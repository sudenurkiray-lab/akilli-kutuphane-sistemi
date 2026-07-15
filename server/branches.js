const DEFAULT_BRANCHES = [
  {
    kod: 'MERKEZ',
    ad: 'Merkez Kütüphane',
    adres: 'Ana Kampüs, A Blok',
    hafta_ici: '08:30 - 22:00',
    cumartesi: '09:00 - 18:00',
    pazar: 'Kapalı',
  },
  {
    kod: 'MUH',
    ad: 'Mühendislik Fakültesi Kütüphanesi',
    adres: 'Mühendislik Fakültesi, B Blok',
    hafta_ici: '09:00 - 20:00',
    cumartesi: '10:00 - 16:00',
    pazar: 'Kapalı',
  },
  {
    kod: 'SAG',
    ad: 'Sağlık Bilimleri Kütüphanesi',
    adres: 'Sağlık Bilimleri Kampüsü',
    hafta_ici: '08:30 - 19:00',
    cumartesi: '09:00 - 15:00',
    pazar: 'Kapalı',
  },
  {
    kod: 'HUK',
    ad: 'Hukuk Kütüphanesi',
    adres: 'Hukuk Fakültesi, C Blok',
    hafta_ici: '09:00 - 21:00',
    cumartesi: '10:00 - 17:00',
    pazar: 'Kapalı',
  },
];

function seedBranches(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM library_branches').get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO library_branches (kod, ad, adres, hafta_ici, cumartesi, pazar)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  DEFAULT_BRANCHES.forEach((b) => {
    insert.run(b.kod, b.ad, b.adres, b.hafta_ici, b.cumartesi, b.pazar);
  });
}

function migrateBranchLinks(db) {
  const cols = db.prepare('PRAGMA table_info(book_copies)').all();
  if (!cols.some((c) => c.name === 'branch_id')) {
    db.exec('ALTER TABLE book_copies ADD COLUMN branch_id INTEGER REFERENCES library_branches(id)');
  }
  const userCols = db.prepare('PRAGMA table_info(users)').all();
  if (!userCols.some((c) => c.name === 'branch_id')) {
    db.exec('ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES library_branches(id)');
  }

  const merkez = db.prepare("SELECT id, ad FROM library_branches WHERE kod = 'MERKEZ'").get();
  if (!merkez) return;

  db.prepare('UPDATE book_copies SET branch_id = ? WHERE branch_id IS NULL').run(merkez.id);
  db.prepare(`
    UPDATE book_copies SET sube = (SELECT ad FROM library_branches WHERE id = book_copies.branch_id)
    WHERE sube IS NULL OR sube = '' OR sube = 'Ana Kütüphane'
  `).run();

  const branches = db.prepare('SELECT id, ad FROM library_branches WHERE aktif = 1 ORDER BY id').all();
  if (branches.length > 1) {
    const distinctBranches = db.prepare('SELECT COUNT(DISTINCT branch_id) as c FROM book_copies').get().c;
    if (distinctBranches <= 1) {
      const copies = db.prepare('SELECT id FROM book_copies ORDER BY id').all();
      const updateCopy = db.prepare('UPDATE book_copies SET branch_id = ?, sube = ? WHERE id = ?');
      copies.forEach((copy, index) => {
        const branch = branches[index % branches.length];
        updateCopy.run(branch.id, branch.ad, copy.id);
      });
    }
  }

  db.prepare(`
    UPDATE users SET branch_id = ?
    WHERE role = 'librarian' AND branch_id IS NULL
  `).run(merkez.id);
}

function getAllBranches(db) {
  return db.prepare(`
    SELECT id, kod, ad, adres, hafta_ici, cumartesi, pazar, aktif
    FROM library_branches WHERE aktif = 1 ORDER BY id
  `).all();
}

function getBranchById(db, id) {
  return db.prepare('SELECT * FROM library_branches WHERE id = ?').get(id);
}

function getBookBranches(db, bookId) {
  return db.prepare(`
    SELECT lb.id, lb.ad, lb.kod,
      COUNT(*) as toplam_kopya,
      SUM(CASE WHEN c.fiziksel_durum = 'rafta' THEN 1 ELSE 0 END) as musait_kopya
    FROM book_copies c
    JOIN library_branches lb ON c.branch_id = lb.id
    WHERE c.book_id = ?
    GROUP BY lb.id
    ORDER BY lb.ad
  `).all(bookId);
}

