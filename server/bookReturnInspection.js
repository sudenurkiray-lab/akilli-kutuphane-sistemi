const path = require('path');
const fs = require('fs');
const RULES = require('./rules');
const { releaseCopy, syncBookStock } = require('./copies');
const { createPenalty, createTypedPenalty } = require('./advancedPenalties');
const { upsertOverduePenalty } = require('./notifications');
const { onBookReturned } = require('./reservationQueue');
const { notifyPenaltyCreated } = require('./notificationCenter');

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'inspections');
const MAX_PHOTO_SIZE = 4 * 1024 * 1024;

const CONDITION_TYPES = {
  iyi: {
    id: 'iyi',
    ad: 'İyi',
    ceza: 0,
    copyDurum: 'rafta',
    penaltyTur: null,
  },
  hafif_hasarli: {
    id: 'hafif_hasarli',
    ad: 'Hafif hasarlı',
    ceza: RULES.LIGHT_DAMAGE_PENALTY_TL,
    copyDurum: 'hasarli',
    penaltyTur: 'hasarli',
  },
  kapak_hasarli: {
    id: 'kapak_hasarli',
    ad: 'Kapak hasarlı',
    ceza: RULES.COVER_DAMAGE_PENALTY_TL,
    copyDurum: 'hasarli',
    penaltyTur: 'hasarli',
  },
  sayfa_eksik: {
    id: 'sayfa_eksik',
    ad: 'Sayfa eksik',
    ceza: RULES.MISSING_PAGE_PENALTY_TL,
    copyDurum: 'hasarli',
    penaltyTur: 'hasarli',
  },
  ciddi_hasarli: {
    id: 'ciddi_hasarli',
    ad: 'Ciddi hasarlı',
    ceza: RULES.DAMAGED_BOOK_PENALTY_TL,
    copyDurum: 'hasarli',
    penaltyTur: 'hasarli',
  },
  kayip: {
    id: 'kayip',
    ad: 'Kayıp',
    ceza: RULES.LOST_BOOK_PENALTY_TL,
    copyDurum: 'kayip',
    penaltyTur: 'kayip',
  },
};

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function migrateInspectionSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_return_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      copy_id INTEGER,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      kitap_durumu TEXT NOT NULL,
      aciklama TEXT,
      foto_yolu TEXT,
      ceza_tutari REAL DEFAULT 0,
      penalty_id INTEGER,
      kontrol_eden_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loan_id) REFERENCES loans(id),
      FOREIGN KEY (copy_id) REFERENCES book_copies(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (penalty_id) REFERENCES penalties(id)
    );
    CREATE INDEX IF NOT EXISTS idx_inspections_loan ON book_return_inspections(loan_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_user ON book_return_inspections(user_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_durum ON book_return_inspections(kitap_durumu);
  `);

  const alters = [
    'ALTER TABLE damage_records ADD COLUMN kitap_durumu TEXT',
    'ALTER TABLE damage_records ADD COLUMN loan_id INTEGER',
    'ALTER TABLE damage_records ADD COLUMN foto_yolu TEXT',
    'ALTER TABLE damage_records ADD COLUMN penalty_id INTEGER',
  ];
  alters.forEach((sql) => {
    try { db.exec(sql); } catch (_) { /* exists */ }
  });
}

function saveInspectionPhoto(actorId, loanId, dosyaAdi, base64Content) {
  if (!base64Content) return null;
  ensureUploadDir();

  const match = base64Content.match(/^data:([^;]+);base64,(.+)$/);
  const raw = match ? Buffer.from(match[2], 'base64') : Buffer.from(base64Content, 'base64');
  if (raw.length > MAX_PHOTO_SIZE) {
    return { error: 'Fotoğraf boyutu 4 MB sınırını aşıyor' };
  }

  const ext = path.extname(dosyaAdi || '').toLowerCase() || '.jpg';
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!allowed.includes(ext)) {
    return { error: 'Yalnızca JPG, PNG veya WEBP yüklenebilir' };
  }

  const safeName = `insp_${actorId}_${loanId}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), raw);
  return { dosya_yolu: safeName };
}

