function branchLoanJoin(branchFilter) {
  if (!branchFilter) return { join: '', where: '', params: [] };
  return {
    join: 'JOIN book_copies bc ON l.copy_id = bc.id',
    where: 'AND bc.branch_id = ?',
    params: [branchFilter],
  };
}

function fillDailySeries(rows, days = 14) {
  const map = Object.fromEntries(rows.map((r) => [r.gun, r.sayi]));
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const gun = d.toISOString().slice(0, 10);
    result.push({
      gun,
      etiket: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      sayi: map[gun] || 0,
    });
  }
  return result;
}

function fillHourlySeries(rows) {
  const map = Object.fromEntries(rows.map((r) => [r.saat, r.sayi]));
  return Array.from({ length: 24 }, (_, hour) => {
    const saat = String(hour).padStart(2, '0');
    return { saat, etiket: `${saat}:00`, sayi: map[saat] || 0 };
  });
}

function getAdminAnalytics(db, branchFilter = null) {
  const { join, where, params } = branchLoanJoin(branchFilter);

  const gunlukOdunc = fillDailySeries(db.prepare(`
    SELECT date(l.odunc_tarihi) as gun, COUNT(*) as sayi
    FROM loans l ${join}
    WHERE date(l.odunc_tarihi) >= date('now', '-13 days') ${where}
    GROUP BY date(l.odunc_tarihi)
    ORDER BY gun
  `).all(...params));

  const aylikIade = db.prepare(`
    SELECT strftime('%Y-%m', l.iade_tarihi) as ay,
      COUNT(*) as iade_sayisi,
      SUM(CASE WHEN date(l.iade_tarihi) <= date(l.teslim_tarihi) THEN 1 ELSE 0 END) as zamaninda,
      SUM(CASE WHEN date(l.iade_tarihi) > date(l.teslim_tarihi) THEN 1 ELSE 0 END) as gecikmeli
    FROM loans l ${join}
    WHERE l.durum = 'iade_edildi' AND l.iade_tarihi IS NOT NULL
      AND l.iade_tarihi >= date('now', '-5 months', 'start of month')
      ${where}
    GROUP BY strftime('%Y-%m', l.iade_tarihi)
    ORDER BY ay
  `).all(...params).map((r) => {
    const [y, m] = r.ay.split('-');
    const oran = r.iade_sayisi > 0 ? Math.round((r.zamaninda / r.iade_sayisi) * 100) : 0;
    return {
      ...r,
      etiket: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
      iade_orani: oran,
    };
  });

  const populerKitaplar = branchFilter
    ? db.prepare(`
      SELECT b.ad, b.yazar, COUNT(l.id) as odunc_sayisi
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN book_copies c ON l.copy_id = c.id AND c.branch_id = ?
      GROUP BY b.id ORDER BY odunc_sayisi DESC LIMIT 10
    `).all(branchFilter)
    : db.prepare(`
      SELECT b.ad, b.yazar, COUNT(l.id) as odunc_sayisi
      FROM loans l JOIN books b ON l.book_id = b.id
      GROUP BY b.id ORDER BY odunc_sayisi DESC LIMIT 10
    `).all();

  const populerKategoriler = branchFilter
    ? db.prepare(`
      SELECT b.kategori, COUNT(l.id) as odunc_sayisi
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN book_copies c ON l.copy_id = c.id AND c.branch_id = ?
      GROUP BY b.kategori ORDER BY odunc_sayisi DESC LIMIT 8
    `).all(branchFilter)
    : db.prepare(`
      SELECT b.kategori, COUNT(l.id) as odunc_sayisi
      FROM loans l JOIN books b ON l.book_id = b.id
      GROUP BY b.kategori ORDER BY odunc_sayisi DESC LIMIT 8
    `).all();

  const loanTotals = db.prepare(`
    SELECT
      COUNT(*) as toplam,
      SUM(CASE WHEN l.durum IN ('aktif', 'gecikti') THEN 1 ELSE 0 END) as aktif,
      SUM(CASE WHEN l.durum IN ('aktif', 'gecikti') AND l.teslim_tarihi < datetime('now') THEN 1 ELSE 0 END) as geciken
    FROM loans l ${join}
    WHERE 1=1 ${where}
  `).get(...params);

  const gecikmeOrani = loanTotals.aktif > 0
    ? Math.round((loanTotals.geciken / loanTotals.aktif) * 100)
    : 0;

  const uyeStats = db.prepare(`
    SELECT
      SUM(CASE WHEN role = 'member' THEN 1 ELSE 0 END) as toplam_uye,
      SUM(CASE WHEN role = 'member' AND uyelik_durumu = 'aktif' THEN 1 ELSE 0 END) as aktif_uye
    FROM users
  `).get();

  const son30GunAktif = db.prepare(`
    SELECT COUNT(DISTINCT l.user_id) as c
    FROM loans l ${join}
    WHERE l.odunc_tarihi >= date('now', '-30 days') ${where}
  `).get(...params).c;

  const aktifKullaniciOrani = uyeStats.toplam_uye > 0
    ? Math.round((son30GunAktif / uyeStats.toplam_uye) * 100)
    : 0;

  const subeKullanim = db.prepare(`
    SELECT lb.id, lb.ad as sube,
      COUNT(l.id) as odunc_sayisi,
      SUM(CASE WHEN l.durum IN ('aktif', 'gecikti') THEN 1 ELSE 0 END) as aktif_odunc
    FROM library_branches lb
    LEFT JOIN book_copies c ON c.branch_id = lb.id
    LEFT JOIN loans l ON l.copy_id = c.id
    WHERE lb.aktif = 1
    GROUP BY lb.id
    ORDER BY odunc_sayisi DESC
  `).all();

  const saatlikYogunluk = fillHourlySeries(db.prepare(`
    SELECT strftime('%H', l.odunc_tarihi) as saat, COUNT(*) as sayi
    FROM loans l ${join}
    WHERE l.odunc_tarihi IS NOT NULL ${where}
    GROUP BY strftime('%H', l.odunc_tarihi)
  `).all(...params));

  const kayipMaliyet = db.prepare(`
    SELECT
      COUNT(*) as kayip_adet,
      COALESCE(SUM(COALESCE(c.maliyet, 0)), 0) as toplam_maliyet
    FROM book_copies c
    ${branchFilter ? 'WHERE c.branch_id = ? AND c.fiziksel_durum = \'kayip\'' : "WHERE c.fiziksel_durum = 'kayip'"}
  `).get(...(branchFilter ? [branchFilter] : []));

  const cezaLiderleri = db.prepare(`
    SELECT u.ad, u.soyad, u.username,
      COUNT(p.id) as ceza_sayisi,
      COALESCE(SUM(p.tutar), 0) as toplam_tutar,
      SUM(CASE WHEN p.odendi = 0 THEN 1 ELSE 0 END) as odenmemis
    FROM penalties p
    JOIN users u ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY ceza_sayisi DESC, toplam_tutar DESC
    LIMIT 8
  `).all();

  const rezStats = db.prepare(`
    SELECT
      COUNT(*) as toplam,
      SUM(CASE WHEN durum IN ('hazir', 'tamamlandi') THEN 1 ELSE 0 END) as basarili,
      SUM(CASE WHEN durum = 'iptal' THEN 1 ELSE 0 END) as iptal,
      SUM(CASE WHEN durum = 'suresi_doldu' THEN 1 ELSE 0 END) as suresi_doldu,
      SUM(CASE WHEN durum = 'beklemede' THEN 1 ELSE 0 END) as bekleyen
    FROM reservations
  `).get();

  const rezervasyonDonusum = {
    toplam: rezStats.toplam,
    basarili: rezStats.basarili,
    iptal: rezStats.iptal,
    suresi_doldu: rezStats.suresi_doldu,
    bekleyen: rezStats.bekleyen,
    oran: rezStats.toplam > 0 ? Math.round((rezStats.basarili / rezStats.toplam) * 100) : 0,
  };

  const odaRezStats = db.prepare(`
    SELECT COUNT(*) as toplam,
      SUM(CASE WHEN durum IN ('onaylandi', 'tamamlandi') THEN 1 ELSE 0 END) as basarili
    FROM room_reservations
  `).get();

  return {
    ozet: {
      gunluk_ortalama: Math.round(gunlukOdunc.reduce((s, d) => s + d.sayi, 0) / Math.max(gunlukOdunc.length, 1)),
      gecikme_orani: gecikmeOrani,
      aktif_kullanici_orani: aktifKullaniciOrani,
      kayip_maliyet: kayipMaliyet.toplam_maliyet,
      kayip_adet: kayipMaliyet.kayip_adet,
      rezervasyon_donusum: rezervasyonDonusum.oran,
      oda_rezervasyon_donusum: odaRezStats.toplam > 0
        ? Math.round((odaRezStats.basarili / odaRezStats.toplam) * 100)
        : 0,
    },
    gunluk_odunc: gunlukOdunc,
    aylik_iade: aylikIade,
    populer_kitaplar: populerKitaplar,
    populer_kategoriler: populerKategoriler.map((k) => ({
      kategori: k.kategori || 'Diğer',
      sayi: k.odunc_sayisi,
    })),
    gecikme: {
      oran: gecikmeOrani,
      aktif: loanTotals.aktif,
      geciken: loanTotals.geciken,
    },
    aktif_kullanicilar: {
      oran: aktifKullaniciOrani,
      son_30_gun: son30GunAktif,
      toplam_uye: uyeStats.toplam_uye,
      aktif_uye: uyeStats.aktif_uye,
    },
    sube_kullanim: subeKullanim,
    saatlik_yogunluk: saatlikYogunluk,
    kayip_maliyet: kayipMaliyet,
    ceza_liderleri: cezaLiderleri,
    rezervasyon_donusum: rezervasyonDonusum,
  };
}

