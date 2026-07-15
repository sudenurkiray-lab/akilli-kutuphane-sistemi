const { getRoomById, getRoomByRaf } = require('./rooms');

const DEFAULT_SUBE = 'Ana Kütüphane';
const COPY_STATUSES = ['rafta', 'oduncte', 'hasarli', 'kayip', 'rezerve', 'bakimda'];

function generateBarcode(bookId, kopyaNo) {
  return `KTP-${String(bookId).padStart(5, '0')}-${String(kopyaNo).padStart(2, '0')}`;
}

function generateQrKod(barkod) {
  return `https://kutuphane.edu.tr/kopya/${barkod}`;
}

function getBookLocationMeta(book) {
  const room = getRoomById(book.oda) || getRoomByRaf(book.raf_no);
  return {
    sube: DEFAULT_SUBE,
    kat: room?.kat || 'Zemin',
    raf_no: book.raf_no || null,
  };
}

function syncBookStock(db, bookId) {
  const rafta = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE book_id = ? AND fiziksel_durum = 'rafta'
  `).get(bookId).c;
  const total = db.prepare('SELECT COUNT(*) as c FROM book_copies WHERE book_id = ?').get(bookId).c;
  const hasOduncte = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE book_id = ? AND fiziksel_durum = 'oduncte'
  `).get(bookId).c;

  let durum = 'mevcut';
  if (total === 0) durum = 'kayip';
  else if (rafta === 0 && hasOduncte > 0) durum = 'oduncte';
  else if (rafta === 0) durum = 'bakimda';

  db.prepare('UPDATE books SET stok = ?, durum = ? WHERE id = ?').run(rafta, durum, bookId);
  return { stok: rafta, durum, toplam_kopya: total };
}

function getDefaultBranch(db) {
  return db.prepare("SELECT id, ad FROM library_branches WHERE kod = 'MERKEZ'").get()
    || db.prepare('SELECT id, ad FROM library_branches WHERE aktif = 1 ORDER BY id LIMIT 1').get();
}

function createCopy(db, book, kopyaNo, fizikselDurum, extra = {}) {
  const loc = getBookLocationMeta(book);
  const barkod = generateBarcode(book.id, kopyaNo);
  let branchId = extra.branch_id || null;
  let sube = extra.sube || null;
  if (!branchId) {
    const def = getDefaultBranch(db);
    branchId = def?.id || null;
    sube = sube || def?.ad || DEFAULT_SUBE;
  } else if (!sube) {
    const branch = db.prepare('SELECT ad FROM library_branches WHERE id = ?').get(branchId);
    sube = branch?.ad || DEFAULT_SUBE;
  }
  const result = db.prepare(`
    INSERT INTO book_copies (
      book_id, kopya_no, barkod, qr_kod, sube, branch_id, kat, raf_no,
      fiziksel_durum, satin_alma_tarihi, maliyet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    book.id,
    kopyaNo,
    barkod,
    generateQrKod(barkod),
    sube,
    branchId,
    extra.kat || loc.kat,
    extra.raf_no || loc.raf_no,
    fizikselDurum,
    extra.satin_alma_tarihi || new Date().toISOString().slice(0, 10),
    extra.maliyet ?? (80 + Math.floor(Math.random() * 120)),
  );
  return result.lastInsertRowid;
}

function ensureCopiesForBook(db, bookId, targetCount) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return;

  const current = db.prepare('SELECT COUNT(*) as c FROM book_copies WHERE book_id = ?').get(bookId).c;
  if (current < targetCount) {
    const maxNo = db.prepare('SELECT COALESCE(MAX(kopya_no), 0) as m FROM book_copies WHERE book_id = ?').get(bookId).m;
    for (let i = current + 1; i <= targetCount; i++) {
      createCopy(db, book, maxNo + (i - current), 'rafta');
    }
  }
  syncBookStock(db, bookId);
}

function migrateAllBookCopies(db) {
  const books = db.prepare('SELECT * FROM books').all();
  const insertLoanCopy = db.prepare('UPDATE loans SET copy_id = ? WHERE id = ?');

  books.forEach((book) => {
    const existing = db.prepare('SELECT COUNT(*) as c FROM book_copies WHERE book_id = ?').get(book.id).c;
    if (existing > 0) return;

    const activeLoans = db.prepare(`
      SELECT id FROM loans WHERE book_id = ? AND durum IN ('aktif', 'gecikti') ORDER BY odunc_tarihi
    `).all(book.id);

    const total = Math.max((book.stok || 0) + activeLoans.length, 1);

    for (let i = 1; i <= total; i++) {
      const onLoan = i <= activeLoans.length;
      let durum = onLoan ? 'oduncte' : 'rafta';
      if (!onLoan && book.durum === 'kayip' && i === total && book.stok === 0) durum = 'kayip';
      if (!onLoan && book.durum === 'bakimda' && book.stok === 0 && i === total) durum = 'bakimda';

      const copyId = createCopy(db, book, i, durum);
      if (onLoan && activeLoans[i - 1]) {
        insertLoanCopy.run(copyId, activeLoans[i - 1].id);
      }
    }
    syncBookStock(db, book.id);
  });
}

function findAvailableCopy(db, bookId, branchId = null) {
  if (branchId) {
    return db.prepare(`
      SELECT * FROM book_copies
      WHERE book_id = ? AND fiziksel_durum = 'rafta' AND branch_id = ?
      ORDER BY kopya_no LIMIT 1
    `).get(bookId, branchId);
  }
  return db.prepare(`
    SELECT * FROM book_copies
    WHERE book_id = ? AND fiziksel_durum = 'rafta'
    ORDER BY kopya_no LIMIT 1
  `).get(bookId);
}

function assignCopyToLoan(db, copyId) {
  db.prepare("UPDATE book_copies SET fiziksel_durum = 'oduncte' WHERE id = ?").run(copyId);
}

function releaseCopy(db, copyId) {
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(copyId);
  if (!copy) return;
  db.prepare("UPDATE book_copies SET fiziksel_durum = 'rafta' WHERE id = ?").run(copyId);
  syncBookStock(db, copy.book_id);
}

function getCopySummary(db, bookId) {
  const rows = db.prepare(`
    SELECT fiziksel_durum, COUNT(*) as c FROM book_copies WHERE book_id = ? GROUP BY fiziksel_durum
  `).all(bookId);
  const summary = Object.fromEntries(COPY_STATUSES.map((s) => [s, 0]));
  rows.forEach((r) => { summary[r.fiziksel_durum] = r.c; });
  summary.toplam = rows.reduce((s, r) => s + r.c, 0);
  return summary;
}

module.exports = {
  COPY_STATUSES,
  DEFAULT_SUBE,
  generateBarcode,
  generateQrKod,
  syncBookStock,
  createCopy,
  ensureCopiesForBook,
  migrateAllBookCopies,
  findAvailableCopy,
  assignCopyToLoan,
  releaseCopy,
  getCopySummary,
  getBookLocationMeta,
};
