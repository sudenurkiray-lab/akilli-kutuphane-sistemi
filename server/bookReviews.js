function getBookStatsMaps(db) {
  const yorumCounts = Object.fromEntries(
    db.prepare(`
      SELECT book_id, COUNT(*) as c FROM book_reviews
      WHERE durum = 'yayinda' GROUP BY book_id
    `).all().map((r) => [r.book_id, r.c])
  );

  const viewCounts = Object.fromEntries(
    db.prepare('SELECT book_id, COUNT(*) as c FROM book_views GROUP BY book_id').all().map((r) => [r.book_id, r.c])
  );

  const favoriCounts = Object.fromEntries(
    db.prepare('SELECT book_id, COUNT(*) as c FROM favorites GROUP BY book_id').all().map((r) => [r.book_id, r.c])
  );

  const puanCounts = Object.fromEntries(
    db.prepare('SELECT book_id, COUNT(*) as c FROM ratings GROUP BY book_id').all().map((r) => [r.book_id, r.c])
  );

  return { yorumCounts, viewCounts, favoriCounts, puanCounts };
}

function enrichReview(db, row, viewerId) {
  const user = db.prepare('SELECT ad, soyad, okul_no FROM users WHERE id = ?').get(row.user_id);
  const begeni = db.prepare('SELECT COUNT(*) as c FROM review_likes WHERE review_id = ?').get(row.id).c;
  const benBegendim = viewerId
    ? !!db.prepare('SELECT 1 FROM review_likes WHERE review_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;
  const sikayet = viewerId
    ? !!db.prepare('SELECT 1 FROM review_reports WHERE review_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;
  const puan = db.prepare('SELECT puan FROM ratings WHERE user_id = ? AND book_id = ?').get(row.user_id, row.book_id)?.puan;

  return {
    id: row.id,
    book_id: row.book_id,
    yorum: row.yorum,
    spoiler: !!row.spoiler,
    durum: row.durum,
    created_at: row.created_at,
    kullanici: user ? { ad: user.ad, soyad: user.soyad, okul_no: user.okul_no } : null,
    yazar_ad: user ? `${user.ad} ${user.soyad}` : 'Anonim',
    begeni_sayisi: begeni,
    ben_begendim: benBegendim,
    benim_yorumum: viewerId ? Number(row.user_id) === Number(viewerId) : false,
    sikayet_edildi: sikayet,
    kullanici_puani: puan || null,
  };
}

function listBookReviews(db, bookId, viewerId) {
  const rows = db.prepare(`
    SELECT * FROM book_reviews
    WHERE book_id = ? AND durum = 'yayinda'
    ORDER BY created_at DESC
  `).all(bookId);
  return rows.map((r) => enrichReview(db, r, viewerId));
}

function upsertReview(db, userId, bookId, { yorum, spoiler }) {
  if (!yorum?.trim()) return { error: 'Yorum metni gerekli', status: 400 };
  if (yorum.length > 2000) return { error: 'Yorum en fazla 2000 karakter olabilir', status: 400 };

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: 'Kitap bulunamadı', status: 404 };

  const existing = db.prepare('SELECT id FROM book_reviews WHERE user_id = ? AND book_id = ?').get(userId, bookId);
  if (existing) {
    db.prepare(`
      UPDATE book_reviews SET yorum = ?, spoiler = ?, durum = 'yayinda', updated_at = datetime('now')
      WHERE id = ?
    `).run(yorum.trim(), spoiler ? 1 : 0, existing.id);
    return { id: existing.id, message: 'Yorum güncellendi' };
  }

  const result = db.prepare(`
    INSERT INTO book_reviews (user_id, book_id, yorum, spoiler) VALUES (?, ?, ?, ?)
  `).run(userId, bookId, yorum.trim(), spoiler ? 1 : 0);
  return { id: result.lastInsertRowid, message: 'Yorum eklendi' };
}

function toggleLike(db, reviewId, userId) {
  const review = db.prepare("SELECT id FROM book_reviews WHERE id = ? AND durum = 'yayinda'").get(reviewId);
  if (!review) return { error: 'Yorum bulunamadı', status: 404 };

  const existing = db.prepare('SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?').get(reviewId, userId);
  if (existing) {
    db.prepare('DELETE FROM review_likes WHERE id = ?').run(existing.id);
    return { message: 'Beğeni kaldırıldı', begendi: false };
  }
  db.prepare('INSERT INTO review_likes (review_id, user_id) VALUES (?, ?)').run(reviewId, userId);
  return { message: 'Yorum beğenildi', begendi: true };
}

function reportReview(db, reviewId, userId, sebep) {
  const review = db.prepare("SELECT id, user_id FROM book_reviews WHERE id = ? AND durum = 'yayinda'").get(reviewId);
  if (!review) return { error: 'Yorum bulunamadı', status: 404 };
  if (Number(review.user_id) === Number(userId)) {
    return { error: 'Kendi yorumunuzu şikâyet edemezsiniz', status: 400 };
  }

  try {
    db.prepare('INSERT INTO review_reports (review_id, user_id, sebep) VALUES (?, ?, ?)').run(
      reviewId, userId, sebep || null,
    );
    return { message: 'Şikâyetiniz alındı' };
  } catch {
    return { error: 'Bu yorumu zaten şikâyet ettiniz', status: 400 };
  }
}

function deleteReview(db, reviewId, isAdmin, userId) {
  const review = db.prepare('SELECT * FROM book_reviews WHERE id = ?').get(reviewId);
  if (!review) return { error: 'Yorum bulunamadı', status: 404 };
  if (!isAdmin && Number(review.user_id) !== Number(userId)) {
    return { error: 'Bu yorumu silemezsiniz', status: 403 };
  }

  db.prepare("UPDATE book_reviews SET durum = 'silindi', updated_at = datetime('now') WHERE id = ?").run(reviewId);
  return { message: 'Yorum silindi' };
}

function listReportedReviews(db) {
  return db.prepare(`
    SELECT r.*, b.ad as kitap_adi, u.ad, u.soyad,
      (SELECT COUNT(*) FROM review_reports WHERE review_id = r.id) as sikayet_sayisi
    FROM book_reviews r
    JOIN books b ON r.book_id = b.id
    JOIN users u ON r.user_id = u.id
    WHERE r.durum = 'yayinda'
      AND EXISTS (SELECT 1 FROM review_reports WHERE review_id = r.id)
    ORDER BY sikayet_sayisi DESC, r.created_at DESC
    LIMIT 100
  `).all().map((row) => ({
    ...enrichReview(db, row, null),
    kitap_adi: row.kitap_adi,
    sikayet_sayisi: row.sikayet_sayisi,
  }));
}

function seedBookReviews(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM book_reviews').get().c;
  if (count > 0) return;

  const books = db.prepare('SELECT id, ad FROM books ORDER BY id LIMIT 15').all();
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  const ogrenci2 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci2'").get();
  if (!books.length || !ogrenci1) return;

  const samples = [
    { yorum: 'Harika bir kaynak, özellikle başlangıç seviyesi için çok faydalı.', spoiler: 0 },
    { yorum: 'Bölüm 8\'deki sonuç beklenmedikti — spoiler!', spoiler: 1 },
    { yorum: 'Kütüphanede bulmak zor ama değer, öneririm.', spoiler: 0 },
    { yorum: 'Akademik projeler için mükemmel referans.', spoiler: 0 },
    { yorum: 'Son bölümdeki karakter ölümü çok etkileyiciydi.', spoiler: 1 },
    { yorum: 'Güncel baskısı stokta, hemen ödünç aldım.', spoiler: 0 },
  ];

  const insert = db.prepare('INSERT INTO book_reviews (user_id, book_id, yorum, spoiler) VALUES (?, ?, ?, ?)');
  const insertRating = db.prepare(`
    INSERT INTO ratings (user_id, book_id, puan) VALUES (?, ?, ?)
    ON CONFLICT(user_id, book_id) DO NOTHING
  `);

  books.forEach((book, i) => {
    const s = samples[i % samples.length];
    const userId = i % 2 === 0 ? ogrenci1.id : (ogrenci2?.id || ogrenci1.id);
    insert.run(userId, book.id, `${s.yorum} (${book.ad})`, s.spoiler);
    insertRating.run(userId, book.id, 3 + (i % 3));
  });

  // Extra reviews on first book
  if (books[0] && ogrenci2) {
    insert.run(ogrenci2.id, books[0].id, 'İkinci okuyuşumda daha çok beğendim, notlar alarak okuyun.', 0);
    insertRating.run(ogrenci2.id, books[0].id, 5);
  }
}

module.exports = {
  getBookStatsMaps,
  enrichReview,
  listBookReviews,
  upsertReview,
  toggleLike,
  reportReview,
  deleteReview,
  listReportedReviews,
  seedBookReviews,
};
