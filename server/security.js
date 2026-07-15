const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};
const SESSION_EXPIRES = '2h';
const TEMP_2FA_EXPIRES = '5m';
const ISSUER = 'Dijital Kutuphane Portali';

function addColumn(db, table, column, type) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (_) { /* exists */ }
}

function migrateSecuritySchema(db) {
  addColumn(db, 'users', 'email_dogrulandi', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'totp_secret', 'TEXT');
  addColumn(db, 'users', 'totp_enabled', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'failed_login_count', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'locked_until', 'TEXT');
  addColumn(db, 'users', 'last_login_ip', 'TEXT');
  addColumn(db, 'users', 'last_login_ua', 'TEXT');
  addColumn(db, 'users', 'preferred_locale', "TEXT DEFAULT 'tr'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS security_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS captcha_challenges (
      id TEXT PRIMARY KEY,
      answer_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      user_id INTEGER,
      success INTEGER DEFAULT 0,
      ip_adresi TEXT,
      user_agent TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_security_tokens_token ON security_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
  `);

  // Mevcut demo hesaplarını doğrulanmış say
  db.prepare(`
    UPDATE users SET email_dogrulandi = 1
    WHERE email IS NOT NULL AND email != '' AND (email_dogrulandi IS NULL OR email_dogrulandi = 0)
      AND username IN ('admin', 'kutuphaneci', 'ogrenci1', 'ogrenci2')
  `).run();
}

/* ---------- Captcha (matematik) ---------- */

function createCaptcha(db) {
  db.prepare("DELETE FROM captcha_challenges WHERE expires_at < datetime('now')").run();
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const id = crypto.randomBytes(16).toString('hex');
  const answer = String(a + b);
  const answer_hash = crypto.createHash('sha256').update(answer).digest('hex');
  const expires_at = new Date(Date.now() + CAPTCHA_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO captcha_challenges (id, answer_hash, expires_at) VALUES (?, ?, ?)
  `).run(id, answer_hash, expires_at);
  return { captcha_id: id, question: `${a} + ${b} = ?`, expires_in: Math.floor(CAPTCHA_TTL_MS / 1000) };
}

function verifyCaptcha(db, captchaId, answer) {
  if (!captchaId || answer === undefined || answer === null || answer === '') {
    return { ok: false, error: 'Captcha doğrulaması gerekli' };
  }
  const row = db.prepare('SELECT * FROM captcha_challenges WHERE id = ?').get(captchaId);
  db.prepare('DELETE FROM captcha_challenges WHERE id = ?').run(captchaId);
  if (!row) return { ok: false, error: 'Captcha geçersiz veya süresi dolmuş' };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: 'Captcha süresi dolmuş, yenileyin' };
  }
  const hash = crypto.createHash('sha256').update(String(answer).trim()).digest('hex');
  if (hash !== row.answer_hash) return { ok: false, error: 'Captcha yanıtı hatalı' };
  return { ok: true };
}

/* ---------- TOTP (Google Authenticator uyumlu) ---------- */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const cleaned = String(str).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function verifyTotp(secret, token, window = 1) {
  if (!secret || !token) return false;
  const clean = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const secretBuf = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (hotp(secretBuf, counter + w) === clean) return true;
  }
  return false;
}

