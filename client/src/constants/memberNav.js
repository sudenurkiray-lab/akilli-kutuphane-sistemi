import { icons } from '../components/Layout';

export const memberNav = [
  { to: '/uye', labelKey: 'nav.member.home', icon: icons.dashboard, end: true },
  { to: '/uye/kart', labelKey: 'nav.member.card', icon: icons.card },
  { to: '/uye/kitaplar', labelKey: 'nav.member.books', icon: icons.search },
  { to: '/uye/okuma-listeleri', labelKey: 'nav.member.lists', icon: icons.books },
  { to: '/uye/satin-alma', labelKey: 'nav.member.purchase', icon: icons.loan },
  { to: '/uye/bagis', labelKey: 'nav.member.donations', icon: icons.books },
  { to: '/uye/dijital-kaynaklar', labelKey: 'nav.member.digital', icon: icons.books },
  { to: '/uye/tez-arsivi', labelKey: 'nav.member.thesis', icon: icons.report },
  { to: '/uye/oda-rezervasyon', labelKey: 'nav.member.room', icon: icons.room },
  { to: '/uye/masa-rezervasyon', labelKey: 'nav.member.desk', icon: icons.shelf },
  { to: '/uye/etkinlikler', labelKey: 'nav.member.events', icon: icons.report },
  { to: '/uye/kulupler', labelKey: 'nav.member.clubs', icon: icons.club },
  { to: '/uye/profil', labelKey: 'nav.member.profile', icon: icons.profile },
  { to: '/uye/bildirimler', labelKey: 'nav.member.notifications', icon: icons.bell },
  { to: '/guvenlik', labelKey: 'nav.member.security', icon: icons.penalty },
];