function resolveInspectionPhoto(dosyaYolu) {
  if (!dosyaYolu) return null;
  const full = path.join(UPLOAD_DIR, path.basename(dosyaYolu));
  if (!full.startsWith(UPLOAD_DIR)) return null;
  return fs.existsSync(full) ? full : null;
}

function applyCopyCondition(db, loan, kitapDurumu) {
  const cond = CONDITION_TYPES[kitapDurumu] || CONDITION_TYPES.iyi;

  if (loan.copy_id) {
    if (cond.copyDurum === 'kayip') {
      db.prepare("UPDATE book_copies SET fiziksel_durum = 'kayip' WHERE id = ?").run(loan.copy_id);
    } else if (cond.copyDurum === 'hasarli') {
      db.prepare("UPDATE book_copies SET fiziksel_durum = 'hasarli' WHERE id = ?").run(loan.copy_id);
    } else {
      releaseCopy(db, loan.copy_id);
    }
    syncBookStock(db, loan.book_id);
    return;
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(loan.book_id);
  if (!book) return;

  if (kitapDurumu === 'kayip') {
    db.prepare("UPDATE books SET durum = 'kayip' WHERE id = ?").run(loan.book_id);
    return;
  }

  const newStok = book.stok + 1;
  const bookDurum = cond.copyDurum === 'hasarli' ? 'bakimda' : 'mevcut';
  db.prepare('UPDATE books SET stok = ?, durum = ? WHERE id = ?').run(newStok, bookDurum, loan.book_id);
}

function createConditionPenalty(db, loan, kitapDurumu, aciklama, actorId) {
  const cond = CONDITION_TYPES[kitapDurumu];
  if (!cond?.penaltyTur || !cond.ceza) return null;

  const book = db.prepare('SELECT ad FROM books WHERE id = ?').get(loan.book_id);
  const sebep = `${book?.ad || 'Kitap'} — ${cond.ad}`;
  const fullAciklama = aciklama || cond.ad;

  if (cond.penaltyTur === 'kayip') {
    const result = createTypedPenalty(db, 'kayip', loan.user_id, {
      loanId: loan.id,
      tutar: cond.ceza,
      sebep,
      aciklama: fullAciklama,
      actorId,
    });
    return result.error ? null : result.id;
  }

  const result = createPenalty(db, {
    userId: loan.user_id,
    tur: 'hasarli',
    tutar: cond.ceza,
    sebep,
    aciklama: fullAciklama,
    loanId: loan.id,
    actorId,
  });
  return result.error ? null : result.id;
}

function processLoanReturn(db, loan, actorId, inspection = {}) {
  const kitapDurumu = inspection.kitap_durumu || 'iyi';
  if (!CONDITION_TYPES[kitapDurumu]) {
    return { error: 'Geçersiz kitap durumu', status: 400 };
  }

  const now = new Date();
  const teslim = new Date(loan.teslim_tarihi);
  let overduePenalty = null;

  if (now > teslim) {
    const daysLate = Math.ceil((now - teslim) / (1000 * 60 * 60 * 24));
    upsertOverduePenalty(db, loan, daysLate);
    const p = db.prepare(`
      SELECT * FROM penalties WHERE loan_id = ? AND tur = 'gecikme' AND odendi = 0 AND durum IN ('aktif', 'taksitli')
    `).get(loan.id);
    if (p) overduePenalty = { id: p.id, tutar: p.tutar, daysLate };
  }

  db.prepare("UPDATE loans SET durum = 'iade_edildi', iade_tarihi = ? WHERE id = ?").run(now.toISOString(), loan.id);
  applyCopyCondition(db, loan, kitapDurumu);
  onBookReturned(db, loan.book_id);

  let fotoYolu = null;
  if (inspection.foto) {
    const saved = saveInspectionPhoto(actorId || loan.user_id, loan.id, inspection.foto_adi, inspection.foto);
    if (saved?.error) return saved;
    fotoYolu = saved?.dosya_yolu || null;
  }

  const cond = CONDITION_TYPES[kitapDurumu];
  const penaltyId = createConditionPenalty(db, loan, kitapDurumu, inspection.aciklama, actorId);

  const inspResult = db.prepare(`
    INSERT INTO book_return_inspections (
      loan_id, copy_id, user_id, book_id, kitap_durumu, aciklama,
      foto_yolu, ceza_tutari, penalty_id, kontrol_eden_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    loan.id, loan.copy_id || null, loan.user_id, loan.book_id,
    kitapDurumu, inspection.aciklama || null, fotoYolu,
    cond.ceza, penaltyId, actorId || null,
  );

  if (loan.copy_id && kitapDurumu !== 'iyi') {
    db.prepare(`
      INSERT INTO damage_records (copy_id, bildiren_id, aciklama, kitap_durumu, loan_id, foto_yolu, penalty_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      loan.copy_id, actorId, inspection.aciklama || cond.ad,
      kitapDurumu, loan.id, fotoYolu, penaltyId,
    );
  }

  let damagePenalty = null;
  if (penaltyId) {
    const p = db.prepare('SELECT id, tutar, tur, sebep, user_id FROM penalties WHERE id = ?').get(penaltyId);
    damagePenalty = { id: p.id, tutar: p.tutar, tur: p.tur, sebep: p.sebep, durum: kitapDurumu, durum_adi: cond.ad };
    const book = db.prepare('SELECT ad FROM books WHERE id = ?').get(loan.book_id);
    notifyPenaltyCreated(db, loan.user_id, p, book?.ad);
  }

  return {
    message: kitapDurumu === 'iyi' ? 'Kitap teslim alındı' : `Kitap teslim alındı — ${cond.ad}`,
    inspection_id: inspResult.lastInsertRowid,
    kitap_durumu: kitapDurumu,
    durum_adi: cond.ad,
    penalty: overduePenalty,
    hasar_cezasi: damagePenalty,
  };
}

function listInspections(db, { userId = null, durum = null } = {}) {
  let sql = `
    SELECT i.*,
           u.ad, u.soyad, u.okul_no,
           b.ad as kitap_adi, b.yazar, b.isbn,
           c.barkod,
           k.ad as kontrol_ad, k.soyad as kontrol_soyad
    FROM book_return_inspections i
    JOIN users u ON i.user_id = u.id
    JOIN books b ON i.book_id = b.id
    LEFT JOIN book_copies c ON i.copy_id = c.id
    LEFT JOIN users k ON i.kontrol_eden_id = k.id
  `;
  const params = [];
  const where = [];
  if (userId != null) {
    where.push('i.user_id = ?');
    params.push(userId);
  }
  if (durum) {
    where.push('i.kitap_durumu = ?');
    params.push(durum);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY i.created_at DESC';

  return db.prepare(sql).all(...params).map((row) => ({
    ...row,
    durum_adi: CONDITION_TYPES[row.kitap_durumu]?.ad || row.kitap_durumu,
  }));
}

function getInspection(db, id) {
  const row = db.prepare(`
    SELECT i.*,
           u.ad, u.soyad, u.okul_no,
           b.ad as kitap_adi, b.yazar, b.isbn,
           c.barkod,
           k.ad as kontrol_ad, k.soyad as kontrol_soyad
    FROM book_return_inspections i
    JOIN users u ON i.user_id = u.id
    JOIN books b ON i.book_id = b.id
    LEFT JOIN book_copies c ON i.copy_id = c.id
    LEFT JOIN users k ON i.kontrol_eden_id = k.id
    WHERE i.id = ?
  `).get(id);
  if (!row) return null;
  return {
    ...row,
    durum_adi: CONDITION_TYPES[row.kitap_durumu]?.ad || row.kitap_durumu,
  };
}

module.exports = {
  CONDITION_TYPES,
  migrateInspectionSchema,
  saveInspectionPhoto,
  resolveInspectionPhoto,
  processLoanReturn,
  listInspections,
  getInspection,
};
