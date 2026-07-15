const REQUEST_STATUSES = {
  bekliyor: { ad: 'Bekliyor', renk: 'yellow' },
  inceleniyor: { ad: 'İnceleniyor', renk: 'blue' },
  onaylandi: { ad: 'Onaylandı', renk: 'green' },
  satin_alindi: { ad: 'Satın alındı', renk: 'purple' },
  reddedildi: { ad: 'Reddedildi', renk: 'red' },
};

const ALLOWED_TRANSITIONS = {
  bekliyor: ['inceleniyor', 'onaylandi', 'reddedildi'],
  inceleniyor: ['bekliyor', 'onaylandi', 'reddedildi'],
  onaylandi: ['satin_alindi', 'reddedildi', 'inceleniyor'],
  satin_alindi: [],
  reddedildi: ['bekliyor', 'inceleniyor'],
};

const TALEP_TIPLERI = {
  ogrenci: 'Öğrenci',
  akademisyen: 'Akademisyen',
};

function migratePurchaseRequests(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kitap_adi TEXT NOT NULL,
      yazar TEXT NOT NULL,
      isbn TEXT,
      yayinevi TEXT,
      talep_nedeni TEXT NOT NULL,
      ders_bilgisi TEXT,
      talep_eden_tipi TEXT DEFAULT 'ogrenci' CHECK(talep_eden_tipi IN ('ogrenci', 'akademisyen')),
      durum TEXT DEFAULT 'bekliyor' CHECK(durum IN ('bekliyor', 'inceleniyor', 'onaylandi', 'satin_alindi', 'reddedildi')),
      admin_notu TEXT,
      red_nedeni TEXT,
      isleyen_id INTEGER,
      islem_tarihi DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (isleyen_id) REFERENCES users(id)
    )
  `);
}

function enrichRequest(db, row) {
  const user = db.prepare('SELECT ad, soyad, username, email, bolum, okul_no FROM users WHERE id = ?').get(row.user_id);
  const isleyen = row.isleyen_id
    ? db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.isleyen_id)
    : null;
  const meta = REQUEST_STATUSES[row.durum] || { ad: row.durum, renk: 'gray' };

  return {
    ...row,
    durum_adi: meta.ad,
    durum_renk: meta.renk,
    talep_eden_tipi_adi: TALEP_TIPLERI[row.talep_eden_tipi] || row.talep_eden_tipi,
    talep_eden: user
      ? {
          ad: `${user.ad || ''} ${user.soyad || ''}`.trim(),
          username: user.username,
          email: user.email,
          bolum: user.bolum,
          okul_no: user.okul_no,
        }
      : null,
    isleyen: isleyen ? `${isleyen.ad} ${isleyen.soyad}` : null,
  };
}

function getStatusMeta() {
  return {
    durumlar: Object.entries(REQUEST_STATUSES).map(([id, m]) => ({ id, ...m })),
    talep_tipleri: Object.entries(TALEP_TIPLERI).map(([id, ad]) => ({ id, ad })),
  };
}

function createPurchaseRequest(db, userId, data) {
  const kitap_adi = (data.kitap_adi || '').trim();
  const yazar = (data.yazar || '').trim();
  const talep_nedeni = (data.talep_nedeni || '').trim();
  const isbn = (data.isbn || '').trim() || null;
  const yayinevi = (data.yayinevi || '').trim() || null;
  const ders_bilgisi = (data.ders_bilgisi || '').trim() || null;
  const talep_eden_tipi = data.talep_eden_tipi === 'akademisyen' ? 'akademisyen' : 'ogrenci';

  if (!kitap_adi) return { error: 'Kitap adı zorunludur', status: 400 };
  if (!yazar) return { error: 'Yazar adı zorunludur', status: 400 };
  if (!talep_nedeni || talep_nedeni.length < 10) {
    return { error: 'Talep nedeni en az 10 karakter olmalıdır', status: 400 };
  }

  // Katalogda aynı ISBN varsa uyarı değil engel: kullanıcı yine de talep edebilir ama bilgilendir
  let katalog_uyari = null;
  if (isbn) {
    const mevcut = db.prepare('SELECT id, ad FROM books WHERE isbn = ? LIMIT 1').get(isbn);
    if (mevcut) katalog_uyari = `"${mevcut.ad}" kataloğumuzda mevcut (ISBN eşleşmesi).`;
  }

  const result = db.prepare(`
    INSERT INTO purchase_requests
      (user_id, kitap_adi, yazar, isbn, yayinevi, talep_nedeni, ders_bilgisi, talep_eden_tipi, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor')
  `).run(userId, kitap_adi, yazar, isbn, yayinevi, talep_nedeni, ders_bilgisi, talep_eden_tipi);

  const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(result.lastInsertRowid);
  return {
    request: enrichRequest(db, row),
    message: 'Satın alma talebiniz oluşturuldu',
    katalog_uyari,
  };
}

function listMyRequests(db, userId) {
  return db.prepare(`
    SELECT * FROM purchase_requests WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId).map((r) => enrichRequest(db, r));
}

function listAllRequests(db, { durum } = {}) {
  let sql = 'SELECT * FROM purchase_requests WHERE 1=1';
  const params = [];
  if (durum && REQUEST_STATUSES[durum]) {
    sql += ' AND durum = ?';
    params.push(durum);
  }
  sql += ' ORDER BY CASE durum WHEN \'bekliyor\' THEN 0 WHEN \'inceleniyor\' THEN 1 WHEN \'onaylandi\' THEN 2 ELSE 3 END, created_at DESC';
  return db.prepare(sql).all(...params).map((r) => enrichRequest(db, r));
}

