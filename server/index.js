const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authenticate, authorize, JWT_SECRET } = require('./middleware');
const { syncUserNotifications, syncAllOverdueLoans, upsertOverduePenalty } = require('./notifications');
const {
  NOTIFICATION_TYPES,
  sendNotification,
  getUserPreferences,
  updateUserPreferences,
  listUserNotifications,
  getNotificationStats,
  syncAllUserAlerts,
  broadcastAnnouncement,
  notifyNewBook,
  notifyPenaltyCreated,
  notifyPenaltyPaid,
} = require('./notificationCenter');
const RULES = require('./rules');
const { LIBRARY_ROOMS, TIME_SLOTS, getRoomByRaf, getRoomById } = require('./rooms');
const { STUDY_TIME_SLOTS, getStudyRoomById, getAllStudyRooms } = require('./studyRooms');
const {
  DESK_TIME_SLOTS,
  getFloors,
  getSalonsByFloor,
  getSalonById,
  getDeskById,
  getDeskGrid,
  getSlotByTime,
} = require('./desks');
const {
  EVENT_TYPES,
  seedEvents,
  enrichEvent,
  enrichRegistration,
  getCertificateData,
  registerForEvent,
  markAttendance,
  completeEvent,
} = require('./events');
const {
  RESOURCE_TYPES,
  ACCESS_LEVELS,
  LICENSE_LABELS,
  enrichResource,
  checkAccess,
  recordView,
  recordDownload,
  resolveFilePath,
  isExternalUrl,
} = require('./digitalResources');
const {
  enrichArchiveItem,
  getFilterOptions,
  buildListQuery,
  buildCountQuery,
  applyPagination,
  createSubmission,
  approveSubmission,
  rejectSubmission,
  recordDownload: recordThesisDownload,
} = require('./thesisArchive');
const {
  getBookStatsMaps,
  listBookReviews,
  upsertReview,
  toggleLike,
  reportReview,
  deleteReview,
  listReportedReviews,
} = require('./bookReviews');
const {
  enrichList,
  getListWithItems,
  createList,
  updateList,
  deleteList,
  addBookToList,
  removeBookFromList,
} = require('./readingLists');
const { awardBadges, getGamificationProfile } = require('./gamification');
const { getReadingStats } = require('./readingStats');
const {
  CONDITION_TYPES,
  processLoanReturn,
  listInspections,
  getInspection,
  resolveInspectionPhoto,
} = require('./bookReturnInspection');
const {
  PENALTY_TYPES,
  PENALTY_AMOUNTS,
  hasUnpaidPenalties,
  unpaidPenaltySum,
  listPenalties,
  getPenalty,
  createPenalty,
  markRoomNoShow,
  cancelPenalty,
  applyDiscount,
  createInstallments,
  markPaid,
  updateNote,
  uploadReceipt,
  reviewReceipt,
  resolveReceiptFile,
} = require('./advancedPenalties');
const { getRecommendations } = require('./recommendations');
const {
  COPY_STATUSES,
  syncBookStock,
  createCopy,
  ensureCopiesForBook,
  findAvailableCopy,
  assignCopyToLoan,
  releaseCopy,
  getCopySummary,
  getBookLocationMeta,
} = require('./copies');
const {
  lookupScanCode,
  scanLend,
  scanReturn,
  scanDamage,
  generateMemberQr,
} = require('./scan');
const { getMemberCard, addOneYear } = require('./memberCard');
const { extendLoan, enrichLoanWithExtend } = require('./loanExtensions');
const {
  processExpiredPickups,
  joinQueue,
  cancelQueueEntry,
  getQueueForBook,
  getUserActiveReservation,
  completeReservationOnBorrow,
  findCopyForLoan,
  canUserBorrowBook,
  onBookReturned,
  enrichReservationRow,
  PICKUP_HOURS,
} = require('./reservationQueue');
const {
  getAllBranches,
  getBranchById,
  getBookBranches,
  getBranchStats,
  resolveBranchFilter,
  enrichUserWithBranch,
} = require('./branches');
const {
  TRANSFER_FLOW,
  createTransfer,
  setTransferStatus,
  cancelTransfer,
  getUserTransfers,
  getManageableTransfers,
  getActiveTransferForBook,
} = require('./transfers');
const {
  getStatusMeta: getPurchaseStatusMeta,
  createPurchaseRequest,
  listMyRequests,
  listAllRequests,
  getRequestById,
  getRequestStats,
  updateRequestStatus,
  cancelMyRequest,
} = require('./purchaseRequests');
const {
  getDonationMeta,
  createDonation,
  listMyDonations,
  listAllDonations,
  getDonationById,
  getDonationStats,
  updateDonationStatus,
  cancelMyDonation,
} = require('./bookDonations');
const {
  getDistinctRafs,
  createSession: createInventorySession,
  listSessions: listInventorySessions,
  getSessionDetail: getInventorySession,
  getSessionReport: getInventoryReport,
  scanIntoSession,
  completeSession: completeInventorySession,
  cancelSession: cancelInventorySession,
} = require('./inventoryCount');
const {
  getStaffMeta,
  listStaff,
  getStaffById,
  createStaff,
  updateStaff,
  touchLastLogin,
  listTasks,
  createTask,
  updateTaskStatus,
} = require('./staffManagement');
const {
  createAuditMiddleware,
  logAudit,
  listAuditLogs,
  getAuditStats,
  getAuditMeta,
  clientIp,
} = require('./auditLog');
const {
  createCaptcha,
  verifyCaptcha,
  generateTotpSecret,
  verifyTotp,
  totpOtpauthUrl,
  isLocked,
  lockRemainingSeconds,
  recordLoginAttempt,
  registerFailedLogin,
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
} = require('./security');
const { verifyRecaptcha } = require('./recaptcha');
const {
  listClubs,
  getClub,
  createClub,
  updateClub,
  joinClub,
  leaveClub,
  setMonthlyBook,
  getMonthlyBooks,
  createMeeting,
  updateMeeting,
  getDiscussions,
  addDiscussion,
  deleteDiscussion,
  getClubStats,
} = require('./clubs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(createAuditMiddleware(db));

const LOAN_DAYS = RULES.LOAN_DAYS;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isBookAvailable(book) {
  const rafta = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE book_id = ? AND fiziksel_durum = 'rafta'
  `).get(book.id)?.c;
  if (rafta !== undefined && rafta > 0) return true;
  return book.stok > 0 && book.durum === 'mevcut';
}

function isBookBorrowableForUser(bookId, userId) {
  processExpiredPickups(db);
  return canUserBorrowBook(db, bookId, userId);
}

function countStudyRoomSlotBookings(roomId, tarih, baslangic) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM room_reservations
    WHERE room_id = ? AND tarih = ? AND baslangic = ? AND durum IN ('beklemede', 'onaylandi')
  `).get(roomId, tarih, baslangic).c;
}

function getStudyRoomSlotAvailability(roomId, tarih) {
  const room = getStudyRoomById(roomId);
  if (!room) return null;
  return STUDY_TIME_SLOTS.map((slot) => {
    const dolu = countStudyRoomSlotBookings(roomId, tarih, slot.baslangic);
    const musait = dolu === 0;
    return {
      ...slot,
      dolu,
      musait,
      rezerve: !musait,
    };
  });
}

