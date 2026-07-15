const RULES = require('./rules');
const { syncBookStock, findAvailableCopy } = require('./copies');
const { sendNotification } = require('./notificationCenter');

const PICKUP_HOURS = RULES.RESERVATION_PICKUP_HOURS;

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function notify(db, userId, tur, refId, baslik, mesaj) {
  sendNotification(db, userId, tur, { refId, baslik, mesaj, link: '/uye/kitaplar' });
}

function renumberQueue(db, bookId) {
  const waiting = db.prepare(`
    SELECT id FROM reservations
    WHERE book_id = ? AND durum = 'beklemede'
    ORDER BY sira_no, tarih
  `).all(bookId);
  const update = db.prepare('UPDATE reservations SET sira_no = ? WHERE id = ?');
  waiting.forEach((row, index) => update.run(index + 1, row.id));
}

function releaseReservedCopy(db, reservation) {
  if (!reservation?.reserved_copy_id) return;
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(reservation.reserved_copy_id);
  if (copy && copy.fiziksel_durum === 'rezerve') {
    db.prepare("UPDATE book_copies SET fiziksel_durum = 'rafta' WHERE id = ?").run(copy.id);
    syncBookStock(db, copy.book_id);
  }
}

function processExpiredPickups(db) {
  const expired = db.prepare(`
    SELECT r.*, b.ad as kitap_adi
    FROM reservations r
    JOIN books b ON r.book_id = b.id
    WHERE r.durum = 'hazir' AND r.hazir_bitis < datetime('now')
  `).all();

  expired.forEach((reservation) => {
    db.prepare("UPDATE reservations SET durum = 'suresi_doldu' WHERE id = ?").run(reservation.id);
    releaseReservedCopy(db, reservation);
    const { createReservationViolation } = require('./advancedPenalties');
    createReservationViolation(db, reservation);
    notify(
      db,
      reservation.user_id,
      'rezervasyon',
      reservation.id,
      'Alma süresi doldu',
      `"${reservation.kitap_adi}" kitabı için ${PICKUP_HOURS} saatlik alma süreniz doldu. Rezervasyon ihlali cezası uygulandı. Sıra bir sonraki kullanıcıya geçti.`,
    );
    activateNextInQueue(db, reservation.book_id);
  });

  return expired.length;
}

function getHazirReservation(db, bookId) {
  return db.prepare(`
    SELECT r.*, u.ad, u.soyad
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ? AND r.durum = 'hazir'
    LIMIT 1
  `).get(bookId);
}

function activateNextInQueue(db, bookId) {
  processExpiredPickups(db);

  if (getHazirReservation(db, bookId)) return null;

  const next = db.prepare(`
    SELECT r.*, u.ad, u.soyad, b.ad as kitap_adi
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.book_id = ? AND r.durum = 'beklemede'
    ORDER BY r.sira_no, r.tarih
    LIMIT 1
  `).get(bookId);

  if (!next) return null;

  const now = new Date();
  const bitis = addHours(now, PICKUP_HOURS);

  const copy = db.prepare(`
    SELECT * FROM book_copies
    WHERE book_id = ? AND fiziksel_durum = 'rafta'
    ORDER BY kopya_no LIMIT 1
  `).get(bookId);

  let copyId = null;
  if (copy) {
    db.prepare("UPDATE book_copies SET fiziksel_durum = 'rezerve' WHERE id = ?").run(copy.id);
    syncBookStock(db, bookId);
    copyId = copy.id;
  }

  db.prepare(`
    UPDATE reservations
    SET durum = 'hazir', hazir_baslangic = ?, hazir_bitis = ?, reserved_copy_id = ?
    WHERE id = ?
  `).run(now.toISOString(), bitis.toISOString(), copyId, next.id);

  notify(
    db,
    next.user_id,
    'rezervasyon_sirasi',
    next.id,
    'Kitabınız hazır!',
    `"${next.kitap_adi}" kitabını almak için ${PICKUP_HOURS} saatiniz var. Son alma: ${bitis.toLocaleString('tr-TR')}.`,
  );

  return { ...next, hazir_bitis: bitis.toISOString(), reserved_copy_id: copyId };
}

function onBookReturned(db, bookId) {
  processExpiredPickups(db);
  return activateNextInQueue(db, bookId);
}

function getNextSiraNo(db, bookId) {
  return db.prepare(`
    SELECT COALESCE(MAX(sira_no), 0) + 1 as sira
    FROM reservations
    WHERE book_id = ? AND durum IN ('beklemede', 'hazir')
  `).get(bookId).sira;
}

