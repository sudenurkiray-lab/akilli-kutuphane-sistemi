const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const { seedBooks } = require('./seed-books');

const db = new Database(path.join(__dirname, 'kutuphane.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'librarian')),
    ad TEXT,
    soyad TEXT,
    okul_no TEXT,
    email TEXT,
    telefon TEXT,
    bolum TEXT,
    uyelik_durumu TEXT DEFAULT 'aktif',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    yazar TEXT NOT NULL,
    kategori TEXT,
    isbn TEXT UNIQUE,
    yayinevi TEXT,
    basim_yili INTEGER,
    raf_no TEXT,
    sayfa_sayisi INTEGER,
    stok INTEGER DEFAULT 1,
    durum TEXT DEFAULT 'mevcut' CHECK(durum IN ('mevcut', 'oduncte', 'bakimda', 'kayip')),
    oda TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    odunc_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    teslim_tarihi DATETIME,
    iade_tarihi DATETIME,
    durum TEXT DEFAULT 'aktif' CHECK(durum IN ('aktif', 'iade_edildi', 'gecikti')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    durum TEXT DEFAULT 'beklemede' CHECK(durum IN ('beklemede', 'tamamlandi', 'iptal')),
    oda TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS penalties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    loan_id INTEGER,
    tutar REAL NOT NULL,
    geciken_gun INTEGER,
    sebep TEXT,
    odendi INTEGER DEFAULT 0,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (loan_id) REFERENCES loans(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tur TEXT NOT NULL,
    ref_id INTEGER,
    baslik TEXT NOT NULL,
    mesaj TEXT NOT NULL,
    okundu INTEGER DEFAULT 0,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS room_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room_id TEXT NOT NULL,
    tarih TEXT NOT NULL,
    baslangic TEXT NOT NULL,
    bitis TEXT NOT NULL,
    durum TEXT DEFAULT 'beklemede' CHECK(durum IN ('beklemede', 'onaylandi', 'iptal', 'tamamlandi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    puan INTEGER NOT NULL CHECK(puan BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS book_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    yorum TEXT NOT NULL,
    spoiler INTEGER DEFAULT 0,
    durum TEXT DEFAULT 'yayinda' CHECK(durum IN ('yayinda', 'silindi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS review_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id),
    FOREIGN KEY (review_id) REFERENCES book_reviews(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS review_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    sebep TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id),
    FOREIGN KEY (review_id) REFERENCES book_reviews(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reading_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ad TEXT NOT NULL,
    aciklama TEXT,
    gizlilik TEXT DEFAULT 'ozel' CHECK(gizlilik IN ('ozel', 'herkese_acik')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reading_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    not_metni TEXT,
    sira INTEGER DEFAULT 0,
    eklendi_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, book_id),
    FOREIGN KEY (list_id) REFERENCES reading_lists(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    kazanma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS book_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    search TEXT,
    kategori TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS damage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id INTEGER NOT NULL,
    bildiren_id INTEGER,
    aciklama TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (copy_id) REFERENCES book_copies(id),
    FOREIGN KEY (bildiren_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS library_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    adres TEXT,
    hafta_ici TEXT DEFAULT '09:00 - 20:00',
    cumartesi TEXT DEFAULT '10:00 - 17:00',
    pazar TEXT DEFAULT 'Kapalı',
    aktif INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    copy_id INTEGER,
    kaynak_sube_id INTEGER NOT NULL,
    hedef_sube_id INTEGER NOT NULL,
    durum TEXT DEFAULT 'talep',
    not_metni TEXT,
    talep_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    onay_tarihi DATETIME,
    hazirlik_tarihi DATETIME,
    transfer_tarihi DATETIME,
    teslim_noktasi_tarihi DATETIME,
    teslim_tarihi DATETIME,
    iptal_tarihi DATETIME,
    loan_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (copy_id) REFERENCES book_copies(id),
    FOREIGN KEY (kaynak_sube_id) REFERENCES library_branches(id),
    FOREIGN KEY (hedef_sube_id) REFERENCES library_branches(id)
  );

  CREATE TABLE IF NOT EXISTS desk_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    desk_id TEXT NOT NULL,
    salon_id TEXT NOT NULL,
    tarih TEXT NOT NULL,
    baslangic TEXT NOT NULL,
    bitis TEXT NOT NULL,
    durum TEXT DEFAULT 'onaylandi' CHECK(durum IN ('onaylandi', 'aktif', 'tamamlandi', 'iptal')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS library_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    baslik TEXT NOT NULL,
    aciklama TEXT,
    tur TEXT NOT NULL,
    tarih TEXT NOT NULL,
    baslangic TEXT NOT NULL,
    bitis TEXT NOT NULL,
    konum TEXT,
    kapasite INTEGER DEFAULT 30,
    egitmen TEXT,
    durum TEXT DEFAULT 'yayinda' CHECK(durum IN ('taslak', 'yayinda', 'iptal', 'tamamlandi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    kayit_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    durum TEXT DEFAULT 'kayitli' CHECK(durum IN ('kayitli', 'iptal', 'katildi', 'katilmadi')),
    sertifika_kodu TEXT UNIQUE,
    sertifika_tarihi DATETIME,
    UNIQUE(event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES library_events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS digital_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    baslik TEXT NOT NULL,
    yazar TEXT,
    tur TEXT NOT NULL CHECK(tur IN (
      'e_kitap', 'makale', 'tez', 'dergi',
      'sesli_kitap', 'video_egitim', 'akademik_veritabani'
    )),
    aciklama TEXT,
    kategori TEXT,
    yayinevi TEXT,
    yayin_yili INTEGER,
    isbn_doi TEXT,
    dosya_yolu TEXT,
    dosya_turu TEXT,
    dosya_boyutu INTEGER DEFAULT 0,
    indirme_sayisi INTEGER DEFAULT 0,
    goruntulenme_sayisi INTEGER DEFAULT 0,
    erisim_yetkisi TEXT DEFAULT 'uye' CHECK(erisim_yetkisi IN (
      'herkes', 'uye', 'ogrenci', 'personel', 'kutuphane_ici'
    )),
    indirme_izni INTEGER DEFAULT 1,
    yayin_lisansi TEXT,
    son_erisim_tarihi TEXT,
    durum TEXT DEFAULT 'yayinda' CHECK(durum IN ('taslak', 'yayinda', 'arsiv')),
    branch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES library_branches(id)
  );

  CREATE TABLE IF NOT EXISTS digital_resource_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    islem TEXT NOT NULL CHECK(islem IN ('goruntuleme', 'indirme')),
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES digital_resources(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS academic_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    baslik TEXT NOT NULL,
    ozet TEXT,
    kayit_turu TEXT NOT NULL CHECK(kayit_turu IN ('tez', 'makale', 'bitirme_projesi')),
    tez_turu TEXT NOT NULL,
    yazar_id INTEGER NOT NULL,
    yazar_ad TEXT,
    bolum TEXT,
    danisman TEXT,
    yil INTEGER NOT NULL,
    anahtar_kelimeler TEXT,
    konu_alani TEXT,
    dosya_yolu TEXT,
    dosya_turu TEXT DEFAULT 'pdf',
    dosya_boyutu INTEGER DEFAULT 0,
    durum TEXT DEFAULT 'beklemede' CHECK(durum IN ('beklemede', 'onaylandi', 'reddedildi', 'yayinda')),
    red_nedeni TEXT,
    onaylayan_id INTEGER,
    onay_tarihi DATETIME,
    indirme_sayisi INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (yazar_id) REFERENCES users(id),
    FOREIGN KEY (onaylayan_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS book_copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    kopya_no INTEGER NOT NULL,
    barkod TEXT UNIQUE NOT NULL,
    qr_kod TEXT UNIQUE NOT NULL,
    sube TEXT DEFAULT 'Ana Kütüphane',
    kat TEXT,
    raf_no TEXT,
    fiziksel_durum TEXT DEFAULT 'rafta' CHECK(fiziksel_durum IN ('rafta', 'oduncte', 'hasarli', 'kayip', 'rezerve', 'bakimda')),
    satin_alma_tarihi TEXT,
    maliyet REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(book_id, kopya_no)
  );
`);

// Mevcut veritabanı için sütun ekleme
try { db.exec('ALTER TABLE penalties ADD COLUMN geciken_gun INTEGER'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE books ADD COLUMN oda TEXT'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE reservations ADD COLUMN oda TEXT'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE loans ADD COLUMN copy_id INTEGER'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE users ADD COLUMN uye_karti_qr TEXT'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE users ADD COLUMN profil_foto TEXT'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE users ADD COLUMN uyelik_bitis_tarihi TEXT'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE loans ADD COLUMN uzatma_sayisi INTEGER DEFAULT 0'); } catch (_) { /* zaten var */ }
try { db.exec('ALTER TABLE books ADD COLUMN sayfa_sayisi INTEGER'); } catch (_) { /* zaten var */ }

const { migrateBookPageCounts } = require('./readingStats');
migrateBookPageCounts(db);

const { migratePenaltiesSchema, seedAdvancedPenaltiesDemo } = require('./advancedPenalties');
migratePenaltiesSchema(db);

const { migrateInspectionSchema } = require('./bookReturnInspection');
migrateInspectionSchema(db);

const { migrateNotificationCenter } = require('./notificationCenter');
migrateNotificationCenter(db);

const { migrateMemberQrCodes } = require('./scan');
const { migrateMembershipDates } = require('./memberCard');
const { migrateReservationsQueue } = require('./reservationQueue');
const { seedBranches, migrateBranchLinks, migrateMemberPreferredBranch } = require('./branches');
migrateMemberQrCodes(db);
migrateMembershipDates(db);
migrateReservationsQueue(db);

// Kitaplara oda ata (raf numarasından)
const { getRoomByRaf } = require('./rooms');
const { migrateAllBookCopies } = require('./copies');
const booksWithoutOda = db.prepare("SELECT id, raf_no FROM books WHERE oda IS NULL OR oda = ''").all();
const updateOda = db.prepare('UPDATE books SET oda = ? WHERE id = ?');
booksWithoutOda.forEach((b) => {
  const room = getRoomByRaf(b.raf_no);
  if (room) updateOda.run(room.id, b.id);
});

function seedUsers() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) return;

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, role, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('admin', hash('admin123'), 'admin', 'Sistem', 'Yöneticisi', null, 'admin@kutuphane.edu.tr', null, null, 'aktif');
  insertUser.run('kutuphaneci', hash('kutup123'), 'librarian', 'Ayşe', 'Demir', null, 'kutuphaneci@kutuphane.edu.tr', '05551234567', null, 'aktif');
  insertUser.run('ogrenci1', hash('ogrenci123'), 'member', 'Mehmet', 'Yılmaz', '2021001', 'mehmet@ogrenci.edu.tr', '05559876543', 'Bilgisayar Mühendisliği', 'aktif');
  insertUser.run('ogrenci2', hash('ogrenci123'), 'member', 'Zeynep', 'Kaya', '2021002', 'zeynep@ogrenci.edu.tr', '05551112233', 'Elektrik Mühendisliği', 'aktif');
}

seedUsers();
seedBooks(db);
seedBranches(db);
migrateBranchLinks(db);
migrateAllBookCopies(db);
migrateMemberPreferredBranch(db);
const { seedDemoDeskReservations } = require('./desks');
const { seedEvents } = require('./events');
const { seedDigitalResources } = require('./digitalResources');
const { seedThesisArchive } = require('./thesisArchive');
const { seedBookReviews } = require('./bookReviews');
const { seedReadingLists } = require('./readingLists');
const { seedGamificationDemo } = require('./gamification');
seedDemoDeskReservations(db);
seedEvents(db);
seedDigitalResources(db);
seedThesisArchive(db);
seedBookReviews(db);
seedReadingLists(db);
seedGamificationDemo(db);
seedAdvancedPenaltiesDemo(db);
const { seedNotificationDemo } = require('./notificationCenter');
seedNotificationDemo(db);
const { seedAdminAnalyticsDemo } = require('./adminAnalytics');
seedAdminAnalyticsDemo(db);
const { migratePurchaseRequests, seedPurchaseRequestsDemo } = require('./purchaseRequests');
migratePurchaseRequests(db);
seedPurchaseRequestsDemo(db);
const { migrateBookDonations, seedBookDonationsDemo } = require('./bookDonations');
migrateBookDonations(db);
seedBookDonationsDemo(db);
const { migrateInventorySchema, seedInventoryDemo } = require('./inventoryCount');
migrateInventorySchema(db);
seedInventoryDemo(db);
const { migrateStaffSchema, seedStaffDemo } = require('./staffManagement');
migrateStaffSchema(db);
seedStaffDemo(db);
const { migrateAuditSchema, seedAuditDemo } = require('./auditLog');
migrateAuditSchema(db);
seedAuditDemo(db);
const { migrateSecuritySchema } = require('./security');
migrateSecuritySchema(db);
const { migrateClubsSchema, seedClubsDemo } = require('./clubs');
migrateClubsSchema(db);
seedClubsDemo(db);

// Performans: kitap arama indeksleri
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_books_ad ON books(ad);
  CREATE INDEX IF NOT EXISTS idx_books_yazar ON books(yazar);
  CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
  CREATE INDEX IF NOT EXISTS idx_books_kategori ON books(kategori);
  CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
  CREATE INDEX IF NOT EXISTS idx_loans_durum ON loans(durum);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_book ON ratings(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_reviews_book ON book_reviews(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_reviews_user ON book_reviews(user_id);
  CREATE INDEX IF NOT EXISTS idx_review_likes_review ON review_likes(review_id);
  CREATE INDEX IF NOT EXISTS idx_review_reports_review ON review_reports(review_id);
  CREATE INDEX IF NOT EXISTS idx_reading_lists_user ON reading_lists(user_id);
  CREATE INDEX IF NOT EXISTS idx_reading_lists_gizlilik ON reading_lists(gizlilik);
  CREATE INDEX IF NOT EXISTS idx_reading_list_items_list ON reading_list_items(list_id);
  CREATE INDEX IF NOT EXISTS idx_reading_list_items_book ON reading_list_items(book_id);
  CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
  CREATE INDEX IF NOT EXISTS idx_book_views_user ON book_views(user_id);
  CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_copies_barkod ON book_copies(barkod);
  CREATE INDEX IF NOT EXISTS idx_book_copies_durum ON book_copies(fiziksel_durum);
  CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_copies_branch ON book_copies(branch_id);
  CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
  CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfers(user_id);
  CREATE INDEX IF NOT EXISTS idx_transfers_durum ON transfers(durum);
  CREATE INDEX IF NOT EXISTS idx_transfers_hedef ON transfers(hedef_sube_id);
  CREATE INDEX IF NOT EXISTS idx_transfers_kaynak ON transfers(kaynak_sube_id);
  CREATE INDEX IF NOT EXISTS idx_desk_res_user ON desk_reservations(user_id);
  CREATE INDEX IF NOT EXISTS idx_desk_res_salon ON desk_reservations(salon_id);
  CREATE INDEX IF NOT EXISTS idx_desk_res_tarih ON desk_reservations(tarih);
  CREATE INDEX IF NOT EXISTS idx_desk_res_desk ON desk_reservations(desk_id);
  CREATE INDEX IF NOT EXISTS idx_events_durum ON library_events(durum);
  CREATE INDEX IF NOT EXISTS idx_events_tarih ON library_events(tarih);
  CREATE INDEX IF NOT EXISTS idx_event_reg_event ON event_registrations(event_id);
  CREATE INDEX IF NOT EXISTS idx_event_reg_user ON event_registrations(user_id);
  CREATE INDEX IF NOT EXISTS idx_digital_res_tur ON digital_resources(tur);
  CREATE INDEX IF NOT EXISTS idx_digital_res_durum ON digital_resources(durum);
  CREATE INDEX IF NOT EXISTS idx_digital_res_kategori ON digital_resources(kategori);
  CREATE INDEX IF NOT EXISTS idx_digital_logs_resource ON digital_resource_logs(resource_id);
  CREATE INDEX IF NOT EXISTS idx_digital_logs_user ON digital_resource_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_archive_durum ON academic_archive(durum);
  CREATE INDEX IF NOT EXISTS idx_archive_bolum ON academic_archive(bolum);
  CREATE INDEX IF NOT EXISTS idx_archive_yil ON academic_archive(yil);
  CREATE INDEX IF NOT EXISTS idx_archive_tez_turu ON academic_archive(tez_turu);
  CREATE INDEX IF NOT EXISTS idx_archive_konu ON academic_archive(konu_alani);
  CREATE INDEX IF NOT EXISTS idx_archive_yazar ON academic_archive(yazar_id);
`);

module.exports = db;
