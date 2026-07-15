const RULES = require('./rules');

const NOTIFICATION_TYPES = {
  teslim_yaklasiyor: {
    id: 'teslim_yaklasiyor',
    ad: 'Teslim tarihi yaklaşıyor',
    ikon: '🟡',
    renk: 'yellow',
    varsayilan: { app: true, email: true, sms: false, push: true },
  },
  kitap_gecikti: {
    id: 'kitap_gecikti',
    ad: 'Kitap gecikti',
    ikon: '🔴',
    renk: 'red',
    varsayilan: { app: true, email: true, sms: true, push: true },
  },
  rezervasyon_sirasi: {
    id: 'rezervasyon_sirasi',
    ad: 'Rezervasyon sırası geldi',
    ikon: '📚',
    renk: 'purple',
    varsayilan: { app: true, email: true, sms: true, push: true },
  },
  kitap_transfer: {
    id: 'kitap_transfer',
    ad: 'Kitap transfer edildi',
    ikon: '🚚',
    renk: 'cyan',
    varsayilan: { app: true, email: true, sms: false, push: true },
  },
  yeni_kitap: {
    id: 'yeni_kitap',
    ad: 'Yeni kitap eklendi',
    ikon: '✨',
    renk: 'green',
    varsayilan: { app: true, email: false, sms: false, push: false },
  },
  oda_yaklasiyor: {
    id: 'oda_yaklasiyor',
    ad: 'Oda rezervasyonu yaklaşıyor',
    ikon: '🏠',
    renk: 'blue',
    varsayilan: { app: true, email: true, sms: true, push: true },
  },
  ceza_olusturuldu: {
    id: 'ceza_olusturuldu',
    ad: 'Ceza oluşturuldu',
    ikon: '💸',
    renk: 'red',
    varsayilan: { app: true, email: true, sms: true, push: true },
  },
  ceza_odendi: {
    id: 'ceza_odendi',
    ad: 'Ceza ödendi',
    ikon: '✅',
    renk: 'green',
    varsayilan: { app: true, email: true, sms: false, push: true },
  },
  etkinlik_baslayacak: {
    id: 'etkinlik_baslayacak',
    ad: 'Etkinlik başlayacak',
    ikon: '📅',
    renk: 'purple',
    varsayilan: { app: true, email: true, sms: false, push: true },
  },
  sistem_duyurusu: {
    id: 'sistem_duyurusu',
    ad: 'Sistem duyurusu',
    ikon: '📢',
    renk: 'orange',
    varsayilan: { app: true, email: true, sms: false, push: true },
  },
  supheli_giris: {
    id: 'supheli_giris',
    ad: 'Şüpheli giriş',
    ikon: '🛡️',
    renk: 'red',
    varsayilan: { app: true, email: true, sms: true, push: true },
  },
};

const LEGACY_TYPE_MAP = {
  gecikme: 'kitap_gecikti',
  rezervasyon: 'rezervasyon_sirasi',
  transfer: 'kitap_transfer',
  oda_rezervasyon: 'oda_yaklasiyor',
  uzatma: 'teslim_yaklasiyor',
};

const CHANNELS = ['app', 'email', 'sms', 'push'];

function normalizeType(tur) {
  return LEGACY_TYPE_MAP[tur] || tur;
}