function seedAdminAnalyticsDemo(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM loans').get().c;
  if (count >= 40) return;

  const members = db.prepare("SELECT id FROM users WHERE role = 'member' LIMIT 5").all();
  const books = db.prepare('SELECT id FROM books ORDER BY RANDOM() LIMIT 30').all();
  const copies = db.prepare(`
    SELECT c.id, c.book_id, c.branch_id FROM book_copies c
    WHERE c.fiziksel_durum = 'rafta' LIMIT 40
  `).all();

  if (!members.length || !books.length) return;

  const insertLoan = db.prepare(`
    INSERT INTO loans (user_id, book_id, copy_id, odunc_tarihi, teslim_tarihi, iade_tarihi, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  let copyIdx = 0;

  for (let day = 13; day >= 0; day -= 1) {
    const dailyCount = 2 + (day % 5);
    for (let i = 0; i < dailyCount; i += 1) {
      const member = members[(day + i) % members.length];
      const copy = copies[copyIdx % copies.length];
      copyIdx += 1;
      const odunc = new Date();
      odunc.setDate(odunc.getDate() - day);
      odunc.setHours(hours[(day + i) % hours.length], (i * 7) % 60, 0, 0);
      const teslim = new Date(odunc);
      teslim.setDate(teslim.getDate() + 14);
      const returned = day > 2 && i % 2 === 0;
      const iade = returned ? new Date(teslim) : null;
      if (iade && day % 4 === 0) iade.setDate(iade.getDate() + 3);

      insertLoan.run(
        member.id,
        copy.book_id,
        copy.id,
        odunc.toISOString(),
        teslim.toISOString(),
        iade ? iade.toISOString() : null,
        returned ? 'iade_edildi' : (teslim < new Date() ? 'gecikti' : 'aktif'),
      );
    }
  }

  const lostCopies = db.prepare(`
    SELECT id FROM book_copies WHERE fiziksel_durum = 'rafta' LIMIT 3
  `).all();
  lostCopies.forEach((c) => {
    db.prepare(`
      UPDATE book_copies SET fiziksel_durum = 'kayip', maliyet = COALESCE(maliyet, 150 + ABS(RANDOM()) % 200)
      WHERE id = ?
    `).run(c.id);
  });

  const rezCount = db.prepare('SELECT COUNT(*) as c FROM reservations').get().c;
  if (rezCount < 8 && members.length && books.length) {
    const insertRez = db.prepare(`
      INSERT INTO reservations (user_id, book_id, tarih, durum, sira_no)
      VALUES (?, ?, datetime('now', ?), ?, ?)
    `);
    const statuses = ['tamamlandi', 'tamamlandi', 'hazir', 'iptal', 'beklemede', 'suresi_doldu', 'tamamlandi', 'beklemede'];
    statuses.forEach((durum, i) => {
      insertRez.run(members[i % members.length].id, books[i % books.length].id, `-${i} days`, durum, i + 1);
    });
  }
}

module.exports = { getAdminAnalytics, seedAdminAnalyticsDemo };
