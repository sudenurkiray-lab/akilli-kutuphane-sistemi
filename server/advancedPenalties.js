const fs = require('fs');
const path = require('path');
const RULES = require('./rules');

const PENALTY_TYPES = {
  gecikme: { ad: 'Gecikme Cezası', renk: 'yellow' },
  kayip: { ad: 'Kayıp Kitap Cezası', renk: 'red' },
  hasarli: { ad: 'Hasarlı Kitap Cezası', renk: 'orange' },
  rezervasyon_ihlali: { ad: 'Rezervasyon İhlali', renk: 'purple' },
  oda_gelmeme: { ad: 'Çalışma Odasına Gelmeme', renk: 'cyan' },
};

const PENALTY_AMOUNTS = {
  kayip: RULES.LOST_BOOK_PENALTY_TL,
  hasarli: RULES.DAMAGED_BOOK_PENALTY_TL,
  rezervasyon_ihlali: RULES.RESERVATION_VIOLATION_TL,
  oda_gelmeme: RULES.ROOM_NOSHOW_PENALTY_TL,
};

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'receipts');
const MAX_RECEIPT_SIZE = 4 * 1024 * 1024;

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function migratePenaltiesSchema(db) {
  const alters = [
    "ALTER TABLE penalties ADD COLUMN tur TEXT DEFAULT 'gecikme'",
    "ALTER TABLE penalties ADD COLUMN durum TEXT DEFAULT 'aktif'",
    'ALTER TABLE penalties ADD COLUMN orijinal_tutar REAL',
    'ALTER TABLE penalties ADD COLUMN indirim_tutari REAL DEFAULT 0',
    'ALTER TABLE penalties ADD COLUMN aciklama TEXT',
    'ALTER TABLE penalties ADD COLUMN dekont_yolu TEXT',
    "ALTER TABLE penalties ADD COLUMN dekont_durumu TEXT DEFAULT 'yok'",
    'ALTER TABLE penalties ADD COLUMN taksit_sayisi INTEGER DEFAULT 0',
    'ALTER TABLE penalties ADD COLUMN taksit_odenen INTEGER DEFAULT 0',
    'ALTER TABLE penalties ADD COLUMN reservation_id INTEGER',
    'ALTER TABLE penalties ADD COLUMN room_reservation_id INTEGER',
    'ALTER TABLE penalties ADD COLUMN olusturan_id INTEGER',
    'ALTER TABLE penalties ADD COLUMN guncelleyen_id INTEGER',
    'ALTER TABLE penalties ADD COLUMN guncelleme_tarihi DATETIME',
  ];
  alters.forEach((sql) => {
    try { db.exec(sql); } catch (_) { /* already exists */ }
  });

  db.exec(`
    CREATE TABLE IF NOT EXISTS penalty_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      penalty_id INTEGER NOT NULL,
      taksit_no INTEGER NOT NULL,
      tutar REAL NOT NULL,
      vade_tarihi TEXT,
      odendi INTEGER DEFAULT 0,
      odeme_tarihi DATETIME,
      FOREIGN KEY (penalty_id) REFERENCES penalties(id),
      UNIQUE(penalty_id, taksit_no)
    );

    CREATE TABLE IF NOT EXISTS penalty_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      penalty_id INTEGER NOT NULL,
      aktor_id INTEGER,
      islem TEXT NOT NULL,
      detay TEXT,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (penalty_id) REFERENCES penalties(id)
    );

    CREATE INDEX IF NOT EXISTS idx_penalties_user_durum ON penalties(user_id, durum, odendi);
    CREATE INDEX IF NOT EXISTS idx_penalty_installments_penalty ON penalty_installments(penalty_id);
  `);

  db.prepare(`
    UPDATE penalties SET orijinal_tutar = tutar WHERE orijinal_tutar IS NULL
  `).run();
  db.prepare(`
    UPDATE penalties SET tur = 'gecikme' WHERE tur IS NULL OR tur = ''
  `).run();
  db.prepare(`
    UPDATE penalties SET durum = CASE WHEN odendi = 1 THEN 'odendi' ELSE 'aktif' END
    WHERE durum IS NULL OR durum = ''
  `).run();
}

