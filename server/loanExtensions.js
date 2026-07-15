const RULES = require('./rules');
const { sendNotification } = require('./notificationCenter');

const MAX_EXTENSIONS = RULES.MAX_LOAN_EXTENSIONS;
const EXTENSION_DAYS = RULES.EXTENSION_DAYS;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function hasBookQueue(db, bookId) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM reservations
    WHERE book_id = ? AND durum IN ('beklemede', 'hazir')
  `).get(bookId).c > 0;
}

function userHasOverdueLoans(db, userId) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum IN ('aktif', 'gecikti') AND teslim_tarihi < datetime('now')
  `).get(userId).c > 0;
}

function getExtendStatus(db, loan, userId) {
  if (!loan || !['aktif', 'gecikti'].includes(loan.durum)) {
    return { uzatilabilir: false, sebep: 'Aktif ödünç değil' };
  }
  if (Number(loan.user_id) !== Number(userId)) {
    return { uzatilabilir: false, sebep: 'Yetkisiz' };
  }
  if (new Date(loan.teslim_tarihi) < new Date()) {
    return { uzatilabilir: false, sebep: 'Gecikmiş kitap uzatılamaz' };
  }
  if (userHasOverdueLoans(db, userId)) {
    return { uzatilabilir: false, sebep: 'Gecikmiş kitabınız var, uzatma yapılamaz' };
  }
  if (hasBookQueue(db, loan.book_id)) {
    return { uzatilabilir: false, sebep: 'Bu kitap için sırada bekleyen var' };
  }
  const uzatmaSayisi = loan.uzatma_sayisi || 0;
  if (uzatmaSayisi >= MAX_EXTENSIONS) {
    return { uzatilabilir: false, sebep: `En fazla ${MAX_EXTENSIONS} kez uzatılabilir` };
  }
  return {
    uzatilabilir: true,
    kalan_uzatma: MAX_EXTENSIONS - uzatmaSayisi,
    uzatma_gun: EXTENSION_DAYS,
  };
}

function extendLoan(db, loanId, userId) {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
  if (!loan) return { error: 'Ödünç kaydı bulunamadı', status: 404 };

  const status = getExtendStatus(db, loan, userId);
  if (!status.uzatilabilir) {
    return { error: status.sebep, status: 400 };
  }

  const yeniTeslim = addDays(new Date(loan.teslim_tarihi), EXTENSION_DAYS);
  const yeniUzatma = (loan.uzatma_sayisi || 0) + 1;

  db.prepare(`
    UPDATE loans SET teslim_tarihi = ?, uzatma_sayisi = ? WHERE id = ?
  `).run(yeniTeslim, yeniUzatma, loanId);

  const book = db.prepare('SELECT ad FROM books WHERE id = ?').get(loan.book_id);
  sendNotification(db, userId, 'teslim_yaklasiyor', {
    refId: loanId,
    baslik: 'Ödünç süresi uzatıldı',
    mesaj: `"${book.ad}" kitabının teslim tarihi ${EXTENSION_DAYS} gün uzatıldı. Yeni tarih: ${new Date(yeniTeslim).toLocaleDateString('tr-TR')}.`,
    link: '/uye/profil',
  });

  return {
    message: `Teslim süresi ${EXTENSION_DAYS} gün uzatıldı`,
    teslim_tarihi: yeniTeslim,
    uzatma_sayisi: yeniUzatma,
    kalan_uzatma: MAX_EXTENSIONS - yeniUzatma,
  };
}

function enrichLoanWithExtend(db, loan, userId) {
  const extend = getExtendStatus(db, loan, userId);
  return {
    ...loan,
    uzatma_sayisi: loan.uzatma_sayisi || 0,
    uzatilabilir: extend.uzatilabilir,
    uzatma_sebep: extend.sebep || null,
    kalan_uzatma: extend.kalan_uzatma ?? 0,
  };
}

module.exports = {
  getExtendStatus,
  extendLoan,
  enrichLoanWithExtend,
  hasBookQueue,
  MAX_EXTENSIONS,
  EXTENSION_DAYS,
};
