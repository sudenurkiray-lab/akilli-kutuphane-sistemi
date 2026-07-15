const { createCopy, syncBookStock } = require('./copies');

const DONATION_STATUSES = {
  bekliyor: { ad: 'Bekliyor', renk: 'yellow' },
  inceleniyor: { ad: 'İnceleniyor', renk: 'blue' },
  kabul_edildi: { ad: 'Kabul edildi', renk: 'green' },
  reddedildi: { ad: 'Reddedildi', renk: 'red' },
};

const BOOK_CONDITIONS = {
  iyi: { ad: 'İyi', renk: 'green' },
  hafif_hasarli: { ad: 'Hafif hasarlı', renk: 'yellow' },
  orta: { ad: 'Orta', renk: 'orange' },
  kotu: { ad: 'Kötü', renk: 'red' },
};

const ALLOWED_TRANSITIONS = {
  bekliyor: ['inceleniyor', 'kabul_edildi', 'reddedildi'],
  inceleniyor: ['bekliyor', 'kabul_edildi', 'reddedildi'],
  kabul_edildi: [],
  reddedildi: ['inceleniyor', 'bekliyor'],
};

function migrateBookDonations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      bagisci_ad TEXT NOT NULL,
      bagisci_soyad TEXT NOT NULL,
      bagisci_email TEXT,
      bagisci_telefon TEXT,
      kitap_adi TEXT NOT NULL,
      yazar TEXT NOT NULL,
      isbn TEXT,
      yayinevi TEXT,
      basim_yili INTEGER,
      kategori TEXT,
      kitap_durumu TEXT NOT NULL DEFAULT 'iyi'
        CHECK(kitap_durumu IN ('iyi', 'hafif_hasarli', 'orta', 'kotu')),
      bagis_tarihi TEXT NOT NULL,
      aciklama TEXT,
      durum TEXT DEFAULT 'bekliyor'
        CHECK(durum IN ('bekliyor', 'inceleniyor', 'kabul_edildi', 'reddedildi')),
      admin_notu TEXT,
      red_nedeni TEXT,
      book_id INTEGER,
      isleyen_id INTEGER,
      islem_tarihi DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (isleyen_id) REFERENCES users(id)
    )
  `);

  try {
    db.exec('ALTER TABLE books ADD COLUMN bagis INTEGER DEFAULT 0');
  } catch (_) { /* exists */ }
}

function enrichDonation(db, row) {
  const user = row.user_id
    ? db.prepare('SELECT ad, soyad, username, email, telefon, bolum FROM users WHERE id = ?').get(row.user_id)
    : null;
  const isleyen = row.isleyen_id
    ? db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.isleyen_id)
    : null;
  const book = row.book_id
    ? db.prepare('SELECT id, ad, yazar, isbn, bagis FROM books WHERE id = ?').get(row.book_id)
    : null;
  const durumMeta = DONATION_STATUSES[row.durum] || { ad: row.durum, renk: 'gray' };
  const kosulMeta = BOOK_CONDITIONS[row.kitap_durumu] || { ad: row.kitap_durumu, renk: 'gray' };

  return {
    ...row,
    durum_adi: durumMeta.ad,
    durum_renk: durumMeta.renk,
    kitap_durumu_adi: kosulMeta.ad,
    kitap_durumu_renk: kosulMeta.renk,
    bagisci_tam_ad: `${row.bagisci_ad || ''} ${row.bagisci_soyad || ''}`.trim(),
    uye: user
      ? {
          ad: `${user.ad || ''} ${user.soyad || ''}`.trim(),
          username: user.username,
          email: user.email,
          bolum: user.bolum,
        }
      : null,
    isleyen: isleyen ? `${isleyen.ad} ${isleyen.soyad}` : null,
    katalog_kitap: book,
  };
}

function getDonationMeta() {
  return {
    durumlar: Object.entries(DONATION_STATUSES).map(([id, m]) => ({ id, ...m })),
    kosullar: Object.entries(BOOK_CONDITIONS).map(([id, m]) => ({ id, ...m })),
  };
}

function createDonation(db, userId, data) {
  const user = userId
    ? db.prepare('SELECT ad, soyad, email, telefon FROM users WHERE id = ?').get(userId)
    : null;

  const bagisci_ad = (data.bagisci_ad || user?.ad || '').trim();
  const bagisci_soyad = (data.bagisci_soyad || user?.soyad || '').trim();
  const bagisci_email = (data.bagisci_email || user?.email || '').trim() || null;
  const bagisci_telefon = (data.bagisci_telefon || user?.telefon || '').trim() || null;
  const kitap_adi = (data.kitap_adi || '').trim();
  const yazar = (data.yazar || '').trim();
  const isbn = (data.isbn || '').trim() || null;
  const yayinevi = (data.yayinevi || '').trim() || null;
  const kategori = (data.kategori || '').trim() || 'Diğer';
  const basim_yili = data.basim_yili ? parseInt(data.basim_yili, 10) : null;
  const kitap_durumu = BOOK_CONDITIONS[data.kitap_durumu] ? data.kitap_durumu : 'iyi';
  const bagis_tarihi = (data.bagis_tarihi || new Date().toISOString().slice(0, 10)).trim();
  const aciklama = (data.aciklama || '').trim() || null;

  if (!bagisci_ad || !bagisci_soyad) {
    return { error: 'Bağışçı adı ve soyadı zorunludur', status: 400 };
  }
  if (!kitap_adi) return { error: 'Kitap adı zorunludur', status: 400 };
  if (!yazar) return { error: 'Yazar adı zorunludur', status: 400 };
  if (!BOOK_CONDITIONS[kitap_durumu]) {
    return { error: 'Geçersiz kitap durumu', status: 400 };
  }

  const result = db.prepare(`
    INSERT INTO book_donations (
      user_id, bagisci_ad, bagisci_soyad, bagisci_email, bagisci_telefon,
      kitap_adi, yazar, isbn, yayinevi, basim_yili, kategori,
      kitap_durumu, bagis_tarihi, aciklama, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor')
  `).run(
    userId || null,
    bagisci_ad,
    bagisci_soyad,
    bagisci_email,
    bagisci_telefon,
    kitap_adi,
    yazar,
    isbn,
    yayinevi,
    Number.isFinite(basim_yili) ? basim_yili : null,
    kategori,
    kitap_durumu,
    bagis_tarihi,
    aciklama,
  );

  const row = db.prepare('SELECT * FROM book_donations WHERE id = ?').get(result.lastInsertRowid);
  return {
    donation: enrichDonation(db, row),
    message: 'Bağış başvurunuz alındı',
  };
}

function listMyDonations(db, userId) {
  return db.prepare(`
    SELECT * FROM book_donations WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId).map((r) => enrichDonation(db, r));
}

