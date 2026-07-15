export const SYSTEM_RULES = {
  maxKitap: 3,
  oduncSuresiGun: 14,
  gecikmeCezasiGunluk: 5,
  teslimUyariGun: 3,
  rezervasyonAlmaSaati: 24,
  maxUzatma: 2,
  uzatmaGun: 7,
};

export const RULE_ITEMS = [
  { icon: '📚', text: `Bir öğrenci aynı anda en fazla ${SYSTEM_RULES.maxKitap} kitap alabilir.` },
  { icon: '📅', text: `Ödünç alma süresi ${SYSTEM_RULES.oduncSuresiGun} gündür.` },
  { icon: '🔄', text: `Teslim süresi en fazla ${SYSTEM_RULES.maxUzatma} kez, her seferinde ${SYSTEM_RULES.uzatmaGun} gün uzatılabilir (sıra veya gecikme yoksa).` },
  { icon: '💰', text: `Gecikme cezası günlük ${SYSTEM_RULES.gecikmeCezasiGunluk} TL'dir. Hasar ve kayıp cezaları teslim kontrolünde otomatik uygulanır.` },
  { icon: '📄', text: 'Ödenmemiş cezalar için profilinizden dekont yükleyebilirsiniz; kütüphane onayı sonrası ceza kapanır.' },
  { icon: '📦', text: 'Stokta olmayan kitap ödünç alınamaz; sıraya girebilirsiniz.' },
  { icon: '🔖', text: 'Kütüphane odalarını "Oda Rezervasyonu" bölümünden tarih ve saat seçerek rezerve edebilirsiniz.' },
  { icon: '⏳', text: `Sıra size geldiğinde kitabı almak için ${SYSTEM_RULES.rezervasyonAlmaSaati} saatiniz vardır.` },
];
