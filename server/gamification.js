const BADGES = {
  ilk_kitabim: {
    id: 'ilk_kitabim',
    ad: 'İlk Kitabım',
    aciklama: 'İlk kitabını ödünç alıp iade ettin',
    ikon: '📖',
    renk: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  },
  duzenli_okuyucu: {
    id: 'duzenli_okuyucu',
    ad: 'Düzenli Okuyucu',
    aciklama: 'Bir ayda 3 kitap okudun',
    ikon: '📅',
    renk: 'from-green-500/20 to-green-600/10 border-green-500/30',
  },
  kitap_kurdu: {
    id: 'kitap_kurdu',
    ad: 'Kitap Kurdu',
    aciklama: 'Toplam 10 kitap iade ettin',
    ikon: '🐛',
    renk: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  },
  bilim_meraklisi: {
    id: 'bilim_meraklisi',
    ad: 'Bilim Meraklısı',
    aciklama: '5 farklı bilim kitabı okudun',
    ikon: '🔬',
    renk: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  },
  zamaninda_teslim: {
    id: 'zamaninda_teslim',
    ad: 'Zamanında Teslim Ustası',
    aciklama: 'Gecikmeden 10 kitap teslim ettin',
    ikon: '⏱️',
    renk: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  },
  ilk_yorum: {
    id: 'ilk_yorum',
    ad: 'İlk Yorumum',
    aciklama: 'İlk kitap yorumunu yazdın',
    ikon: '✍️',
    renk: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  },
  yuz_kitap: {
    id: 'yuz_kitap',
    ad: '100 Kitap Rozeti',
    aciklama: 'Toplam 100 kitap iade ettin — efsane!',
    ikon: '🏆',
    renk: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  },
};

const GOALS = [
  { id: 'ayda_3', ad: 'Ayda 3 kitap oku', hedef: 3, birim: 'kitap' },
  { id: 'yilda_20', ad: 'Yılda 20 kitap oku', hedef: 20, birim: 'kitap' },
  { id: 'bes_kategori', ad: '5 farklı kategoriden kitap oku', hedef: 5, birim: 'kategori' },
  { id: 'gecikmesiz_10', ad: 'Gecikmeden 10 kitap teslim et', hedef: 10, birim: 'teslim' },
  { id: 'ilk_yorum', ad: 'İlk yorumunu yaz', hedef: 1, birim: 'yorum' },
];

function getUserReadingStats(db, userId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const toplamIade = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum = 'iade_edildi'
  `).get(userId).c;

  const buAyIade = db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi' AND iade_tarihi >= ?
  `).get(userId, monthStart).c;

  const buYilIade = db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi' AND iade_tarihi >= ?
  `).get(userId, yearStart).c;

  const kategoriSayisi = db.prepare(`
    SELECT COUNT(DISTINCT b.kategori) as c
    FROM loans l JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi' AND b.kategori IS NOT NULL
  `).get(userId).c;

  const zamanindaTeslim = db.prepare(`
    SELECT COUNT(*) as c FROM loans
    WHERE user_id = ? AND durum = 'iade_edildi'
      AND iade_tarihi IS NOT NULL AND teslim_tarihi IS NOT NULL
      AND datetime(iade_tarihi) <= datetime(teslim_tarihi)
  `).get(userId).c;

  const bilimKitap = db.prepare(`
    SELECT COUNT(*) as c FROM loans l
    JOIN books b ON l.book_id = b.id
    WHERE l.user_id = ? AND l.durum = 'iade_edildi' AND b.kategori = 'Bilim'
  `).get(userId).c;

  const yorumSayisi = db.prepare(`
    SELECT COUNT(*) as c FROM book_reviews
    WHERE user_id = ? AND durum = 'yayinda'
  `).get(userId).c;

  return {
    toplam_iade: toplamIade,
    bu_ay_iade: buAyIade,
    bu_yil_iade: buYilIade,
    kategori_sayisi: kategoriSayisi,
    zamaninda_teslim: zamanindaTeslim,
    bilim_kitap: bilimKitap,
    yorum_sayisi: yorumSayisi,
  };
}

function getGoalsProgress(db, userId) {
  const stats = getUserReadingStats(db, userId);

  const progressMap = {
    ayda_3: stats.bu_ay_iade,
    yilda_20: stats.bu_yil_iade,
    bes_kategori: stats.kategori_sayisi,
    gecikmesiz_10: stats.zamaninda_teslim,
    ilk_yorum: stats.yorum_sayisi,
  };

  return GOALS.map((g) => {
    const mevcut = progressMap[g.id] || 0;
    const tamamlandi = mevcut >= g.hedef;
    return {
      ...g,
      mevcut,
      tamamlandi,
      yuzde: Math.min(100, Math.round((mevcut / g.hedef) * 100)),
    };
  });
}

function evaluateBadges(db, userId) {
  const stats = getUserReadingStats(db, userId);
  const earned = [];

  if (stats.toplam_iade >= 1) earned.push('ilk_kitabim');
  if (stats.bu_ay_iade >= 3) earned.push('duzenli_okuyucu');
  if (stats.toplam_iade >= 10) earned.push('kitap_kurdu');
  if (stats.bilim_kitap >= 5) earned.push('bilim_meraklisi');
  if (stats.zamaninda_teslim >= 10) earned.push('zamaninda_teslim');
  if (stats.yorum_sayisi >= 1) earned.push('ilk_yorum');
  if (stats.toplam_iade >= 100) earned.push('yuz_kitap');

  return earned;
}

function awardBadges(db, userId) {
  const eligible = evaluateBadges(db, userId);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)
  `);
  const newlyEarned = [];

  eligible.forEach((badgeId) => {
    const result = insert.run(userId, badgeId);
    if (result.changes > 0) newlyEarned.push(BADGES[badgeId]);
  });

  return newlyEarned;
}