function listAllDonations(db, { durum } = {}) {
  let sql = 'SELECT * FROM book_donations WHERE 1=1';
  const params = [];
  if (durum && DONATION_STATUSES[durum]) {
    sql += ' AND durum = ?';
    params.push(durum);
  }
  sql += ` ORDER BY CASE durum
    WHEN 'bekliyor' THEN 0
    WHEN 'inceleniyor' THEN 1
    WHEN 'kabul_edildi' THEN 2
    ELSE 3 END, created_at DESC`;
  return db.prepare(sql).all(...params).map((r) => enrichDonation(db, r));
}

function getDonationById(db, id) {
  const row = db.prepare('SELECT * FROM book_donations WHERE id = ?').get(id);
  return row ? enrichDonation(db, row) : null;
}

function getDonationStats(db) {
  const rows = db.prepare(`
    SELECT durum, COUNT(*) as sayi FROM book_donations GROUP BY durum
  `).all();
  const stats = { toplam: 0 };
  Object.keys(DONATION_STATUSES).forEach((k) => { stats[k] = 0; });
  rows.forEach((r) => {
    stats[r.durum] = r.sayi;
    stats.toplam += r.sayi;
  });
  return stats;
}

function acceptDonationIntoCatalog(db, donation) {
  let book = null;
  if (donation.isbn) {
    book = db.prepare('SELECT * FROM books WHERE isbn = ?').get(donation.isbn);
  }

  if (!book) {
    const insert = db.prepare(`
      INSERT INTO books (ad, yazar, kategori, isbn, yayinevi, basim_yili, stok, durum, bagis)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'mevcut', 1)
    `).run(
      donation.kitap_adi,
      donation.yazar,
      donation.kategori || 'Diğer',
      donation.isbn || null,
      donation.yayinevi || null,
      donation.basim_yili || null,
    );
    book = db.prepare('SELECT * FROM books WHERE id = ?').get(insert.lastInsertRowid);
  } else {
    db.prepare('UPDATE books SET bagis = 1 WHERE id = ?').run(book.id);
    book = db.prepare('SELECT * FROM books WHERE id = ?').get(book.id);
  }

  const maxNo = db.prepare('SELECT COALESCE(MAX(kopya_no), 0) as m FROM book_copies WHERE book_id = ?').get(book.id).m;
  const fiziksel = donation.kitap_durumu === 'iyi' ? 'rafta'
    : donation.kitap_durumu === 'kotu' ? 'hasarli'
      : 'rafta';

  createCopy(db, book, maxNo + 1, fiziksel, {
    satin_alma_tarihi: donation.bagis_tarihi,
    maliyet: 0,
  });
  syncBookStock(db, book.id);

  return book.id;
}