function countRoomSlotBookings(roomId, tarih, baslangic) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM room_reservations
    WHERE room_id = ? AND tarih = ? AND baslangic = ? AND durum IN ('beklemede', 'onaylandi')
  `).get(roomId, tarih, baslangic).c;
}

function getRoomSlotAvailability(roomId, tarih) {
  const room = getRoomById(roomId);
  if (!room) return null;
  return TIME_SLOTS.map((slot) => {
    const dolu = countRoomSlotBookings(roomId, tarih, slot.baslangic);
    return {
      ...slot,
      dolu,
      kapasite: room.kapasite,
      musait: dolu < room.kapasite,
      kalan: room.kapasite - dolu,
    };
  });
}

// --- AUTH & SECURITY ---
function buildSafeUser(user) {
  const { password, totp_secret, ...rest } = user;
  return {
    ...enrichUserWithBranch(db, rest),
    security: securityPublicProfile(user),
  };
}

function completeLoginResponse(req, res, user) {
  if (user.role === 'member') syncUserNotifications(db, user.id);
  touchLastLogin(db, user.id);
  user.son_giris_tarihi = new Date().toISOString();
  const { ip, suspicious } = finishSuccessfulLogin(db, user, req);

  logAudit(db, {
    user,
    action: 'giris',
    entity_type: 'auth',
    ozet: suspicious
      ? `Şüpheli giriş: ${user.username} (${user.role}) — IP ${ip}`
      : `Sisteme giriş: ${user.username} (${user.role})`,
    ip_adresi: ip,
    method: 'POST',
    path: '/api/auth/login',
  });

  const token = signSessionToken(user, JWT_SECRET);
  res.json({ token, user: buildSafeUser(user), suspicious });
}

app.get('/api/auth/captcha', (req, res) => {
  res.json(createCaptcha(db));
});

app.get('/api/auth/recaptcha-key', (_req, res) => {
  res.json({ siteKey: process.env.RECAPTCHA_SITE_KEY || '6LcP4FQtAAAAAGByd_ns5o4pRFdTmuqqHw3WKs1H' });
});

app.get('/api/auth/security-info', (req, res) => {
  res.json({
    features: {
      password_hash: 'bcrypt',
      rbac: true,
      two_factor: true,
      google_authenticator: true,
      email_verification: true,
      forgot_password: true,
      failed_login_limit: MAX_FAILED_ATTEMPTS,
      lock_minutes: LOCK_MINUTES,
      session_timeout: '2h',
      idle_timeout_minutes: 30,
      suspicious_login_notify: true,
      admin_audit_logs: true,
      captcha: true,
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password, captcha_id, captcha_answer, recaptcha_token } = req.body;
  const ip = clientIp(req);
  const ua = getUserAgent(req);

  const captcha = verifyCaptcha(db, captcha_id, captcha_answer);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  if (recaptcha_token) {
    const rc = await verifyRecaptcha(recaptcha_token);
    if (!rc.ok) return res.status(400).json({ error: rc.error });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user && isLocked(user)) {
    const sec = lockRemainingSeconds(user);
    recordLoginAttempt(db, { username, userId: user.id, success: false, ip, ua, reason: 'locked' });
    return res.status(429).json({
      error: `Hesap geçici olarak kilitlendi. ${Math.ceil(sec / 60)} dk sonra tekrar deneyin.`,
      locked_until: user.locked_until,
      remaining_seconds: sec,
    });
  }

  if (!user || !comparePassword(password, user.password)) {
    if (user) {
      const fail = registerFailedLogin(db, user);
      recordLoginAttempt(db, { username, userId: user.id, success: false, ip, ua, reason: 'bad_password' });
      if (fail?.locked_until) {
        return res.status(429).json({
          error: `Çok fazla hatalı deneme. Hesap ${LOCK_MINUTES} dakika kilitlendi.`,
          locked_until: fail.locked_until,
        });
      }
      const left = MAX_FAILED_ATTEMPTS - fail.count;
      return res.status(401).json({
        error: `Kullanıcı adı veya şifre hatalı. Kalan deneme: ${left}`,
        remaining_attempts: left,
      });
    }
    recordLoginAttempt(db, { username, success: false, ip, ua, reason: 'unknown_user' });
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }

  if (user.role === 'member' && user.uyelik_durumu !== 'aktif') {
    recordLoginAttempt(db, { username, userId: user.id, success: false, ip, ua, reason: 'inactive' });
    return res.status(403).json({ error: 'Üyeliğiniz aktif değil' });
  }

  if (user.totp_enabled) {
    const temp_token = signTemp2FAToken(user, JWT_SECRET);
    recordLoginAttempt(db, { username, userId: user.id, success: false, ip, ua, reason: 'awaiting_2fa' });
    return res.json({
      requires_2fa: true,
      temp_token,
      message: 'Google Authenticator kodunu girin',
    });
  }

  recordLoginAttempt(db, { username, userId: user.id, success: true, ip, ua, reason: 'ok' });
  completeLoginResponse(req, res, user);
});

app.post('/api/auth/login/2fa', (req, res) => {
  const { temp_token, code } = req.body;
  const payload = verifyTemp2FAToken(temp_token, JWT_SECRET);
  if (!payload) {
    return res.status(401).json({ error: '2FA oturumu geçersiz veya süresi dolmuş. Tekrar giriş yapın.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.totp_enabled) {
    return res.status(400).json({ error: 'İki aşamalı doğrulama bu hesapta aktif değil' });
  }
  if (!verifyTotp(user.totp_secret, code)) {
    const fail = registerFailedLogin(db, user);
    recordLoginAttempt(db, {
      username: user.username,
      userId: user.id,
      success: false,
      ip: clientIp(req),
      ua: getUserAgent(req),
      reason: 'bad_2fa',
    });
    if (fail?.locked_until) {
      return res.status(429).json({ error: `Çok fazla hatalı 2FA. Hesap ${LOCK_MINUTES} dakika kilitlendi.` });
    }
    return res.status(401).json({ error: 'Doğrulama kodu hatalı' });
  }
  if (isLocked(user)) {
    return res.status(429).json({ error: 'Hesap geçici olarak kilitli' });
  }
  recordLoginAttempt(db, {
    username: user.username,
    userId: user.id,
    success: true,
    ip: clientIp(req),
    ua: getUserAgent(req),
    reason: '2fa_ok',
  });
  completeLoginResponse(req, res, user);
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, ad, soyad, email, telefon, okul_no, bolum, captcha_id, captcha_answer, recaptcha_token } = req.body;
  const role = 'member';

  const captcha = verifyCaptcha(db, captcha_id, captcha_answer);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  if (recaptcha_token) {
    const rc = await verifyRecaptcha(recaptcha_token);
    if (!rc.ok) return res.status(400).json({ error: rc.error });
  }

  if (!username || !password || !ad || !soyad) {
    return res.status(400).json({ error: 'Kullanıcı adı, şifre, ad ve soyad zorunludur' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
  }
  if (!okul_no) {
    return res.status(400).json({ error: 'Öğrenci kaydı için okul numarası zorunludur' });
  }
  if (!email) {
    return res.status(400).json({ error: 'E-posta adresi zorunludur (doğrulama için)' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });

  const existingNo = db.prepare("SELECT id FROM users WHERE okul_no = ? AND role = 'member'").get(okul_no);
  if (existingNo) return res.status(400).json({ error: 'Bu okul numarası zaten kayıtlı' });

  try {
    const hash = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (username, password, role, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu, email_dogrulandi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 0)
    `).run(username, hash, role, ad, soyad, okul_no, email, telefon || null, bolum || null);

    const qr = `UYE-${okul_no}`;
    const bitis = addOneYear(new Date().toISOString());
    db.prepare('UPDATE users SET uye_karti_qr = ?, uyelik_bitis_tarihi = ? WHERE id = ?')
      .run(qr, bitis, result.lastInsertRowid);

    const { token: verifyToken } = createSecurityToken(db, result.lastInsertRowid, 'email_verify');
    const verifyPath = `/email-dogrula?token=${verifyToken}`;

    try {
      sendNotification(db, result.lastInsertRowid, 'sistem_duyurusu', {
        baslik: 'E-posta doğrulama',
        mesaj: `Hesabınızı doğrulamak için bağlantıyı açın (demo): ${verifyPath}`,
        link: verifyPath,
        skipDuplicate: false,
      });
    } catch (_) { /* optional */ }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const sessionToken = signSessionToken(user, JWT_SECRET);
    res.status(201).json({
      token: sessionToken,
      user: buildSafeUser(user),
      message: 'Hesap oluşturuldu. E-posta doğrulama bağlantısı bildiriminize eklendi.',
      demo_email_verify_url: verifyPath,
    });
  } catch (e) {
    res.status(400).json({ error: 'Kayıt oluşturulamadı' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { username, email, captcha_id, captcha_answer, recaptcha_token } = req.body;
  const captcha = verifyCaptcha(db, captcha_id, captcha_answer);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  if (recaptcha_token) {
    const rc = await verifyRecaptcha(recaptcha_token);
    if (!rc.ok) return res.status(400).json({ error: rc.error });
  }

  const generic = {
    message: 'Eşleşen bir hesap varsa şifre sıfırlama bağlantısı oluşturuldu.',
  };

  let user = null;
  if (username) user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  else if (email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) return res.json(generic);

  const { token } = createSecurityToken(db, user.id, 'password_reset');
  const resetPath = `/sifre-sifirla?token=${token}`;
  try {
    sendNotification(db, user.id, 'sistem_duyurusu', {
      baslik: 'Şifre sıfırlama',
      mesaj: `Şifrenizi sıfırlamak için (demo): ${resetPath}`,
      link: resetPath,
      skipDuplicate: false,
    });
  } catch (_) { /* optional */ }

  res.json({
    ...generic,
    demo_reset_url: resetPath,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ve yeni şifre gerekli' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });

  const consumed = consumeSecurityToken(db, token, 'password_reset');
  if (!consumed.ok) return res.status(400).json({ error: consumed.error });

  db.prepare('UPDATE users SET password = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?')
    .run(hashPassword(password), consumed.user_id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(consumed.user_id);
  logAudit(db, {
    user,
    action: 'sifre_sifirlama',
    entity_type: 'auth',
    ozet: `Şifre sıfırlandı: ${user.username}`,
    ip_adresi: clientIp(req),
    method: 'POST',
    path: '/api/auth/reset-password',
  });

  res.json({ message: 'Şifreniz güncellendi. Giriş yapabilirsiniz.' });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Doğrulama tokenı gerekli' });
  const consumed = consumeSecurityToken(db, token, 'email_verify');
  if (!consumed.ok) return res.status(400).json({ error: consumed.error });
  db.prepare('UPDATE users SET email_dogrulandi = 1 WHERE id = ?').run(consumed.user_id);
  res.json({ message: 'E-posta adresiniz doğrulandı.' });
});

app.post('/api/auth/resend-verification', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.email) return res.status(400).json({ error: 'Hesabınızda e-posta yok' });
  if (user.email_dogrulandi) return res.json({ message: 'E-posta zaten doğrulanmış' });
  const { token } = createSecurityToken(db, user.id, 'email_verify');
  const verifyPath = `/email-dogrula?token=${token}`;
  sendNotification(db, user.id, 'sistem_duyurusu', {
    baslik: 'E-posta doğrulama',
    mesaj: `Doğrulama bağlantısı (demo): ${verifyPath}`,
    link: verifyPath,
    skipDuplicate: false,
  });
  res.json({ message: 'Doğrulama bağlantısı gönderildi (bildirim).', demo_email_verify_url: verifyPath });
});

app.get('/api/auth/security', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(securityPublicProfile(user));
});

app.put('/api/auth/locale', authenticate, (req, res) => {
  const allowed = ['tr', 'en', 'de', 'ar'];
  const { locale } = req.body;
  if (!allowed.includes(locale)) {
    return res.status(400).json({ error: 'Geçersiz dil kodu. Desteklenen: tr, en, de, ar' });
  }
  db.prepare('UPDATE users SET preferred_locale = ? WHERE id = ?').run(locale, req.user.id);
  res.json({ message: 'Dil tercihi kaydedildi', preferred_locale: locale });
});

app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
  }
  if (new_password.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!comparePassword(current_password, user.password)) {
    return res.status(401).json({ error: 'Mevcut şifre hatalı' });
  }
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(new_password), user.id);
  logAudit(db, {
    user,
    action: 'sifre_degistirme',
    entity_type: 'auth',
    ozet: `Şifre değiştirildi: ${user.username}`,
    ip_adresi: clientIp(req),
    method: 'POST',
    path: '/api/auth/change-password',
  });
  res.json({ message: 'Şifreniz güncellendi' });
});

app.post('/api/auth/2fa/setup', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.totp_enabled) {
    return res.status(400).json({ error: '2FA zaten aktif. Önce kapatın.' });
  }
  const secret = generateTotpSecret();
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, user.id);
  const otpauth_url = totpOtpauthUrl(secret, user.username);
  res.json({
    secret,
    otpauth_url,
    message: 'Google Authenticator ile QR kodu tarayın, ardından gelen kodu onaylayın.',
  });
});

app.post('/api/auth/2fa/enable', authenticate, (req, res) => {
  const { code } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_secret) return res.status(400).json({ error: 'Önce 2FA kurulumu başlatın' });
  if (!verifyTotp(user.totp_secret, code)) {
    return res.status(401).json({ error: 'Doğrulama kodu hatalı' });
  }
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  logAudit(db, {
    user,
    action: '2fa_aktif',
    entity_type: 'auth',
    ozet: `2FA etkinleştirildi: ${user.username}`,
    ip_adresi: clientIp(req),
    method: 'POST',
    path: '/api/auth/2fa/enable',
  });
  res.json({ message: 'İki aşamalı doğrulama aktif', totp_enabled: true });
});

app.post('/api/auth/2fa/disable', authenticate, (req, res) => {
  const { password, code } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!comparePassword(password, user.password)) {
    return res.status(401).json({ error: 'Şifre hatalı' });
  }
  if (user.totp_enabled && !verifyTotp(user.totp_secret, code)) {
    return res.status(401).json({ error: 'Doğrulama kodu hatalı' });
  }
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
  logAudit(db, {
    user,
    action: '2fa_kapatildi',
    entity_type: 'auth',
    ozet: `2FA kapatıldı: ${user.username}`,
    ip_adresi: clientIp(req),
    method: 'POST',
    path: '/api/auth/2fa/disable',
  });
  res.json({ message: 'İki aşamalı doğrulama kapatıldı', totp_enabled: false });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  if (req.user.role === 'member') syncUserNotifications(db, req.user.id);
  const user = db.prepare(`
    SELECT id, username, role, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu, uye_karti_qr, branch_id, tercih_sube_id,
           email_dogrulandi, totp_enabled, failed_login_count, locked_until, last_login_ip, preferred_locale
    FROM users WHERE id = ?
  `).get(req.user.id);
  if (user.role === 'member') {
    user.uye_karti_qr = user.uye_karti_qr || generateMemberQr(user);
    user.qr_url = `https://kutuphane.edu.tr/uye/${user.uye_karti_qr}`;
  }
  const enriched = enrichUserWithBranch(db, user);
  enriched.security = securityPublicProfile(user);
  res.json(enriched);
});

// --- DİJİTAL ÜYE KARTI ---
app.get('/api/members/card', authenticate, authorize('member'), (req, res) => {
  syncUserNotifications(db, req.user.id);
  const card = getMemberCard(db, req.user.id);
  if (!card) return res.status(404).json({ error: 'Üye kartı bulunamadı' });
  res.json(card);
});

app.put('/api/members/photo', authenticate, authorize('member'), (req, res) => {
  const { profil_foto } = req.body;
  if (profil_foto && profil_foto.length > 600000) {
    return res.status(400).json({ error: 'Fotoğraf çok büyük (max ~400KB)' });
  }
  if (profil_foto && !profil_foto.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Geçersiz fotoğraf formatı' });
  }
  db.prepare('UPDATE users SET profil_foto = ? WHERE id = ?').run(profil_foto || null, req.user.id);
  res.json({ message: profil_foto ? 'Profil fotoğrafı güncellendi' : 'Profil fotoğrafı kaldırıldı' });
});

// Sistem kuralları (herkese açık)
app.get('/api/rules', (req, res) => {
  res.json({
    max_kitap: RULES.MAX_LOANS_PER_MEMBER,
    odunc_suresi_gun: RULES.LOAN_DAYS,
    gecikme_cezasi_gunluk: RULES.PENALTY_PER_DAY_TL,
    teslim_uyari_gun: RULES.DUE_SOON_DAYS,
    rezervasyon_alma_saati: RULES.RESERVATION_PICKUP_HOURS,
    max_uzatma: RULES.MAX_LOAN_EXTENSIONS,
    uzatma_gun: RULES.EXTENSION_DAYS,
  });
});

// --- NOTIFICATIONS ---
app.get('/api/notifications/types', authenticate, (req, res) => {
  res.json({
    turler: Object.values(NOTIFICATION_TYPES),
    kanallar: [
      { id: 'app', ad: 'Sistem içi' },
      { id: 'email', ad: 'E-posta' },
      { id: 'sms', ad: 'SMS' },
      { id: 'push', ad: 'Mobil bildirim' },
    ],
  });
});

app.get('/api/notifications', authenticate, (req, res) => {
  if (req.user.role === 'member') syncAllUserAlerts(db, req.user.id);
  const tur = req.query.tur || null;
  const notifications = listUserNotifications(db, req.user.id, { tur, limit: 80 });
  const stats = getNotificationStats(db, req.user.id);
  res.json({ notifications, stats });
});

app.get('/api/notifications/preferences', authenticate, (req, res) => {
  res.json(getUserPreferences(db, req.user.id));
});

app.put('/api/notifications/preferences', authenticate, (req, res) => {
  const prefs = updateUserPreferences(db, req.user.id, req.body.preferences);
  res.json({ message: 'Bildirim tercihleri güncellendi', preferences: prefs });
});

