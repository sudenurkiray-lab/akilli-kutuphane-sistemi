/** Kütüphane odaları — çalışma/okuma salonları */
const TIME_SLOTS = [
  { baslangic: '09:00', bitis: '11:00', label: '09:00 – 11:00' },
  { baslangic: '11:00', bitis: '13:00', label: '11:00 – 13:00' },
  { baslangic: '13:00', bitis: '15:00', label: '13:00 – 15:00' },
  { baslangic: '15:00', bitis: '17:00', label: '15:00 – 17:00' },
  { baslangic: '17:00', bitis: '19:00', label: '17:00 – 19:00' },
];

const LIBRARY_ROOMS = [
  { id: 'roman-salonu', ad: 'Roman Salonu', kat: '1. Kat', raf_prefix: 'A', aciklama: 'Sessiz çalışma ve roman okuma', kapasite: 30 },
  { id: 'bilim-kurgu', ad: 'Bilim Kurgu Odası', kat: '1. Kat', raf_prefix: 'B', aciklama: 'Grup çalışması ve okuma', kapasite: 20 },
  { id: 'tarih-salonu', ad: 'Tarih Salonu', kat: '2. Kat', raf_prefix: 'C', aciklama: 'Sessiz çalışma alanı', kapasite: 25 },
  { id: 'teknoloji', ad: 'Teknoloji & Yazılım', kat: '2. Kat', raf_prefix: 'D', aciklama: 'Bilgisayarlı çalışma odası', kapasite: 24 },
  { id: 'felsefe', ad: 'Felsefe Salonu', kat: '2. Kat', raf_prefix: 'E', aciklama: 'Sessiz okuma köşesi', kapasite: 20 },
  { id: 'psikoloji', ad: 'Psikoloji Odası', kat: '3. Kat', raf_prefix: 'F', aciklama: 'Bireysel çalışma', kapasite: 18 },
  { id: 'sosyal-bilimler', ad: 'Sosyal Bilimler', kat: '3. Kat', raf_prefix: 'G', aciklama: 'Grup çalışma masaları', kapasite: 22 },
  { id: 'biyografi', ad: 'Biyografi Köşesi', kat: '3. Kat', raf_prefix: 'H', aciklama: 'Sessiz okuma', kapasite: 15 },
  { id: 'siir', ad: 'Şiir Köşesi', kat: '1. Kat', raf_prefix: 'I', aciklama: 'Sessiz çalışma', kapasite: 12 },
  { id: 'cocuk', ad: 'Çocuk Edebiyatı', kat: 'Zemin', raf_prefix: 'J', aciklama: 'Aile ve çocuk okuma alanı', kapasite: 20 },
  { id: 'polisiye', ad: 'Polisiye & Gerilim', kat: '1. Kat', raf_prefix: 'K', aciklama: 'Sessiz okuma', kapasite: 18 },
  { id: 'fantastik', ad: 'Fantastik Edebiyat', kat: '1. Kat', raf_prefix: 'L', aciklama: 'Rahat okuma alanı', kapasite: 16 },
  { id: 'bilim', ad: 'Bilim Salonu', kat: '4. Kat', raf_prefix: 'M', aciklama: 'Araştırma ve çalışma', kapasite: 28 },
  { id: 'sanat', ad: 'Sanat Galerisi', kat: '2. Kat', raf_prefix: 'N', aciklama: 'Sessiz çalışma', kapasite: 14 },
  { id: 'sosyoloji', ad: 'Sosyoloji Odası', kat: '3. Kat', raf_prefix: 'O', aciklama: 'Grup çalışması', kapasite: 20 },
  { id: 'politika', ad: 'Politika & Kamu', kat: '3. Kat', raf_prefix: 'P', aciklama: 'Seminer ve çalışma', kapasite: 24 },
  { id: 'din-mitoloji', ad: 'Din & Mitoloji', kat: '4. Kat', raf_prefix: 'Q', aciklama: 'Sessiz okuma', kapasite: 15 },
  { id: 'egitim', ad: 'Eğitim Salonu', kat: '2. Kat', raf_prefix: 'R', aciklama: 'Grup ders çalışması', kapasite: 30 },
  { id: 'saglik', ad: 'Sağlık Köşesi', kat: '4. Kat', raf_prefix: 'S', aciklama: 'Sessiz çalışma', kapasite: 16 },
  { id: 'muhendislik', ad: 'Mühendislik', kat: '4. Kat', raf_prefix: 'T', aciklama: 'Proje ve çalışma odası', kapasite: 26 },
  { id: 'hukuk', ad: 'Hukuk Odası', kat: '3. Kat', raf_prefix: 'U', aciklama: 'Sessiz araştırma', kapasite: 22 },
  { id: 'cografya', ad: 'Coğrafya & Seyahat', kat: '2. Kat', raf_prefix: 'V', aciklama: 'Okuma ve çalışma', kapasite: 14 },
  { id: 'genel', ad: 'Genel Koleksiyon', kat: 'Zemin', raf_prefix: 'X', aciklama: 'Genel çalışma alanı', kapasite: 40 },
];

function getRoomByRaf(rafNo) {
  if (!rafNo) return null;
  const prefix = rafNo.split('-')[0];
  return LIBRARY_ROOMS.find((r) => r.raf_prefix === prefix) || LIBRARY_ROOMS.find((r) => r.id === 'genel');
}

function getRoomById(id) {
  return LIBRARY_ROOMS.find((r) => r.id === id) || null;
}

module.exports = { LIBRARY_ROOMS, TIME_SLOTS, getRoomByRaf, getRoomById };