function totpOtpauthUrl(secret, username) {
  const label = encodeURIComponent(`${ISSUER}:${username}`);
  const issuer = encodeURIComponent(ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/* ---------- Login lockout ---------- */

function isLocked(user) {
  if (!user?.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

function lockRemainingSeconds(user) {
  if (!isLocked(user)) return 0;
  return Math.max(0, Math.ceil((new Date(user.locked_until) - Date.now()) / 1000));
}

function recordLoginAttempt(db, { username, userId = null, success, ip, ua, reason = null }) {
  db.prepare(`
    INSERT INTO login_attempts (username, user_id, success, ip_adresi, user_agent, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username || null, userId, success ? 1 : 0, ip || null, ua || null, reason);
}

function registerFailedLogin(db, user) {
  if (!user) return null;
  const count = (user.failed_login_count || 0) + 1;
  let locked_until = null;
  if (count >= MAX_FAILED_ATTEMPTS) {
    locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
  }
  db.prepare(`
    UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?
  `).run(count, locked_until, user.id);
  return { count, locked_until };
}

function clearFailedLogins(db, userId) {
  db.prepare(`
    UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?
  `).run(userId);
}

/* ---------- Tokens (email / password reset) ---------- */

function createSecurityToken(db, userId, type) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires_at = new Date(Date.now() + (TOKEN_TTL_MS[type] || TOKEN_TTL_MS.email_verify)).toISOString();
  db.prepare(`
    UPDATE security_tokens SET used_at = datetime('now')
    WHERE user_id = ? AND type = ? AND used_at IS NULL
  `).run(userId, type);
  db.prepare(`
    INSERT INTO security_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)
  `).run(userId, type, token, expires_at);
  return { token, expires_at };
}

function consumeSecurityToken(db, token, type) {
  const row = db.prepare(`
    SELECT * FROM security_tokens WHERE token = ? AND type = ?
  `).get(token, type);
  if (!row) return { ok: false, error: 'Geçersiz veya kullanılmış bağlantı' };
  if (row.used_at) return { ok: false, error: 'Bu bağlantı zaten kullanılmış' };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: 'Bağlantının süresi dolmuş' };
  }
  db.prepare(`UPDATE security_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  return { ok: true, user_id: row.user_id };
}

/* ---------- Session / JWT helpers ---------- */

function signSessionToken(user, JWT_SECRET) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      ad: user.ad,
      soyad: user.soyad,
      session: true,
    },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRES },
  );
}

function signTemp2FAToken(user, JWT_SECRET) {
  return jwt.sign(
    { id: user.id, username: user.username, purpose: '2fa' },
    JWT_SECRET,
    { expiresIn: TEMP_2FA_EXPIRES },
  );
}

function verifyTemp2FAToken(token, JWT_SECRET) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== '2fa') return null;
    return payload;
  } catch {
    return null;
  }
}

function getUserAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 500);
}

function securityPublicProfile(user) {
  return {
    email_dogrulandi: !!user.email_dogrulandi,
    totp_enabled: !!user.totp_enabled,
    email: user.email || null,
    has_email: !!(user.email && String(user.email).trim()),
    failed_login_count: user.failed_login_count || 0,
    locked_until: user.locked_until || null,
    last_login_ip: user.last_login_ip || null,
    session_expires: SESSION_EXPIRES,
    idle_timeout_minutes: 30,
    max_failed_attempts: MAX_FAILED_ATTEMPTS,
    lock_minutes: LOCK_MINUTES,
  };
}

function finishSuccessfulLogin(db, user, req, { notifySuspicious = true } = {}) {
  const ip = require('./auditLog').clientIp(req);
  const ua = getUserAgent(req);
  const prevIp = user.last_login_ip;
  const suspicious = notifySuspicious && prevIp && prevIp !== ip;

  clearFailedLogins(db, user.id);
  db.prepare(`
    UPDATE users SET last_login_ip = ?, last_login_ua = ? WHERE id = ?
  `).run(ip, ua, user.id);

  if (suspicious) {
    try {
      const { sendNotification } = require('./notificationCenter');
      sendNotification(db, user.id, 'supheli_giris', {
        baslik: 'Şüpheli giriş tespit edildi',
        mesaj: `Hesabınıza bilinen IP (${prevIp}) dışında yeni bir IP ile giriş yapıldı: ${ip}. Siz değilseniz şifrenizi değiştirin ve 2FA açın.`,
        link: '/guvenlik',
        oncelik: 'yuksek',
        skipDuplicate: false,
      });
    } catch (_) { /* optional */ }
  }

  return { ip, ua, suspicious, prevIp };
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

module.exports = {
  migrateSecuritySchema,
  createCaptcha,
  verifyCaptcha,
  generateTotpSecret,
  verifyTotp,
  totpOtpauthUrl,
  isLocked,
  lockRemainingSeconds,
  recordLoginAttempt,
  registerFailedLogin,
  clearFailedLogins,
  createSecurityToken,
  consumeSecurityToken,
  signSessionToken,
  signTemp2FAToken,
  verifyTemp2FAToken,
  getUserAgent,
  securityPublicProfile,
  finishSuccessfulLogin,
  hashPassword,
  comparePassword,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  SESSION_EXPIRES,
};
