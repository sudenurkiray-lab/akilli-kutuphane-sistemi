export const ROLES = {
  admin: {
    key: 'admin',
    label: 'Admin',
    subtitle: 'Yönetici',
    description: 'Sistemin tamamını yönetir.',
    capabilities: ['Üye yönetimi', 'Ceza takibi', 'Sistem raporları', 'Genel denetim'],
    path: '/admin',
    demo: { username: 'admin', password: 'admin123' },
  },
  librarian: {
    key: 'librarian',
    label: 'Kütüphaneci / Görevli',
    subtitle: 'Görevli',
    description: 'Kitap ödünç verme, teslim alma ve stok takibi yapar.',
    capabilities: ['Ödünç verme / iade', 'Stok takibi', 'Kitap yönetimi', 'Raf düzenleme'],
    path: '/kutuphaneci',
    demo: { username: 'kutuphaneci', password: 'kutup123' },
  },
  member: {
    key: 'member',
    label: 'Öğrenci / Üye',
    subtitle: 'Üye',
    description: 'Kitap arar, ödünç alır, oda rezerve eder, kendi işlemlerini görür.',
    capabilities: ['Kitap arama', 'Ödünç alma', 'Oda rezervasyonu', 'İşlem geçmişi'],
    path: '/uye',
    demo: { username: 'ogrenci1', password: 'ogrenci123' },
  },
};

export const roleLabels = {
  admin: ROLES.admin.label,
  librarian: ROLES.librarian.label,
  member: ROLES.member.label,
};
