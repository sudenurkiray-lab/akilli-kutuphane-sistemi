const CATEGORY_PAGE_AVG = {
  Roman: 380, 'Bilim Kurgu': 320, Tarih: 420, Bilgisayar: 480, Yazılım: 520,
  Felsefe: 340, Psikoloji: 360, Ekonomi: 400, Biyografi: 350, Şiir: 180,
  'Çocuk Edebiyatı': 120, Polisiye: 340, Fantastik: 400, Bilim: 300,
  Sanat: 280, Sosyoloji: 380, Politika: 360, 'Din ve Mitoloji': 320,
  Eğitim: 280, Sağlık: 340, Mühendislik: 450, Hukuk: 420, Coğrafya: 300,
};

const DEFAULT_PAGE_COUNT = 320;

function estimatePages(kategori, seed = 0) {
  const base = CATEGORY_PAGE_AVG[kategori] || DEFAULT_PAGE_COUNT;
  const variance = (seed % 7) * 15 - 45;
  return Math.max(80, base + variance);
}

function migrateBookPageCounts(db) {
  const needsUpdate = db.prepare('SELECT COUNT(*) as c FROM books WHERE sayfa_sayisi IS NULL').get().c;
  if (needsUpdate === 0) return;

  const books = db.prepare('SELECT id, kategori FROM books WHERE sayfa_sayisi IS NULL').all();
  const update = db.prepare('UPDATE books SET sayfa_sayisi = ? WHERE id = ?');
  books.forEach((b) => update.run(estimatePages(b.kategori, b.id), b.id));
}

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function countReturnsInRange(db, userId, start, end) {
  return db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi'
      AND iade_tarihi >= ? AND iade_tarihi < ?
  `).get(userId, start, end).c;
}

function getMonthlyChart(db, userId, months = 6) {
  const data = [];
  for (let i = months - 1; i >= 0; i--) {
    const { start, end } = monthRange(-i);
    const sayi = countReturnsInRange(db, userId, start, end);
    const d = new Date(start);
    data.push({
      ay: d.toLocaleDateString('tr-TR', { month: 'short' }),
      ay_tam: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      sayi,
    });
  }
  return data;
}

function getCategoryChart(db, userId) {
  const rows = db.prepare(`
    SELECT b.kategori as kategori, COUNT(*) as sayi
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi' AND b.kategori IS NOT NULL
    GROUP BY b.kategori
    ORDER BY sayi DESC
    LIMIT 8
  `).all(userId);

  const max = rows[0]?.sayi || 1;
  return rows.map((r) => ({
    ...r,
    yuzde: Math.round((r.sayi / max) * 100),
  }));
}

function getTopAuthors(db, userId, limit = 5) {
  return db.prepare(`
    SELECT b.yazar as yazar, COUNT(*) as sayi
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi'
    GROUP BY b.yazar
    ORDER BY sayi DESC
    LIMIT ?
  `).all(userId, limit);
}

function getReadingStats(db, userId) {
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const buAy = countReturnsInRange(db, userId, thisMonth.start, thisMonth.end);
  const gecenAy = countReturnsInRange(db, userId, lastMonth.start, lastMonth.end);
  const buYil = db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi' AND iade_tarihi >= ?
  `).get(userId, yearStart).c;

  const toplamKitap = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum = 'iade_edildi'
  `).get(userId).c;

  const enCokKategori = db.prepare(`
    SELECT b.kategori as kategori, COUNT(*) as sayi
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi' AND b.kategori IS NOT NULL
    GROUP BY b.kategori ORDER BY sayi DESC LIMIT 1
  `).get(userId);

  const ortalamaTeslim = db.prepare(`
    SELECT ROUND(AVG(
      (julianday(iade_tarihi) - julianday(odunc_tarihi))
    ), 1) as gun
    FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi'
      AND iade_tarihi IS NOT NULL AND odunc_tarihi IS NOT NULL
  `).get(userId).gun;

  const toplamSayfa = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(b.sayfa_sayisi, ?)), 0) as toplam
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi'
  `).get(DEFAULT_PAGE_COUNT, userId).toplam;

  const favoriYazar = db.prepare(`
    SELECT b.yazar as yazar, COUNT(*) as sayi
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi'
    GROUP BY b.yazar ORDER BY sayi DESC LIMIT 1
  `).get(userId);

  const degisim = buAy - gecenAy;
  const degisimYuzde = gecenAy > 0
    ? Math.round((degisim / gecenAy) * 100)
    : (buAy > 0 ? 100 : 0);

  const aylikGrafik = getMonthlyChart(db, userId);
  const kategoriGrafik = getCategoryChart(db, userId);
  const yazarSirasi = getTopAuthors(db, userId);

  return {
    ozet: {
      bu_ay: buAy,
      bu_yil: buYil,
      toplam_kitap: toplamKitap,
      en_cok_kategori: enCokKategori?.kategori || null,
      en_cok_kategori_sayi: enCokKategori?.sayi || 0,
      ortalama_teslim_gun: ortalamaTeslim || 0,
      toplam_sayfa: toplamSayfa,
      favori_yazar: favoriYazar?.yazar || null,
      favori_yazar_sayi: favoriYazar?.sayi || 0,
      gecen_ay: gecenAy,
      degisim,
      degisim_yuzde: degisimYuzde,
    },
    aylik_grafik: aylikGrafik,
    kategori_grafik: kategoriGrafik,
    yazar_sirasi: yazarSirasi,
  };
}

module.exports = {
  CATEGORY_PAGE_AVG,
  estimatePages,
  migrateBookPageCounts,
  getReadingStats,
};