function addLog(db, penaltyId, actorId, islem, detay) {
  db.prepare(`
    INSERT INTO penalty_logs (penalty_id, aktor_id, islem, detay) VALUES (?, ?, ?, ?)
  `).run(penaltyId, actorId || null, islem, detay || null);
}

function unpaidClause(alias = 'p') {
  return `${alias}.odendi = 0 AND ${alias}.durum IN ('aktif', 'taksitli')`;
}

function hasUnpaidPenalties(db, userId) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM penalties p
    WHERE p.user_id = ? AND ${unpaidClause('p')}
  `).get(userId).c > 0;
}

function unpaidPenaltySum(db, userId = null) {
  if (userId != null) {
    return db.prepare(`
      SELECT COALESCE(SUM(tutar), 0) as c FROM penalties p
      WHERE p.user_id = ? AND ${unpaidClause('p')}
    `).get(userId).c;
  }
  return db.prepare(`
    SELECT COALESCE(SUM(tutar), 0) as c FROM penalties p
    WHERE ${unpaidClause('p')}
  `).get().c;
}

function getInstallments(db, penaltyId) {
  return db.prepare(`
    SELECT * FROM penalty_installments
    WHERE penalty_id = ? ORDER BY taksit_no
  `).all(penaltyId);
}

function getLogs(db, penaltyId) {
  return db.prepare(`
    SELECT pl.*, u.ad, u.soyad
    FROM penalty_logs pl
    LEFT JOIN users u ON pl.aktor_id = u.id
    WHERE pl.penalty_id = ?
    ORDER BY pl.tarih DESC
  `).all(penaltyId);
}

function enrichPenalty(db, row) {
  const type = PENALTY_TYPES[row.tur] || PENALTY_TYPES.gecikme;
  const installments = row.durum === 'taksitli' || row.taksit_sayisi > 0
    ? getInstallments(db, row.id)
    : [];

  return {
    ...row,
    tur_adi: type.ad,
    tur_renk: type.renk,
    orijinal_tutar: row.orijinal_tutar ?? row.tutar,
    indirim_tutari: row.indirim_tutari || 0,
    taksitler: installments,
  };
}

function listPenalties(db, { userId = null, includeCancelled = true } = {}) {
  let sql = `
    SELECT p.*,
           u.ad, u.soyad, u.okul_no,
           b.ad as kitap_adi
    FROM penalties p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN loans l ON p.loan_id = l.id
    LEFT JOIN books b ON l.book_id = b.id
  `;
  const params = [];
  const where = [];
  if (userId != null) {
    where.push('p.user_id = ?');
    params.push(userId);
  }
  if (!includeCancelled) {
    where.push("p.durum != 'iptal'");
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY p.tarih DESC';

  return db.prepare(sql).all(...params).map((r) => enrichPenalty(db, r));
}

function getPenalty(db, id) {
  const row = db.prepare(`
    SELECT p.*,
           u.ad, u.soyad, u.okul_no,
           b.ad as kitap_adi
    FROM penalties p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN loans l ON p.loan_id = l.id
    LEFT JOIN books b ON l.book_id = b.id
    WHERE p.id = ?
  `).get(id);
  if (!row) return null;
  return {
    ...enrichPenalty(db, row),
    loglar: getLogs(db, id),
  };
}

function createPenalty(db, {
  userId,
  tur,
  tutar,
  sebep,
  aciklama = null,
  loanId = null,
  reservationId = null,
  roomReservationId = null,
  gecikenGun = null,
  actorId = null,
}) {
  if (!PENALTY_TYPES[tur]) return { error: 'Geçersiz ceza türü', status: 400 };
  const amount = Number(tutar);
  if (!amount || amount <= 0) return { error: 'Geçerli bir tutar girin', status: 400 };

  const result = db.prepare(`
    INSERT INTO penalties (
      user_id, loan_id, reservation_id, room_reservation_id,
      tur, tutar, orijinal_tutar, geciken_gun, sebep, aciklama,
      durum, odendi, olusturan_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 0, ?)
  `).run(
    userId, loanId, reservationId, roomReservationId,
    tur, amount, amount, gecikenGun, sebep || PENALTY_TYPES[tur].ad, aciklama,
    actorId,
  );

  const id = result.lastInsertRowid;
  addLog(db, id, actorId, 'olusturuldu', `${PENALTY_TYPES[tur].ad}: ${amount.toFixed(2)} ₺`);
  return { id, message: 'Ceza oluşturuldu', penalty: getPenalty(db, id) };
}

function createTypedPenalty(db, tur, userId, opts = {}) {
  return createPenalty(db, {
    userId,
    tur,
    tutar: opts.tutar ?? PENALTY_AMOUNTS[tur],
    sebep: opts.sebep || PENALTY_TYPES[tur].ad,
    aciklama: opts.aciklama,
    loanId: opts.loanId,
    reservationId: opts.reservationId,
    roomReservationId: opts.roomReservationId,
    gecikenGun: opts.gecikenGun,
    actorId: opts.actorId,
  });
}

function upsertOverduePenaltyAdvanced(db, loan, daysLate) {
  const tutar = daysLate * RULES.PENALTY_PER_DAY_TL;
  const sebep = `${daysLate} gün gecikme`;
  const existing = db.prepare(`
    SELECT id FROM penalties
    WHERE loan_id = ? AND tur = 'gecikme' AND durum IN ('aktif', 'taksitli') AND odendi = 0
  `).get(loan.id);

  if (existing) {
    db.prepare(`
      UPDATE penalties SET tutar = ?, orijinal_tutar = COALESCE(orijinal_tutar, ?),
        geciken_gun = ?, sebep = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tutar, tutar, daysLate, sebep, existing.id);
    return existing.id;
  }

  const result = createPenalty(db, {
    userId: loan.user_id,
    tur: 'gecikme',
    tutar,
    sebep,
    loanId: loan.id,
    gecikenGun: daysLate,
  });
  return result.id;
}

