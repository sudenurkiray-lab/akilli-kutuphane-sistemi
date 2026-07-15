const LIST_ICONS = ['📚', '☀️', '💻', '❤️', '📝', '⏳', '🎯', '🌟'];

function enrichList(db, row, viewerId) {
  const owner = db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.user_id);
  const kitapSayisi = db.prepare('SELECT COUNT(*) as c FROM reading_list_items WHERE list_id = ?').get(row.id).c;
  const benim = viewerId ? Number(row.user_id) === Number(viewerId) : false;

  return {
    id: row.id,
    ad: row.ad,
    aciklama: row.aciklama,
    gizlilik: row.gizlilik,
    gizlilik_adi: row.gizlilik === 'herkese_acik' ? 'Herkese açık' : 'Özel',
    user_id: row.user_id,
    sahip_ad: owner ? `${owner.ad} ${owner.soyad}` : '—',
    kitap_sayisi: kitapSayisi,
    benim_listem: benim,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function enrichListItem(db, row) {
  const book = db.prepare('SELECT id, ad, yazar, kategori, isbn, stok, durum FROM books WHERE id = ?').get(row.book_id);
  return {
    id: row.id,
    list_id: row.list_id,
    book_id: row.book_id,
    not_metni: row.not_metni,
    sira: row.sira,
    eklendi_tarihi: row.eklendi_tarihi,
    kitap: book,
  };
}

function canViewList(db, list, viewerId, isStaff) {
  if (!list) return false;
  if (isStaff) return true;
  if (list.gizlilik === 'herkese_acik') return true;
  return viewerId && Number(list.user_id) === Number(viewerId);
}

function getListWithItems(db, listId, viewerId, isStaff) {
  const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
  if (!list) return { error: 'Liste bulunamadı', status: 404 };
  if (!canViewList(db, list, viewerId, isStaff)) {
    return { error: 'Bu listeye erişim yetkiniz yok', status: 403 };
  }

  const items = db.prepare(`
    SELECT * FROM reading_list_items WHERE list_id = ? ORDER BY sira, eklendi_tarihi
  `).all(listId);

  return {
    liste: enrichList(db, list, viewerId),
    kitaplar: items.map((i) => enrichListItem(db, i)),
  };
}

function createList(db, userId, { ad, aciklama, gizlilik }) {
  if (!ad?.trim()) return { error: 'Liste adı gerekli', status: 400 };
  if (gizlilik && !['ozel', 'herkese_acik'].includes(gizlilik)) {
    return { error: 'Geçersiz gizlilik ayarı', status: 400 };
  }

  const result = db.prepare(`
    INSERT INTO reading_lists (user_id, ad, aciklama, gizlilik) VALUES (?, ?, ?, ?)
  `).run(userId, ad.trim(), aciklama?.trim() || null, gizlilik || 'ozel');

  return { id: result.lastInsertRowid, message: 'Liste oluşturuldu' };
}

function updateList(db, listId, userId, { ad, aciklama, gizlilik }) {
  const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
  if (!list) return { error: 'Liste bulunamadı', status: 404 };
  if (Number(list.user_id) !== Number(userId)) {
    return { error: 'Bu listeyi düzenleyemezsiniz', status: 403 };
  }

  db.prepare(`
    UPDATE reading_lists SET
      ad = COALESCE(?, ad),
      aciklama = COALESCE(?, aciklama),
      gizlilik = COALESCE(?, gizlilik),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(ad?.trim() || null, aciklama?.trim() ?? null, gizlilik || null, listId);

  return { message: 'Liste güncellendi' };
}

function deleteList(db, listId, userId) {
  const list = db.prepare('SELECT user_id FROM reading_lists WHERE id = ?').get(listId);
  if (!list) return { error: 'Liste bulunamadı', status: 404 };
  if (Number(list.user_id) !== Number(userId)) {
    return { error: 'Bu listeyi silemezsiniz', status: 403 };
  }

  db.prepare('DELETE FROM reading_list_items WHERE list_id = ?').run(listId);
  db.prepare('DELETE FROM reading_lists WHERE id = ?').run(listId);
  return { message: 'Liste silindi' };
}

function addBookToList(db, listId, userId, { book_id, not_metni }) {
  const list = db.prepare('SELECT user_id FROM reading_lists WHERE id = ?').get(listId);
  if (!list) return { error: 'Liste bulunamadı', status: 404 };
  if (Number(list.user_id) !== Number(userId)) {
    return { error: 'Bu listeye kitap ekleyemezsiniz', status: 403 };
  }

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(book_id);
  if (!book) return { error: 'Kitap bulunamadı', status: 404 };

  const maxSira = db.prepare('SELECT COALESCE(MAX(sira), 0) as m FROM reading_list_items WHERE list_id = ?').get(listId).m;

  try {
    db.prepare(`
      INSERT INTO reading_list_items (list_id, book_id, not_metni, sira) VALUES (?, ?, ?, ?)
    `).run(listId, book_id, not_metni?.trim() || null, maxSira + 1);
    db.prepare("UPDATE reading_lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
    return { message: 'Kitap listeye eklendi' };
  } catch {
    return { error: 'Kitap zaten listede', status: 400 };
  }
}

function removeBookFromList(db, listId, bookId, userId) {
  const list = db.prepare('SELECT user_id FROM reading_lists WHERE id = ?').get(listId);
  if (!list) return { error: 'Liste bulunamadı', status: 404 };
  if (Number(list.user_id) !== Number(userId)) {
    return { error: 'Bu listeden kitap çıkaramazsınız', status: 403 };
  }

  db.prepare('DELETE FROM reading_list_items WHERE list_id = ? AND book_id = ?').run(listId, bookId);
  db.prepare("UPDATE reading_lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
  return { message: 'Kitap listeden çıkarıldı' };
}

const EXAM_CATEGORIES = [
  'Bilgisayar', 'Yazılım', 'Mühendislik', 'Eğitim', 'Bilim',
  'Ekonomi', 'Psikoloji', 'Hukuk', 'Sosyoloji', 'Tarih',
];

const LIST_BOOK_RULES = {
  'Sınav İçin Kaynaklar': {
    categories: EXAM_CATEGORIES,
    limit: 10,
    aciklama: 'Final ve büt için ders kitapları, akademik kaynaklar ve çalışma materyalleri',
  },
  'Yazılım Kitapları': { categories: ['Yazılım', 'Bilgisayar'], limit: 8 },
  'Favori Romanlarım': { categories: ['Roman'], limit: 6 },
  'Yazın Okuyacaklarım': { categories: ['Roman', 'Bilim Kurgu', 'Fantastik', 'Biyografi'], limit: 6 },
  'Sonra Okuyacaklarım': { categories: ['Roman', 'Tarih', 'Sanat', 'Bilim'], limit: 5 },
  'Elektrik Mühendisliği Kaynakları': { categories: ['Mühendislik', 'Bilgisayar', 'Bilim'], limit: 8 },
  'Kişisel Okuma Listem': { categories: ['Roman', 'Psikoloji'], limit: 4 },
};

function pickBooksByCategories(db, categories, limit) {
  const picked = [];
  const seen = new Set();
  let round = 0;

  while (picked.length < limit && round < limit) {
    let added = false;
    for (const cat of categories) {
      if (picked.length >= limit) break;
      const row = db.prepare(`
        SELECT id FROM books WHERE kategori = ? ORDER BY ad LIMIT 1 OFFSET ?
      `).get(cat, round);
      if (row && !seen.has(row.id)) {
        seen.add(row.id);
        picked.push(row);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }

  return picked;
}

function populateListBooks(db, listId, listAd) {
  const rule = LIST_BOOK_RULES[listAd];
  if (!rule) return;

  const books = pickBooksByCategories(db, rule.categories, rule.limit);
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO reading_list_items (list_id, book_id, sira) VALUES (?, ?, ?)
  `);

  books.forEach((b, i) => {
    insertItem.run(listId, b.id, i + 1);
  });
}

/** Mevcut DB: Sınav listesindeki romanları akademik kaynaklarla değiştir */
function migrateExamReadingList(db) {
  const list = db.prepare(`
    SELECT id FROM reading_lists WHERE ad = 'Sınav İçin Kaynaklar' LIMIT 1
  `).get();
  if (!list) return;

  const rule = LIST_BOOK_RULES['Sınav İçin Kaynaklar'];
  db.prepare(`
    UPDATE reading_lists SET aciklama = ?, updated_at = datetime('now') WHERE id = ?
  `).run(rule.aciklama, list.id);

  db.prepare('DELETE FROM reading_list_items WHERE list_id = ?').run(list.id);
  populateListBooks(db, list.id, 'Sınav İçin Kaynaklar');
}

function seedReadingLists(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM reading_lists').get().c;

  if (count === 0) {
    const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
    const ogrenci2 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci2'").get();
    if (!ogrenci1) return;

    const lists = [
      { user_id: ogrenci1.id, ad: 'Yazın Okuyacaklarım', aciklama: 'Tatilde okumak için seçtiklerim', gizlilik: 'herkese_acik' },
      { user_id: ogrenci1.id, ad: 'Yazılım Kitapları', aciklama: 'Programlama ve yazılım mühendisliği', gizlilik: 'herkese_acik' },
      { user_id: ogrenci1.id, ad: 'Favori Romanlarım', aciklama: 'Tekrar okumaktan vazgeçemediklerim', gizlilik: 'ozel' },
      { user_id: ogrenci1.id, ad: 'Sınav İçin Kaynaklar', aciklama: LIST_BOOK_RULES['Sınav İçin Kaynaklar'].aciklama, gizlilik: 'ozel' },
      { user_id: ogrenci1.id, ad: 'Sonra Okuyacaklarım', aciklama: 'Vaktim olunca', gizlilik: 'herkese_acik' },
    ];

    if (ogrenci2) {
      lists.push(
        { user_id: ogrenci2.id, ad: 'Elektrik Mühendisliği Kaynakları', aciklama: 'Ders ve proje kitapları', gizlilik: 'herkese_acik' },
        { user_id: ogrenci2.id, ad: 'Kişisel Okuma Listem', aciklama: null, gizlilik: 'ozel' },
      );
    }

    const insertList = db.prepare(`
      INSERT INTO reading_lists (user_id, ad, aciklama, gizlilik) VALUES (?, ?, ?, ?)
    `);

    lists.forEach((l) => {
      const listId = insertList.run(l.user_id, l.ad, l.aciklama, l.gizlilik).lastInsertRowid;
      populateListBooks(db, listId, l.ad);
    });
  }

  migrateExamReadingList(db);
}

module.exports = {
  LIST_ICONS,
  enrichList,
  enrichListItem,
  canViewList,
  getListWithItems,
  createList,
  updateList,
  deleteList,
  addBookToList,
  removeBookFromList,
  seedReadingLists,
  migrateExamReadingList,
};
