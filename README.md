# Dijital Kütüphane Portalı

Modern, üç rollü kütüphane yönetim sistemi. Siyah-mor temalı arayüz ile kitap yönetimi, ödünç işlemleri, rezervasyon ve ceza takibi.

## Özellikler

### Yönetici (Admin)
- Sistem paneli ve istatistikler
- Üye yönetimi (ad, soyad, okul no, e-posta, telefon, bölüm, üyelik durumu)
- Ceza takibi ve ödeme işaretleme
- Detaylı raporlar

### Kütüphaneci (Görevli)
- **Kitap yönetimi** (sadece bu rolde): ad, yazar, kategori, ISBN, yayınevi, basım yılı, raf no, stok, durum
- Ödünç verme ve iade alma
- Gecikme kontrolü
- Raf düzenleme

### Üye (Öğrenci)
- Kitap arama ve filtreleme
- Ödünç alma ve rezervasyon
- Profil: ödünç kitaplar, geçmiş, gecikenler, cezalar, rezervasyonlar
- Teslim tarihi görüntüleme

## Kurulum

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Tutulacak Temel Bilgiler

### Kitap (`books`)
Kitap adı, yazar, ISBN, kategori, yayınevi, basım yılı, raf numarası, stok adedi, durum

### Üye (`users`)
Ad, soyad, öğrenci numarası, e-posta, telefon, bölüm, şifre (hash), üyelik durumu

### Ödünç (`loans`)
Kitap, öğrenci, alış tarihi, teslim tarihi, gerçek teslim tarihi, durum

### Ceza (`penalties`)
Öğrenci, kitap, geciken gün sayısı, ceza tutarı, ödeme durumu

### Rezervasyon (`reservations`)
Öğrenci, kitap, rezervasyon tarihi, rezervasyon durumu

## Fonksiyonel Olmayan Gereksinimler

| Gereksinim | Uygulama |
|------------|----------|
| Kullanımı kolay | Sade menüler, hızlı işlem butonları, sistem kuralları kartı |
| Güvenli | JWT kimlik doğrulama, rol bazlı yetkilendirme |
| Yetki kontrolü | Her kullanıcı yalnızca kendi rolünün işlemlerini yapar |
| Hızlı arama | Veritabanı indeksleri + 300ms debounce arama |
| Veri düzeni | SQLite: kitap, kullanıcı, ödünç, ceza, rezervasyon tabloları |
| Modern tasarım | Sade siyah-mor tema, göz yormayan renkler |

## Sistem Kuralları

| Kural | Değer |
|-------|-------|
| Maksimum ödünç | 3 kitap / öğrenci |
| Ödünç süresi | 14 gün |
| Gecikme cezası | 5 TL / gün |
| Stok kontrolü | Stok yoksa ödünç alınamaz |
| Rezervasyon | Kitap ödünçteyken yapılabilir |
| Admin yetkisi | Tüm işlemleri görür ve yönetir |
| Öğrenci yetkisi | Yalnızca kendi bilgilerini ve kitaplarını görür |

Kurallar `server/rules.js` dosyasından merkezi olarak yönetilir.

## Fonksiyonel Gereksinimler

| Gereksinim | Durum |
|------------|-------|
| Kullanıcı giriş sistemi (Admin, Öğrenci, Kütüphaneci) | ✅ |
| Kitap ekleme (ad, yazar, ISBN, kategori, yayınevi, yıl, raf, stok) | ✅ |
| Kitap listeleme ve arama (ad, yazar, kategori, ISBN) | ✅ |
| Kitap güncelleme ve silme (Admin veya Görevli) | ✅ |
| Üye yönetimi (kayıt oluşturma, güncelleme) | ✅ |
| Ödünç alma işlemi | ✅ |
| Teslim alma işlemi | ✅ |
| Gecikme cezası (otomatik hesaplama) | ✅ |
| Rezervasyon sistemi (kitap ödünçteyken) | ✅ |
| Bildirim sistemi (teslim yaklaşınca / gecikince) | ✅ |
| Raporlama (popüler kitaplar, gecikenler, aktif üyeler) | ✅ |

## Kullanıcı Gereksinimleri

Sistemde 3 temel kullanıcı tipi bulunur:

### Admin
Sistemin tamamını yönetir.
- Üye yönetimi
- Ceza takibi
- Sistem raporları
- Ödünç denetimi (salt okunur)

### Kütüphaneci / Görevli
Kitap ödünç verme, teslim alma ve stok takibi yapar.
- Ödünç verme ve iade alma
- Stok takibi ve kitap yönetimi
- Gecikme kontrolü
- Raf düzenleme

### Öğrenci / Üye
Kitap arar, ödünç alır, rezervasyon yapar, kendi işlemlerini görür.
- Kitap arama ve filtreleme
- Ödünç alma
- Rezervasyon
- İşlem geçmişi (ödünç, geciken, ceza, rezervasyon)

## Kitap Veritabanı

Sistem **320+ gerçek kitap** içerir; 16 farklı kategoride (Roman, Bilim Kurgu, Tarih, Bilgisayar, Yazılım, Felsefe, Psikoloji, Ekonomi, Polisiye, Fantastik, Bilim, Biyografi, Sosyoloji, Sanat, Eğitim, Mühendislik).

Kitapları yeniden yüklemek için:
```bash
npm run seed        # 200'den az kitap varsa ekler
npm run seed:force  # Tüm kitapları sıfırlayıp yeniden yükler
```

## Kayıt Olma

`/kayit` sayfasından **Öğrenci**, **Kütüphaneci** veya **Admin** hesabı oluşturabilirsiniz.

## Demo Hesaplar

| Rol | Kullanıcı Adı | Şifre |
|-----|---------------|-------|
| Yönetici | admin | admin123 |
| Kütüphaneci | kutuphaneci | kutup123 |
| Üye (Öğrenci) | ogrenci1 | ogrenci123 |

## Teknolojiler

- **Frontend:** React, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Auth:** JWT tabanlı kimlik doğrulama