function createReservationViolation(db, reservation) {
  const exists = db.prepare(`
    SELECT id FROM penalties WHERE reservation_id = ? AND tur = 'rezervasyon_ihlali'
  `).get(reservation.id);
  if (exists) return null;

  return createTypedPenalty(db, 'rezervasyon_ihlali', reservation.user_id, {
    reservationId: reservation.id,
    sebep: `"${reservation.kitap_adi}" rezervasyon alma süresi doldu`,
  });
}

function markRoomNoShow(db, roomReservationId, actorId) {
  const rr = db.prepare('SELECT * FROM room_reservations WHERE id = ?').get(roomReservationId);
  if (!rr) return { error: 'Rezervasyon bulunamadı', status: 404 };
  if (['iptal', 'tamamlandi'].includes(rr.durum)) {
    return { error: 'Bu rezervasyon için ceza uygulanamaz', status: 400 };
  }

  const exists = db.prepare(`
    SELECT id FROM penalties WHERE room_reservation_id = ? AND tur = 'oda_gelmeme'
  `).get(rr.id);
  if (exists) return { error: 'Bu rezervasyon için zaten ceza kaydı var', status: 400 };

  try {
    db.exec('ALTER TABLE room_reservations ADD COLUMN katilim TEXT');
  } catch (_) { /* ok */ }

  db.prepare("UPDATE room_reservations SET durum = 'tamamlandi', katilim = 'gelmedi' WHERE id = ?").run(rr.id);

  return createTypedPenalty(db, 'oda_gelmeme', rr.user_id, {
    roomReservationId: rr.id,
    sebep: 'Çalışma odası rezervasyonuna gelinmedi',
    actorId,
  });
}

