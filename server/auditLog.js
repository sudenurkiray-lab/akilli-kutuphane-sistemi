const SKIP_PREFIXES = [
  '/api/notifications',
  '/api/auth/me',
  '/api/books/categories',
  '/api/inventory/rafs',
  '/api/staff/meta',
  '/api/donations/meta',
  '/api/purchase-requests/meta',
  '/api/penalties/types',
  '/api/return-inspections/conditions',
  '/api/transfers/flow',
];

const SKIP_EXACT = new Set([
  '/api/auth/login', // handled explicitly after success
  '/api/auth/login/2fa',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/captcha',
]);

const ACTION_LABELS = {
  giris: 'Sisteme giriş',
  sifre_sifirlama: 'Şifre sıfırlama',
  sifre_degistirme: 'Şifre değiştirme',
  '2fa_aktif': '2FA etkinleştirildi',
  '2fa_kapatildi': '2FA kapatıldı',
  kitap_ekleme: 'Kitap eklendi',
  kitap_guncelleme: 'Kitap güncellendi',
  kitap_silme: 'Kitap silindi',
  uye_ekleme: 'Üye eklendi',
  uye_guncelleme: 'Üye güncellendi',
  personel_ekleme: 'Personel eklendi',
  personel_guncelleme: 'Personel güncellendi',
  gorev_atama: 'Görev atandı',
  gorev_guncelleme: 'Görev güncellendi',
  odunc_verme: 'Ödünç verildi',
  iade_alma: 'İade alındı',
  odunc_uzatma: 'Ödünç uzatıldı',
  ceza_olusturma: 'Ceza oluşturuldu',
  ceza_odeme: 'Ceza ödendi işaretlendi',
  ceza_iptal: 'Ceza iptal edildi',
  ceza_indirim: 'Ceza indirimi uygulandı',
  ceza_taksit: 'Ceza taksitlendirildi',
  ceza_not: 'Ceza notu güncellendi',
  ceza_dekont: 'Ceza dekontu incelendi',
  kopya_ekleme: 'Kopya eklendi',
  kopya_guncelleme: 'Kopya / kitap durumu güncellendi',
  kopya_silme: 'Kopya silindi',
  scan_odunc: 'QR ile ödünç',
  scan_iade: 'QR ile iade',
  scan_hasar: 'QR ile hasar kaydı',
  bagis_durum: 'Bağış durumu değişti',
  satin_alma_durum: 'Satın alma talebi durumu değişti',
  envanter_baslat: 'Envanter sayımı başlatıldı',
  envanter_tamamla: 'Envanter sayımı tamamlandı',
  envanter_iptal: 'Envanter sayımı iptal edildi',
  duyuru: 'Sistem duyurusu gönderildi',
  diger: 'Diğer işlem',
};

function migrateAuditSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      user_role TEXT,
      user_ad TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ozet TEXT NOT NULL,
      detay TEXT,
      ip_adresi TEXT,
      method TEXT,
      path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
  `);
}

function logAudit(db, {
  user = null,
  action = 'diger',
  entity_type = null,
  entity_id = null,
  ozet,
  detay = null,
  ip_adresi = null,
  method = null,
  path = null,
} = {}) {
  if (!ozet) return null;
  const ad = user ? `${user.ad || ''} ${user.soyad || ''}`.trim() : null;
  const detayStr = detay == null
    ? null
    : (typeof detay === 'string' ? detay : JSON.stringify(detay));

  const result = db.prepare(`
    INSERT INTO audit_logs (
      user_id, username, user_role, user_ad, action, entity_type, entity_id,
      ozet, detay, ip_adresi, method, path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user?.id || null,
    user?.username || null,
    user?.role || null,
    ad || null,
    action,
    entity_type,
    entity_id != null ? String(entity_id) : null,
    ozet,
    detayStr,
    ip_adresi,
    method,
    path,
  );
  return result.lastInsertRowid;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

function shouldSkip(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const p = req.path || req.url?.split('?')[0] || '';
  if (SKIP_EXACT.has(p)) return true;
  if (SKIP_PREFIXES.some((pre) => p.startsWith(pre))) return true;
  if (p.match(/^\/api\/books\/\d+\/view$/)) return true;
  if (p.match(/^\/api\/books\/\d+\/(favorite|rate)$/)) return true;
  if (p.match(/^\/api\/inventory\/sessions\/\d+\/scan$/)) return true;
  if (p.includes('/read') || p.includes('/read-all')) return true;
  return false;
}

