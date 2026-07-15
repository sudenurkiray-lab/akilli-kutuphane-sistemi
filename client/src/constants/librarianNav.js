import { icons } from '../components/Layout';

export const librarianNav = [
  { to: '/kutuphaneci', labelKey: 'nav.librarian.home', icon: icons.dashboard, end: true },
  { to: '/kutuphaneci/gorevler', labelKey: 'nav.librarian.tasks', icon: icons.report },
  { to: '/kutuphaneci/tara', labelKey: 'nav.librarian.scan', icon: icons.scan },
  { to: '/kutuphaneci/kitaplar', labelKey: 'nav.librarian.books', icon: icons.books },
  { to: '/kutuphaneci/satin-alma', labelKey: 'nav.librarian.purchase', icon: icons.loan },
  { to: '/kutuphaneci/bagis', labelKey: 'nav.librarian.donations', icon: icons.books },
  { to: '/kutuphaneci/kitap-yorumlari', labelKey: 'nav.librarian.reviews', icon: icons.books },
  { to: '/kutuphaneci/dijital-kaynaklar', labelKey: 'nav.librarian.digital', icon: icons.books },
  { to: '/kutuphaneci/tez-arsivi', labelKey: 'nav.librarian.thesis', icon: icons.report },
  { to: '/kutuphaneci/kopyalar', labelKey: 'nav.librarian.copies', icon: icons.shelf },
  { to: '/kutuphaneci/envanter', labelKey: 'nav.librarian.inventory', icon: icons.scan },
  { to: '/kutuphaneci/odunc', labelKey: 'nav.librarian.loans', icon: icons.loan },
  { to: '/kutuphaneci/hasar-kayip', labelKey: 'nav.librarian.damage', icon: icons.shelf },
  { to: '/kutuphaneci/transferler', labelKey: 'nav.librarian.transfers', icon: icons.loan },
  { to: '/kutuphaneci/etkinlikler', labelKey: 'nav.librarian.events', icon: icons.report },
  { to: '/kutuphaneci/cezalar', labelKey: 'nav.librarian.penalties', icon: icons.penalty },
  { to: '/kutuphaneci/raf', labelKey: 'nav.librarian.shelf', icon: icons.shelf },
  { to: '/guvenlik', labelKey: 'nav.librarian.security', icon: icons.penalty },
];
