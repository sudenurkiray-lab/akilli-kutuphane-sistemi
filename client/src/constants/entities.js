/** Veritabanı alan eşleştirmeleri — Tutulacak temel bilgiler */

export const KITAP_ALANLARI = [
  { alan: 'ad', label: 'Kitap Adı' },
  { alan: 'yazar', label: 'Yazar' },
  { alan: 'isbn', label: 'ISBN' },
  { alan: 'kategori', label: 'Kategori' },
  { alan: 'yayinevi', label: 'Yayınevi' },
  { alan: 'basim_yili', label: 'Basım Yılı' },
  { alan: 'raf_no', label: 'Raf Numarası' },
  { alan: 'stok', label: 'Stok Adedi' },
  { alan: 'durum', label: 'Durum' },
];

export const UYE_ALANLARI = [
  { alan: 'ad', label: 'Ad' },
  { alan: 'soyad', label: 'Soyad' },
  { alan: 'okul_no', label: 'Öğrenci Numarası' },
  { alan: 'email', label: 'E-posta' },
  { alan: 'telefon', label: 'Telefon' },
  { alan: 'bolum', label: 'Bölüm' },
  { alan: 'password', label: 'Şifre', gizli: true },
  { alan: 'uyelik_durumu', label: 'Üyelik Durumu' },
];

export const ODUNC_ALANLARI = [
  { alan: 'kitap_adi', label: 'Kitap' },
  { alan: 'ogrenci', label: 'Öğrenci' },
  { alan: 'odunc_tarihi', label: 'Alış Tarihi' },
  { alan: 'teslim_tarihi', label: 'Teslim Tarihi' },
  { alan: 'iade_tarihi', label: 'Gerçek Teslim Tarihi' },
  { alan: 'durum', label: 'Durum' },
];

export const CEZA_ALANLARI = [
  { alan: 'ogrenci', label: 'Öğrenci' },
  { alan: 'kitap_adi', label: 'Kitap' },
  { alan: 'geciken_gun', label: 'Geciken Gün' },
  { alan: 'tutar', label: 'Ceza Tutarı' },
  { alan: 'odendi', label: 'Ödeme Durumu' },
];

export const REZERVASYON_ALANLARI = [
  { alan: 'ogrenci', label: 'Öğrenci' },
  { alan: 'kitap_adi', label: 'Kitap' },
  { alan: 'tarih', label: 'Rezervasyon Tarihi' },
  { alan: 'durum', label: 'Rezervasyon Durumu' },
];