function classify(req) {
  const p = req.path || '';
  const m = req.method;
  const body = req.body || {};
  const override = req.audit || {};

  let m1;
  const take = (re) => {
    m1 = p.match(re);
    return m1;
  };

  if (m === 'DELETE' && take(/^\/api\/books\/(\d+)$/)) {
    return {
      action: 'kitap_silme',
      entity_type: 'book',
      entity_id: m1[1],
      ozet: override.ozet || `Kitap silindi (#${m1[1]})`,
    };
  }
  if (m === 'POST' && p === '/api/books') {
    return {
      action: 'kitap_ekleme',
      entity_type: 'book',
      entity_id: null,
      ozet: `Kitap eklendi: ${body.ad || '—'}`,
      detay: { ad: body.ad, yazar: body.yazar, isbn: body.isbn },
    };
  }
  if (m === 'PUT' && take(/^\/api\/books\/(\d+)$/)) {
    return {
      action: 'kitap_guncelleme',
      entity_type: 'book',
      entity_id: m1[1],
      ozet: `Kitap güncellendi (#${m1[1]})${body.durum ? ` — durum: ${body.durum}` : ''}`,
      detay: { durum: body.durum, ad: body.ad, raf_no: body.raf_no },
    };
  }

  if (m === 'POST' && p === '/api/members') {
    return {
      action: 'uye_ekleme',
      entity_type: 'user',
      ozet: `Üye eklendi: ${body.ad || ''} ${body.soyad || ''}`.trim(),
      detay: { username: body.username, okul_no: body.okul_no },
    };
  }
  if (m === 'PUT' && take(/^\/api\/members\/(\d+)$/)) {
    return {
      action: 'uye_guncelleme',
      entity_type: 'user',
      entity_id: m1[1],
      ozet: body.uyelik_durumu === 'pasif'
        ? `Üye pasif yapıldı (#${m1[1]})`
        : `Üye güncellendi (#${m1[1]})${body.uyelik_durumu ? ` — üyelik: ${body.uyelik_durumu}` : ''}`,
      detay: { uyelik_durumu: body.uyelik_durumu, ad: body.ad, soyad: body.soyad },
    };
  }

  if (m === 'POST' && p === '/api/staff') {
    return {
      action: 'personel_ekleme',
      entity_type: 'staff',
      ozet: `Personel eklendi: ${body.ad || ''} ${body.soyad || ''}`.trim(),
    };
  }
  if (m === 'PUT' && take(/^\/api\/staff\/(\d+)$/)) {
    return {
      action: 'personel_guncelleme',
      entity_type: 'staff',
      entity_id: m1[1],
      ozet: `Personel güncellendi (#${m1[1]})${body.izin_durumu ? ` — izin: ${body.izin_durumu}` : ''}`,
      detay: { izin_durumu: body.izin_durumu, gorev: body.gorev, vardiya: body.vardiya },
    };
  }
  if (m === 'POST' && p === '/api/staff-tasks') {
    return {
      action: 'gorev_atama',
      entity_type: 'staff_task',
      ozet: `Görev atandı: ${body.baslik || '—'}`,
      detay: { assigned_to: body.assigned_to },
    };
  }
  if (m === 'PUT' && take(/^\/api\/staff-tasks\/(\d+)$/)) {
    return {
      action: 'gorev_guncelleme',
      entity_type: 'staff_task',
      entity_id: m1[1],
      ozet: `Görev güncellendi (#${m1[1]})${body.durum ? ` — ${body.durum}` : ''}`,
    };
  }

  if (m === 'POST' && p === '/api/loans') {
    return {
      action: 'odunc_verme',
      entity_type: 'loan',
      ozet: `Ödünç verildi — kitap #${body.book_id}, üye #${body.user_id || 'kendisi'}`,
      detay: { book_id: body.book_id, user_id: body.user_id },
    };
  }
  if (m === 'POST' && take(/^\/api\/loans\/(\d+)\/return$/)) {
    return {
      action: 'iade_alma',
      entity_type: 'loan',
      entity_id: m1[1],
      ozet: `İade alındı — ödünç #${m1[1]}`,
      detay: { kitap_durumu: body.kitap_durumu },
    };
  }
  if (m === 'POST' && take(/^\/api\/loans\/(\d+)\/extend$/)) {
    return {
      action: 'odunc_uzatma',
      entity_type: 'loan',
      entity_id: m1[1],
      ozet: `Ödünç uzatıldı (#${m1[1]})`,
    };
  }

  if (m === 'POST' && p === '/api/penalties') {
    return {
      action: 'ceza_olusturma',
      entity_type: 'penalty',
      ozet: `Ceza oluşturuldu — üye #${body.user_id}, tutar ${body.tutar ?? '—'}`,
      detay: { tur: body.tur, tutar: body.tutar },
    };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/pay$/)) {
    return { action: 'ceza_odeme', entity_type: 'penalty', entity_id: m1[1], ozet: `Ceza ödendi (#${m1[1]})` };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/cancel$/)) {
    return { action: 'ceza_iptal', entity_type: 'penalty', entity_id: m1[1], ozet: `Ceza iptal edildi (#${m1[1]})` };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/discount$/)) {
    return {
      action: 'ceza_indirim',
      entity_type: 'penalty',
      entity_id: m1[1],
      ozet: `Ceza indirimi (#${m1[1]}) — ${body.indirim_tutari ?? body.tutar ?? ''}`,
      detay: body,
    };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/installments$/)) {
    return { action: 'ceza_taksit', entity_type: 'penalty', entity_id: m1[1], ozet: `Ceza taksitlendirildi (#${m1[1]})` };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/note$/)) {
    return { action: 'ceza_not', entity_type: 'penalty', entity_id: m1[1], ozet: `Ceza notu güncellendi (#${m1[1]})` };
  }
  if (m === 'PUT' && take(/^\/api\/penalties\/(\d+)\/receipt\/review$/)) {
    return {
      action: 'ceza_dekont',
      entity_type: 'penalty',
      entity_id: m1[1],
      ozet: `Ceza dekontu ${body.onay ? 'onaylandı' : 'reddedildi'} (#${m1[1]})`,
    };
  }

  if (m === 'POST' && p === '/api/copies') {
    return { action: 'kopya_ekleme', entity_type: 'copy', ozet: `Kopya eklendi — kitap #${body.book_id}` };
  }
  if (m === 'PUT' && take(/^\/api\/copies\/(\d+)$/)) {
    return {
      action: 'kopya_guncelleme',
      entity_type: 'copy',
      entity_id: m1[1],
      ozet: `Kopya güncellendi (#${m1[1]})${body.fiziksel_durum ? ` — durum: ${body.fiziksel_durum}` : ''}${body.raf_no ? `, raf: ${body.raf_no}` : ''}`,
      detay: { fiziksel_durum: body.fiziksel_durum, raf_no: body.raf_no },
    };
  }
  if (m === 'DELETE' && take(/^\/api\/copies\/(\d+)$/)) {
    return { action: 'kopya_silme', entity_type: 'copy', entity_id: m1[1], ozet: `Kopya silindi (#${m1[1]})` };
  }

  if (m === 'POST' && p === '/api/scan/lend') {
    return { action: 'scan_odunc', entity_type: 'scan', ozet: 'QR ile ödünç verildi', detay: body };
  }
  if (m === 'POST' && p === '/api/scan/return') {
    return { action: 'scan_iade', entity_type: 'scan', ozet: 'QR ile iade alındı', detay: { copy_code: body.copy_code } };
  }
  if (m === 'POST' && p === '/api/scan/damage') {
    return { action: 'scan_hasar', entity_type: 'scan', ozet: 'QR ile hasar kaydı', detay: body };
  }

  if (m === 'PUT' && take(/^\/api\/donations\/(\d+)\/status$/)) {
    return {
      action: 'bagis_durum',
      entity_type: 'donation',
      entity_id: m1[1],
      ozet: `Bağış durumu: ${body.durum || 'güncellendi'} (#${m1[1]})`,
    };
  }
  if (m === 'PUT' && take(/^\/api\/purchase-requests\/(\d+)\/status$/)) {
    return {
      action: 'satin_alma_durum',
      entity_type: 'purchase_request',
      entity_id: m1[1],
      ozet: `Satın alma talebi: ${body.durum || 'güncellendi'} (#${m1[1]})`,
    };
  }

  if (m === 'POST' && p === '/api/inventory/sessions') {
    return {
      action: 'envanter_baslat',
      entity_type: 'inventory',
      ozet: `Envanter sayımı başlatıldı${body.raf_no ? ` — raf ${body.raf_no}` : ''}`,
    };
  }
  if (m === 'PUT' && take(/^\/api\/inventory\/sessions\/(\d+)\/complete$/)) {
    return { action: 'envanter_tamamla', entity_type: 'inventory', entity_id: m1[1], ozet: `Envanter sayımı tamamlandı (#${m1[1]})` };
  }
  if (m === 'PUT' && take(/^\/api\/inventory\/sessions\/(\d+)\/cancel$/)) {
    return { action: 'envanter_iptal', entity_type: 'inventory', entity_id: m1[1], ozet: `Envanter sayımı iptal (#${m1[1]})` };
  }

  if (m === 'POST' && p === '/api/notifications/announce') {
    return { action: 'duyuru', entity_type: 'notification', ozet: `Duyuru: ${body.baslik || '—'}` };
  }

  if (p.startsWith('/api/')) {
    const idMatch = p.match(/\/(\d+)(?:\/|$)/);
    return {
      action: 'diger',
      entity_type: p.split('/')[2] || 'api',
      entity_id: idMatch ? idMatch[1] : null,
      ozet: `${m} ${p}`,
    };
  }
  return null;
}

