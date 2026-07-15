const path = require('path');
const fs = require('fs');

const KAYIT_TURLERI = {
  tez: 'Tez',
  makale: 'Makale',
  bitirme_projesi: 'Bitirme Projesi',
};

const TEZ_TURLERI = {
  lisans: 'Lisans Tezi',
  yuksek_lisans: 'Yüksek Lisans Tezi',
  doktora: 'Doktora Tezi',
  bitirme_projesi: 'Bitirme Projesi',
  makale: 'Akademik Makale',
  diger: 'Diğer',
};

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'thesis');
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function saveUploadedFile(userId, dosyaAdi, base64Content) {
  ensureUploadDir();
  if (!base64Content || !dosyaAdi) return { error: 'Dosya gerekli' };

  const match = base64Content.match(/^data:([^;]+);base64,(.+)$/);
  const raw = match ? Buffer.from(match[2], 'base64') : Buffer.from(base64Content, 'base64');

  if (raw.length > MAX_FILE_SIZE) {
    return { error: 'Dosya boyutu 8 MB sınırını aşıyor' };
  }

  const ext = path.extname(dosyaAdi).toLowerCase() || '.pdf';
  const allowed = ['.pdf', '.doc', '.docx', '.txt'];
  if (!allowed.includes(ext)) {
    return { error: 'Yalnızca PDF, DOC, DOCX veya TXT yüklenebilir' };
  }

  const safeName = `${userId}_${Date.now()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(fullPath, raw);

  return {
    dosya_yolu: safeName,
    dosya_turu: ext.replace('.', ''),
    dosya_boyutu: raw.length,
  };
}

function resolveThesisFile(dosyaYolu) {
  if (!dosyaYolu) return null;
  const full = path.join(UPLOAD_DIR, path.basename(dosyaYolu));
  if (!full.startsWith(UPLOAD_DIR)) return null;
  return fs.existsSync(full) ? full : null;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function enrichArchiveItem(db, row, viewer) {
  const yazar = db.prepare('SELECT ad, soyad, okul_no, bolum FROM users WHERE id = ?').get(row.yazar_id);
  const onaylayan = row.onaylayan_id
    ? db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.onaylayan_id)
    : null;

  const isStaff = viewer && ['admin', 'librarian'].includes(viewer.role);
  const isOwner = viewer && Number(row.yazar_id) === Number(viewer.id);

  return {
    id: row.id,
    baslik: row.baslik,
    ozet: row.ozet,
    kayit_turu: row.kayit_turu,
    kayit_turu_adi: KAYIT_TURLERI[row.kayit_turu] || row.kayit_turu,
    tez_turu: row.tez_turu,
    tez_turu_adi: TEZ_TURLERI[row.tez_turu] || row.tez_turu,
    yazar_id: row.yazar_id,
    yazar_ad: row.yazar_ad || (yazar ? `${yazar.ad} ${yazar.soyad}` : '—'),
    yazar_okul_no: yazar?.okul_no,
    bolum: row.bolum || yazar?.bolum,
    danisman: row.danisman,
    yil: row.yil,
    anahtar_kelimeler: row.anahtar_kelimeler,
    konu_alani: row.konu_alani,
    dosya_turu: row.dosya_turu,
    dosya_boyutu: row.dosya_boyutu,
    dosya_boyutu_okunur: formatBytes(row.dosya_boyutu),
    durum: row.durum,
    red_nedeni: (isStaff || isOwner) ? row.red_nedeni : null,
    onaylayan: onaylayan ? `${onaylayan.ad} ${onaylayan.soyad}` : null,
    onay_tarihi: row.onay_tarihi,
    indirme_sayisi: row.indirme_sayisi,
    created_at: row.created_at,
    benim_kayit: isOwner,
    indirilebilir: row.durum === 'yayinda' && !!row.dosya_yolu,
  };
}

function getFilterOptions(db) {
  const bolumler = db.prepare(`
    SELECT DISTINCT bolum FROM academic_archive
    WHERE bolum IS NOT NULL AND bolum != '' AND durum = 'yayinda'
    ORDER BY bolum
  `).all().map((r) => r.bolum);

  const danismanlar = db.prepare(`
    SELECT DISTINCT danisman FROM academic_archive
    WHERE danisman IS NOT NULL AND danisman != '' AND durum = 'yayinda'
    ORDER BY danisman
  `).all().map((r) => r.danisman);

  const konuAlanlari = db.prepare(`
    SELECT DISTINCT konu_alani FROM academic_archive
    WHERE konu_alani IS NOT NULL AND konu_alani != '' AND durum = 'yayinda'
    ORDER BY konu_alani
  `).all().map((r) => r.konu_alani);

  const yillar = db.prepare(`
    SELECT DISTINCT yil FROM academic_archive
    WHERE yil IS NOT NULL AND durum = 'yayinda'
    ORDER BY yil DESC
  `).all().map((r) => r.yil);

  return {
    bolumler,
    danismanlar,
    konu_alanlari: konuAlanlari,
    yillar,
    kayit_turleri: Object.entries(KAYIT_TURLERI).map(([id, ad]) => ({ id, ad })),
    tez_turleri: Object.entries(TEZ_TURLERI).map(([id, ad]) => ({ id, ad })),
  };
}

function buildListQuery(viewer, filters) {
  const isStaff = viewer && ['admin', 'librarian'].includes(viewer.role);
  let sql = 'SELECT * FROM academic_archive WHERE 1=1';
  const params = [];

  if (!isStaff) {
    if (filters.mine) {
      sql += ' AND yazar_id = ?';
      params.push(viewer.id);
    } else {
      sql += " AND durum = 'yayinda'";
    }
  } else if (filters.durum) {
    sql += ' AND durum = ?';
    params.push(filters.durum);
  }

  if (filters.bolum) { sql += ' AND bolum = ?'; params.push(filters.bolum); }
  if (filters.danisman) { sql += ' AND danisman = ?'; params.push(filters.danisman); }
  if (filters.yazar) {
    sql += ' AND (yazar_ad LIKE ? OR yazar_id IN (SELECT id FROM users WHERE ad LIKE ? OR soyad LIKE ? OR okul_no LIKE ?))';
    const q = `%${filters.yazar}%`;
    params.push(q, q, q, q);
  }
  if (filters.yil) { sql += ' AND yil = ?'; params.push(parseInt(filters.yil, 10)); }
  if (filters.tez_turu) { sql += ' AND tez_turu = ?'; params.push(filters.tez_turu); }
  if (filters.konu_alani) { sql += ' AND konu_alani = ?'; params.push(filters.konu_alani); }
  if (filters.kayit_turu) { sql += ' AND kayit_turu = ?'; params.push(filters.kayit_turu); }
  if (filters.anahtar_kelime) {
    sql += ' AND (anahtar_kelimeler LIKE ? OR baslik LIKE ? OR ozet LIKE ?)';
    const q = `%${filters.anahtar_kelime}%`;
    params.push(q, q, q);
  }
  if (filters.search) {
    sql += ' AND (baslik LIKE ? OR ozet LIKE ? OR yazar_ad LIKE ? OR anahtar_kelimeler LIKE ?)';
    const q = `%${filters.search}%`;
    params.push(q, q, q, q);
  }

  sql += ' ORDER BY yil DESC, created_at DESC';
  return { sql, params };
}

function buildCountQuery(viewer, filters) {
  const isStaff = viewer && ['admin', 'librarian'].includes(viewer.role);
  let sql = 'SELECT COUNT(*) as c FROM academic_archive WHERE 1=1';
  const params = [];

  if (!isStaff) {
    if (filters.mine) {
      sql += ' AND yazar_id = ?';
      params.push(viewer.id);
    } else {
      sql += " AND durum = 'yayinda'";
    }
  } else if (filters.durum) {
    sql += ' AND durum = ?';
    params.push(filters.durum);
  }

  if (filters.bolum) { sql += ' AND bolum = ?'; params.push(filters.bolum); }
  if (filters.danisman) { sql += ' AND danisman = ?'; params.push(filters.danisman); }
  if (filters.yazar) {
    sql += ' AND (yazar_ad LIKE ? OR yazar_id IN (SELECT id FROM users WHERE ad LIKE ? OR soyad LIKE ? OR okul_no LIKE ?))';
    const q = `%${filters.yazar}%`;
    params.push(q, q, q, q);
  }
  if (filters.yil) { sql += ' AND yil = ?'; params.push(parseInt(filters.yil, 10)); }
  if (filters.tez_turu) { sql += ' AND tez_turu = ?'; params.push(filters.tez_turu); }
  if (filters.konu_alani) { sql += ' AND konu_alani = ?'; params.push(filters.konu_alani); }
  if (filters.kayit_turu) { sql += ' AND kayit_turu = ?'; params.push(filters.kayit_turu); }
  if (filters.anahtar_kelime) {
    sql += ' AND (anahtar_kelimeler LIKE ? OR baslik LIKE ? OR ozet LIKE ?)';
    const q = `%${filters.anahtar_kelime}%`;
    params.push(q, q, q);
  }
  if (filters.search) {
    sql += ' AND (baslik LIKE ? OR ozet LIKE ? OR yazar_ad LIKE ? OR anahtar_kelimeler LIKE ?)';
    const q = `%${filters.search}%`;
    params.push(q, q, q, q);
  }

  return { sql, params };
}

function applyPagination(sql, params, filters) {
  if (filters.limit) {
    const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);
    const offset = parseInt(filters.offset, 10) || 0;
    return { sql: `${sql} LIMIT ? OFFSET ?`, params: [...params, limit, offset] };
  }
  return { sql, params };
}

function createSubmission(db, userId, data) {
  const {
    baslik, ozet, kayit_turu, tez_turu, bolum, danisman, yil,
    anahtar_kelimeler, konu_alani, dosya_icerik, dosya_adi,
  } = data;

  if (!baslik || !kayit_turu || !tez_turu || !yil) {
    return { error: 'Başlık, kayıt türü, tez türü ve yıl zorunludur', status: 400 };
  }
  if (!KAYIT_TURLERI[kayit_turu]) return { error: 'Geçersiz kayıt türü', status: 400 };
  if (!TEZ_TURLERI[tez_turu]) return { error: 'Geçersiz tez türü', status: 400 };

  const user = db.prepare('SELECT ad, soyad, bolum, uyelik_durumu FROM users WHERE id = ?').get(userId);
  if (!user || user.uyelik_durumu !== 'aktif') {
    return { error: 'Aktif üyelik gerekli', status: 400 };
  }

  const fileResult = saveUploadedFile(userId, dosya_adi, dosya_icerik);
  if (fileResult.error) return { error: fileResult.error, status: 400 };

  const yazarAd = `${user.ad} ${user.soyad}`;

  const result = db.prepare(`
    INSERT INTO academic_archive (
      baslik, ozet, kayit_turu, tez_turu, yazar_id, yazar_ad, bolum, danisman,
      yil, anahtar_kelimeler, konu_alani, dosya_yolu, dosya_turu, dosya_boyutu, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'beklemede')
  `).run(
    baslik, ozet || null, kayit_turu, tez_turu, userId, yazarAd,
    bolum || user.bolum || null, danisman || null,
    parseInt(yil, 10), anahtar_kelimeler || null, konu_alani || null,
    fileResult.dosya_yolu, fileResult.dosya_turu, fileResult.dosya_boyutu,
  );

  return { id: result.lastInsertRowid, message: 'Çalışmanız onay için gönderildi' };
}

function approveSubmission(db, id, approverId) {
  const row = db.prepare('SELECT * FROM academic_archive WHERE id = ?').get(id);
  if (!row) return { error: 'Kayıt bulunamadı', status: 404 };
  if (row.durum !== 'beklemede') return { error: 'Yalnızca bekleyen kayıtlar onaylanabilir', status: 400 };

  db.prepare(`
    UPDATE academic_archive SET durum = 'yayinda', onaylayan_id = ?, onay_tarihi = datetime('now'), red_nedeni = NULL
    WHERE id = ?
  `).run(approverId, id);

  return { message: 'Kayıt yayına alındı' };
}

function rejectSubmission(db, id, approverId, redNedeni) {
  const row = db.prepare('SELECT * FROM academic_archive WHERE id = ?').get(id);
  if (!row) return { error: 'Kayıt bulunamadı', status: 404 };
  if (row.durum !== 'beklemede') return { error: 'Yalnızca bekleyen kayıtlar reddedilebilir', status: 400 };

  db.prepare(`
    UPDATE academic_archive SET durum = 'reddedildi', onaylayan_id = ?, onay_tarihi = datetime('now'), red_nedeni = ?
    WHERE id = ?
  `).run(approverId, redNedeni || 'Uygun görülmedi', id);

  return { message: 'Kayıt reddedildi' };
}

function recordDownload(db, id, viewer) {
  const row = db.prepare('SELECT * FROM academic_archive WHERE id = ?').get(id);
  if (!row) return { error: 'Kayıt bulunamadı', status: 404 };

  const isStaff = ['admin', 'librarian'].includes(viewer.role);
  if (!isStaff && row.durum !== 'yayinda') {
    return { error: 'Bu kayıt henüz yayında değil', status: 403 };
  }

  const filePath = resolveThesisFile(row.dosya_yolu);
  if (!filePath) return { error: 'Dosya bulunamadı', status: 404 };

  db.prepare('UPDATE academic_archive SET indirme_sayisi = indirme_sayisi + 1 WHERE id = ?').run(id);

  return {
    filePath,
    filename: `${row.baslik.replace(/[^\w\s-ğüşıöçĞÜŞİÖÇ]/gi, '').slice(0, 60)}.${row.dosya_turu || 'pdf'}`,
  };
}

const TARGET_ARCHIVE_SIZE = 500;

const BOLUMLER = [
  'Bilgisayar Mühendisliği', 'Elektrik-Elektronik Mühendisliği', 'Makine Mühendisliği',
  'Endüstri Mühendisliği', 'İnşaat Mühendisliği', 'Kimya Mühendisliği', 'Biyomedikal Mühendisliği',
  'Yazılım Mühendisliği', 'Mimarlık', 'Şehir ve Bölge Planlama', 'İç Mimarlık',
  'Hukuk', 'İşletme', 'İktisat', 'Uluslararası İlişkiler', 'Siyaset Bilimi',
  'Psikoloji', 'Sosyoloji', 'Tarih', 'Türk Dili ve Edebiyatı', 'İngiliz Dili ve Edebiyatı',
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Moleküler Biyoloji ve Genetik',
  'Tıp', 'Eczacılık', 'Hemşirelik', 'Fizyoterapi ve Rehabilitasyon', 'Beslenme ve Diyetetik',
  'Gastronomi ve Mutfak Sanatları', 'Turizm İşletmeciliği', 'Halkla İlişkiler ve Tanıtım',
  'Grafik Tasarım', 'Görsel İletişim Tasarımı', 'Müzik', 'Sahne Sanatları', 'Sinema ve Televizyon',
  'İlahiyat', 'Felsefe', 'Coğrafya', 'Jeoloji Mühendisliği', 'Çevre Mühendisliği',
  'Orman Mühendisliği', 'Ziraat Mühendisliği', 'Veteriner Hekimliği', 'Diş Hekimliği',
  'Eğitim Bilimleri', 'Rehberlik ve Psikolojik Danışmanlık', 'Okul Öncesi Öğretmenliği',
  'Matematik Öğretmenliği', 'Fen Bilimleri Öğretmenliği', 'Sınıf Öğretmenliği',
  'Bankacılık ve Finans', 'Lojistik Yönetimi', 'Pazarlama', 'Muhasebe ve Finansman',
  'Bilgi ve Belge Yönetimi', 'Arşivcilik', 'Kütüphanecilik',
];

const KONU_ALANLARI = [
  'Yapay Zeka', 'Veri Bilimi', 'Siber Güvenlik', 'Yazılım Mühendisliği', 'IoT',
  'Enerji Sistemleri', 'Yenilenebilir Enerji', 'Yapı Malzemeleri', 'Kentsel Planlama',
  'Sürdürülebilirlik', 'Halk Sağlığı', 'Klinik Araştırma', 'Eczakokinetik',
  'Kurumsal Finans', 'Girişimcilik', 'Dijital Pazarlama', 'İnsan Kaynakları',
  'Anayasa Hukuku', 'Ceza Hukuku', 'Uluslararası Hukuk', 'Medeni Hukuk',
  'Eğitim Teknolojileri', 'Öğrenme Psikolojisi', 'Sosyal Psikoloji', 'Klinik Psikoloji',
  'Türk Edebiyatı', 'Karşılaştırmalı Edebiyat', 'Dilbilim', 'Çeviribilim',
  'Makine Öğrenmesi', 'Doğal Dil İşleme', 'Bilgisayarlı Görü', 'Robotik',
  'Nanoteknoloji', 'Biyoteknoloji', 'Çevre Bilimleri', 'Su Kaynakları',
  'Kültür Varlıkları', 'Müze Çalışmaları', 'Bilgi Erişimi', 'Dijital Arşiv',
  'Kamu Yönetimi', 'Siyaset Tarihi', 'Dış Politika', 'Ekonomi Politikası',
];

const DANISMANLAR = [
  'Prof. Dr. Ahmet Yılmaz', 'Prof. Dr. Ayşe Demir', 'Prof. Dr. Mehmet Kaya', 'Prof. Dr. Fatma Şahin',
  'Prof. Dr. Ali Vural', 'Prof. Dr. Zeynep Arslan', 'Prof. Dr. Mustafa Çelik', 'Prof. Dr. Elif Öztürk',
  'Prof. Dr. Hasan Koç', 'Prof. Dr. Selin Aydın', 'Prof. Dr. Burak Yıldız', 'Prof. Dr. Gül Erdoğan',
  'Doç. Dr. Emre Polat', 'Doç. Dr. Deniz Aksoy', 'Doç. Dr. Cem Güneş', 'Doç. Dr. Pınar Kurt',
  'Doç. Dr. Selin Ak', 'Doç. Dr. Onur Tekin', 'Doç. Dr. Leyla Uçar', 'Doç. Dr. Kerem Aslan',
  'Doç. Dr. Merve Tunç', 'Doç. Dr. Barış Eren', 'Doç. Dr. Seda Yalçın', 'Doç. Dr. Tolga Özkan',
  'Dr. Öğr. Üyesi Can Demir', 'Dr. Öğr. Üyesi Fatma Çelik', 'Dr. Öğr. Üyesi Hakan İpek',
  'Dr. Öğr. Üyesi İrem Bulut', 'Dr. Öğr. Üyesi Kaan Sarı', 'Dr. Öğr. Üyesi Lale Doğan',
  'Dr. Öğr. Üyesi Murat Gencer', 'Dr. Öğr. Üyesi Nihan Acar', 'Dr. Öğr. Üyesi Oğuz Kılıç',
  'Dr. Öğr. Üyesi Pınar Uysal', 'Dr. Öğr. Üyesi Rıza Aktaş', 'Dr. Öğr. Üyesi Sibel Ergin',
  'Dr. Öğr. Üyesi Tarık Yavuz', 'Dr. Öğr. Üyesi Umut Sezer', 'Dr. Öğr. Üyesi Volkan İnce',
  'Prof. Dr. Arzu Karaca', 'Prof. Dr. Bülent Horasan', 'Prof. Dr. Ceyda Avcı', 'Prof. Dr. Doruk Şen',
  'Prof. Dr. Ebru Tanrıverdi', 'Prof. Dr. Ferhat Dursun', 'Prof. Dr. Gizem Altuntaş', 'Prof. Dr. Hüseyin Bayrak',
  'Doç. Dr. İpek Çınar', 'Doç. Dr. Jale Önder', 'Doç. Dr. Kamil Usta', 'Doç. Dr. Leman Bozkurt',
  'Doç. Dr. Metin Gürbüz', 'Doç. Dr. Nilüfer Erdem', 'Doç. Dr. Orhan Başer', 'Doç. Dr. Pelin Çetin',
  'Dr. Öğr. Üyesi Rana Korkmaz', 'Dr. Öğr. Üyesi Serkan Mutlu', 'Dr. Öğr. Üyesi Tuğba Akın',
  'Dr. Öğr. Üyesi Ufuk Dinç', 'Dr. Öğr. Üyesi Vildan Soylu', 'Dr. Öğr. Üyesi Yakup Temiz',
  'Prof. Dr. Zehra Akgül', 'Prof. Dr. Adem Yürekli', 'Prof. Dr. Beste Karataş', 'Prof. Dr. Cihan Özdemir',
  'Doç. Dr. Derya Işık', 'Doç. Dr. Engin Toprak', 'Doç. Dr. Fulya Keskin', 'Doç. Dr. Gökhan Arı',
  'Dr. Öğr. Üyesi Hande Uzun', 'Dr. Öğr. Üyesi İlker Sağlam', 'Dr. Öğr. Üyesi Jülide Ermiş',
  'Dr. Öğr. Üyesi Kadir Yaman', 'Dr. Öğr. Üyesi Lale Güler', 'Dr. Öğr. Üyesi Mert Albayrak',
  'Prof. Dr. Nalan Ertürk', 'Prof. Dr. Okan Bilgin', 'Prof. Dr. Pervin Akar', 'Prof. Dr. Rüstem Çolak',
];

const YAZAR_ADLAR = [
  'Mehmet', 'Ayşe', 'Ali', 'Fatma', 'Mustafa', 'Zeynep', 'Ahmet', 'Elif', 'Hasan', 'Merve',
  'Emre', 'Selin', 'Burak', 'Deniz', 'Cem', 'Pınar', 'Onur', 'Gül', 'Kerem', 'Seda',
  'Barış', 'Leyla', 'Tolga', 'İrem', 'Kaan', 'Nihan', 'Oğuz', 'Arzu', 'Volkan', 'Derya',
  'Can', 'Büşra', 'Efe', 'Yasemin', 'Berk', 'Esra', 'Koray', 'Hande', 'Serkan', 'Tuğba',
];

const YAZAR_SOYADLAR = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Öztürk', 'Aydın', 'Arslan', 'Doğan',
  'Kılıç', 'Koç', 'Aslan', 'Çetin', 'Kara', 'Özkan', 'Aksoy', 'Polat', 'Güneş', 'Erdoğan',
  'Tunç', 'Bulut', 'Sarı', 'Uçar', 'Tekin', 'Yalçın', 'Eren', 'Acar', 'Gencer', 'Uysal',
  'Aktaş', 'Ergin', 'Yavuz', 'Sezer', 'İnce', 'Karaca', 'Horasan', 'Avcı', 'Şen', 'Tanrıverdi',
];

const BASLIK_KONULAR = [
  'Akıllı Sistem Tasarımı', 'Veri Analizi ve Modelleme', 'Dijital Dönüşüm', 'Optimizasyon Yöntemleri',
  'Güvenlik Protokolleri', 'Kullanıcı Deneyimi Araştırması', 'Sürdürülebilir Uygulamalar',
  'Eğitimde Teknoloji Entegrasyonu', 'Sağlık Hizmetlerinde İnovasyon', 'Kentsel Dönüşüm Analizi',
  'Enerji Verimliliği Çalışması', 'Makine Öğrenmesi Uygulaması', 'Derin Öğrenme Modeli',
  'Mobil Uygulama Geliştirme', 'Web Tabanlı Platform', 'Sensör Ağları', 'Görüntü İşleme',
  'Doğal Dil İşleme', 'Blok Zinciri Uygulaması', 'Büyük Veri Analitiği', 'Bulut Bilişim Mimarisi',
  'İnsan-Makine Etkileşimi', 'Sosyal Medya Analizi', 'Finansal Risk Modellemesi',
  'Tedarik Zinciri Optimizasyonu', 'Hasta Takip Sistemi', 'Akademik Performans Analizi',
  'Çevresel Etki Değerlendirmesi', 'Kültürel Miras Dijitalleştirme', 'Kütüphane Otomasyonu',
  'Hukuki Uyuşmazlık Çözümü', 'Kamu Politikası Değerlendirmesi', 'Öğrenme Analitiği',
  'Psikolojik İyi Oluş Araştırması', 'Edebiyat Karşılaştırması', 'Dil Öğretim Yöntemleri',
];

const KAYIT_TURU_POOL = [
  { kayit: 'tez', tez: 'lisans', w: 35 },
  { kayit: 'tez', tez: 'yuksek_lisans', w: 30 },
  { kayit: 'tez', tez: 'doktora', w: 10 },
  { kayit: 'makale', tez: 'makale', w: 15 },
  { kayit: 'bitirme_projesi', tez: 'bitirme_projesi', w: 10 },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(pool) {
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

function generateTitle(bolum, konu) {
  const konuBaslik = pick(BASLIK_KONULAR);
  const templates = [
    `${bolum} Alanında ${konuBaslik}`,
    `${konuBaslik}: ${bolum} Perspektifi`,
    `${konu} Kapsamında ${konuBaslik}`,
    `Üniversite Ölçeğinde ${konuBaslik}`,
    `${konuBaslik} Üzerine Bir Araştırma`,
    `${bolum} için ${konuBaslik} Çözümü`,
  ];
  return pick(templates);
}

function generateOzet(baslik, konu) {
  return `${baslik} konulu bu çalışma, ${konu} alanında güncel literatürü inceleyerek metodolojik bir yaklaşım sunmaktadır. Araştırma kapsamında veri toplama, analiz ve değerlendirme aşamaları detaylandırılmıştır.`;
}

function generateKeywords(konu) {
  const extras = ['analiz', 'tasarım', 'uygulama', 'model', 'sistem', 'araştırma', 'Türkiye', 'kampüs'];
  const kws = [konu.toLowerCase(), pick(extras), pick(extras), pick(extras)];
  return [...new Set(kws)].slice(0, 4).join(', ');
}

function seedThesisArchive(db) {
  ensureUploadDir();
  const count = db.prepare('SELECT COUNT(*) as c FROM academic_archive').get().c;
  if (count >= TARGET_ARCHIVE_SIZE) return;

  const demoFile = 'demo-tez.txt';
  const demoPath = path.join(UPLOAD_DIR, demoFile);
  if (!fs.existsSync(demoPath)) {
    fs.writeFileSync(demoPath, 'Örnek tez dosyası — Akıllı Kütüphane Arşivi\n', 'utf8');
  }

  const members = db.prepare("SELECT id, ad, soyad, bolum FROM users WHERE role = 'member'").all();
  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const librarian = db.prepare("SELECT id FROM users WHERE username = 'kutuphaneci'").get();
  const approvers = [admin, librarian].filter(Boolean);

  const toInsert = TARGET_ARCHIVE_SIZE - count;

  const insert = db.prepare(`
    INSERT INTO academic_archive (
      baslik, ozet, kayit_turu, tez_turu, yazar_id, yazar_ad, bolum, danisman,
      yil, anahtar_kelimeler, konu_alani, dosya_yolu, dosya_turu, dosya_boyutu,
      durum, onaylayan_id, onay_tarihi, indirme_sayisi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((n) => {
    for (let i = 0; i < n; i++) {
      const bolum = pick(BOLUMLER);
      const konu = pick(KONU_ALANLARI);
      const danisman = pick(DANISMANLAR);
      const { kayit, tez } = pickWeighted(KAYIT_TURU_POOL);
      const yil = 2015 + Math.floor(Math.random() * 11);
      const baslik = generateTitle(bolum, konu);
      const ozet = generateOzet(baslik, konu);
      const anahtar = generateKeywords(konu);

      const member = members.length ? pick(members) : null;
      const yazarAd = member
        ? `${member.ad} ${member.soyad}`
        : `${pick(YAZAR_ADLAR)} ${pick(YAZAR_SOYADLAR)}`;
      const yazarId = member?.id || 1;

      const roll = Math.random();
      let durum = 'yayinda';
      if (roll > 0.96) durum = 'beklemede';
      else if (roll > 0.93) durum = 'reddedildi';

      const isPublished = durum === 'yayinda';
      const approver = approvers.length ? pick(approvers) : null;
      const dosyaBoyutu = 120000 + Math.floor(Math.random() * 4800000);
      const indirme = isPublished ? Math.floor(Math.random() * 450) : 0;

      insert.run(
        baslik, ozet, kayit, tez, yazarId, yazarAd, bolum, danisman,
        yil, anahtar, konu, demoFile, 'pdf', dosyaBoyutu,
        durum,
        isPublished || durum === 'reddedildi' ? approver?.id : null,
        isPublished || durum === 'reddedildi' ? new Date(yil, 5, 15).toISOString() : null,
        indirme,
      );
    }
  });

  insertMany(toInsert);
  console.log(`Tez arşivi: ${toInsert} kayıt eklendi (toplam hedef: ${TARGET_ARCHIVE_SIZE})`);
}

module.exports = {
  KAYIT_TURLERI,
  TEZ_TURLERI,
  enrichArchiveItem,
  getFilterOptions,
  buildListQuery,
  buildCountQuery,
  applyPagination,
  createSubmission,
  approveSubmission,
  rejectSubmission,
  recordDownload,
  resolveThesisFile,
  seedThesisArchive,
};
