const { MAX_LOANS_PER_MEMBER, LOAN_DAYS, PENALTY_PER_DAY_TL, DUE_SOON_DAYS } = require('./rules');
const { upsertOverduePenaltyAdvanced } = require('./advancedPenalties');
const { sendNotification } = require('./notificationCenter');

const PENALTY_PER_DAY = PENALTY_PER_DAY_TL;

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function upsertOverduePenalty(db, loan, daysLate) {
  return upsertOverduePenaltyAdvanced(db, loan, daysLate);
}

function addNotification(db, userId, tur, refId, baslik, mesaj, opts = {}) {
  return sendNotification(db, userId, tur, {
    refId,
    baslik,
    mesaj,
    link: opts.link,
    oncelik: opts.oncelik,
    skipDuplicate: opts.skipDuplicate !== false,
  });
}

function syncLoanAlerts(db, loan, kitapAdi) {
  const kalan = daysUntil(loan.teslim_tarihi);

  if (kalan < 0) {
    const daysLate = Math.abs(kalan);
    db.prepare("UPDATE loans SET durum = 'gecikti' WHERE id = ? AND durum = 'aktif'").run(loan.id);
    upsertOverduePenalty(db, loan, daysLate);
    sendNotification(db, loan.user_id, 'kitap_gecikti', {
      refId: loan.id,
      baslik: 'Kitap gecikti',
      mesaj: `"${kitapAdi}" kitabının teslim tarihi ${daysLate} gün geçti. Ceza: ${(daysLate * PENALTY_PER_DAY).toFixed(2)} ₺`,
      link: '/uye/profil',
      oncelik: 'yuksek',
    });
  } else if (kalan <= DUE_SOON_DAYS) {
    sendNotification(db, loan.user_id, 'teslim_yaklasiyor', {
      refId: loan.id,
      baslik: 'Teslim tarihi yaklaşıyor',
      mesaj: `"${kitapAdi}" kitabını ${kalan === 0 ? 'bugün' : `${kalan} gün içinde`} iade etmelisiniz.`,
      link: '/uye/profil',
    });
  }
}

function syncUserNotifications(db, userId) {
  const loans = db.prepare(`
    SELECT l.*, b.ad as kitap_adi
    FROM loans l
    JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum IN ('aktif', 'gecikti')
  `).all(userId);

  loans.forEach((loan) => syncLoanAlerts(db, loan, loan.kitap_adi));
}

function syncAllOverdueLoans(db) {
  const loans = db.prepare(`
    SELECT l.*, b.ad as kitap_adi
    FROM loans l
    JOIN books b ON l.book_id = b.id
    WHERE l.durum IN ('aktif', 'gecikti')
  `).all();

  loans.forEach((loan) => syncLoanAlerts(db, loan, loan.kitap_adi));
}

module.exports = {
  PENALTY_PER_DAY,
  DUE_SOON_DAYS,
  syncUserNotifications,
  syncAllOverdueLoans,
  upsertOverduePenalty,
  addNotification,
};