function createAuditMiddleware(db) {
  return function auditMiddleware(req, res, next) {
    if (shouldSkip(req)) return next();

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      try {
        const status = res.statusCode || 200;
        if (status < 400 && req.user) {
          const info = { ...(classify(req) || {}), ...(req.audit || {}) };
          if (info.action && info.ozet) {
            // Enrich entity_id from response when created
            if (!info.entity_id && payload?.id) info.entity_id = payload.id;
            if (!info.entity_id && payload?.request?.id) info.entity_id = payload.request.id;
            if (!info.entity_id && payload?.donation?.id) info.entity_id = payload.donation.id;
            if (!info.entity_id && payload?.staff?.id) info.entity_id = payload.staff.id;
            if (!info.entity_id && payload?.session?.id) info.entity_id = payload.session.id;
            if (!info.entity_id && payload?.task?.id) info.entity_id = payload.task.id;

            logAudit(db, {
              user: req.user,
              action: info.action,
              entity_type: info.entity_type,
              entity_id: info.entity_id,
              ozet: info.ozet,
              detay: info.detay || null,
              ip_adresi: clientIp(req),
              method: req.method,
              path: req.path,
            });
          }
        }
      } catch (_) { /* never break API */ }
      return originalJson(payload);
    };
    next();
  };
}

