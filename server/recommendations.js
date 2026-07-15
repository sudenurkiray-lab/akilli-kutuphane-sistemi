/** Bölüm → önerilen kitap kategorileri */
const BOLUM_KATEGORILERI = {
  'Bilgisayar Mühendisliği': ['Bilgisayar', 'Yazılım', 'Mühendislik', 'Bilim Kurgu', 'Bilim'],
  'Elektrik Mühendisliği': ['Mühendislik', 'Bilim', 'Bilgisayar', 'Fizik'],
  'Elektrik-Elektronik Mühendisliği': ['Mühendislik', 'Bilim', 'Bilgisayar'],
  'Endüstri Mühendisliği': ['Ekonomi', 'Mühendislik', 'Psikoloji', 'Sosyoloji'],
  'Makine Mühendisliği': ['Mühendislik', 'Bilim'],
  'İşletme': ['Ekonomi', 'Psikoloji', 'Sosyoloji', 'Biyografi'],
  'Hukuk': ['Hukuk', 'Politika', 'Tarih', 'Felsefe'],
  'Tıp': ['Sağlık', 'Bilim', 'Biyografi'],
  'Mimarlık': ['Sanat', 'Mühendislik', 'Coğrafya'],
};

const DEFAULT_KATEGORILER = ['Roman', 'Bilim Kurgu', 'Psikoloji', 'Tarih'];

function bookRowToCard(b) {
  return {
    id: b.id,
    ad: b.ad,
    yazar: b.yazar,
    kategori: b.kategori,
    isbn: b.isbn,
    stok: b.stok,
    durum: b.durum,
    ortalama_puan: b.ortalama_puan ? Number(b.ortalama_puan.toFixed(1)) : null,
    musait: b.stok > 0 && b.durum === 'mevcut',
  };
}

function dedupeBooks(books, excludeIds = new Set(), limit = 8) {
  const seen = new Set(excludeIds);
  const result = [];
  for (const b of books) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    result.push(bookRowToCard(b));
    if (result.length >= limit) break;
  }
  return result;
}

function getUserBorrowedBookIds(db, userId) {
  return db.prepare(`
    SELECT DISTINCT book_id FROM loans WHERE user_id = ?
  `).all(userId).map((r) => r.book_id);
}