function cancelPenalty(db, id, actorId, aciklama) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(id);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (p.durum === 'iptal') return { error: 'Ceza zaten iptal edilmiş', status: 400 };
  if (p.odendi === 1) return { error: 'Ödenmiş ceza iptal edilemez', status: 400 };

  db.prepare(`
    UPDATE penalties SET durum = 'iptal', dekont_durumu = CASE WHEN dekont_durumu = 'bekliyor' THEN 'reddedildi' ELSE dekont_durumu END,
      aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(aciklama || null, actorId, id);
  addLog(db, id, actorId, 'iptal', aciklama || 'Ceza iptal edildi');
  return { message: 'Ceza iptal edildi', penalty: getPenalty(db, id) };
}

function applyDiscount(db, id, actorId, { indirimTutari, indirimOrani, aciklama }) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(id);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (p.durum === 'iptal' || p.odendi === 1) {
    return { error: 'Bu ceza üzerinde işlem yapılamaz', status: 400 };
  }

  const base = p.orijinal_tutar ?? p.tutar;
  let discount = Number(indirimTutari) || 0;
  if (indirimOrani != null && indirimOrani !== '') {
    discount = Math.round(base * (Number(indirimOrani) / 100) * 100) / 100;
  }
  if (discount < 0 || discount >= base) {
    return { error: 'İndirim tutarı geçersiz (0 ile orijinal tutar arasında olmalı)', status: 400 };
  }

  const newAmount = Math.round((base - discount) * 100) / 100;
  db.prepare(`
    UPDATE penalties SET tutar = ?, indirim_tutari = ?, aciklama = COALESCE(?, aciklama),
      guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newAmount, discount, aciklama || null, actorId, id);

  if (p.durum === 'taksitli') {
    const unpaid = db.prepare(`
      SELECT * FROM penalty_installments WHERE penalty_id = ? AND odendi = 0 ORDER BY taksit_no
    `).all(id);
    if (unpaid.length) {
      const per = Math.round((newAmount / unpaid.length) * 100) / 100;
      unpaid.forEach((inst, i) => {
        const amount = i === unpaid.length - 1
          ? Math.round((newAmount - per * (unpaid.length - 1)) * 100) / 100
          : per;
        db.prepare('UPDATE penalty_installments SET tutar = ? WHERE id = ?').run(amount, inst.id);
      });
    }
  }

  addLog(db, id, actorId, 'indirim', `${discount.toFixed(2)} ₺ indirim → ${newAmount.toFixed(2)} ₺`);
  return { message: 'İndirim uygulandı', penalty: getPenalty(db, id) };
}

function createInstallments(db, id, actorId, { taksitSayisi, aciklama }) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(id);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (p.durum === 'iptal' || p.odendi === 1) {
    return { error: 'Bu ceza taksitlendirilemez', status: 400 };
  }
  const count = parseInt(taksitSayisi, 10);
  if (!count || count < 2 || count > 12) {
    return { error: 'Taksit sayısı 2–12 arasında olmalı', status: 400 };
  }

  db.prepare('DELETE FROM penalty_installments WHERE penalty_id = ?').run(id);

  const per = Math.round((p.tutar / count) * 100) / 100;
  const insert = db.prepare(`
    INSERT INTO penalty_installments (penalty_id, taksit_no, tutar, vade_tarihi)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 1; i <= count; i++) {
    const amount = i === count
      ? Math.round((p.tutar - per * (count - 1)) * 100) / 100
      : per;
    const due = new Date();
    due.setMonth(due.getMonth() + i);
    insert.run(id, i, amount, due.toISOString().slice(0, 10));
  }

  db.prepare(`
    UPDATE penalties SET durum = 'taksitli', taksit_sayisi = ?, taksit_odenen = 0,
      aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(count, aciklama || null, actorId, id);

  addLog(db, id, actorId, 'taksit', `${count} taksit oluşturuldu`);
  return { message: `${count} taksite bölündü`, penalty: getPenalty(db, id) };
}