function migrateNotificationCenter(db) {
  const alters = [
    'ALTER TABLE notifications ADD COLUMN kanal TEXT DEFAULT \'app\'',
    'ALTER TABLE notifications ADD COLUMN oncelik TEXT DEFAULT \'normal\'',
    'ALTER TABLE notifications ADD COLUMN link TEXT',
    'ALTER TABLE notifications ADD COLUMN meta TEXT',
  ];
  alters.forEach((sql) => {
    try { db.exec(sql); } catch (_) { /* exists */ }
  });

  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tur TEXT NOT NULL,
      kanal_app INTEGER DEFAULT 1,
      kanal_email INTEGER DEFAULT 1,
      kanal_sms INTEGER DEFAULT 0,
      kanal_push INTEGER DEFAULT 1,
      UNIQUE(user_id, tur),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER,
      user_id INTEGER NOT NULL,
      kanal TEXT NOT NULL,
      durum TEXT DEFAULT 'gonderildi',
      detay TEXT,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (notification_id) REFERENCES notifications(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_deliveries_user ON notification_deliveries(user_id);
  `);

  // Migrate legacy tur values
  Object.entries(LEGACY_TYPE_MAP).forEach(([oldTur, newTur]) => {
    db.prepare('UPDATE notifications SET tur = ? WHERE tur = ?').run(newTur, oldTur);
  });
}

function getDefaultPreferences() {
  return Object.values(NOTIFICATION_TYPES).map((t) => ({
    tur: t.id,
    tur_adi: t.ad,
    ikon: t.ikon,
    ...t.varsayilan,
    kanal_app: t.varsayilan.app ? 1 : 0,
    kanal_email: t.varsayilan.email ? 1 : 0,
    kanal_sms: t.varsayilan.sms ? 1 : 0,
    kanal_push: t.varsayilan.push ? 1 : 0,
  }));
}

function ensureUserPreferences(db, userId) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notification_preferences (user_id, tur, kanal_app, kanal_email, kanal_sms, kanal_push)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  Object.values(NOTIFICATION_TYPES).forEach((t) => {
    insert.run(
      userId, t.id,
      t.varsayilan.app ? 1 : 0,
      t.varsayilan.email ? 1 : 0,
      t.varsayilan.sms ? 1 : 0,
      t.varsayilan.push ? 1 : 0,
    );
  });
}

function getUserPreferences(db, userId) {
  ensureUserPreferences(db, userId);
  const rows = db.prepare(`
    SELECT * FROM notification_preferences WHERE user_id = ? ORDER BY tur
  `).all(userId);

  return rows.map((r) => {
    const meta = NOTIFICATION_TYPES[r.tur] || { ad: r.tur, ikon: '🔔' };
    return {
      tur: r.tur,
      tur_adi: meta.ad,
      ikon: meta.ikon,
      kanal_app: !!r.kanal_app,
      kanal_email: !!r.kanal_email,
      kanal_sms: !!r.kanal_sms,
      kanal_push: !!r.kanal_push,
    };
  });
}

function updateUserPreferences(db, userId, prefs) {
  ensureUserPreferences(db, userId);
  const update = db.prepare(`
    UPDATE notification_preferences SET
      kanal_app = ?, kanal_email = ?, kanal_sms = ?, kanal_push = ?
    WHERE user_id = ? AND tur = ?
  `);

  (prefs || []).forEach((p) => {
    if (!NOTIFICATION_TYPES[p.tur]) return;
    update.run(
      p.kanal_app ? 1 : 0,
      p.kanal_email ? 1 : 0,
      p.kanal_sms ? 1 : 0,
      p.kanal_push ? 1 : 0,
      userId,
      p.tur,
    );
  });

  return getUserPreferences(db, userId);
}

function getPreference(db, userId, tur) {
  ensureUserPreferences(db, userId);
  const type = normalizeType(tur);
  return db.prepare('SELECT * FROM notification_preferences WHERE user_id = ? AND tur = ?').get(userId, type);
}

function logDelivery(db, notificationId, userId, kanal, durum, detay) {
  db.prepare(`
    INSERT INTO notification_deliveries (notification_id, user_id, kanal, durum, detay)
    VALUES (?, ?, ?, ?, ?)
  `).run(notificationId, userId, kanal, durum, detay || null);
}

function simulateExternalDelivery(db, user, kanal, baslik, mesaj, notificationId) {
  const contact = kanal === 'email' ? user.email : kanal === 'sms' ? user.telefon : 'mobil-cihaz';
  if (!contact && kanal !== 'push') {
    logDelivery(db, notificationId, user.id, kanal, 'basarisiz', 'İletişim bilgisi yok');
    return;
  }
  logDelivery(
    db, notificationId, user.id, kanal, 'gonderildi',
    `${kanal.toUpperCase()} simülasyonu: ${baslik}`,
  );
}

function sendNotification(db, userId, tur, { refId = null, baslik, mesaj, link = null, oncelik = 'normal', skipDuplicate = true } = {}) {
  const type = normalizeType(tur);
  if (!baslik || !mesaj) return null;

  const pref = getPreference(db, userId, type);
  if (!pref) return null;

  if (skipDuplicate && refId != null) {
    const exists = db.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND tur = ? AND ref_id = ? AND okundu = 0
    `).get(userId, type, refId);
    if (exists) return exists.id;
  }

  const user = db.prepare('SELECT id, email, telefon FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  let notificationId = null;

  if (pref.kanal_app) {
    const result = db.prepare(`
      INSERT INTO notifications (user_id, tur, ref_id, baslik, mesaj, kanal, oncelik, link)
      VALUES (?, ?, ?, ?, ?, 'app', ?, ?)
    `).run(userId, type, refId, baslik, mesaj, oncelik, link);
    notificationId = result.lastInsertRowid;
    logDelivery(db, notificationId, userId, 'app', 'gonderildi', 'Uygulama içi bildirim');
  }

  if (pref.kanal_email) {
    simulateExternalDelivery(db, user, 'email', baslik, mesaj, notificationId);
  }
  if (pref.kanal_sms) {
    simulateExternalDelivery(db, user, 'sms', baslik, mesaj, notificationId);
  }
  if (pref.kanal_push) {
    simulateExternalDelivery(db, user, 'push', baslik, mesaj, notificationId);
  }

  return notificationId;
}