function listAuditLogs(db, {
  action, user_id, entity_type, q, from, to, limit = 100, offset = 0,
} = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (user_id) { sql += ' AND user_id = ?'; params.push(user_id); }
  if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(`${to} 23:59:59`); }
  if (q) {
    sql += ' AND (ozet LIKE ? OR username LIKE ? OR user_ad LIKE ? OR detay LIKE ?)';
    const s = `%${q}%`;
    params.push(s, s, s, s);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(parseInt(limit, 10) || 100, 500), parseInt(offset, 10) || 0);

  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => ({
    ...r,
    action_adi: ACTION_LABELS[r.action] || r.action,
    detay_obj: (() => {
      if (!r.detay) return null;
      try { return JSON.parse(r.detay); } catch { return r.detay; }
    })(),
  }));
}

function getAuditStats(db) {
  const toplam = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;
  const bugun = db.prepare(`
    SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now')
  `).get().c;
  const byAction = db.prepare(`
    SELECT action, COUNT(*) as sayi FROM audit_logs
    GROUP BY action ORDER BY sayi DESC LIMIT 12
  `).all().map((r) => ({ ...r, action_adi: ACTION_LABELS[r.action] || r.action }));

  return { toplam, bugun, byAction };
}

function getAuditMeta() {
  return {
    actions: Object.entries(ACTION_LABELS).map(([id, ad]) => ({ id, ad })),
  };
}

function seedAuditDemo(db) {
  migrateAuditSchema(db);
  const count = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;
  if (count > 0) return;

  const admin = db.prepare("SELECT id, username, role, ad, soyad FROM users WHERE username = 'admin'").get();
  const lib = db.prepare("SELECT id, username, role, ad, soyad FROM users WHERE username = 'kutuphaneci'").get();
  if (!admin) return;

  const samples = [
    { user: admin, action: 'giris', ozet: 'Sisteme giriş yapıldı', entity_type: 'auth' },
    { user: admin, action: 'uye_guncelleme', ozet: 'Üye pasif yapıldı (#3)', entity_type: 'user', entity_id: '3', detay: { uyelik_durumu: 'pasif' } },
    { user: lib || admin, action: 'odunc_verme', ozet: 'Ödünç verildi — kitap #10', entity_type: 'loan' },
    { user: admin, action: 'ceza_indirim', ozet: 'Ceza indirimi (#1)', entity_type: 'penalty', entity_id: '1' },
    { user: lib || admin, action: 'kopya_guncelleme', ozet: 'Kopya güncellendi — durum: rafta', entity_type: 'copy' },
    { user: admin, action: 'kitap_silme', ozet: 'Kitap silindi (#999 — demo)', entity_type: 'book', entity_id: '999' },
  ];

  samples.forEach((s, i) => {
    logAudit(db, {
      ...s,
      path: '/api/demo',
      method: 'POST',
      ip_adresi: '127.0.0.1',
    });
    // Backdate slightly for variety
    db.prepare(`UPDATE audit_logs SET created_at = datetime('now', ?) WHERE id = (SELECT MAX(id) FROM audit_logs)`)
      .run(`-${i * 3} hours`);
  });
}

module.exports = {
  ACTION_LABELS,
  migrateAuditSchema,
  logAudit,
  createAuditMiddleware,
  listAuditLogs,
  getAuditStats,
  getAuditMeta,
  seedAuditDemo,
  clientIp,
};