function getRequestById(db, id) {
  const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id);
  return row ? enrichRequest(db, row) : null;
}

function getRequestStats(db) {
  const rows = db.prepare(`
    SELECT durum, COUNT(*) as sayi FROM purchase_requests GROUP BY durum
  `).all();
  const stats = { toplam: 0 };
  Object.keys(REQUEST_STATUSES).forEach((k) => { stats[k] = 0; });
  rows.forEach((r) => {
    stats[r.durum] = r.sayi;
    stats.toplam += r.sayi;
  });
  return stats;
}

function updateRequestStatus(db, id, staffId, data) {
  const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id);
  if (!row) return { error: 'Talep bulunamadı', status: 404 };

  const yeniDurum = data.durum;
  if (!REQUEST_STATUSES[yeniDurum]) {
    return { error: 'Geçersiz durum', status: 400 };
  }

  if (yeniDurum !== row.durum) {
    const allowed = ALLOWED_TRANSITIONS[row.durum] || [];
    if (!allowed.includes(yeniDurum)) {
      return {
        error: `"${REQUEST_STATUSES[row.durum].ad}" durumundan "${REQUEST_STATUSES[yeniDurum].ad}" durumuna geçilemez`,
        status: 400,
      };
    }
  }

  if (yeniDurum === 'reddedildi' && !(data.red_nedeni || '').trim() && !row.red_nedeni) {
    return { error: 'Reddedilirken red nedeni zorunludur', status: 400 };
  }

  db.prepare(`
    UPDATE purchase_requests SET
      durum = ?,
      admin_notu = COALESCE(?, admin_notu),
      red_nedeni = CASE WHEN ? = 'reddedildi' THEN COALESCE(?, red_nedeni) ELSE red_nedeni END,
      isleyen_id = ?,
      islem_tarihi = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    yeniDurum,
    (data.admin_notu || '').trim() || null,
    yeniDurum,
    (data.red_nedeni || '').trim() || null,
    staffId,
    id,
  );

  const updated = getRequestById(db, id);

  try {
    const { sendNotification } = require('./notificationCenter');
    const durumAd = REQUEST_STATUSES[yeniDurum].ad;
    sendNotification(db, row.user_id, 'sistem_duyurusu', {
      baslik: 'Satın alma talebi güncellendi',
      mesaj: `"${row.kitap_adi}" talebiniz: ${durumAd}${yeniDurum === 'reddedildi' && updated.red_nedeni ? ` — ${updated.red_nedeni}` : ''}`,
      link: '/uye/satin-alma',
      oncelik: yeniDurum === 'reddedildi' ? 'yuksek' : 'normal',
    });
  } catch (_) { /* ignore notify errors */ }

  return { request: updated, message: `Talep durumu "${REQUEST_STATUSES[yeniDurum].ad}" olarak güncellendi` };
}

function cancelMyRequest(db, userId, id) {
  const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id);
  if (!row) return { error: 'Talep bulunamadı', status: 404 };
  if (Number(row.user_id) !== Number(userId)) {
    return { error: 'Bu talebi iptal etme yetkiniz yok', status: 403 };
  }
  if (row.durum !== 'bekliyor') {
    return { error: 'Yalnızca "Bekliyor" durumundaki talepler iptal edilebilir', status: 400 };
  }
  db.prepare('DELETE FROM purchase_requests WHERE id = ?').run(id);
  return { message: 'Talep iptal edildi' };
}

function seedPurchaseRequestsDemo(db) {
  migratePurchaseRequests(db);
  const count = db.prepare('SELECT COUNT(*) as c FROM purchase_requests').get().c;
  if (count > 0) return;

  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  const ogrenci2 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci2'").get();
  if (!ogrenci1) return;

  const insert = db.prepare(`
    INSERT INTO purchase_requests
      (user_id, kitap_adi, yazar, isbn, yayinevi, talep_nedeni, ders_bilgisi, talep_eden_tipi, durum, admin_notu, red_nedeni)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    ogrenci1.id,
    'Clean Architecture',
    'Robert C. Martin',
    '9780134494166',
    'Prentice Hall',
    'Yazılım mimarisi dersi için güncel kaynak katalogda bulunmuyor.',
    'Yazılım Mimarisi (BLM401)',
    'ogrenci',
    'bekliyor',
    null,
    null,
  );
  insert.run(
    ogrenci1.id,
    'Deep Learning',
    'Ian Goodfellow',
    '9780262035613',
    'MIT Press',
    'Yapay zeka tez çalışmam için temel referans olarak ihtiyaç duyuyorum.',
    'Derin Öğrenme (BLM512)',
    'ogrenci',
    'inceleniyor',
    'Fiyat teklifleri toplanıyor',
    null,
  );
  if (ogrenci2) {
    insert.run(
      ogrenci2.id,
      'Introduction to Algorithms',
      'Cormen, Leiserson, Rivest, Stein',
      '9780262046305',
      'MIT Press',
      'Algoritma dersinde ek kaynak olarak kullanılacak.',
      'Algoritmalar (BLM301)',
      'akademisyen',
      'onaylandi',
      'Onaylandı — sipariş verilecek',
      null,
    );
  }
}

module.exports = {
  REQUEST_STATUSES,
  TALEP_TIPLERI,
  migratePurchaseRequests,
  getStatusMeta,
  createPurchaseRequest,
  listMyRequests,
  listAllRequests,
  getRequestById,
  getRequestStats,
  updateRequestStatus,
  cancelMyRequest,
  seedPurchaseRequestsDemo,
};