function enrichNotification(row) {
  const type = normalizeType(row.tur);
  const meta = NOTIFICATION_TYPES[type] || { ad: row.tur, ikon: '🔔', renk: 'gray' };
  return {
    ...row,
    tur: type,
    tur_adi: meta.ad,
    ikon: meta.ikon,
    renk: meta.renk,
  };
}

function listUserNotifications(db, userId, { limit = 50, tur = null } = {}) {
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [userId];
  if (tur) {
    sql += ' AND tur = ?';
    params.push(normalizeType(tur));
  }
  sql += ' ORDER BY tarih DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params).map(enrichNotification);
}

function getNotificationStats(db, userId) {
  const total = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ?').get(userId).c;
  const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND okundu = 0').get(userId).c;
  const byType = db.prepare(`
    SELECT tur, COUNT(*) as c FROM notifications WHERE user_id = ? AND okundu = 0 GROUP BY tur
  `).all(userId).map((r) => ({ ...r, tur: normalizeType(r.tur), tur_adi: NOTIFICATION_TYPES[normalizeType(r.tur)]?.ad }));

  return { total, unread, by_type: byType };
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function syncRoomReservationAlerts(db, userId) {
  const { getStudyRoomById } = require('./studyRooms');
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const upcoming = db.prepare(`
    SELECT rr.*
    FROM room_reservations rr
    WHERE rr.user_id = ? AND rr.durum IN ('beklemede', 'onaylandi')
      AND rr.tarih IN (?, ?)
  `).all(userId, today, tomorrowStr);

  upcoming.forEach((rr) => {
    const room = getStudyRoomById(rr.room_id);
    const odaAdi = room?.ad || rr.room_id;
    const gun = rr.tarih === today ? 'bugün' : 'yarın';
    sendNotification(db, userId, 'oda_yaklasiyor', {
      refId: rr.id,
      baslik: 'Oda rezervasyonu yaklaşıyor',
      mesaj: `${odaAdi} odası rezervasyonunuz ${gun} ${rr.baslangic}–${rr.bitis} saatleri arasında.`,
      link: '/uye/oda-rezervasyon',
    });
  });
}

function syncEventAlerts(db, userId) {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const events = db.prepare(`
    SELECT er.event_id, e.baslik, e.tarih, e.baslangic
    FROM event_registrations er
    JOIN library_events e ON er.event_id = e.id
    WHERE er.user_id = ? AND er.durum IN ('kayitli', 'onaylandi')
      AND e.durum = 'yayinda' AND e.tarih <= ? AND e.tarih >= datetime('now')
  `).all(userId, in48h);

  events.forEach((ev) => {
    sendNotification(db, userId, 'etkinlik_baslayacak', {
      refId: ev.event_id,
      baslik: 'Etkinlik başlıyor',
      mesaj: `"${ev.baslik}" etkinliği yakında başlayacak (${new Date(ev.tarih).toLocaleDateString('tr-TR')}).`,
      link: '/uye/etkinlikler',
    });
  });
}

function broadcastAnnouncement(db, { baslik, mesaj, hedef = 'members' }) {
  let users = [];
  if (hedef === 'all') {
    users = db.prepare("SELECT id FROM users WHERE uyelik_durumu = 'aktif' OR role IN ('admin', 'librarian')").all();
  } else {
    users = db.prepare("SELECT id FROM users WHERE role = 'member' AND uyelik_durumu = 'aktif'").all();
  }

  users.forEach((u) => {
    sendNotification(db, u.id, 'sistem_duyurusu', {
      baslik,
      mesaj,
      skipDuplicate: false,
      oncelik: 'yuksek',
    });
  });

  return { count: users.length };
}

function notifyNewBook(db, book) {
  const members = db.prepare("SELECT id FROM users WHERE role = 'member' AND uyelik_durumu = 'aktif'").all();
  members.forEach((m) => {
    sendNotification(db, m.id, 'yeni_kitap', {
      refId: book.id,
      baslik: 'Yeni kitap eklendi',
      mesaj: `"${book.ad}" — ${book.yazar} (${book.kategori || 'Genel'}) kütüphaneye eklendi.`,
      link: '/uye/kitaplar',
    });
  });
}

function notifyPenaltyCreated(db, userId, penalty, kitapAdi) {
  sendNotification(db, userId, 'ceza_olusturuldu', {
    refId: penalty.id,
    baslik: 'Yeni ceza oluşturuldu',
    mesaj: `${kitapAdi ? `"${kitapAdi}" için ` : ''}${penalty.tutar?.toFixed(2) || penalty.tutar} ₺ ceza kaydı oluşturuldu.`,
    link: '/uye/profil',
    oncelik: 'yuksek',
  });
}

function notifyPenaltyPaid(db, userId, penalty) {
  sendNotification(db, userId, 'ceza_odendi', {
    refId: penalty.id,
    baslik: 'Ceza ödendi',
    mesaj: `${penalty.tutar?.toFixed(2) || penalty.tutar} ₺ tutarındaki cezanız ödendi olarak işaretlendi.`,
    link: '/uye/profil',
  });
}

function syncAllUserAlerts(db, userId) {
  const { syncUserNotifications } = require('./notifications');
  syncUserNotifications(db, userId);
  syncRoomReservationAlerts(db, userId);
  syncEventAlerts(db, userId);
}

function seedNotificationDemo(db) {
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  if (!ogrenci1) return;

  const count = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ?').get(ogrenci1.id).c;
  if (count >= 5) return;

  ensureUserPreferences(db, ogrenci1.id);

  const demos = [
    { tur: 'teslim_yaklasiyor', baslik: 'Teslim tarihi yaklaşıyor', mesaj: '"1984" kitabını 2 gün içinde iade etmelisiniz.', link: '/uye/profil' },
    { tur: 'rezervasyon_sirasi', baslik: 'Kitabınız hazır!', mesaj: '"Suç ve Ceza" kitabı almaya hazır. 24 saat içinde teslim alın.', link: '/uye/kitaplar' },
    { tur: 'yeni_kitap', baslik: 'Yeni kitap eklendi', mesaj: '"Atomic Habits" — James Clear (Kişisel Gelişim) kütüphaneye eklendi.', link: '/uye/kitaplar' },
    { tur: 'sistem_duyurusu', baslik: 'Kütüphane duyurusu', mesaj: 'Final döneminde çalışma odaları 22:00\'ye kadar açıktır.', link: '/uye' },
    { tur: 'etkinlik_baslayacak', baslik: 'Etkinlik başlıyor', mesaj: '"Python Atölyesi" etkinliği yarın başlıyor.', link: '/uye/etkinlikler' },
  ];

  demos.forEach((d, i) => {
    sendNotification(db, ogrenci1.id, d.tur, {
      baslik: d.baslik,
      mesaj: d.mesaj,
      link: d.link,
      skipDuplicate: false,
      refId: 1000 + i,
    });
  });
}

module.exports = {
  NOTIFICATION_TYPES,
  CHANNELS,
  LEGACY_TYPE_MAP,
  migrateNotificationCenter,
  normalizeType,
  sendNotification,
  getUserPreferences,
  updateUserPreferences,
  listUserNotifications,
  getNotificationStats,
  syncRoomReservationAlerts,
  syncEventAlerts,
  syncAllUserAlerts,
  broadcastAnnouncement,
  notifyNewBook,
  notifyPenaltyCreated,
  notifyPenaltyPaid,
  seedNotificationDemo,
};