function markPaid(db, id, actorId, { aciklama, installmentId } = {}) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(id);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (p.durum === 'iptal') return { error: 'İptal edilmiş ceza ödenemez', status: 400 };
  if (p.odendi === 1) return { error: 'Ceza zaten ödenmiş', status: 400 };

  if (p.durum === 'taksitli' && installmentId) {
    const inst = db.prepare('SELECT * FROM penalty_installments WHERE id = ? AND penalty_id = ?').get(installmentId, id);
    if (!inst) return { error: 'Taksit bulunamadı', status: 404 };
    if (inst.odendi) return { error: 'Bu taksit zaten ödenmiş', status: 400 };

    db.prepare(`
      UPDATE penalty_installments SET odendi = 1, odeme_tarihi = CURRENT_TIMESTAMP WHERE id = ?
    `).run(installmentId);

    const paidCount = db.prepare(`
      SELECT COUNT(*) as c FROM penalty_installments WHERE penalty_id = ? AND odendi = 1
    `).get(id).c;

    db.prepare('UPDATE penalties SET taksit_odenen = ? WHERE id = ?').run(paidCount, id);
    addLog(db, id, actorId, 'taksit_odeme', `${inst.taksit_no}. taksit ödendi (${inst.tutar} ₺)`);

    if (paidCount >= p.taksit_sayisi) {
      db.prepare(`
        UPDATE penalties SET odendi = 1, durum = 'odendi',
          aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(aciklama || null, actorId, id);
      addLog(db, id, actorId, 'odendi', 'Tüm taksitler tamamlandı');
      return { message: 'Son taksit ödendi — ceza kapatıldı', penalty: getPenalty(db, id) };
    }
    return { message: `${inst.taksit_no}. taksit ödendi olarak işaretlendi`, penalty: getPenalty(db, id) };
  }

  if (p.durum === 'taksitli') {
    db.prepare(`
      UPDATE penalty_installments SET odendi = 1, odeme_tarihi = CURRENT_TIMESTAMP
      WHERE penalty_id = ? AND odendi = 0
    `).run(id);
  }

  db.prepare(`
    UPDATE penalties SET odendi = 1, durum = 'odendi', taksit_odenen = taksit_sayisi,
      aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(aciklama || null, actorId, id);
  addLog(db, id, actorId, 'odendi', aciklama || 'Ödendi olarak işaretlendi');
  return { message: 'Ceza ödendi olarak işaretlendi', penalty: getPenalty(db, id) };
}

function updateNote(db, id, actorId, aciklama) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(id);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  db.prepare(`
    UPDATE penalties SET aciklama = ?, guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(aciklama || null, actorId, id);
  addLog(db, id, actorId, 'aciklama', aciklama || 'Açıklama güncellendi');
  return { message: 'Açıklama güncellendi', penalty: getPenalty(db, id) };
}

function saveReceipt(userId, penaltyId, dosyaAdi, base64Content) {
  ensureUploadDir();
  if (!base64Content || !dosyaAdi) return { error: 'Dekont dosyası gerekli', status: 400 };

  const match = base64Content.match(/^data:([^;]+);base64,(.+)$/);
  const raw = match ? Buffer.from(match[2], 'base64') : Buffer.from(base64Content, 'base64');

  if (raw.length > MAX_RECEIPT_SIZE) {
    return { error: 'Dekont boyutu 4 MB sınırını aşıyor', status: 400 };
  }

  const ext = path.extname(dosyaAdi).toLowerCase() || '.pdf';
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  if (!allowed.includes(ext)) {
    return { error: 'Yalnızca PDF veya görsel (JPG, PNG, WEBP) yüklenebilir', status: 400 };
  }

  const safeName = `${userId}_${penaltyId}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), raw);
  return { dosya_yolu: safeName };
}