function getBranchStats(db, branchId) {
  const branch = getBranchById(db, branchId);
  if (!branch) return null;

  const kitapTurleri = db.prepare(`
    SELECT COUNT(DISTINCT c.book_id) as c
    FROM book_copies c WHERE c.branch_id = ?
  `).get(branchId).c;

  const toplamKopya = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE branch_id = ?
  `).get(branchId).c;

  const rafta = db.prepare(`
    SELECT COUNT(*) as c FROM book_copies WHERE branch_id = ? AND fiziksel_durum = 'rafta'
  `).get(branchId).c;

  const aktifOdunc = db.prepare(`
    SELECT COUNT(*) as c FROM loans l
    JOIN book_copies c ON l.copy_id = c.id
    WHERE c.branch_id = ? AND l.durum IN ('aktif', 'gecikti')
  `).get(branchId).c;

  const gorevli = db.prepare(`
    SELECT COUNT(*) as c FROM users WHERE role = 'librarian' AND branch_id = ?
  `).get(branchId).c;

  const rafSayisi = db.prepare(`
    SELECT COUNT(DISTINCT raf_no) as c FROM book_copies
    WHERE branch_id = ? AND raf_no IS NOT NULL AND raf_no != ''
  `).get(branchId).c;

  const populer = db.prepare(`
    SELECT b.ad, b.yazar, COUNT(l.id) as odunc_sayisi
    FROM loans l
    JOIN book_copies c ON l.copy_id = c.id
    JOIN books b ON l.book_id = b.id
    WHERE c.branch_id = ?
    GROUP BY b.id
    ORDER BY odunc_sayisi DESC
    LIMIT 5
  `).all(branchId);

  return {
    sube: branch,
    istatistik: {
      kitap_turu: kitapTurleri,
      toplam_kopya: toplamKopya,
      rafta,
      aktif_odunc: aktifOdunc,
      gorevli_sayisi: gorevli,
      raf_sayisi: rafSayisi,
    },
    populer,
  };
}

function resolveBranchFilter(db, user, queryBranchId) {
  if (user.role === 'admin') {
    return queryBranchId ? parseInt(queryBranchId, 10) : null;
  }
  if (user.role === 'librarian') {
    const row = db.prepare('SELECT branch_id FROM users WHERE id = ?').get(user.id);
    return row?.branch_id || null;
  }
  return queryBranchId ? parseInt(queryBranchId, 10) : null;
}

function enrichUserWithBranch(db, user) {
  if (!user) return user;
  let result = { ...user };
  if (user.branch_id) {
    const branch = getBranchById(db, user.branch_id);
    if (branch) {
      result.branch = { id: branch.id, kod: branch.kod, ad: branch.ad };
    }
  }
  if (user.tercih_sube_id) {
    const tercih = getBranchById(db, user.tercih_sube_id);
    if (tercih) {
      result.tercih_sube = { id: tercih.id, kod: tercih.kod, ad: tercih.ad };
    }
  }
  return result;
}

function migrateMemberPreferredBranch(db) {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'tercih_sube_id')) {
    db.exec('ALTER TABLE users ADD COLUMN tercih_sube_id INTEGER REFERENCES library_branches(id)');
  }
  const merkez = db.prepare("SELECT id FROM library_branches WHERE kod = 'MERKEZ'").get();
  if (!merkez) return;

  db.prepare(`
    UPDATE users SET tercih_sube_id = ?
    WHERE role = 'member' AND tercih_sube_id IS NULL
  `).run(merkez.id);

  const muh = db.prepare("SELECT id FROM library_branches WHERE kod = 'MUH'").get();
  if (muh) {
    db.prepare(`
      UPDATE users SET tercih_sube_id = ?
      WHERE role = 'member' AND bolum LIKE '%Mühendis%'
    `).run(muh.id);
  }
}

module.exports = {
  seedBranches,
  migrateBranchLinks,
  migrateMemberPreferredBranch,
  getAllBranches,
  getBranchById,
  getBookBranches,
  getBranchStats,
  resolveBranchFilter,
  enrichUserWithBranch,
};