app.get('/api/notifications/deliveries', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, n.baslik, n.tur
    FROM notification_deliveries d
    LEFT JOIN notifications n ON d.notification_id = n.id
    WHERE d.user_id = ?
    ORDER BY d.tarih DESC LIMIT 30
  `).all(req.user.id);
  res.json(rows);
});

app.put('/api/notifications/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET okundu = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Bildirim okundu' });
});

app.put('/api/notifications/read-all', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET okundu = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Tüm bildirimler okundu' });
});

app.post('/api/notifications/announce', authenticate, authorize('admin'), (req, res) => {
  const { baslik, mesaj, hedef } = req.body;
  if (!baslik || !mesaj) return res.status(400).json({ error: 'Başlık ve mesaj zorunlu' });
  const result = broadcastAnnouncement(db, { baslik, mesaj, hedef: hedef || 'members' });
  res.json({ message: `${result.count} kullanıcıya duyuru gönderildi`, ...result });
});

// --- BRANCHES ---
app.get('/api/branches', authenticate, (req, res) => {
  res.json(getAllBranches(db));
});

app.get('/api/branches/:id/stats', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const branchId = parseInt(req.params.id, 10);
  const scope = resolveBranchFilter(db, req.user, branchId);
  if (req.user.role === 'librarian' && scope !== branchId) {
    return res.status(403).json({ error: 'Bu şubenin istatistiklerine erişemezsiniz' });
  }
  const stats = getBranchStats(db, branchId);
  if (!stats) return res.status(404).json({ error: 'Şube bulunamadı' });
  res.json(stats);
});

app.put('/api/branches/:id', authenticate, authorize('admin'), (req, res) => {
  const { adres, hafta_ici, cumartesi, pazar } = req.body;
  const branch = getBranchById(db, req.params.id);
  if (!branch) return res.status(404).json({ error: 'Şube bulunamadı' });
  db.prepare(`
    UPDATE library_branches SET
      adres = COALESCE(?, adres),
      hafta_ici = COALESCE(?, hafta_ici),
      cumartesi = COALESCE(?, cumartesi),
      pazar = COALESCE(?, pazar)
    WHERE id = ?
  `).run(adres || null, hafta_ici || null, cumartesi || null, pazar || null, req.params.id);
  res.json({ message: 'Şube güncellendi' });
});

// --- TRANSFERS (Şubeler arası kitap transferi) ---
app.get('/api/transfers/flow', authenticate, (req, res) => {
  res.json(TRANSFER_FLOW.map((s) => ({ durum: s.durum, label: s.label })));
});

app.post('/api/transfers', authenticate, authorize('member'), (req, res) => {
  const { book_id, kaynak_sube_id, hedef_sube_id } = req.body;
  if (!book_id || !kaynak_sube_id || !hedef_sube_id) {
    return res.status(400).json({ error: 'Kitap, kaynak ve hedef şube zorunludur' });
  }
  const result = createTransfer(db, req.user.id, book_id, kaynak_sube_id, hedef_sube_id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.get('/api/transfers/my', authenticate, authorize('member'), (req, res) => {
  syncUserNotifications(db, req.user.id);
  res.json(getUserTransfers(db, req.user.id));
});

app.get('/api/transfers', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(getManageableTransfers(db, req.user, req.query.durum));
});

app.put('/api/transfers/:id/status', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { durum } = req.body;
  const result = setTransferStatus(db, req.params.id, durum, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.delete('/api/transfers/:id', authenticate, (req, res) => {
  const result = cancelTransfer(db, req.params.id, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/members/me/branch', authenticate, authorize('member'), (req, res) => {
  const { tercih_sube_id } = req.body;
  if (!tercih_sube_id) return res.status(400).json({ error: 'Teslim şubesi seçilmelidir' });
  const branch = getBranchById(db, tercih_sube_id);
  if (!branch || !branch.aktif) return res.status(404).json({ error: 'Şube bulunamadı' });
  db.prepare('UPDATE users SET tercih_sube_id = ? WHERE id = ?').run(tercih_sube_id, req.user.id);
  const user = db.prepare('SELECT id, username, role, ad, soyad, tercih_sube_id FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: 'Teslim şubeniz güncellendi', user: enrichUserWithBranch(db, user) });
});

// --- ROOMS ---
app.get('/api/rooms', authenticate, (req, res) => {
  const counts = db.prepare(`
    SELECT oda, COUNT(*) as kitap_sayisi FROM books WHERE oda IS NOT NULL GROUP BY oda
  `).all();
  const countMap = Object.fromEntries(counts.map((c) => [c.oda, c.kitap_sayisi]));
  res.json(LIBRARY_ROOMS.map((room) => ({
    ...room,
    kitap_sayisi: countMap[room.id] || 0,
  })));
});

// --- BOOKS ---
app.get('/api/books', authenticate, (req, res) => {
  const { search, kategori, oda, branch_id } = req.query;
  const branchFilter = resolveBranchFilter(db, req.user, branch_id);
  let sql = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (ad LIKE ? OR yazar LIKE ? OR isbn LIKE ? OR kategori LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (kategori) {
    sql += ' AND kategori = ?';
    params.push(kategori);
  }
  if (oda) {
    sql += ' AND oda = ?';
    params.push(oda);
  }
  if (branchFilter) {
    sql += ' AND EXISTS (SELECT 1 FROM book_copies c WHERE c.book_id = books.id AND c.branch_id = ?)';
    params.push(branchFilter);
  }
  sql += ' ORDER BY ad';
  const books = db.prepare(sql).all(...params);

  if (req.user.role === 'member' && (search || kategori)) {
    db.prepare('INSERT INTO search_logs (user_id, search, kategori) VALUES (?, ?, ?)').run(
      req.user.id, search || null, kategori || null
    );
  }

  const favoriteIds = req.user.role === 'member'
    ? new Set(db.prepare('SELECT book_id FROM favorites WHERE user_id = ?').all(req.user.id).map((f) => f.book_id))
    : new Set();

  const ratingMap = req.user.role === 'member'
    ? Object.fromEntries(db.prepare('SELECT book_id, puan FROM ratings WHERE user_id = ?').all(req.user.id).map((r) => [r.book_id, r.puan]))
    : {};

  const avgRatings = Object.fromEntries(
    db.prepare('SELECT book_id, ROUND(AVG(puan), 1) as ort FROM ratings GROUP BY book_id').all().map((r) => [r.book_id, r.ort])
  );

  const { yorumCounts, viewCounts, favoriCounts, puanCounts } = getBookStatsMaps(db);

  processExpiredPickups(db);

  const queueCounts = Object.fromEntries(
    db.prepare(`
      SELECT book_id, COUNT(*) as c FROM reservations
      WHERE durum IN ('beklemede', 'hazir') GROUP BY book_id
    `).all().map((r) => [r.book_id, r.c])
  );

  const userReservations = req.user.role === 'member'
    ? Object.fromEntries(
      db.prepare(`
        SELECT book_id, durum, sira_no, hazir_bitis FROM reservations
        WHERE user_id = ? AND durum IN ('beklemede', 'hazir')
      `).all(req.user.id).map((r) => [r.book_id, r])
    )
    : {};

  res.json(books.map((b) => {
    const userRes = userReservations[b.id];
    const subeler = getBookBranches(db, b.id);
    const branchInfo = branchFilter ? subeler.find((s) => s.id === branchFilter) : null;
    const borrowable = req.user.role === 'member'
      ? isBookBorrowableForUser(b.id, req.user.id)
      : isBookAvailable(b);
    const transfer = req.user.role === 'member'
      ? getActiveTransferForBook(db, req.user.id, b.id)
      : null;
    return {
      ...b,
      musait: borrowable,
      subeler,
      benim_transferim: transfer,
      sube_stok: branchInfo?.musait_kopya ?? null,
      sira_sayisi: queueCounts[b.id] || 0,
      benim_siram: userRes ? enrichReservationRow(userRes) : null,
      oda_adi: getRoomById(b.oda)?.ad || null,
      favori: favoriteIds.has(b.id),
      kullanici_puani: ratingMap[b.id] || null,
      ortalama_puan: avgRatings[b.id] || null,
      puan_sayisi: puanCounts[b.id] || 0,
      yorum_sayisi: yorumCounts[b.id] || 0,
      goruntulenme_sayisi: viewCounts[b.id] || 0,
      favori_sayisi: favoriCounts[b.id] || 0,
      kopya_ozet: getCopySummary(db, b.id),
    };
  }));
});

app.get('/api/books/categories', authenticate, (req, res) => {
  const cats = db.prepare('SELECT DISTINCT kategori FROM books WHERE kategori IS NOT NULL ORDER BY kategori').all();
  res.json(cats.map(c => c.kategori));
});

app.post('/api/books', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, stok, durum } = req.body;
  if (!ad || !yazar) return res.status(400).json({ error: 'Kitap adı ve yazar zorunludur' });
  try {
    const room = getRoomByRaf(raf_no);
    const result = db.prepare(`
      INSERT INTO books (ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, stok, durum, oda)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, stok || 1, durum || 'mevcut', room?.id || null);
    const bookId = result.lastInsertRowid;
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    const copyCount = parseInt(stok, 10) || 1;
    const branchId = resolveBranchFilter(db, req.user, req.body.branch_id);
    for (let i = 1; i <= copyCount; i++) {
      createCopy(db, book, i, 'rafta', { branch_id: branchId });
    }
    syncBookStock(db, bookId);
    notifyNewBook(db, book);
    res.status(201).json({ id: bookId, message: 'Kitap ve kopyalar eklendi' });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Bu ISBN zaten kayıtlı' : 'Kitap eklenemedi' });
  }
});

app.put('/api/books/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, stok, durum } = req.body;
  const room = getRoomByRaf(raf_no);
  db.prepare(`
    UPDATE books SET ad=?, yazar=?, kategori=?, isbn=?, yayinevi=?, basim_yili=?, raf_no=?, stok=?, durum=?, oda=?
    WHERE id=?
  `).run(ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, stok, durum, room?.id || null, req.params.id);
  const targetStok = parseInt(stok, 10) || 0;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  const currentTotal = db.prepare('SELECT COUNT(*) as c FROM book_copies WHERE book_id = ?').get(req.params.id).c;
  if (targetStok > currentTotal) {
    ensureCopiesForBook(db, req.params.id, targetStok);
  }
  syncBookStock(db, req.params.id);
  res.json({ message: 'Kitap güncellendi' });
});

app.delete('/api/books/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const activeLoan = db.prepare("SELECT id FROM loans WHERE book_id = ? AND durum IN ('aktif', 'gecikti')").get(req.params.id);
  if (activeLoan) return res.status(400).json({ error: 'Bu kitap şu an ödünçte, silinemez' });
  const book = db.prepare('SELECT id, ad, yazar, isbn FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  req.audit = {
    action: 'kitap_silme',
    entity_type: 'book',
    entity_id: book.id,
    ozet: `Kitap silindi: "${book.ad}" (${book.yazar})`,
    detay: { isbn: book.isbn },
  };
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kitap silindi' });
});

// --- MEMBERS (Admin) ---
app.get('/api/members', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const members = db.prepare(`
    SELECT id, username, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu, created_at
    FROM users WHERE role = 'member' ORDER BY soyad, ad
  `).all();
  res.json(members);
});

app.post('/api/members', authenticate, authorize('admin'), (req, res) => {
  const { username, password, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu } = req.body;
  if (!username || !password || !ad || !soyad) {
    return res.status(400).json({ error: 'Kullanıcı adı, şifre, ad ve soyad zorunludur' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password, role, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu)
      VALUES (?, ?, 'member', ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hash, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu || 'aktif');
    const qr = okul_no ? `UYE-${okul_no}` : `UYE-${result.lastInsertRowid}`;
    const bitis = addOneYear(new Date().toISOString());
    db.prepare('UPDATE users SET uye_karti_qr = ?, uyelik_bitis_tarihi = ? WHERE id = ?')
      .run(qr, bitis, result.lastInsertRowid);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Üye kaydı oluşturuldu' });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Bu kullanıcı adı zaten kayıtlı' : 'Üye oluşturulamadı' });
  }
});

app.put('/api/members/:id', authenticate, authorize('admin'), (req, res) => {
  const { ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu } = req.body;
  db.prepare(`
    UPDATE users SET ad=?, soyad=?, okul_no=?, email=?, telefon=?, bolum=?, uyelik_durumu=?
    WHERE id=? AND role='member'
  `).run(ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu, req.params.id);
  res.json({ message: 'Üye güncellendi' });
});

// --- STAFF (Personel Yönetimi) ---
app.get('/api/staff/meta', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(getStaffMeta());
});

app.get('/api/staff', authenticate, authorize('admin'), (req, res) => {
  res.json(listStaff(db, { role: req.query.role || null }));
});

app.get('/api/staff/:id', authenticate, authorize('admin'), (req, res) => {
  const staff = getStaffById(db, req.params.id);
  if (!staff) return res.status(404).json({ error: 'Personel bulunamadı' });
  res.json(staff);
});