function updateDonationStatus(db, id, staffId, data) {
  const row = db.prepare('SELECT * FROM book_donations WHERE id = ?').get(id);
  if (!row) return { error: 'Bağış kaydı bulunamadı', status: 404 };

  const yeniDurum = data.durum;
  if (!DONATION_STATUSES[yeniDurum]) {
    return { error: 'Geçersiz durum', status: 400 };
  }

  if (yeniDurum !== row.durum) {
    const allowed = ALLOWED_TRANSITIONS[row.durum] || [];
    if (!allowed.includes(yeniDurum)) {
      return {
        error: `"${DONATION_STATUSES[row.durum].ad}" durumundan "${DONATION_STATUSES[yeniDurum].ad}" durumuna geçilemez`,
        status: 400,
      };
    }
  }

  if (yeniDurum === 'reddedildi' && !(data.red_nedeni || '').trim() && !row.red_nedeni) {
    return { error: 'Reddedilirken red nedeni zorunludur', status: 400 };
  }

  let bookId = row.book_id;
  if (yeniDurum === 'kabul_edildi' && !bookId) {
    bookId = acceptDonationIntoCatalog(db, row);
  }

  db.prepare(`
    UPDATE book_donations SET
      durum = ?,
      admin_notu = COALESCE(?, admin_notu),
      red_nedeni = CASE WHEN ? = 'reddedildi' THEN COALESCE(?, red_nedeni) ELSE red_nedeni END,
      book_id = COALESCE(?, book_id),
      isleyen_id = ?,
      islem_tarihi = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    yeniDurum,
    (data.admin_notu || '').trim() || null,
    yeniDurum,
    (data.red_nedeni || '').trim() || null,
    bookId,
    staffId,
    id,
  );

  const updated = getDonationById(db, id);

  if (row.user_id) {
    try {
      const { sendNotification } = require('./notificationCenter');
      sendNotification(db, row.user_id, 'sistem_duyurusu', {
        baslik: 'Bağış başvurunuz güncellendi',
        mesaj: `"${row.kitap_adi}" bağışınız: ${DONATION_STATUSES[yeniDurum].ad}${
          yeniDurum === 'kabul_edildi' ? ' — kitap kataloğa Bağış Kitap etiketiyle eklendi.' : ''
        }${yeniDurum === 'reddedildi' && updated.red_nedeni ? ` — ${updated.red_nedeni}` : ''}`,
        link: '/uye/bagis',
        oncelik: yeniDurum === 'reddedildi' ? 'yuksek' : 'normal',
      });
    } catch (_) { /* ignore */ }
  }

  return {
    donation: updated,
    message: `Bağış durumu "${DONATION_STATUSES[yeniDurum].ad}" olarak güncellendi`,
  };
}

function cancelMyDonation(db, userId, id) {
  const row = db.prepare('SELECT * FROM book_donations WHERE id = ?').get(id);
  if (!row) return { error: 'Bağış kaydı bulunamadı', status: 404 };
  if (Number(row.user_id) !== Number(userId)) {
    return { error: 'Bu kaydı iptal etme yetkiniz yok', status: 403 };
  }
  if (row.durum !== 'bekliyor') {
    return { error: 'Yalnızca bekleyen başvurular iptal edilebilir', status: 400 };
  }
  db.prepare('DELETE FROM book_donations WHERE id = ?').run(id);
  return { message: 'Bağış başvurusu iptal edildi' };
}

function seedBookDonationsDemo(db) {
  migrateBookDonations(db);
  const count = db.prepare('SELECT COUNT(*) as c FROM book_donations').get().c;
  if (count > 0) return;

  const ogrenci1 = db.prepare("SELECT id, ad, soyad, email, telefon FROM users WHERE username = 'ogrenci1'").get();
  const ogrenci2 = db.prepare("SELECT id, ad, soyad, email, telefon FROM users WHERE username = 'ogrenci2'").get();
  if (!ogrenci1) return;

  const insert = db.prepare(`
    INSERT INTO book_donations (
      user_id, bagisci_ad, bagisci_soyad, bagisci_email, bagisci_telefon,
      kitap_adi, yazar, isbn, yayinevi, basim_yili, kategori,
      kitap_durumu, bagis_tarihi, aciklama, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?)
  `);

  insert.run(
    ogrenci1.id, ogrenci1.ad, ogrenci1.soyad, ogrenci1.email, ogrenci1.telefon,
    'Sapiens', 'Yuval Noah Harari', '9780062316097', 'Harper', 2015, 'Tarih',
    'iyi', 'Fakülte kitaplığımda fazladan bir kopyam var.', 'bekliyor',
  );
  insert.run(
    ogrenci1.id, ogrenci1.ad, ogrenci1.soyad, ogrenci1.email, ogrenci1.telefon,
    'Atomic Habits', 'James Clear', '9780735211292', 'Avery', 2018, 'Kişisel Gelişim',
    'hafif_hasarli', 'Kapakta hafif çizik var, sayfalar temiz.', 'inceleniyor',
  );
  if (ogrenci2) {
    insert.run(
      ogrenci2.id, ogrenci2.ad, ogrenci2.soyad, ogrenci2.email, ogrenci2.telefon,
      'Thinking, Fast and Slow', 'Daniel Kahneman', '9780374533557', 'FSG', 2013, 'Psikoloji',
      'iyi', 'Ders kaynağı olarak bağışlamak istiyorum.', 'bekliyor',
    );
  }
}

module.exports = {
  DONATION_STATUSES,
  BOOK_CONDITIONS,
  migrateBookDonations,
  getDonationMeta,
  createDonation,
  listMyDonations,
  listAllDonations,
  getDonationById,
  getDonationStats,
  updateDonationStatus,
  cancelMyDonation,
  seedBookDonationsDemo,
};