function joinQueue(db, userId, bookId) {
  processExpiredPickups(db);

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: 'Kitap bulunamadı', status: 404 };

  const rafta = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE book_id = ? AND fiziksel_durum = 'rafta'
  `).get(bookId).c;
  const hazir = getHazirReservation(db, bookId);
  if (rafta > 0 && !hazir) {
    return { error: 'Kitap müsait, doğrudan ödünç alabilirsiniz', status: 400 };
  }

  const existing = db.prepare(`
    SELECT * FROM reservations
    WHERE user_id = ? AND book_id = ? AND durum IN ('beklemede', 'hazir')
  `).get(userId, bookId);
  if (existing) {
    return { error: 'Bu kitap için zaten sıradasınız', status: 400 };
  }

  const siraNo = getNextSiraNo(db, bookId);
  const result = db.prepare(`
    INSERT INTO reservations (user_id, book_id, sira_no, durum) VALUES (?, ?, ?, 'beklemede')
  `).run(userId, bookId, siraNo);

  notify(
    db,
    userId,
    'rezervasyon_sirasi',
    result.lastInsertRowid,
    'Sıraya eklendiniz',
    `"${book.ad}" kitabı için ${siraNo}. sıradasınız. Kitap iade edildiğinde bildirim alacaksınız.`,
  );

  return {
    status: 201,
    id: result.lastInsertRowid,
    sira_no: siraNo,
    message: `Sıraya eklendiniz (${siraNo}. sıra)`,
  };
}

function cancelQueueEntry(db, reservationId, userId) {
  const reservation = db.prepare(`
    SELECT * FROM reservations WHERE id = ? AND user_id = ?
  `).get(reservationId, userId);

  if (!reservation) return { error: 'Kayıt bulunamadı', status: 404 };
  if (!['beklemede', 'hazir'].includes(reservation.durum)) {
    return { error: 'Bu kayıt iptal edilemez', status: 400 };
  }

  const wasHazir = reservation.durum === 'hazir';
  db.prepare("UPDATE reservations SET durum = 'iptal' WHERE id = ?").run(reservationId);
  releaseReservedCopy(db, reservation);
  renumberQueue(db, reservation.book_id);

  if (wasHazir) {
    activateNextInQueue(db, reservation.book_id);
  }

  return { message: 'Sıradan çıktınız' };
}

function getQueueForBook(db, bookId) {
  processExpiredPickups(db);
  return db.prepare(`
    SELECT r.id, r.sira_no, r.durum, r.hazir_bitis, r.tarih, r.user_id,
           u.ad, u.soyad, u.okul_no
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ? AND r.durum IN ('beklemede', 'hazir')
    ORDER BY r.sira_no, r.tarih
  `).all(bookId);
}

function getUserActiveReservation(db, userId, bookId) {
  processExpiredPickups(db);
  return db.prepare(`
    SELECT * FROM reservations
    WHERE user_id = ? AND book_id = ? AND durum IN ('beklemede', 'hazir')
  `).get(userId, bookId);
}

function completeReservationOnBorrow(db, userId, bookId) {
  const reservation = getUserActiveReservation(db, userId, bookId);
  if (reservation?.durum === 'hazir') {
    db.prepare("UPDATE reservations SET durum = 'tamamlandi' WHERE id = ?").run(reservation.id);
  }
}

function findCopyForLoan(db, bookId, userId) {
  processExpiredPickups(db);

  const hazir = db.prepare(`
    SELECT * FROM reservations WHERE user_id = ? AND book_id = ? AND durum = 'hazir'
  `).get(userId, bookId);

  if (hazir?.reserved_copy_id) {
    const reserved = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(hazir.reserved_copy_id);
    if (reserved && reserved.fiziksel_durum === 'rezerve') return reserved;
  }

  const otherHazir = db.prepare(`
    SELECT id FROM reservations WHERE book_id = ? AND durum = 'hazir' AND user_id != ?
  `).get(bookId, userId);
  if (otherHazir) return null;

  return findAvailableCopy(db, bookId);
}

function canUserBorrowBook(db, bookId, userId) {
  const hazir = getUserActiveReservation(db, userId, bookId);
  if (hazir?.durum === 'hazir') return true;

  const otherHazir = getHazirReservation(db, bookId);
  if (otherHazir && otherHazir.user_id !== userId) return false;

  return !!findAvailableCopy(db, bookId);
}

function enrichReservationRow(row) {
  if (!row) return row;
  let kalan_saat = null;
  if (row.durum === 'hazir' && row.hazir_bitis) {
    kalan_saat = Math.max(0, Math.ceil((new Date(row.hazir_bitis) - new Date()) / (1000 * 60 * 60)));
  }
  return { ...row, kalan_saat };
}

function migrateReservationsQueue(db) {
  const cols = db.prepare('PRAGMA table_info(reservations)').all();
  if (cols.some((c) => c.name === 'sira_no')) return;

  db.exec(`
    CREATE TABLE reservations_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
      durum TEXT DEFAULT 'beklemede',
      sira_no INTEGER,
      hazir_baslangic DATETIME,
      hazir_bitis DATETIME,
      reserved_copy_id INTEGER,
      oda TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (reserved_copy_id) REFERENCES book_copies(id)
    );
    INSERT INTO reservations_new (id, user_id, book_id, tarih, durum, oda)
      SELECT id, user_id, book_id, tarih, durum, oda FROM reservations;
    DROP TABLE reservations;
    ALTER TABLE reservations_new RENAME TO reservations;
  `);

  const books = db.prepare("SELECT DISTINCT book_id FROM reservations WHERE durum = 'beklemede'").all();
  books.forEach(({ book_id }) => renumberQueue(db, book_id));
}

module.exports = {
  migrateReservationsQueue,
  processExpiredPickups,
  joinQueue,
  cancelQueueEntry,
  getQueueForBook,
  getUserActiveReservation,
  completeReservationOnBorrow,
  findCopyForLoan,
  canUserBorrowBook,
  onBookReturned,
  activateNextInQueue,
  enrichReservationRow,
  PICKUP_HOURS,
};