function getUserTopCategories(db, userId) {
  const fromLoans = db.prepare(`
    SELECT b.kategori, COUNT(*) as cnt
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND b.kategori IS NOT NULL
    GROUP BY b.kategori ORDER BY cnt DESC LIMIT 5
  `).all(userId);

  const fromFavorites = db.prepare(`
    SELECT b.kategori, COUNT(*) as cnt
    FROM favorites f JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ? AND b.kategori IS NOT NULL
    GROUP BY b.kategori ORDER BY cnt DESC LIMIT 5
  `).all(userId);

  const fromSearches = db.prepare(`
    SELECT kategori, COUNT(*) as cnt FROM search_logs
    WHERE user_id = ? AND kategori IS NOT NULL
    GROUP BY kategori ORDER BY cnt DESC LIMIT 5
  `).all(userId);

  const scores = {};
  [...fromLoans, ...fromFavorites, ...fromSearches].forEach(({ kategori, cnt }) => {
    scores[kategori] = (scores[kategori] || 0) + cnt;
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function getBooksByCategories(db, categories, excludeIds, limit) {
  if (!categories.length) return [];
  const placeholders = categories.map(() => '?').join(',');
  const exclude = [...excludeIds];
  let sql = `
    SELECT b.*, COALESCE(AVG(r.puan), 0) as ortalama_puan
    FROM books b
    LEFT JOIN ratings r ON r.book_id = b.id
    WHERE b.kategori IN (${placeholders})
  `;
  const params = [...categories];
  if (exclude.length) {
    sql += ` AND b.id NOT IN (${exclude.map(() => '?').join(',')})`;
    params.push(...exclude);
  }
  sql += ` GROUP BY b.id ORDER BY ortalama_puan DESC, b.stok DESC, b.ad LIMIT ?`;
  params.push(limit * 3);
  return db.prepare(sql).all(...params);
}

function getPopularInCategories(db, categories, excludeIds, limit) {
  if (!categories.length) return [];
  const placeholders = categories.map(() => '?').join(',');
  const exclude = [...excludeIds];
  let sql = `
    SELECT b.*, COUNT(l.id) as odunc_sayisi, COALESCE(AVG(rt.puan), 0) as ortalama_puan
    FROM books b
    LEFT JOIN loans l ON l.book_id = b.id
    LEFT JOIN ratings rt ON rt.book_id = b.id
    WHERE b.kategori IN (${placeholders})
  `;
  const params = [...categories];
  if (exclude.length) {
    sql += ` AND b.id NOT IN (${exclude.map(() => '?').join(',')})`;
    params.push(...exclude);
  }
  sql += ` GROUP BY b.id ORDER BY odunc_sayisi DESC, ortalama_puan DESC LIMIT ?`;
  params.push(limit * 3);
  return db.prepare(sql).all(...params);
}

/** Sana özel: ödünç + favori + puan + arama kategorileri */
function getPersonalRecommendations(db, userId, excludeIds, limit = 8) {
  const topCategories = getUserTopCategories(db, userId);
  const highlyRated = db.prepare(`
    SELECT b.*, AVG(r.puan) as ortalama_puan
    FROM ratings r JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.puan >= 4
    GROUP BY b.id
  `).all(userId).map((b) => b.kategori).filter(Boolean);

  const mergedCategories = [...new Set([...topCategories, ...highlyRated])];
  if (!mergedCategories.length) {
    const user = db.prepare('SELECT bolum FROM users WHERE id = ?').get(userId);
    const deptCats = BOLUM_KATEGORILERI[user?.bolum] || DEFAULT_KATEGORILER;
    return dedupeBooks(getPopularInCategories(db, deptCats, excludeIds, limit), new Set(excludeIds), limit);
  }

  const books = getBooksByCategories(db, mergedCategories, excludeIds, limit);
  return dedupeBooks(books, new Set(excludeIds), limit);
}

/** Benzer kullanıcılar: aynı kitapları okuyanların diğer kitapları */
function getSimilarUsersRecommendations(db, userId, excludeIds, limit = 8) {
  const myBooks = getUserBorrowedBookIds(db, userId);
  if (!myBooks.length) return [];

  const placeholders = myBooks.map(() => '?').join(',');
  const similarUsers = db.prepare(`
    SELECT DISTINCT l2.user_id
    FROM loans l1
    JOIN loans l2 ON l1.book_id = l2.book_id AND l2.user_id != ?
    WHERE l1.user_id = ? AND l1.book_id IN (${placeholders})
    LIMIT 20
  `).all(userId, userId, ...myBooks);

  if (!similarUsers.length) return [];

  const userPlaceholders = similarUsers.map(() => '?').join(',');
  const books = db.prepare(`
    SELECT b.*, COUNT(l.id) as ortak, COALESCE(AVG(r.puan), 0) as ortalama_puan
    FROM loans l
    JOIN books b ON l.book_id = b.id
    LEFT JOIN ratings r ON r.book_id = b.id
    WHERE l.user_id IN (${userPlaceholders})
      AND l.book_id NOT IN (${placeholders})
      AND l.user_id != ?
    GROUP BY b.id
    ORDER BY ortak DESC, ortalama_puan DESC
    LIMIT ?
  `).all(...similarUsers.map((u) => u.user_id), ...myBooks, userId, limit * 3);

  return dedupeBooks(books, new Set(excludeIds), limit);
}

/** Bölüme uygun kitaplar */
function getDepartmentRecommendations(db, userId, excludeIds, limit = 8) {
  const user = db.prepare('SELECT bolum FROM users WHERE id = ?').get(userId);
  const categories = BOLUM_KATEGORILERI[user?.bolum] || DEFAULT_KATEGORILER;
  const books = getPopularInCategories(db, categories, excludeIds, limit);
  return dedupeBooks(books, new Set(excludeIds), limit);
}

/** Son bakılan / ödünç kitaplara benzer */
function getSimilarToRecent(db, userId, excludeIds, limit = 8) {
  const recentBooks = db.prepare(`
    SELECT book_id FROM book_views WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 5
  `).all(userId).map((r) => r.book_id);

  const recentLoans = db.prepare(`
    SELECT book_id FROM loans WHERE user_id = ? ORDER BY odunc_tarihi DESC LIMIT 5
  `).all(userId).map((r) => r.book_id);

  const seedIds = [...new Set([...recentBooks, ...recentLoans])];
  if (!seedIds.length) {
    const top = getUserTopCategories(db, userId);
    if (top.length) {
      return dedupeBooks(getBooksByCategories(db, top.slice(0, 2), excludeIds, limit), new Set(excludeIds), limit);
    }
    return [];
  }

  const placeholders = seedIds.map(() => '?').join(',');
  const seeds = db.prepare(`SELECT * FROM books WHERE id IN (${placeholders})`).all(...seedIds);
  const categories = [...new Set(seeds.map((b) => b.kategori).filter(Boolean))];
  const authors = [...new Set(seeds.map((b) => b.yazar).filter(Boolean))];

  let books = [];
  if (categories.length) {
    books = books.concat(getBooksByCategories(db, categories, [...excludeIds, ...seedIds], limit));
  }
  if (authors.length && books.length < limit) {
    const authorPh = authors.map(() => '?').join(',');
    const notIn = [...excludeIds, ...seedIds];
    let authorSql = `
      SELECT b.*, COALESCE(AVG(r.puan), 0) as ortalama_puan
      FROM books b LEFT JOIN ratings r ON r.book_id = b.id
      WHERE b.yazar IN (${authorPh})
    `;
    const authorParams = [...authors];
    if (notIn.length) {
      authorSql += ` AND b.id NOT IN (${notIn.map(() => '?').join(',')})`;
      authorParams.push(...notIn);
    }
    authorSql += ' GROUP BY b.id ORDER BY ortalama_puan DESC LIMIT ?';
    authorParams.push(limit * 2);
    books = books.concat(db.prepare(authorSql).all(...authorParams));
  }

  return dedupeBooks(books, new Set([...excludeIds, ...seedIds]), limit);
}

function getRecommendations(db, userId) {
  const borrowedIds = getUserBorrowedBookIds(db, userId);
  const excludeIds = new Set(borrowedIds);

  const personal = getPersonalRecommendations(db, userId, borrowedIds, 8);
  personal.forEach((b) => excludeIds.add(b.id));

  const similarUsers = getSimilarUsersRecommendations(db, userId, [...excludeIds], 8);
  similarUsers.forEach((b) => excludeIds.add(b.id));

  const department = getDepartmentRecommendations(db, userId, [...excludeIds], 8);
  department.forEach((b) => excludeIds.add(b.id));

  const similarRecent = getSimilarToRecent(db, userId, [...excludeIds], 8);

  const user = db.prepare('SELECT bolum FROM users WHERE id = ?').get(userId);
  const topCategories = getUserTopCategories(db, userId);

  return {
    sana_ozel: personal,
    benzer_kullanicilar: similarUsers,
    bolumune_uygun: department,
    son_baktiklarina_benzer: similarRecent,
    meta: {
      bolum: user?.bolum || null,
      favori_kategoriler: topCategories.slice(0, 5),
    },
  };
}

module.exports = {
  BOLUM_KATEGORILERI,
  getRecommendations,
  bookRowToCard,
};