function getUserBadges(db, userId) {
  const rows = db.prepare(`
    SELECT badge_id, kazanma_tarihi FROM user_badges
    WHERE user_id = ? ORDER BY kazanma_tarihi
  `).all(userId);

  return rows.map((r) => ({
    ...BADGES[r.badge_id],
    kazanma_tarihi: r.kazanma_tarihi,
    kazanildi: true,
  })).filter((b) => b.id);
}

function getGamificationProfile(db, userId) {
  awardBadges(db, userId);
  const badges = getUserBadges(db, userId);
  const earnedIds = new Set(badges.map((b) => b.id));

  const tumRozetler = Object.values(BADGES).map((b) => ({
    ...b,
    kazanildi: earnedIds.has(b.id),
    kazanma_tarihi: badges.find((x) => x.id === b.id)?.kazanma_tarihi || null,
  }));

  return {
    istatistik: getUserReadingStats(db, userId),
    hedefler: getGoalsProgress(db, userId),
    rozetler: tumRozetler,
    kazanilan_sayisi: badges.length,
    toplam_rozet: Object.keys(BADGES).length,
  };
}

function seedGamificationDemo(db) {
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  if (!ogrenci1) return;

  const existingReturns = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum = 'iade_edildi'
  `).get(ogrenci1.id).c;

  if (existingReturns < 8) {
    const books = db.prepare(`
      SELECT id, kategori FROM books
      WHERE kategori IN ('Bilgisayar', 'Yazılım', 'Bilim', 'Roman', 'Tarih', 'Psikoloji', 'Ekonomi', 'Mühendislik')
      ORDER BY kategori, id LIMIT 12
    `).all();

    const insertLoan = db.prepare(`
      INSERT INTO loans (user_id, book_id, odunc_tarihi, teslim_tarihi, iade_tarihi, durum)
      VALUES (?, ?, ?, ?, ?, 'iade_edildi')
    `);

    const now = new Date();
    books.forEach((book, i) => {
      const odunc = new Date(now);
      odunc.setDate(odunc.getDate() - 30 - i * 5);
      const teslim = new Date(odunc);
      teslim.setDate(teslim.getDate() + 14);
      const iade = new Date(teslim);
      iade.setDate(iade.getDate() - (i % 3 === 0 ? 2 : 0)); // mostly on time

      const exists = db.prepare(`
        SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND durum = 'iade_edildi'
      `).get(ogrenci1.id, book.id);
      if (!exists) {
        insertLoan.run(
          ogrenci1.id, book.id,
          odunc.toISOString(), teslim.toISOString(), iade.toISOString(),
        );
      }
    });

    // Extra bilim books for bilim meraklisi progress
    const bilimBooks = db.prepare("SELECT id FROM books WHERE kategori = 'Bilim' LIMIT 5").all();
    bilimBooks.forEach((b, i) => {
      const exists = db.prepare(`
        SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND durum = 'iade_edildi'
      `).get(ogrenci1.id, b.id);
      if (!exists) {
        const d = new Date();
        d.setMonth(d.getMonth() - 2);
        insertLoan.run(ogrenci1.id, b.id, d.toISOString(), d.toISOString(), d.toISOString());
      }
    });
  }

  awardBadges(db, ogrenci1.id);
}

module.exports = {
  BADGES,
  GOALS,
  getUserReadingStats,
  getGoalsProgress,
  awardBadges,
  getGamificationProfile,
  seedGamificationDemo,
};