app.post('/api/staff', authenticate, authorize('admin'), (req, res) => {
  const result = createStaff(db, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/staff/:id', authenticate, authorize('admin'), (req, res) => {
  const result = updateStaff(db, req.params.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/staff-tasks', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const assignedTo = req.user.role === 'librarian'
    ? req.user.id
    : (req.query.assigned_to ? parseInt(req.query.assigned_to, 10) : null);
  res.json(listTasks(db, {
    assigned_to: assignedTo || null,
    durum: req.query.durum || null,
  }));
});

app.post('/api/staff-tasks', authenticate, authorize('admin'), (req, res) => {
  const result = createTask(db, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/staff-tasks/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = updateTaskStatus(db, req.params.id, req.body, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- LOANS ---
app.post('/api/loans', authenticate, (req, res) => {
  const { book_id, user_id } = req.body;

  if (req.user.role === 'member') {
    if (user_id && user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sadece kendi adınıza ödünç alabilirsiniz' });
    }
  } else if (!['admin', 'librarian'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  const targetUserId = req.user.role === 'member' ? req.user.id : user_id;
  if (!targetUserId) return res.status(400).json({ error: 'Üye seçilmedi' });

  const member = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'member'").get(targetUserId);
  if (!member) return res.status(404).json({ error: 'Üye bulunamadı' });
  if (member.uyelik_durumu !== 'aktif') return res.status(400).json({ error: 'Üyelik aktif değil' });

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });

  const copy = req.user.role === 'member'
    ? findCopyForLoan(db, book_id, targetUserId)
    : findAvailableCopy(db, book_id);
  if (!copy) {
    const hazir = getUserActiveReservation(db, targetUserId, book_id);
    if (hazir?.durum === 'beklemede') {
      return res.status(400).json({ error: 'Sıranız gelmedi. Kitap hazır olduğunda bildirim alacaksınız.' });
    }
    return res.status(400).json({ error: 'Müsait fiziksel kopya yok' });
  }

  const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum IN ('aktif', 'gecikti')").get(targetUserId);
  if (activeLoans.c >= RULES.MAX_LOANS_PER_MEMBER) {
    return res.status(400).json({ error: `Maksimum ${RULES.MAX_LOANS_PER_MEMBER} kitap ödünç alınabilir` });
  }

  const unpaid = hasUnpaidPenalties(db, targetUserId);
  if (unpaid) return res.status(400).json({ error: 'Ödenmemiş ceza var, ödünç alınamaz' });

  const teslim = addDays(new Date(), LOAN_DAYS);
  const result = db.prepare(`
    INSERT INTO loans (user_id, book_id, copy_id, teslim_tarihi, durum) VALUES (?, ?, ?, ?, 'aktif')
  `).run(targetUserId, book_id, copy.id, teslim);

  assignCopyToLoan(db, copy.id);
  syncBookStock(db, book_id);
  completeReservationOnBorrow(db, targetUserId, book_id);

  res.status(201).json({
    id: result.lastInsertRowid,
    teslim_tarihi: teslim,
    message: 'Ödünç verildi',
    kopya: { id: copy.id, barkod: copy.barkod, kopya_no: copy.kopya_no },
  });
});

app.post('/api/loans/:id/return', authenticate, (req, res) => {
  const loan = db.prepare("SELECT * FROM loans WHERE id = ? AND durum IN ('aktif', 'gecikti')").get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Aktif ödünç bulunamadı' });

  if (req.user.role === 'member' && Number(loan.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Sadece kendi ödünç kitaplarınızı iade edebilirsiniz' });
  }
  if (!['admin', 'librarian', 'member'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  const inspection = isStaff ? {
    kitap_durumu: req.body.kitap_durumu || 'iyi',
    aciklama: req.body.aciklama,
    foto: req.body.foto,
    foto_adi: req.body.foto_adi,
  } : { kitap_durumu: 'iyi' };

  const result = processLoanReturn(db, loan, isStaff ? req.user.id : null, inspection);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });

  const newBadges = awardBadges(db, loan.user_id);
  res.json({ ...result, yeni_rozetler: newBadges });
});

app.get('/api/loans/all', authenticate, authorize('admin'), (req, res) => {
  const loans = db.prepare(`
    SELECT l.id, l.odunc_tarihi, l.teslim_tarihi, l.iade_tarihi, l.durum,
           u.ad, u.soyad, u.okul_no, b.ad as kitap_adi, b.yazar, b.isbn
    FROM loans l
    JOIN users u ON l.user_id = u.id
    JOIN books b ON l.book_id = b.id
    ORDER BY l.odunc_tarihi DESC
  `).all();
  res.json(loans);
});

app.get('/api/loans/active', authenticate, authorize('librarian', 'admin'), (req, res) => {
  syncAllOverdueLoans(db);
  const branchFilter = resolveBranchFilter(db, req.user, req.query.branch_id);
  let sql = `
    SELECT l.*, u.ad, u.soyad, u.okul_no, b.ad as kitap_adi, b.isbn, b.raf_no,
           c.barkod, c.kopya_no, c.qr_kod, c.sube, lb.ad as sube_adi
    FROM loans l
    JOIN users u ON l.user_id = u.id
    JOIN books b ON l.book_id = b.id
    LEFT JOIN book_copies c ON l.copy_id = c.id
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    WHERE l.durum IN ('aktif', 'gecikti')
  `;
  const params = [];
  if (branchFilter) {
    sql += ' AND c.branch_id = ?';
    params.push(branchFilter);
  }
  sql += ' ORDER BY l.teslim_tarihi';
  const loans = db.prepare(sql).all(...params);

  const now = new Date();
  const enriched = loans.map(l => ({
    ...l,
    gecikti: new Date(l.teslim_tarihi) < now,
    kalan_gun: Math.ceil((new Date(l.teslim_tarihi) - now) / (1000 * 60 * 60 * 24))
  }));
  res.json(enriched);
});

app.get('/api/loans/my', authenticate, authorize('member'), (req, res) => {
  syncUserNotifications(db, req.user.id);
  const loans = db.prepare(`
    SELECT l.*, b.ad as kitap_adi, b.yazar, b.isbn, b.raf_no,
           c.barkod, c.kopya_no, c.qr_kod, c.sube, lb.ad as sube_adi
    FROM loans l JOIN books b ON l.book_id = b.id
    LEFT JOIN book_copies c ON l.copy_id = c.id
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    WHERE l.user_id = ? ORDER BY l.odunc_tarihi DESC
  `).all(req.user.id);

  const now = new Date();
  res.json(loans.map((l) => {
    const enriched = {
      ...l,
      gecikti: ['aktif', 'gecikti'].includes(l.durum) && new Date(l.teslim_tarihi) < now,
      kalan_gun: ['aktif', 'gecikti'].includes(l.durum)
        ? Math.ceil((new Date(l.teslim_tarihi) - now) / (1000 * 60 * 60 * 24))
        : null,
    };
    return enrichLoanWithExtend(db, enriched, req.user.id);
  }));
});

app.post('/api/loans/:id/extend', authenticate, authorize('member'), (req, res) => {
  const result = extendLoan(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- RESERVATIONS (kitap sıra sistemi) ---
app.post('/api/reservations', authenticate, authorize('member'), (req, res) => {
  const result = joinQueue(db, req.user.id, req.body.book_id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(result.status || 201).json(result);
});

app.get('/api/reservations/queue/:bookId', authenticate, (req, res) => {
  const book = db.prepare('SELECT id, ad FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  const sira = getQueueForBook(db, book.id);
  res.json({
    kitap: book,
    alma_suresi_saat: PICKUP_HOURS,
    sira: sira.map((row) => ({
      id: row.id,
      sira_no: row.sira_no,
      durum: row.durum,
      ad: row.ad,
      hazir_bitis: row.hazir_bitis,
      kalan_saat: row.durum === 'hazir' && row.hazir_bitis
        ? Math.max(0, Math.ceil((new Date(row.hazir_bitis) - new Date()) / (1000 * 60 * 60)))
        : null,
      benim: req.user.role === 'member' ? row.user_id === req.user.id : false,
    })),
  });
});

app.get('/api/reservations/my', authenticate, authorize('member'), (req, res) => {
  processExpiredPickups(db);
  const reservations = db.prepare(`
    SELECT r.*, b.ad as kitap_adi, b.yazar, b.stok, b.durum as kitap_durumu
    FROM reservations r JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.durum IN ('beklemede', 'hazir', 'tamamlandi', 'suresi_doldu', 'iptal')
    ORDER BY
      CASE r.durum WHEN 'hazir' THEN 0 WHEN 'beklemede' THEN 1 ELSE 2 END,
      r.tarih DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(reservations.map(enrichReservationRow));
});

app.delete('/api/reservations/:id', authenticate, authorize('member'), (req, res) => {
  const result = cancelQueueEntry(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/reservations', authenticate, authorize('admin', 'librarian'), (req, res) => {
  processExpiredPickups(db);
  const reservations = db.prepare(`
    SELECT r.id, r.tarih, r.durum, r.sira_no, r.hazir_bitis,
           u.ad, u.soyad, u.okul_no, b.ad as kitap_adi, b.yazar
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.durum IN ('beklemede', 'hazir')
    ORDER BY b.ad, r.sira_no
  `).all();
  res.json(reservations.map(enrichReservationRow));
});

// --- STUDY ROOMS (çalışma odası rezervasyonu) ---
app.get('/api/study-rooms', authenticate, (req, res) => {
  res.json(getAllStudyRooms());
});

app.get('/api/study-rooms/:id', authenticate, (req, res) => {
  const room = getStudyRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Çalışma odası bulunamadı' });
  res.json(room);
});

// --- ROOM RESERVATIONS (oda) ---
app.get('/api/room-reservations/slots', authenticate, (req, res) => {
  const { room_id, tarih } = req.query;
  if (!room_id || !tarih) {
    return res.status(400).json({ error: 'Oda ve tarih seçilmelidir' });
  }
  const room = getStudyRoomById(room_id);
  if (!room) return res.status(404).json({ error: 'Çalışma odası bulunamadı' });

  const today = new Date().toISOString().slice(0, 10);
  if (tarih < today) return res.status(400).json({ error: 'Geçmiş tarih için rezervasyon yapılamaz' });

  res.json({
    oda: room,
    tarih,
    uygun_saatler: STUDY_TIME_SLOTS.map((s) => s.label),
    slotlar: getStudyRoomSlotAvailability(room_id, tarih),
  });
});

app.post('/api/room-reservations', authenticate, authorize('member'), (req, res) => {
  const { room_id, tarih, baslangic, bitis } = req.body;
  if (!room_id || !tarih || !baslangic || !bitis) {
    return res.status(400).json({ error: 'Oda, tarih ve saat aralığı zorunludur' });
  }

  const room = getStudyRoomById(room_id);
  if (!room) return res.status(404).json({ error: 'Çalışma odası bulunamadı' });

  const slot = STUDY_TIME_SLOTS.find((s) => s.baslangic === baslangic && s.bitis === bitis);
  if (!slot) return res.status(400).json({ error: 'Geçersiz saat aralığı' });

  const today = new Date().toISOString().slice(0, 10);
  if (tarih < today) return res.status(400).json({ error: 'Geçmiş tarih için rezervasyon yapılamaz' });

  const userPending = db.prepare(`
    SELECT COUNT(*) as c FROM room_reservations
    WHERE user_id = ? AND durum IN ('beklemede', 'onaylandi') AND tarih >= ?
  `).get(req.user.id, today).c;
  if (userPending >= 3) {
    return res.status(400).json({ error: 'En fazla 3 aktif oda rezervasyonunuz olabilir' });
  }

  const duplicate = db.prepare(`
    SELECT id FROM room_reservations
    WHERE user_id = ? AND room_id = ? AND tarih = ? AND baslangic = ? AND durum IN ('beklemede', 'onaylandi')
  `).get(req.user.id, room_id, tarih, baslangic);
  if (duplicate) return res.status(400).json({ error: 'Bu oda ve saat için zaten rezervasyonunuz var' });

  const userTimeConflict = db.prepare(`
    SELECT id, room_id FROM room_reservations
    WHERE user_id = ? AND tarih = ? AND baslangic = ?
      AND durum IN ('beklemede', 'onaylandi')
  `).get(req.user.id, tarih, baslangic);
  if (userTimeConflict) {
    const conflictRoom = getStudyRoomById(userTimeConflict.room_id);
    return res.status(400).json({
      error: `Bu saatte başka bir oda rezervasyonunuz var (${conflictRoom?.ad || 'oda'})`,
    });
  }

  if (countStudyRoomSlotBookings(room_id, tarih, baslangic) > 0) {
    return res.status(400).json({ error: 'Bu saat dilimi dolu — oda başka bir kullanıcı tarafından rezerve edilmiş' });
  }

  const result = db.prepare(`
    INSERT INTO room_reservations (user_id, room_id, tarih, baslangic, bitis, durum)
    VALUES (?, ?, ?, ?, ?, 'onaylandi')
  `).run(req.user.id, room_id, tarih, baslangic, bitis);

  const mesaj = `${room.ad} odası için ${tarih} ${slot.label} rezervasyonunuz onaylandı.`;
  sendNotification(db, req.user.id, 'oda_yaklasiyor', {
    refId: result.lastInsertRowid,
    baslik: 'Oda rezervasyonu onaylandı',
    mesaj,
    link: '/uye/oda-rezervasyon',
  });

  res.status(201).json({ id: result.lastInsertRowid, message: 'Çalışma odası rezervasyonu oluşturuldu', oda: room.ad });
});

app.get('/api/room-reservations/my', authenticate, authorize('member'), (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM room_reservations WHERE user_id = ? ORDER BY tarih DESC, baslangic DESC
  `).all(req.user.id);
  res.json(rows.map((r) => {
    const room = getStudyRoomById(r.room_id);
    return {
      ...r,
      oda_adi: room?.ad || r.room_id,
      kat: room?.kat,
      sube: room?.sube,
      kapasite: room?.kapasite,
      akilli_tahta: room?.akilli_tahta,
      bilgisayar: room?.bilgisayar,
      sessiz_oda: room?.sessiz_oda,
      grup_odasi: room?.grup_odasi,
    };
  }));
});

app.delete('/api/room-reservations/:id', authenticate, authorize('member'), (req, res) => {
  const row = db.prepare('SELECT * FROM room_reservations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı' });
  if (row.durum === 'iptal') return res.status(400).json({ error: 'Rezervasyon zaten iptal edilmiş' });
  db.prepare("UPDATE room_reservations SET durum = 'iptal' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Oda rezervasyonu iptal edildi' });
});

app.get('/api/room-reservations', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = db.prepare(`
    SELECT rr.*, u.ad, u.soyad, u.okul_no
    FROM room_reservations rr
    JOIN users u ON rr.user_id = u.id
    ORDER BY rr.tarih DESC, rr.baslangic DESC
  `).all();
  res.json(rows.map((r) => {
    const room = getStudyRoomById(r.room_id);
    return {
      ...r,
      oda_adi: room?.ad || r.room_id,
      sube: room?.sube,
      kapasite: room?.kapasite,
      sessiz_oda: room?.sessiz_oda,
      grup_odasi: room?.grup_odasi,
    };
  }));
});

// --- DESK RESERVATIONS (masa) ---
app.get('/api/desks/floors', authenticate, (req, res) => {
  res.json(getFloors());
});

app.get('/api/desks/salons', authenticate, (req, res) => {
  const { kat_id } = req.query;
  if (!kat_id) return res.status(400).json({ error: 'Kat seçilmelidir' });
  const kat = getFloors().find((f) => f.id === kat_id);
  if (!kat) return res.status(404).json({ error: 'Kat bulunamadı' });
  res.json(getSalonsByFloor(kat_id).map((s) => ({ ...s, kat_adi: kat.ad })));
});

app.get('/api/desks/slots', authenticate, (req, res) => {
  res.json(DESK_TIME_SLOTS);
});

app.get('/api/desks/grid', authenticate, (req, res) => {
  const { salon_id, tarih, baslangic, bitis } = req.query;
  if (!salon_id || !tarih || !baslangic || !bitis) {
    return res.status(400).json({ error: 'Salon, tarih ve saat zorunludur' });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (tarih < today) return res.status(400).json({ error: 'Geçmiş tarih seçilemez' });

  const grid = getDeskGrid(db, salon_id, tarih, baslangic, bitis);
  if (!grid) return res.status(404).json({ error: 'Salon veya saat bulunamadı' });
  res.json(grid);
});

app.post('/api/desk-reservations', authenticate, authorize('member'), (req, res) => {
  const { desk_id, salon_id, tarih, baslangic, bitis } = req.body;
  if (!desk_id || !salon_id || !tarih || !baslangic || !bitis) {
    return res.status(400).json({ error: 'Masa, salon, tarih ve saat zorunludur' });
  }

  const desk = getDeskById(desk_id);
  const salon = getSalonById(salon_id);
  const slot = getSlotByTime(baslangic, bitis);
  if (!desk || desk.salon_id !== salon_id) return res.status(404).json({ error: 'Masa bulunamadı' });
  if (!salon) return res.status(404).json({ error: 'Salon bulunamadı' });
  if (!slot) return res.status(400).json({ error: 'Geçersiz saat aralığı' });
  if (!desk.aktif) return res.status(400).json({ error: 'Bu masa kullanım dışı' });

  const today = new Date().toISOString().slice(0, 10);
  if (tarih < today) return res.status(400).json({ error: 'Geçmiş tarih için rezervasyon yapılamaz' });

  const grid = getDeskGrid(db, salon_id, tarih, baslangic, bitis);
  const deskStatus = grid?.desks.find((d) => d.id === desk_id);
  if (!deskStatus || deskStatus.durum === 'dolu') {
    return res.status(400).json({ error: 'Bu masa seçilen saatte dolu' });
  }
  if (deskStatus.durum === 'kullanim_disi') {
    return res.status(400).json({ error: 'Bu masa kullanım dışı' });
  }

  const userConflict = db.prepare(`
    SELECT id FROM desk_reservations
    WHERE user_id = ? AND tarih = ? AND baslangic = ? AND durum IN ('onaylandi', 'aktif')
  `).get(req.user.id, tarih, baslangic);
  if (userConflict) {
    return res.status(400).json({ error: 'Bu saatte başka bir masa rezervasyonunuz var' });
  }

  const deskConflict = db.prepare(`
    SELECT id FROM desk_reservations
    WHERE desk_id = ? AND tarih = ? AND baslangic = ? AND durum IN ('onaylandi', 'aktif')
  `).get(desk_id, tarih, baslangic);
  if (deskConflict) {
    return res.status(400).json({ error: 'Masa bu saatte başka bir kullanıcı tarafından rezerve edilmiş' });
  }

  const pending = db.prepare(`
    SELECT COUNT(*) as c FROM desk_reservations
    WHERE user_id = ? AND durum IN ('onaylandi', 'aktif') AND tarih >= ?
  `).get(req.user.id, today).c;
  if (pending >= 5) {
    return res.status(400).json({ error: 'En fazla 5 aktif masa rezervasyonunuz olabilir' });
  }

  const result = db.prepare(`
    INSERT INTO desk_reservations (user_id, desk_id, salon_id, tarih, baslangic, bitis, durum)
    VALUES (?, ?, ?, ?, ?, ?, 'onaylandi')
  `).run(req.user.id, desk_id, salon_id, tarih, baslangic, bitis);

  const kat = getFloors().find((f) => f.id === salon.kat_id);
  const mesaj = `${kat?.ad || ''} ${salon.ad} — Masa ${desk.masa_no} (${tarih} ${slot.label}) rezervasyonunuz onaylandı.`;
  sendNotification(db, req.user.id, 'oda_yaklasiyor', {
    refId: result.lastInsertRowid,
    baslik: 'Masa rezervasyonu onaylandı',
    mesaj,
    link: '/uye/masa-rezervasyon',
  });

  res.status(201).json({
    id: result.lastInsertRowid,
    message: 'Masa rezervasyonu oluşturuldu',
    masa: desk.masa_no,
  });
});

app.get('/api/desk-reservations/my', authenticate, authorize('member'), (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM desk_reservations WHERE user_id = ?
    ORDER BY tarih DESC, baslangic DESC
  `).all(req.user.id);
  res.json(rows.map((r) => {
    const salon = getSalonById(r.salon_id);
    const desk = getDeskById(r.desk_id);
    const kat = salon ? getFloors().find((f) => f.id === salon.kat_id) : null;
    return {
      ...r,
      kat_adi: kat?.ad,
      salon_adi: salon?.ad,
      masa_no: desk?.masa_no,
    };
  }));
});

app.delete('/api/desk-reservations/:id', authenticate, authorize('member'), (req, res) => {
  const row = db.prepare('SELECT * FROM desk_reservations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı' });
  if (row.durum === 'iptal') return res.status(400).json({ error: 'Zaten iptal edilmiş' });
  db.prepare("UPDATE desk_reservations SET durum = 'iptal' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Masa rezervasyonu iptal edildi' });
});

app.get('/api/desk-reservations', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = db.prepare(`
    SELECT dr.*, u.ad, u.soyad, u.okul_no
    FROM desk_reservations dr
    JOIN users u ON dr.user_id = u.id
    ORDER BY dr.tarih DESC, dr.baslangic DESC
    LIMIT 500
  `).all();
  res.json(rows.map((r) => {
    const salon = getSalonById(r.salon_id);
    const desk = getDeskById(r.desk_id);
    const kat = salon ? getFloors().find((f) => f.id === salon.kat_id) : null;
    return {
      ...r,
      kat_adi: kat?.ad,
      salon_adi: salon?.ad,
      masa_no: desk?.masa_no,
    };
  }));
});

// --- EVENTS (etkinlik & seminer) ---
app.get('/api/events/types', authenticate, (req, res) => {
  res.json(Object.entries(EVENT_TYPES).map(([id, ad]) => ({ id, ad })));
});

app.get('/api/events', authenticate, (req, res) => {
  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  let sql = 'SELECT * FROM library_events';
  const params = [];
  if (!isStaff) {
    sql += " WHERE durum IN ('yayinda', 'tamamlandi')";
  }
  sql += ' ORDER BY tarih DESC, baslangic';
  const events = db.prepare(sql).all(...params);
  const userId = req.user.role === 'member' ? req.user.id : null;
  res.json(events.map((e) => enrichEvent(db, e, userId)));
});

app.get('/api/events/my', authenticate, authorize('member'), (req, res) => {
  const rows = db.prepare(`
    SELECT er.* FROM event_registrations er
    WHERE er.user_id = ? ORDER BY er.kayit_tarihi DESC
  `).all(req.user.id);
  res.json(rows.map((r) => enrichRegistration(db, r)));
});

app.get('/api/events/:id', authenticate, (req, res) => {
  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı' });
  if (req.user.role === 'member' && !['yayinda', 'tamamlandi'].includes(event.durum)) {
    return res.status(404).json({ error: 'Etkinlik bulunamadı' });
  }
  const userId = req.user.role === 'member' ? req.user.id : null;
  res.json(enrichEvent(db, event, userId));
});

app.post('/api/events', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { baslik, aciklama, tur, tarih, baslangic, bitis, konum, kapasite, egitmen, durum } = req.body;
  if (!baslik || !tur || !tarih || !baslangic || !bitis) {
    return res.status(400).json({ error: 'Başlık, tür, tarih ve saat zorunludur' });
  }
  if (!EVENT_TYPES[tur]) return res.status(400).json({ error: 'Geçersiz etkinlik türü' });
  const result = db.prepare(`
    INSERT INTO library_events (baslik, aciklama, tur, tarih, baslangic, bitis, konum, kapasite, egitmen, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    baslik, aciklama || null, tur, tarih, baslangic, bitis,
    konum || null, kapasite || 30, egitmen || null, durum || 'yayinda',
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Etkinlik oluşturuldu' });
});

app.put('/api/events/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const event = db.prepare('SELECT id FROM library_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı' });
  const { baslik, aciklama, tur, tarih, baslangic, bitis, konum, kapasite, egitmen, durum } = req.body;
  db.prepare(`
    UPDATE library_events SET
      baslik=COALESCE(?, baslik), aciklama=COALESCE(?, aciklama), tur=COALESCE(?, tur),
      tarih=COALESCE(?, tarih), baslangic=COALESCE(?, baslangic), bitis=COALESCE(?, bitis),
      konum=COALESCE(?, konum), kapasite=COALESCE(?, kapasite), egitmen=COALESCE(?, egitmen),
      durum=COALESCE(?, durum)
    WHERE id=?
  `).run(baslik, aciklama, tur, tarih, baslangic, bitis, konum, kapasite, egitmen, durum, req.params.id);
  res.json({ message: 'Etkinlik güncellendi' });
});

app.post('/api/events/:id/complete', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = completeEvent(db, req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/events/:id/registrations', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = db.prepare(`
    SELECT er.*, u.ad, u.soyad, u.okul_no, u.bolum
    FROM event_registrations er
    JOIN users u ON er.user_id = u.id
    WHERE er.event_id = ?
    ORDER BY er.kayit_tarihi
  `).all(req.params.id);
  res.json(rows.map((r) => enrichRegistration(db, r)));
});

app.post('/api/events/:id/register', authenticate, authorize('member'), (req, res) => {
  const result = registerForEvent(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.delete('/api/events/:id/register', authenticate, authorize('member'), (req, res) => {
  const reg = db.prepare(`
    SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ? AND durum = 'kayitli'
  `).get(req.params.id, req.user.id);
  if (!reg) return res.status(404).json({ error: 'Aktif kayıt bulunamadı' });
  db.prepare("UPDATE event_registrations SET durum = 'iptal' WHERE id = ?").run(reg.id);
  res.json({ message: 'Etkinlik kaydı iptal edildi' });
});

app.put('/api/events/registrations/:id/attend', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { katildi } = req.body;
  const result = markAttendance(db, req.params.id, katildi !== false);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/events/registrations/:id/certificate', authenticate, (req, res) => {
  const isAdmin = ['admin', 'librarian'].includes(req.user.role);
  const result = getCertificateData(db, req.params.id, req.user.id, isAdmin);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- DIGITAL RESOURCES (e-kitap & dijital kaynaklar) ---
app.get('/api/digital-resources/types', authenticate, (req, res) => {
  res.json(Object.entries(RESOURCE_TYPES).map(([id, ad]) => ({ id, ad })));
});

app.get('/api/digital-resources/access-levels', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(Object.entries(ACCESS_LEVELS).map(([id, ad]) => ({ id, ad })));
});

app.get('/api/digital-resources/licenses', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(Object.entries(LICENSE_LABELS).map(([id, ad]) => ({ id, ad })));
});

app.get('/api/digital-resources', authenticate, (req, res) => {
  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  const { search, tur, kategori } = req.query;
  let sql = 'SELECT * FROM digital_resources WHERE 1=1';
  const params = [];

  if (!isStaff) sql += " AND durum = 'yayinda'";
  if (tur) { sql += ' AND tur = ?'; params.push(tur); }
  if (kategori) { sql += ' AND kategori = ?'; params.push(kategori); }
  if (search) {
    sql += ' AND (baslik LIKE ? OR yazar LIKE ? OR aciklama LIKE ? OR isbn_doi LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => enrichResource(db, r, req.user)));
});

app.get('/api/digital-resources/:id', authenticate, (req, res) => {
  const resource = db.prepare('SELECT * FROM digital_resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Kaynak bulunamadı' });
  if (req.user.role === 'member' && resource.durum !== 'yayinda') {
    return res.status(404).json({ error: 'Kaynak bulunamadı' });
  }
  res.json(enrichResource(db, resource, req.user));
});

app.post('/api/digital-resources', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const {
    baslik, yazar, tur, aciklama, kategori, yayinevi, yayin_yili, isbn_doi,
    dosya_yolu, dosya_turu, dosya_boyutu, erisim_yetkisi, indirme_izni,
    yayin_lisansi, son_erisim_tarihi, durum,
  } = req.body;
  if (!baslik || !tur) return res.status(400).json({ error: 'Başlık ve tür zorunludur' });
  if (!RESOURCE_TYPES[tur]) return res.status(400).json({ error: 'Geçersiz kaynak türü' });

  const result = db.prepare(`
    INSERT INTO digital_resources (
      baslik, yazar, tur, aciklama, kategori, yayinevi, yayin_yili, isbn_doi,
      dosya_yolu, dosya_turu, dosya_boyutu, erisim_yetkisi, indirme_izni,
      yayin_lisansi, son_erisim_tarihi, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    baslik, yazar || null, tur, aciklama || null, kategori || null,
    yayinevi || null, yayin_yili || null, isbn_doi || null,
    dosya_yolu || null, dosya_turu || null, dosya_boyutu || 0,
    erisim_yetkisi || 'uye', indirme_izni ? 1 : 0,
    yayin_lisansi || null, son_erisim_tarihi || null, durum || 'yayinda',
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Dijital kaynak eklendi' });
});

app.put('/api/digital-resources/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const existing = db.prepare('SELECT id FROM digital_resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kaynak bulunamadı' });
  const {
    baslik, yazar, tur, aciklama, kategori, yayinevi, yayin_yili, isbn_doi,
    dosya_yolu, dosya_turu, dosya_boyutu, erisim_yetkisi, indirme_izni,
    yayin_lisansi, son_erisim_tarihi, durum,
  } = req.body;

  db.prepare(`
    UPDATE digital_resources SET
      baslik=COALESCE(?, baslik), yazar=COALESCE(?, yazar), tur=COALESCE(?, tur),
      aciklama=COALESCE(?, aciklama), kategori=COALESCE(?, kategori),
      yayinevi=COALESCE(?, yayinevi), yayin_yili=COALESCE(?, yayin_yili),
      isbn_doi=COALESCE(?, isbn_doi), dosya_yolu=COALESCE(?, dosya_yolu),
      dosya_turu=COALESCE(?, dosya_turu), dosya_boyutu=COALESCE(?, dosya_boyutu),
      erisim_yetkisi=COALESCE(?, erisim_yetkisi),
      indirme_izni=COALESCE(?, indirme_izni),
      yayin_lisansi=COALESCE(?, yayin_lisansi),
      son_erisim_tarihi=COALESCE(?, son_erisim_tarihi),
      durum=COALESCE(?, durum)
    WHERE id=?
  `).run(
    baslik, yazar, tur, aciklama, kategori, yayinevi, yayin_yili, isbn_doi,
    dosya_yolu, dosya_turu, dosya_boyutu, erisim_yetkisi,
    indirme_izni !== undefined ? (indirme_izni ? 1 : 0) : null,
    yayin_lisansi, son_erisim_tarihi, durum, req.params.id,
  );
  res.json({ message: 'Dijital kaynak güncellendi' });
});

app.delete('/api/digital-resources/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const existing = db.prepare('SELECT id FROM digital_resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kaynak bulunamadı' });
  db.prepare("UPDATE digital_resources SET durum = 'arsiv' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Kaynak arşivlendi' });
});

app.get('/api/digital-resources/:id/logs', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.ad, u.soyad, u.okul_no
    FROM digital_resource_logs l
    JOIN users u ON l.user_id = u.id
    WHERE l.resource_id = ?
    ORDER BY l.tarih DESC LIMIT 100
  `).all(req.params.id);
  res.json(rows);
});

app.post('/api/digital-resources/:id/view', authenticate, (req, res) => {
  const result = recordView(db, req.params.id, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/digital-resources/:id/download', authenticate, (req, res) => {
  const result = recordDownload(db, req.params.id, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  if (result.redirect) return res.redirect(result.redirect);
  const filePath = resolveFilePath(result.filePath);
  if (!filePath) return res.status(404).json({ error: 'Dosya bulunamadı' });
  res.download(filePath, result.filename);
});

app.get('/api/digital-resources/:id/file', authenticate, (req, res) => {
  const resource = db.prepare('SELECT * FROM digital_resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Kaynak bulunamadı' });
  const access = checkAccess(db, req.user, resource);
  if (!access.view) return res.status(403).json({ error: access.reason || 'Erişim yetkiniz yok' });
  if (isExternalUrl(resource.dosya_yolu)) return res.redirect(resource.dosya_yolu);
  const filePath = resolveFilePath(resource.dosya_yolu);
  if (!filePath) return res.status(404).json({ error: 'Dosya bulunamadı' });
  res.sendFile(filePath);
});

// --- ACADEMIC ARCHIVE (tez & makale arşivi) ---
app.get('/api/thesis-archive/filters', authenticate, (req, res) => {
  res.json(getFilterOptions(db));
});

app.get('/api/thesis-archive', authenticate, (req, res) => {
  const filters = {
    bolum: req.query.bolum,
    danisman: req.query.danisman,
    yazar: req.query.yazar,
    yil: req.query.yil,
    tez_turu: req.query.tez_turu,
    konu_alani: req.query.konu_alani,
    kayit_turu: req.query.kayit_turu,
    anahtar_kelime: req.query.anahtar_kelime,
    search: req.query.search,
    durum: req.query.durum,
    mine: req.query.mine === '1',
    limit: req.query.limit,
    offset: req.query.offset,
  };
  const { sql, params } = buildListQuery(req.user, filters);
  const paginated = applyPagination(sql, params, filters);
  const rows = db.prepare(paginated.sql).all(...paginated.params);

  if (filters.limit) {
    const { sql: countSql, params: countParams } = buildCountQuery(req.user, filters);
    const total = db.prepare(countSql).get(...countParams).c;
    return res.json({
      items: rows.map((r) => enrichArchiveItem(db, r, req.user)),
      total,
      limit: parseInt(filters.limit, 10),
      offset: parseInt(filters.offset, 10) || 0,
    });
  }

  res.json(rows.map((r) => enrichArchiveItem(db, r, req.user)));
});

app.get('/api/thesis-archive/pending', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM academic_archive WHERE durum = 'beklemede' ORDER BY created_at ASC
  `).all();
  res.json(rows.map((r) => enrichArchiveItem(db, r, req.user)));
});

app.get('/api/thesis-archive/:id', authenticate, (req, res) => {
  const row = db.prepare('SELECT * FROM academic_archive WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Kayıt bulunamadı' });

  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  const isOwner = Number(row.yazar_id) === Number(req.user.id);
  if (!isStaff && !isOwner && row.durum !== 'yayinda') {
    return res.status(404).json({ error: 'Kayıt bulunamadı' });
  }

  res.json(enrichArchiveItem(db, row, req.user));
});

app.post('/api/thesis-archive', authenticate, authorize('member'), (req, res) => {
  const result = createSubmission(db, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/thesis-archive/:id/approve', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = approveSubmission(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/thesis-archive/:id/reject', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { red_nedeni } = req.body;
  const result = rejectSubmission(db, req.params.id, req.user.id, red_nedeni);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/thesis-archive/:id/download', authenticate, (req, res) => {
  const result = recordThesisDownload(db, req.params.id, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.download(result.filePath, result.filename);
});

// --- PENALTIES ---
app.get('/api/penalties/types', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json({
    turler: Object.entries(PENALTY_TYPES).map(([id, t]) => ({ id, ...t, varsayilan_tutar: PENALTY_AMOUNTS[id] || null })),
    tutarlar: PENALTY_AMOUNTS,
  });
});

app.get('/api/penalties', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(listPenalties(db));
});

app.get('/api/penalties/my', authenticate, authorize('member'), (req, res) => {
  syncUserNotifications(db, req.user.id);
  res.json(listPenalties(db, { userId: req.user.id }));
});

app.get('/api/penalties/:id', authenticate, authorize('admin', 'librarian', 'member'), (req, res) => {
  const penalty = getPenalty(db, req.params.id);
  if (!penalty) return res.status(404).json({ error: 'Ceza bulunamadı' });
  if (req.user.role === 'member' && Number(penalty.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Yetkisiz' });
  }
  res.json(penalty);
});

app.post('/api/penalties', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { user_id, tur, tutar, sebep, aciklama, loan_id } = req.body;
  if (!user_id || !tur) return res.status(400).json({ error: 'Üye ve ceza türü zorunlu' });

  const member = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'member'").get(user_id);
  if (!member) return res.status(404).json({ error: 'Üye bulunamadı' });

  const result = createPenalty(db, {
    userId: user_id,
    tur,
    tutar: tutar ?? PENALTY_AMOUNTS[tur],
    sebep,
    aciklama,
    loanId: loan_id || null,
    actorId: req.user.id,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  if (result.penalty && user_id) {
    const book = loan_id
      ? db.prepare('SELECT b.ad FROM books b JOIN loans l ON l.book_id = b.id WHERE l.id = ?').get(loan_id)
      : null;
    notifyPenaltyCreated(db, user_id, result.penalty, book?.ad);
  }
  res.status(201).json(result);
});

app.put('/api/penalties/:id/pay', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = markPaid(db, req.params.id, req.user.id, {
    aciklama: req.body.aciklama,
    installmentId: req.body.installment_id,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  if (result.penalty) notifyPenaltyPaid(db, result.penalty.user_id, result.penalty);
  res.json(result);
});

app.put('/api/penalties/:id/cancel', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = cancelPenalty(db, req.params.id, req.user.id, req.body.aciklama);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/penalties/:id/discount', authenticate, authorize('admin'), (req, res) => {
  const result = applyDiscount(db, req.params.id, req.user.id, {
    indirimTutari: req.body.indirim_tutari,
    indirimOrani: req.body.indirim_orani,
    aciklama: req.body.aciklama,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/penalties/:id/installments', authenticate, authorize('admin'), (req, res) => {
  const result = createInstallments(db, req.params.id, req.user.id, {
    taksitSayisi: req.body.taksit_sayisi,
    aciklama: req.body.aciklama,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/penalties/:id/note', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = updateNote(db, req.params.id, req.user.id, req.body.aciklama);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/penalties/:id/receipt', authenticate, authorize('member'), (req, res) => {
  const result = uploadReceipt(db, req.params.id, req.user.id, {
    dosyaAdi: req.body.dosya_adi,
    icerik: req.body.icerik,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/penalties/:id/receipt/review', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = reviewReceipt(db, req.params.id, req.user.id, {
    onay: !!req.body.onay,
    aciklama: req.body.aciklama,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  if (result.penalty?.odendi) notifyPenaltyPaid(db, result.penalty.user_id, result.penalty);
  res.json(result);
});

app.get('/api/penalties/:id/receipt', authenticate, (req, res) => {
  const penalty = getPenalty(db, req.params.id);
  if (!penalty) return res.status(404).json({ error: 'Ceza bulunamadı' });
  if (req.user.role === 'member' && Number(penalty.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Yetkisiz' });
  }
  if (!penalty.dekont_yolu) return res.status(404).json({ error: 'Dekont yok' });
  const filePath = resolveReceiptFile(penalty.dekont_yolu);
  if (!filePath) return res.status(404).json({ error: 'Dosya bulunamadı' });
  res.download(filePath, penalty.dekont_yolu);
});

app.post('/api/penalties/room-noshow/:reservationId', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = markRoomNoShow(db, req.params.reservationId, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

// --- REPORTS (Admin) ---
app.get('/api/reports/dashboard', authenticate, authorize('admin'), (req, res) => {
  syncAllOverdueLoans(db);
  const branchFilter = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;

  const bookWhere = branchFilter
    ? `WHERE EXISTS (SELECT 1 FROM book_copies c WHERE c.book_id = books.id AND c.branch_id = ${branchFilter})`
    : '';
  const copyWhere = branchFilter ? `WHERE branch_id = ${branchFilter}` : '';
  const loanJoin = branchFilter
    ? `JOIN book_copies c ON l.copy_id = c.id AND c.branch_id = ${branchFilter}`
    : '';

  const stats = {
    toplam_kitap: db.prepare(`SELECT COUNT(*) as c FROM books ${bookWhere}`).get().c,
    toplam_stok: db.prepare(`SELECT COALESCE(SUM(stok), 0) as c FROM books ${bookWhere}`).get().c,
    toplam_kopya: db.prepare(`SELECT COUNT(*) as c FROM book_copies ${copyWhere}`).get().c,
    toplam_uye: db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'member'").get().c,
    aktif_uye: db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'member' AND uyelik_durumu = 'aktif'").get().c,
    aktif_odunc: db.prepare(`
      SELECT COUNT(*) as c FROM loans l ${loanJoin}
      WHERE l.durum IN ('aktif', 'gecikti')
    `).get().c,
    geciken: db.prepare(`
      SELECT COUNT(*) as c FROM loans l ${loanJoin}
      WHERE l.durum IN ('aktif', 'gecikti') AND l.teslim_tarihi < datetime('now')
    `).get().c,
    odenmemis_ceza: unpaidPenaltySum(db),
    bekleyen_rezervasyon: db.prepare("SELECT COUNT(*) as c FROM reservations WHERE durum = 'beklemede'").get().c,
  };

  const populerSql = branchFilter
    ? `SELECT b.ad, b.yazar, COUNT(l.id) as odunc_sayisi
       FROM books b JOIN loans l ON b.id = l.book_id
       JOIN book_copies c ON l.copy_id = c.id AND c.branch_id = ?
       GROUP BY b.id ORDER BY odunc_sayisi DESC LIMIT 10`
    : `SELECT b.ad, b.yazar, COUNT(l.id) as odunc_sayisi
       FROM books b JOIN loans l ON b.id = l.book_id
       GROUP BY b.id ORDER BY odunc_sayisi DESC LIMIT 10`;
  const populer = branchFilter
    ? db.prepare(populerSql).all(branchFilter)
    : db.prepare(populerSql).all();

  const gecikenSql = branchFilter
    ? `SELECT l.id, b.ad as kitap_adi, b.yazar, u.ad, u.soyad, u.okul_no, l.teslim_tarihi, l.durum, lb.ad as sube_adi
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN users u ON l.user_id = u.id
       JOIN book_copies c ON l.copy_id = c.id
       LEFT JOIN library_branches lb ON c.branch_id = lb.id
       WHERE l.durum IN ('aktif', 'gecikti') AND l.teslim_tarihi < datetime('now') AND c.branch_id = ?
       ORDER BY l.teslim_tarihi`
    : `SELECT l.id, b.ad as kitap_adi, b.yazar, u.ad, u.soyad, u.okul_no, l.teslim_tarihi, l.durum, lb.ad as sube_adi
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN users u ON l.user_id = u.id
       LEFT JOIN book_copies c ON l.copy_id = c.id
       LEFT JOIN library_branches lb ON c.branch_id = lb.id
       WHERE l.durum IN ('aktif', 'gecikti') AND l.teslim_tarihi < datetime('now')
       ORDER BY l.teslim_tarihi`;
  const gecikenKitaplar = branchFilter
    ? db.prepare(gecikenSql).all(branchFilter)
    : db.prepare(gecikenSql).all();

  const aktifUyeler = db.prepare(`
    SELECT id, ad, soyad, okul_no, email, bolum, uyelik_durumu,
      (SELECT COUNT(*) FROM loans WHERE user_id = users.id AND durum IN ('aktif', 'gecikti')) as aktif_odunc
    FROM users WHERE role = 'member' AND uyelik_durumu = 'aktif'
    ORDER BY soyad, ad
  `).all();

  const kategoriDagilim = db.prepare(`
    SELECT kategori, COUNT(*) as sayi FROM books ${bookWhere} GROUP BY kategori ORDER BY sayi DESC
  `).all();

  const subeOzetleri = getAllBranches(db).map((b) => ({
    id: b.id,
    ad: b.ad,
    istatistik: getBranchStats(db, b.id).istatistik,
  }));

  res.json({ stats, populer, gecikenKitaplar, aktifUyeler, kategoriDagilim, subeOzetleri, secili_sube: branchFilter });
});

const { getAdminAnalytics } = require('./adminAnalytics');

app.get('/api/reports/analytics', authenticate, authorize('admin'), (req, res) => {
  syncAllOverdueLoans(db);
  const branchFilter = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
  res.json(getAdminAnalytics(db, branchFilter));
});

// ── Rapor Dışa Aktarma ──
const { REPORT_TYPES, getReportData, generateCSV, generateExcel, generatePDF } = require('./reportExport');

app.get('/api/reports/types', authenticate, authorize('admin'), (_req, res) => {
  res.json(Object.values(REPORT_TYPES));
});

app.get('/api/reports/preview/:type', authenticate, authorize('admin'), (req, res) => {
  try {
    syncAllOverdueLoans(db);
    const data = getReportData(db, req.params.type, req.query);
    if (!data) return res.status(400).json({ error: 'Geçersiz rapor türü' });
    res.json(data);
  } catch (err) {
    console.error('Report preview error:', err);
    res.status(500).json({ error: 'Rapor oluşturulurken hata oluştu' });
  }
});

app.get('/api/reports/export/:type/:format', authenticate, authorize('admin'), async (req, res) => {
  try {
    syncAllOverdueLoans(db);
    const { type, format } = req.params;
    const data = getReportData(db, type, req.query);
    if (!data) return res.status(400).json({ error: 'Geçersiz rapor türü' });

    const safeTitle = data.title.replace(/[^a-zA-Z0-9_\-ÇçĞğİıÖöŞşÜü ]/g, '').replace(/\s+/g, '_');
    const ts = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = generateCSV(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${ts}.csv"`);
      return res.send(csv);
    }

    if (format === 'excel') {
      const buffer = await generateExcel(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${ts}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    if (format === 'pdf') {
      const buffer = await generatePDF(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${ts}.pdf"`);
      return res.send(buffer);
    }

    res.status(400).json({ error: 'Geçersiz format. pdf, excel veya csv kullanın.' });
  } catch (err) {
    console.error('Report export error:', err);
    res.status(500).json({ error: 'Rapor dışa aktarılırken hata oluştu' });
  }
});

app.get('/api/audit-logs/meta', authenticate, authorize('admin'), (req, res) => {
  res.json(getAuditMeta());
});

app.get('/api/audit-logs/stats', authenticate, authorize('admin'), (req, res) => {
  res.json(getAuditStats(db));
});

app.get('/api/audit-logs', authenticate, authorize('admin'), (req, res) => {
  res.json(listAuditLogs(db, {
    action: req.query.action || null,
    user_id: req.query.user_id || null,
    entity_type: req.query.entity_type || null,
    q: req.query.q || null,
    from: req.query.from || null,
    to: req.query.to || null,
    limit: req.query.limit || 100,
    offset: req.query.offset || 0,
  }));
});

// --- PURCHASE REQUESTS (Satın Alma / Tedarik) ---
app.get('/api/purchase-requests/meta', authenticate, (req, res) => {
  res.json(getPurchaseStatusMeta());
});

app.get('/api/purchase-requests/stats', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(getRequestStats(db));
});

app.get('/api/purchase-requests/my', authenticate, authorize('member'), (req, res) => {
  res.json(listMyRequests(db, req.user.id));
});

app.get('/api/purchase-requests', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(listAllRequests(db, { durum: req.query.durum || null }));
});

app.get('/api/purchase-requests/:id', authenticate, (req, res) => {
  const request = getRequestById(db, req.params.id);
  if (!request) return res.status(404).json({ error: 'Talep bulunamadı' });
  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  if (!isStaff && Number(request.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Bu talebi görme yetkiniz yok' });
  }
  res.json(request);
});

app.post('/api/purchase-requests', authenticate, authorize('member'), (req, res) => {
  const result = createPurchaseRequest(db, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/purchase-requests/:id/status', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = updateRequestStatus(db, req.params.id, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.delete('/api/purchase-requests/:id', authenticate, authorize('member'), (req, res) => {
  const result = cancelMyRequest(db, req.user.id, req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- BOOK DONATIONS (Bağış) ---
app.get('/api/donations/meta', authenticate, (req, res) => {
  res.json(getDonationMeta());
});

app.get('/api/donations/stats', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(getDonationStats(db));
});

app.get('/api/donations/my', authenticate, authorize('member'), (req, res) => {
  res.json(listMyDonations(db, req.user.id));
});

app.get('/api/donations', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(listAllDonations(db, { durum: req.query.durum || null }));
});

app.get('/api/donations/:id', authenticate, (req, res) => {
  const donation = getDonationById(db, req.params.id);
  if (!donation) return res.status(404).json({ error: 'Bağış kaydı bulunamadı' });
  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  if (!isStaff && Number(donation.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Bu kaydı görme yetkiniz yok' });
  }
  res.json(donation);
});

app.post('/api/donations', authenticate, authorize('member'), (req, res) => {
  const result = createDonation(db, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/donations/:id/status', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = updateDonationStatus(db, req.params.id, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.delete('/api/donations/:id', authenticate, authorize('member'), (req, res) => {
  const result = cancelMyDonation(db, req.user.id, req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- BOOK COPIES ---
app.get('/api/copies', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { book_id, barkod, durum } = req.query;
  const branchFilter = resolveBranchFilter(db, req.user, req.query.branch_id);
  let sql = `
    SELECT c.*, b.ad as kitap_adi, b.yazar, b.isbn, lb.ad as sube_adi
    FROM book_copies c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    WHERE 1=1
  `;
  const params = [];
  if (book_id) { sql += ' AND c.book_id = ?'; params.push(book_id); }
  if (barkod) { sql += ' AND c.barkod LIKE ?'; params.push(`%${barkod}%`); }
  if (durum) { sql += ' AND c.fiziksel_durum = ?'; params.push(durum); }
  if (branchFilter) { sql += ' AND c.branch_id = ?'; params.push(branchFilter); }
  sql += ' ORDER BY b.ad, c.kopya_no LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/books/:id/copies', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const book = db.prepare('SELECT id, ad, yazar, isbn FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  const kopyalar = db.prepare('SELECT * FROM book_copies WHERE book_id = ? ORDER BY kopya_no').all(req.params.id);
  res.json({ kitap: book, ozet: getCopySummary(db, req.params.id), kopyalar });
});

app.post('/api/copies', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { book_id, fiziksel_durum, sube, branch_id, kat, raf_no, satin_alma_tarihi, maliyet } = req.body;
  if (!book_id) return res.status(400).json({ error: 'Kitap seçilmedi' });
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  const scopeBranch = resolveBranchFilter(db, req.user, branch_id);
  const maxNo = db.prepare('SELECT COALESCE(MAX(kopya_no), 0) as m FROM book_copies WHERE book_id = ?').get(book_id).m;
  const id = createCopy(db, book, maxNo + 1, fiziksel_durum || 'rafta', {
    sube, branch_id: scopeBranch, kat, raf_no, satin_alma_tarihi, maliyet,
  });
  syncBookStock(db, book_id);
  res.status(201).json({ id, message: 'Yeni kopya eklendi' });
});

app.put('/api/copies/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { fiziksel_durum, sube, branch_id, kat, raf_no, satin_alma_tarihi, maliyet } = req.body;
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(req.params.id);
  if (!copy) return res.status(404).json({ error: 'Kopya bulunamadı' });
  if (req.user.role === 'librarian') {
    const scope = resolveBranchFilter(db, req.user, null);
    if (scope && copy.branch_id !== scope) {
      return res.status(403).json({ error: 'Bu şubenin kopyasını düzenleyemezsiniz' });
    }
  }
  if (fiziksel_durum && !COPY_STATUSES.includes(fiziksel_durum)) {
    return res.status(400).json({ error: 'Geçersiz fiziksel durum' });
  }
  if (fiziksel_durum === 'oduncte') {
    return res.status(400).json({ error: 'Ödünç durumu yalnızca ödünç işlemiyle atanır' });
  }
  let newBranchId = branch_id ?? copy.branch_id;
  let newSube = sube;
  if (branch_id && req.user.role === 'admin') {
    const branch = getBranchById(db, branch_id);
    if (branch) newSube = branch.ad;
  }
  db.prepare(`
    UPDATE book_copies SET
      fiziksel_durum = COALESCE(?, fiziksel_durum),
      sube = COALESCE(?, sube),
      branch_id = COALESCE(?, branch_id),
      kat = COALESCE(?, kat),
      raf_no = COALESCE(?, raf_no),
      satin_alma_tarihi = COALESCE(?, satin_alma_tarihi),
      maliyet = COALESCE(?, maliyet)
    WHERE id = ?
  `).run(
    fiziksel_durum || null, newSube || null, newBranchId || null,
    kat || null, raf_no || null, satin_alma_tarihi || null, maliyet ?? null, req.params.id,
  );
  syncBookStock(db, copy.book_id);
  res.json({ message: 'Kopya güncellendi' });
});

app.delete('/api/copies/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(req.params.id);
  if (!copy) return res.status(404).json({ error: 'Kopya bulunamadı' });
  if (copy.fiziksel_durum === 'oduncte') return res.status(400).json({ error: 'Ödünçteki kopya silinemez' });
  db.prepare('DELETE FROM book_copies WHERE id = ?').run(req.params.id);
  syncBookStock(db, copy.book_id);
  res.json({ message: 'Kopya silindi' });
});

// --- RECOMMENDATIONS ---
app.get('/api/recommendations', authenticate, authorize('member'), (req, res) => {
  res.json(getRecommendations(db, req.user.id));
});

app.post('/api/books/:id/view', authenticate, authorize('member'), (req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  db.prepare('INSERT INTO book_views (user_id, book_id) VALUES (?, ?)').run(req.user.id, req.params.id);
  res.json({ message: 'Görüntülendi' });
});

app.get('/api/favorites', authenticate, authorize('member'), (req, res) => {
  const rows = db.prepare(`
    SELECT b.* FROM favorites f JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/favorites/:bookId', authenticate, authorize('member'), (req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  try {
    db.prepare('INSERT INTO favorites (user_id, book_id) VALUES (?, ?)').run(req.user.id, req.params.bookId);
    res.status(201).json({ message: 'Favorilere eklendi' });
  } catch {
    res.status(400).json({ error: 'Zaten favorilerde' });
  }
});

app.delete('/api/favorites/:bookId', authenticate, authorize('member'), (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND book_id = ?').run(req.user.id, req.params.bookId);
  res.json({ message: 'Favorilerden çıkarıldı' });
});

app.post('/api/ratings', authenticate, authorize('member'), (req, res) => {
  const { book_id, puan } = req.body;
  if (!book_id || !puan || puan < 1 || puan > 5) {
    return res.status(400).json({ error: '1-5 arası puan verilmelidir' });
  }
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  db.prepare(`
    INSERT INTO ratings (user_id, book_id, puan) VALUES (?, ?, ?)
    ON CONFLICT(user_id, book_id) DO UPDATE SET puan = excluded.puan
  `).run(req.user.id, book_id, puan);
  const ort = db.prepare('SELECT ROUND(AVG(puan), 1) as ort, COUNT(*) as c FROM ratings WHERE book_id = ?').get(book_id);
  res.json({ message: 'Puan kaydedildi', puan, ortalama_puan: ort.ort, puan_sayisi: ort.c });
});

// --- BOOK REVIEWS ---
app.get('/api/books/:id/reviews', authenticate, (req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Kitap bulunamadı' });
  const viewerId = req.user.role === 'member' ? req.user.id : null;
  res.json(listBookReviews(db, req.params.id, viewerId));
});

app.post('/api/books/:id/reviews', authenticate, authorize('member'), (req, res) => {
  const { yorum, spoiler } = req.body;
  const result = upsertReview(db, req.user.id, req.params.id, { yorum, spoiler });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  const yeniRozetler = awardBadges(db, req.user.id);
  res.status(201).json({ ...result, yeni_rozetler: yeniRozetler });
});

app.post('/api/reviews/:id/like', authenticate, authorize('member'), (req, res) => {
  const result = toggleLike(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/reviews/:id/report', authenticate, authorize('member'), (req, res) => {
  const { sebep } = req.body;
  const result = reportReview(db, req.params.id, req.user.id, sebep);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.delete('/api/reviews/:id', authenticate, (req, res) => {
  const isAdmin = ['admin', 'librarian'].includes(req.user.role);
  const result = deleteReview(db, req.params.id, isAdmin, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/reviews/reported', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json(listReportedReviews(db));
});

// --- READING LISTS ---
app.get('/api/reading-lists', authenticate, authorize('member'), (req, res) => {
  const { public: publicOnly } = req.query;
  let rows;
  if (publicOnly === '1') {
    rows = db.prepare(`
      SELECT * FROM reading_lists WHERE gizlilik = 'herkese_acik'
      ORDER BY updated_at DESC LIMIT 100
    `).all();
  } else {
    rows = db.prepare(`
      SELECT * FROM reading_lists WHERE user_id = ? ORDER BY updated_at DESC
    `).all(req.user.id);
  }
  res.json(rows.map((r) => enrichList(db, r, req.user.id)));
});

app.get('/api/reading-lists/:id', authenticate, (req, res) => {
  const isStaff = ['admin', 'librarian'].includes(req.user.role);
  const viewerId = req.user.role === 'member' ? req.user.id : null;
  const result = getListWithItems(db, req.params.id, viewerId, isStaff);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/reading-lists', authenticate, authorize('member'), (req, res) => {
  const result = createList(db, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/reading-lists/:id', authenticate, authorize('member'), (req, res) => {
  const result = updateList(db, req.params.id, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.delete('/api/reading-lists/:id', authenticate, authorize('member'), (req, res) => {
  const result = deleteList(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/reading-lists/:id/items', authenticate, authorize('member'), (req, res) => {
  const result = addBookToList(db, req.params.id, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.delete('/api/reading-lists/:id/items/:bookId', authenticate, authorize('member'), (req, res) => {
  const result = removeBookFromList(db, req.params.id, req.params.bookId, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- GAMIFICATION (hedefler & rozetler) ---
app.get('/api/gamification/me', authenticate, authorize('member'), (req, res) => {
  res.json(getGamificationProfile(db, req.user.id));
});

app.get('/api/reading-stats/me', authenticate, authorize('member'), (req, res) => {
  res.json(getReadingStats(db, req.user.id));
});

// --- SHELF (Librarian) ---
app.get('/api/shelf', authenticate, authorize('librarian', 'admin'), (req, res) => {
  const branchFilter = resolveBranchFilter(db, req.user, req.query.branch_id);
  let sql = `
    SELECT c.raf_no, COUNT(*) as kopya_sayisi,
           SUM(CASE WHEN c.fiziksel_durum = 'rafta' THEN 1 ELSE 0 END) as rafta,
           GROUP_CONCAT(DISTINCT b.ad) as kitaplar
    FROM book_copies c
    JOIN books b ON c.book_id = b.id
    WHERE c.raf_no IS NOT NULL AND c.raf_no != ''
  `;
  const params = [];
  if (branchFilter) {
    sql += ' AND c.branch_id = ?';
    params.push(branchFilter);
  }
  sql += ' GROUP BY c.raf_no ORDER BY c.raf_no';
  res.json(db.prepare(sql).all(...params));
});

app.put('/api/shelf/move', authenticate, authorize('librarian', 'admin'), (req, res) => {
  const { book_id, raf_no } = req.body;
  db.prepare('UPDATE books SET raf_no = ? WHERE id = ?').run(raf_no, book_id);
  res.json({ message: 'Raf güncellendi' });
});

// --- QR / BARKOD TARAMA ---
app.post('/api/scan/lookup', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { code } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Kod gerekli' });
  const result = lookupScanCode(db, code);
  if (result.type === 'not_found' || result.type === 'invalid') {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/scan/lend', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { member_code, copy_code } = req.body;
  if (!member_code || !copy_code) {
    return res.status(400).json({ error: 'Üye kartı ve kitap kodu gerekli' });
  }
  const result = scanLend(db, member_code, copy_code);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(result.status || 201).json(result);
});

app.post('/api/scan/return', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { copy_code, kitap_durumu, aciklama, foto, foto_adi } = req.body;
  if (!copy_code) return res.status(400).json({ error: 'Kitap kodu gerekli' });
  const result = scanReturn(db, copy_code, req.user.id, {
    kitap_durumu: kitap_durumu || 'iyi',
    aciklama,
    foto,
    foto_adi,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/return-inspections/conditions', authenticate, authorize('admin', 'librarian'), (req, res) => {
  res.json({
    durumlar: Object.values(CONDITION_TYPES).map((c) => ({
      id: c.id,
      ad: c.ad,
      ceza: c.ceza,
    })),
  });
});

app.get('/api/return-inspections', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const rows = listInspections(db, { durum: req.query.durum || null });
  res.json(rows);
});

app.get('/api/return-inspections/:id/photo', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const row = getInspection(db, req.params.id);
  if (!row?.foto_yolu) return res.status(404).json({ error: 'Fotoğraf yok' });
  const filePath = resolveInspectionPhoto(row.foto_yolu);
  if (!filePath) return res.status(404).json({ error: 'Dosya bulunamadı' });
  res.sendFile(filePath);
});

app.post('/api/scan/damage', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const { copy_code, aciklama } = req.body;
  if (!copy_code) return res.status(400).json({ error: 'Kitap kodu gerekli' });
  const result = scanDamage(db, copy_code, aciklama, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

// --- INVENTORY COUNT (Envanter Sayım) ---
app.get('/api/inventory/rafs', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const branchFilter = resolveBranchFilter(db, req.user, req.query.branch_id);
  res.json({ raflar: getDistinctRafs(db, branchFilter) });
});

app.get('/api/inventory/sessions', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const branchFilter = resolveBranchFilter(db, req.user, req.query.branch_id);
  res.json(listInventorySessions(db, {
    branch_id: branchFilter || null,
    durum: req.query.durum || null,
  }));
});

app.post('/api/inventory/sessions', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const branchFilter = resolveBranchFilter(db, req.user, req.body.branch_id);
  const result = createInventorySession(db, {
    ...req.user,
    branch_id: req.user.role === 'librarian' ? req.user.branch_id : (branchFilter || req.user.branch_id),
  }, {
    branch_id: branchFilter || req.body.branch_id,
    raf_no: req.body.raf_no,
    notlar: req.body.notlar,
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.get('/api/inventory/sessions/:id', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const session = getInventorySession(db, req.params.id);
  if (!session) return res.status(404).json({ error: 'Sayım bulunamadı' });
  res.json(session);
});

app.get('/api/inventory/sessions/:id/report', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = getInventoryReport(db, req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/inventory/sessions/:id/scan', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const code = req.body.code || req.body.copy_code;
  const result = scanIntoSession(db, req.params.id, code, req.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error, session: result.session });
  res.json(result);
});

app.put('/api/inventory/sessions/:id/complete', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = completeInventorySession(db, req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.put('/api/inventory/sessions/:id/cancel', authenticate, authorize('admin', 'librarian'), (req, res) => {
  const result = cancelInventorySession(db, req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/loans/check-overdue', authenticate, authorize('librarian', 'admin'), (req, res) => {
  syncAllOverdueLoans(db);
  const overdue = db.prepare(`
    SELECT l.*, u.ad, u.soyad, u.okul_no, u.email, b.ad as kitap_adi
    FROM loans l
    JOIN users u ON l.user_id = u.id
    JOIN books b ON l.book_id = b.id
    WHERE l.durum = 'gecikti'
    ORDER BY l.teslim_tarihi
  `).all();
  res.json({ count: overdue.length, overdue });
});

// ── Kulüp & Topluluk Sistemi ──

app.get('/api/clubs', authenticate, (req, res) => {
  try {
    const clubs = listClubs(db, { durum: req.query.durum, search: req.query.search, userId: req.user.id });
    res.json(clubs);
  } catch (err) {
    console.error('GET /api/clubs error:', err);
    res.status(500).json({ error: 'Kulüpler yüklenirken hata oluştu' });
  }
});

app.get('/api/clubs/stats', authenticate, authorize('admin'), (req, res) => {
  res.json(getClubStats(db));
});

app.get('/api/clubs/:id', authenticate, (req, res) => {
  const club = getClub(db, +req.params.id, req.user.id);
  if (!club) return res.status(404).json({ error: 'Kulüp bulunamadı' });
  res.json(club);
});

app.post('/api/clubs', authenticate, (req, res) => {
  const result = createClub(db, req.body, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/clubs/:id', authenticate, (req, res) => {
  const result = updateClub(db, +req.params.id, req.body, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/clubs/:id/join', authenticate, (req, res) => {
  const result = joinClub(db, +req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/clubs/:id/leave', authenticate, (req, res) => {
  const result = leaveClub(db, +req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/clubs/:id/monthly-book', authenticate, (req, res) => {
  const result = setMonthlyBook(db, +req.params.id, req.body.book_id, req.user.id, req.body.notlar);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/clubs/:id/monthly-books', authenticate, (req, res) => {
  res.json(getMonthlyBooks(db, +req.params.id));
});

app.post('/api/clubs/:id/meetings', authenticate, (req, res) => {
  const result = createMeeting(db, +req.params.id, req.body, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.put('/api/meetings/:id', authenticate, (req, res) => {
  const result = updateMeeting(db, +req.params.id, req.body, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.get('/api/clubs/:id/discussions', authenticate, (req, res) => {
  res.json(getDiscussions(db, +req.params.id));
});

app.post('/api/clubs/:id/discussions', authenticate, (req, res) => {
  const result = addDiscussion(db, +req.params.id, req.user.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(201).json(result);
});

app.delete('/api/discussions/:id', authenticate, (req, res) => {
  const result = deleteDiscussion(db, +req.params.id, req.user.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Dijital Kütüphane API: http://localhost:${PORT}`));