function uploadReceipt(db, penaltyId, userId, { dosyaAdi, icerik }) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(penaltyId);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (Number(p.user_id) !== Number(userId)) return { error: 'Yetkisiz', status: 403 };
  if (p.durum === 'iptal' || p.odendi === 1 || p.durum === 'odendi') {
    return { error: 'Bu ceza için dekont yüklenemez', status: 400 };
  }
  if (p.dekont_durumu === 'bekliyor') {
    return { error: 'Dekontunuz zaten inceleniyor. Onay veya red sonrası tekrar yükleyebilirsiniz.', status: 400 };
  }

  const saved = saveReceipt(userId, penaltyId, dosyaAdi, icerik);
  if (saved.error) return { ...saved, status: saved.status || 400 };

  // Eski dekont dosyasını temizle
  if (p.dekont_yolu) {
    const oldPath = resolveReceiptFile(p.dekont_yolu);
    if (oldPath) {
      try { fs.unlinkSync(oldPath); } catch (_) { /* ignore */ }
    }
  }

  db.prepare(`
    UPDATE penalties SET dekont_yolu = ?, dekont_durumu = 'bekliyor',
      guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?
  `).run(saved.dosya_yolu, penaltyId);
  addLog(db, penaltyId, userId, 'dekont_yuklendi', dosyaAdi);

  return { message: 'Dekont yüklendi, onay bekleniyor', penalty: getPenalty(db, penaltyId) };
}

function reviewReceipt(db, penaltyId, actorId, { onay, aciklama }) {
  const p = db.prepare('SELECT * FROM penalties WHERE id = ?').get(penaltyId);
  if (!p) return { error: 'Ceza bulunamadı', status: 404 };
  if (!p.dekont_yolu || p.dekont_durumu !== 'bekliyor') {
    return { error: 'Onay bekleyen dekont yok', status: 400 };
  }

  if (onay) {
    db.prepare(`
      UPDATE penalties SET dekont_durumu = 'onaylandi', odendi = 1, durum = 'odendi',
        aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(aciklama || null, actorId, penaltyId);

    if (p.durum === 'taksitli') {
      db.prepare(`
        UPDATE penalty_installments SET odendi = 1, odeme_tarihi = CURRENT_TIMESTAMP
        WHERE penalty_id = ? AND odendi = 0
      `).run(penaltyId);
      db.prepare('UPDATE penalties SET taksit_odenen = taksit_sayisi WHERE id = ?').run(penaltyId);
    }

    addLog(db, penaltyId, actorId, 'dekont_onay', aciklama || 'Dekont onaylandı, ödeme tamamlandı');
    return { message: 'Dekont onaylandı — ceza ödendi sayıldı', penalty: getPenalty(db, penaltyId) };
  }

  db.prepare(`
    UPDATE penalties SET dekont_durumu = 'reddedildi',
      aciklama = COALESCE(?, aciklama), guncelleyen_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(aciklama || null, actorId, penaltyId);
  addLog(db, penaltyId, actorId, 'dekont_red', aciklama || 'Dekont reddedildi');
  return { message: 'Dekont reddedildi', penalty: getPenalty(db, penaltyId) };
}

function resolveReceiptFile(dosyaYolu) {
  if (!dosyaYolu) return null;
  const full = path.join(UPLOAD_DIR, path.basename(dosyaYolu));
  if (!full.startsWith(UPLOAD_DIR)) return null;
  return fs.existsSync(full) ? full : null;
}

function seedAdvancedPenaltiesDemo(db) {
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  if (!ogrenci1) return;

  const activePenalty = db.prepare(`
    SELECT id FROM penalties
    WHERE user_id = ? AND durum IN ('aktif', 'taksitli') AND odendi = 0
  `).get(ogrenci1.id);
  if (activePenalty) return;

  createTypedPenalty(db, 'hasarli', ogrenci1.id, {
    tutar: RULES.DAMAGED_BOOK_PENALTY_TL,
    sebep: 'Kitap kapağında yırtık ve sayfa hasarı',
    aciklama: 'Demo: hasarlı kitap cezası',
  });
}

module.exports = {
  PENALTY_TYPES,
  PENALTY_AMOUNTS,
  migratePenaltiesSchema,
  unpaidClause,
  hasUnpaidPenalties,
  unpaidPenaltySum,
  listPenalties,
  getPenalty,
  createPenalty,
  createTypedPenalty,
  upsertOverduePenaltyAdvanced,
  createReservationViolation,
  markRoomNoShow,
  cancelPenalty,
  applyDiscount,
  createInstallments,
  markPaid,
  updateNote,
  uploadReceipt,
  reviewReceipt,
  resolveReceiptFile,
  seedAdvancedPenaltiesDemo,
};
