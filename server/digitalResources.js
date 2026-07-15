const path = require('path');
const fs = require('fs');

const RESOURCE_TYPES = {
  e_kitap: 'E-Kitap',
  makale: 'Makale',
  tez: 'Tez',
  dergi: 'Dergi',
  sesli_kitap: 'Sesli Kitap',
  video_egitim: 'Video Eğitim',
  akademik_veritabani: 'Akademik Veritabanı',
};

const ACCESS_LEVELS = {
  herkes: 'Tüm kullanıcılar',
  uye: 'Aktif üyeler',
  ogrenci: 'Öğrenciler',
  personel: 'Kütüphane personeli',
  kutuphane_ici: 'Kütüphane içi erişim',
};

const LICENSE_LABELS = {
  cc_by: 'Creative Commons BY',
  cc_by_nc: 'Creative Commons BY-NC',
  kurumsal: 'Kurumsal lisans',
  ticari_yasak: 'Ticari kullanım yasak',
  abonelik: 'Abonelik (kampüs)',
  acik_erisim: 'Açık erişim',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isExternalUrl(p) {
  return typeof p === 'string' && /^https?:\/\//i.test(p);
}

function getMemberRow(db, userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function hasUnpaidPenalties(db, userId) {
  const { hasUnpaidPenalties: check } = require('./advancedPenalties');
  return check(db, userId);
}

function checkAccess(db, user, resource) {
  if (['admin', 'librarian'].includes(user.role)) {
    return { view: true, download: true };
  }

  if (resource.durum !== 'yayinda') {
    return { view: false, download: false, reason: 'Kaynak yayında değil' };
  }

  if (resource.son_erisim_tarihi && resource.son_erisim_tarihi < today()) {
    return { view: false, download: false, reason: 'Erişim lisansının süresi dolmuş' };
  }

  const member = getMemberRow(db, user.id);
  if (!member || member.uyelik_durumu !== 'aktif') {
    return { view: false, download: false, reason: 'Üyeliğiniz aktif değil' };
  }

  if (hasUnpaidPenalties(db, user.id)) {
    return { view: false, download: false, reason: 'Ödenmemiş cezanız var' };
  }

  switch (resource.erisim_yetkisi) {
    case 'herkes':
    case 'uye':
      break;
    case 'ogrenci':
      if (!member.okul_no) {
        return { view: false, download: false, reason: 'Bu kaynak yalnızca öğrencilere açıktır' };
      }
      break;
    case 'personel':
      return { view: false, download: false, reason: 'Bu kaynak yalnızca personele açıktır' };
    case 'kutuphane_ici':
      break;
    default:
      break;
  }

  return {
    view: true,
    download: !!resource.indirme_izni,
    reason: resource.indirme_izni ? null : 'Bu kaynak yalnızca görüntülenebilir',
  };
}

function getLastUserAccess(db, resourceId, userId) {
  const row = db.prepare(`
    SELECT tarih FROM digital_resource_logs
    WHERE resource_id = ? AND user_id = ?
    ORDER BY tarih DESC LIMIT 1
  `).get(resourceId, userId);
  return row?.tarih || null;
}

function enrichResource(db, resource, user) {
  const access = user ? checkAccess(db, user, resource) : { view: false, download: false };
  const sonKullaniciErisim = user ? getLastUserAccess(db, resource.id, user.id) : null;

  const base = {
    id: resource.id,
    baslik: resource.baslik,
    yazar: resource.yazar,
    tur: resource.tur,
    tur_adi: RESOURCE_TYPES[resource.tur] || resource.tur,
    aciklama: resource.aciklama,
    kategori: resource.kategori,
    yayinevi: resource.yayinevi,
    yayin_yili: resource.yayin_yili,
    isbn_doi: resource.isbn_doi,
    dosya_turu: resource.dosya_turu,
    dosya_boyutu: resource.dosya_boyutu,
    dosya_boyutu_okunur: formatBytes(resource.dosya_boyutu),
    indirme_sayisi: resource.indirme_sayisi,
    goruntulenme_sayisi: resource.goruntulenme_sayisi,
    erisim_yetkisi: resource.erisim_yetkisi,
    erisim_yetkisi_adi: ACCESS_LEVELS[resource.erisim_yetkisi] || resource.erisim_yetkisi,
    indirme_izni: !!resource.indirme_izni,
    yayin_lisansi: resource.yayin_lisansi,
    yayin_lisansi_adi: LICENSE_LABELS[resource.yayin_lisansi] || resource.yayin_lisansi,
    son_erisim_tarihi: resource.son_erisim_tarihi,
    durum: resource.durum,
    branch_id: resource.branch_id,
    created_at: resource.created_at,
    erisebilir: access.view,
    indirebilir: access.download,
    erisim_engel_nedeni: access.reason || null,
    son_kullanici_erisim: sonKullaniciErisim,
    harici_baglanti: isExternalUrl(resource.dosya_yolu),
  };

  if (user && ['admin', 'librarian'].includes(user.role)) {
    return { ...base, dosya_yolu: resource.dosya_yolu };
  }

  return base;
}

function logAccess(db, resourceId, userId, islem) {
  db.prepare(`
    INSERT INTO digital_resource_logs (resource_id, user_id, islem) VALUES (?, ?, ?)
  `).run(resourceId, userId, islem);
}

function recordView(db, resourceId, user) {
  const resource = db.prepare('SELECT * FROM digital_resources WHERE id = ?').get(resourceId);
  if (!resource) return { error: 'Kaynak bulunamadı', status: 404 };

  const access = checkAccess(db, user, resource);
  if (!access.view) return { error: access.reason || 'Erişim yetkiniz yok', status: 403 };

  db.prepare('UPDATE digital_resources SET goruntulenme_sayisi = goruntulenme_sayisi + 1 WHERE id = ?').run(resourceId);
  logAccess(db, resourceId, user.id, 'goruntuleme');

  let erisimUrl = null;
  if (isExternalUrl(resource.dosya_yolu)) {
    erisimUrl = resource.dosya_yolu;
  } else if (resource.dosya_yolu) {
    erisimUrl = `/api/digital-resources/${resourceId}/file`;
  }

  return {
    message: 'Görüntüleme kaydedildi',
    erisim_url: erisimUrl,
    dosya_turu: resource.dosya_turu,
    baslik: resource.baslik,
    harici: isExternalUrl(resource.dosya_yolu),
  };
}

function recordDownload(db, resourceId, user) {
  const resource = db.prepare('SELECT * FROM digital_resources WHERE id = ?').get(resourceId);
  if (!resource) return { error: 'Kaynak bulunamadı', status: 404 };

  const access = checkAccess(db, user, resource);
  if (!access.download) {
    return { error: access.reason || 'İndirme yetkiniz yok', status: 403 };
  }

  db.prepare(`
    UPDATE digital_resources SET indirme_sayisi = indirme_sayisi + 1 WHERE id = ?
  `).run(resourceId);
  logAccess(db, resourceId, user.id, 'indirme');

  if (isExternalUrl(resource.dosya_yolu)) {
    return { redirect: resource.dosya_yolu, filename: resource.baslik };
  }

  return {
    filePath: resource.dosya_yolu,
    filename: `${resource.baslik.replace(/[^\w\s-]/g, '')}.${resource.dosya_turu || 'bin'}`,
  };
}

function resolveFilePath(dosyaYolu) {
  if (!dosyaYolu || isExternalUrl(dosyaYolu)) return null;
  const uploadsRoot = path.join(__dirname, 'uploads', 'digital');
  const full = path.join(uploadsRoot, path.basename(dosyaYolu));
  if (!full.startsWith(uploadsRoot)) return null;
  return fs.existsSync(full) ? full : null;
}

function ensureDemoFiles() {
  const dir = path.join(__dirname, 'uploads', 'digital');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const demos = [
    {
      name: 'ornek-e-kitap.txt',
      content: 'Akıllı Kütüphane Sistemi — Örnek E-Kitap\n\nBu dosya demo amaçlıdır.\n',
    },
    {
      name: 'ornek-makale.txt',
      content: 'Örnek Akademik Makale\n\nÖzet: Dijital kütüphane sistemlerinde erişim yönetimi...\n',
    },
    {
      name: 'ornek-tez.txt',
      content: 'Örnek Yüksek Lisans Tezi\n\nKonu: Kütüphane otomasyon sistemleri\n',
    },
  ];

  demos.forEach(({ name, content }) => {
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, content, 'utf8');
  });
}

function seedDigitalResources(db) {
  ensureDemoFiles();
  const count = db.prepare('SELECT COUNT(*) as c FROM digital_resources').get().c;
  if (count > 0) return;

  const todayStr = today();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const licenseEnd = nextYear.toISOString().slice(0, 10);

  const resources = [
    {
      baslik: 'Algoritmalar — E-Kitap',
      yazar: 'Thomas H. Cormen',
      tur: 'e_kitap',
      aciklama: 'Klasik algoritma ders kitabının dijital sürümü.',
      kategori: 'Bilgisayar',
      yayinevi: 'MIT Press',
      yayin_yili: 2022,
      isbn_doi: '978-0262046305',
      dosya_yolu: 'ornek-e-kitap.txt',
      dosya_turu: 'pdf',
      dosya_boyutu: 4500000,
      erisim_yetkisi: 'uye',
      indirme_izni: 1,
      yayin_lisansi: 'kurumsal',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'Makine Öğrenmesinde Derin Öğrenme',
      yazar: 'Ian Goodfellow',
      tur: 'makale',
      aciklama: 'IEEE erişimli araştırma makalesi.',
      kategori: 'Yapay Zeka',
      yayinevi: 'IEEE',
      yayin_yili: 2024,
      isbn_doi: '10.1109/ML.2024.001',
      dosya_yolu: 'ornek-makale.txt',
      dosya_turu: 'pdf',
      dosya_boyutu: 890000,
      erisim_yetkisi: 'ogrenci',
      indirme_izni: 1,
      yayin_lisansi: 'abonelik',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'Akıllı Şehir Uygulamalarında IoT',
      yazar: 'Ayşe Yılmaz',
      tur: 'tez',
      aciklama: 'Yüksek lisans tezi — tam metin erişim.',
      kategori: 'Elektrik-Elektronik',
      yayinevi: 'Üniversite Arşivi',
      yayin_yili: 2023,
      isbn_doi: null,
      dosya_yolu: 'ornek-tez.txt',
      dosya_turu: 'pdf',
      dosya_boyutu: 3200000,
      erisim_yetkisi: 'uye',
      indirme_izni: 1,
      yayin_lisansi: 'acik_erisim',
      son_erisim_tarihi: null,
      durum: 'yayinda',
    },
    {
      baslik: 'Nature — 2025 Nisan Sayısı',
      yazar: 'Nature Publishing',
      tur: 'dergi',
      aciklama: 'Nature dergisinin güncel sayısı (dijital).',
      kategori: 'Bilim',
      yayinevi: 'Nature',
      yayin_yili: 2025,
      isbn_doi: 'ISSN 0028-0836',
      dosya_yolu: 'ornek-makale.txt',
      dosya_turu: 'pdf',
      dosya_boyutu: 12000000,
      erisim_yetkisi: 'uye',
      indirme_izni: 0,
      yayin_lisansi: 'abonelik',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'Suç ve Ceza — Sesli Kitap',
      yazar: 'Fyodor Dostoyevski',
      tur: 'sesli_kitap',
      aciklama: 'Klasik romanın sesli kitap kaydı.',
      kategori: 'Edebiyat',
      yayinevi: 'LibriVox',
      yayin_yili: 2020,
      isbn_doi: null,
      dosya_yolu: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      dosya_turu: 'mp3',
      dosya_boyutu: 5200000,
      erisim_yetkisi: 'herkes',
      indirme_izni: 0,
      yayin_lisansi: 'cc_by',
      son_erisim_tarihi: null,
      durum: 'yayinda',
    },
    {
      baslik: 'Akademik Yazım Teknikleri',
      yazar: 'Kütüphane Eğitim Birimi',
      tur: 'video_egitim',
      aciklama: 'Tez ve makale yazımında kaynak gösterme eğitimi.',
      kategori: 'Eğitim',
      yayinevi: 'Kütüphane',
      yayin_yili: 2025,
      isbn_doi: null,
      dosya_yolu: 'https://www.w3schools.com/html/mov_bbb.mp4',
      dosya_turu: 'mp4',
      dosya_boyutu: 780000,
      erisim_yetkisi: 'ogrenci',
      indirme_izni: 0,
      yayin_lisansi: 'kurumsal',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'Web of Science',
      yazar: 'Clarivate',
      tur: 'akademik_veritabani',
      aciklama: 'Atıf dizini ve literatür tarama veri tabanı.',
      kategori: 'Veri Tabanı',
      yayinevi: 'Clarivate Analytics',
      yayin_yili: 2025,
      isbn_doi: null,
      dosya_yolu: 'https://www.webofscience.com/',
      dosya_turu: 'url',
      dosya_boyutu: 0,
      erisim_yetkisi: 'ogrenci',
      indirme_izni: 0,
      yayin_lisansi: 'abonelik',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'Scopus Veri Tabanı',
      yazar: 'Elsevier',
      tur: 'akademik_veritabani',
      aciklama: 'Multidisipliner akademik veri tabanı erişimi.',
      kategori: 'Veri Tabanı',
      yayinevi: 'Elsevier',
      yayin_yili: 2025,
      isbn_doi: null,
      dosya_yolu: 'https://www.scopus.com/',
      dosya_turu: 'url',
      dosya_boyutu: 0,
      erisim_yetkisi: 'personel',
      indirme_izni: 0,
      yayin_lisansi: 'abonelik',
      son_erisim_tarihi: licenseEnd,
      durum: 'yayinda',
    },
    {
      baslik: 'IEEE Xplore (Taslak)',
      yazar: 'IEEE',
      tur: 'akademik_veritabani',
      aciklama: 'Henüz yayınlanmamış veri tabanı kaydı.',
      kategori: 'Veri Tabanı',
      yayinevi: 'IEEE',
      yayin_yili: 2025,
      isbn_doi: null,
      dosya_yolu: 'https://ieeexplore.ieee.org/',
      dosya_turu: 'url',
      dosya_boyutu: 0,
      erisim_yetkisi: 'uye',
      indirme_izni: 0,
      yayin_lisansi: 'abonelik',
      son_erisim_tarihi: licenseEnd,
      durum: 'taslak',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO digital_resources (
      baslik, yazar, tur, aciklama, kategori, yayinevi, yayin_yili, isbn_doi,
      dosya_yolu, dosya_turu, dosya_boyutu, erisim_yetkisi, indirme_izni,
      yayin_lisansi, son_erisim_tarihi, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  resources.forEach((r) => {
    insert.run(
      r.baslik, r.yazar, r.tur, r.aciklama, r.kategori, r.yayinevi, r.yayin_yili,
      r.isbn_doi, r.dosya_yolu, r.dosya_turu, r.dosya_boyutu,
      r.erisim_yetkisi, r.indirme_izni, r.yayin_lisansi, r.son_erisim_tarihi, r.durum,
    );
  });

  // Demo erişim logu
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  const ekitap = db.prepare("SELECT id FROM digital_resources WHERE tur = 'e_kitap'").get();
  if (ogrenci1 && ekitap) {
    db.prepare(`
      INSERT INTO digital_resource_logs (resource_id, user_id, islem, tarih)
      VALUES (?, ?, 'goruntuleme', datetime('now', '-2 days'))
    `).run(ekitap.id, ogrenci1.id);
  }
}

module.exports = {
  RESOURCE_TYPES,
  ACCESS_LEVELS,
  LICENSE_LABELS,
  seedDigitalResources,
  enrichResource,
  checkAccess,
  recordView,
  recordDownload,
  resolveFilePath,
  isExternalUrl,
  formatBytes,
};
