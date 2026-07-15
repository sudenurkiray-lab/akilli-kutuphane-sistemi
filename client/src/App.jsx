import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useT } from './i18n/LocaleContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMembers from './pages/admin/Members';
import AdminPenalties from './pages/admin/Penalties';
import AdminReports from './pages/admin/Reports';
import AdminLoans from './pages/admin/Loans';
import AdminBooks from './pages/admin/Books';
import AdminReservations from './pages/admin/Reservations';
import AdminBranches from './pages/admin/Branches';
import AdminEvents from './pages/admin/Events';
import AdminDigitalResources from './pages/admin/DigitalResources';
import AdminThesisArchive from './pages/admin/ThesisArchive';
import AdminBookReviews from './pages/admin/BookReviews';
import LibrarianDashboard from './pages/librarian/Dashboard';
import LibrarianBooks from './pages/librarian/Books';
import LibrarianLoans from './pages/librarian/Loans';
import LibrarianShelf from './pages/librarian/Shelf';
import LibrarianCopies from './pages/librarian/Copies';
import LibrarianScanner from './pages/librarian/Scanner';
import LibrarianTransfers from './pages/librarian/Transfers';
import LibrarianPenalties from './pages/librarian/Penalties';
import LibrarianDamageInspections from './pages/librarian/DamageInspections';
import AdminDamageInspections from './pages/admin/DamageInspections';
import InventoryCount from './pages/librarian/InventoryCount';
import LibrarianTasks from './pages/librarian/Tasks';
import AdminStaff from './pages/admin/Staff';
import AdminAuditLogs from './pages/admin/AuditLogs';
import SecuritySettings from './pages/SecuritySettings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import MemberDashboard from './pages/member/Dashboard';
import MemberBooks from './pages/member/Books';
import MemberRoomReservation from './pages/member/RoomReservation';
import MemberDeskReservation from './pages/member/DeskReservation';
import MemberEvents from './pages/member/Events';
import MemberDigitalResources from './pages/member/DigitalResources';
import MemberThesisArchive from './pages/member/ThesisArchive';
import MemberReadingLists from './pages/member/ReadingLists';
import MemberProfile from './pages/member/Profile';
import MemberNotifications from './pages/member/Notifications';
import MemberCard from './pages/member/MemberCard';
import MemberPurchaseRequests from './pages/member/PurchaseRequests';
import MemberDonations from './pages/member/Donations';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminPurchaseRequests from './pages/admin/PurchaseRequests';
import AdminDonations from './pages/admin/Donations';
import MemberClubs from './pages/member/Clubs';
import AdminClubs from './pages/admin/Clubs';
import AdminReportExport from './pages/admin/ReportExport';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
}

function LoadingScreen() {
  const t = useT();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-purple-light">{t('common.loading')}</p>
      </div>
    </div>
  );
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  const paths = { admin: '/admin', librarian: '/kutuphaneci', member: '/uye' };
  return <Navigate to={paths[user.role]} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/kayit" element={<Register />} />
      <Route path="/sifremi-unuttum" element={<ForgotPassword />} />
      <Route path="/sifre-sifirla" element={<ResetPassword />} />
      <Route path="/email-dogrula" element={<VerifyEmail />} />
      <Route path="/guvenlik" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/subeler" element={<ProtectedRoute roles={['admin']}><AdminBranches /></ProtectedRoute>} />
      <Route path="/admin/kitaplar" element={<ProtectedRoute roles={['admin']}><AdminBooks /></ProtectedRoute>} />
      <Route path="/admin/satin-alma" element={<ProtectedRoute roles={['admin']}><AdminPurchaseRequests /></ProtectedRoute>} />
      <Route path="/admin/bagis" element={<ProtectedRoute roles={['admin']}><AdminDonations /></ProtectedRoute>} />
      <Route path="/admin/kopyalar" element={<ProtectedRoute roles={['admin']}><LibrarianCopies /></ProtectedRoute>} />
      <Route path="/admin/envanter" element={<ProtectedRoute roles={['admin']}><InventoryCount /></ProtectedRoute>} />
      <Route path="/admin/tara" element={<ProtectedRoute roles={['admin']}><LibrarianScanner /></ProtectedRoute>} />
      <Route path="/admin/uyeler" element={<ProtectedRoute roles={['admin']}><AdminMembers /></ProtectedRoute>} />
      <Route path="/admin/personel" element={<ProtectedRoute roles={['admin']}><AdminStaff /></ProtectedRoute>} />
      <Route path="/admin/odunc" element={<ProtectedRoute roles={['admin']}><AdminLoans /></ProtectedRoute>} />
      <Route path="/admin/transferler" element={<ProtectedRoute roles={['admin']}><LibrarianTransfers /></ProtectedRoute>} />
      <Route path="/admin/rezervasyonlar" element={<ProtectedRoute roles={['admin']}><AdminReservations /></ProtectedRoute>} />
      <Route path="/admin/etkinlikler" element={<ProtectedRoute roles={['admin']}><AdminEvents /></ProtectedRoute>} />
      <Route path="/admin/kulupler" element={<ProtectedRoute roles={['admin']}><AdminClubs /></ProtectedRoute>} />
      <Route path="/admin/dijital-kaynaklar" element={<ProtectedRoute roles={['admin']}><AdminDigitalResources /></ProtectedRoute>} />
      <Route path="/admin/tez-arsivi" element={<ProtectedRoute roles={['admin']}><AdminThesisArchive /></ProtectedRoute>} />
      <Route path="/admin/kitap-yorumlari" element={<ProtectedRoute roles={['admin']}><AdminBookReviews /></ProtectedRoute>} />
      <Route path="/admin/cezalar" element={<ProtectedRoute roles={['admin']}><AdminPenalties /></ProtectedRoute>} />
      <Route path="/admin/hasar-kayip" element={<ProtectedRoute roles={['admin']}><AdminDamageInspections /></ProtectedRoute>} />
      <Route path="/admin/duyurular" element={<ProtectedRoute roles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/raporlar" element={<ProtectedRoute roles={['admin']}><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/rapor-aktar" element={<ProtectedRoute roles={['admin']}><AdminReportExport /></ProtectedRoute>} />
      <Route path="/admin/denetim" element={<ProtectedRoute roles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />

      <Route path="/kutuphaneci" element={<ProtectedRoute roles={['librarian']}><LibrarianDashboard /></ProtectedRoute>} />
      <Route path="/kutuphaneci/gorevler" element={<ProtectedRoute roles={['librarian']}><LibrarianTasks /></ProtectedRoute>} />
      <Route path="/kutuphaneci/kitaplar" element={<ProtectedRoute roles={['librarian']}><LibrarianBooks /></ProtectedRoute>} />
      <Route path="/kutuphaneci/satin-alma" element={<ProtectedRoute roles={['librarian']}><AdminPurchaseRequests /></ProtectedRoute>} />
      <Route path="/kutuphaneci/bagis" element={<ProtectedRoute roles={['librarian']}><AdminDonations /></ProtectedRoute>} />
      <Route path="/kutuphaneci/kopyalar" element={<ProtectedRoute roles={['librarian']}><LibrarianCopies /></ProtectedRoute>} />
      <Route path="/kutuphaneci/envanter" element={<ProtectedRoute roles={['librarian']}><InventoryCount /></ProtectedRoute>} />
      <Route path="/kutuphaneci/tara" element={<ProtectedRoute roles={['librarian']}><LibrarianScanner /></ProtectedRoute>} />
      <Route path="/kutuphaneci/odunc" element={<ProtectedRoute roles={['librarian']}><LibrarianLoans /></ProtectedRoute>} />
      <Route path="/kutuphaneci/transferler" element={<ProtectedRoute roles={['librarian']}><LibrarianTransfers /></ProtectedRoute>} />
      <Route path="/kutuphaneci/etkinlikler" element={<ProtectedRoute roles={['librarian']}><AdminEvents /></ProtectedRoute>} />
      <Route path="/kutuphaneci/dijital-kaynaklar" element={<ProtectedRoute roles={['librarian']}><AdminDigitalResources /></ProtectedRoute>} />
      <Route path="/kutuphaneci/tez-arsivi" element={<ProtectedRoute roles={['librarian']}><AdminThesisArchive /></ProtectedRoute>} />
      <Route path="/kutuphaneci/kitap-yorumlari" element={<ProtectedRoute roles={['librarian']}><AdminBookReviews /></ProtectedRoute>} />
      <Route path="/kutuphaneci/cezalar" element={<ProtectedRoute roles={['librarian']}><LibrarianPenalties /></ProtectedRoute>} />
      <Route path="/kutuphaneci/hasar-kayip" element={<ProtectedRoute roles={['librarian']}><LibrarianDamageInspections /></ProtectedRoute>} />
      <Route path="/kutuphaneci/raf" element={<ProtectedRoute roles={['librarian']}><LibrarianShelf /></ProtectedRoute>} />

      <Route path="/uye" element={<ProtectedRoute roles={['member']}><MemberDashboard /></ProtectedRoute>} />
      <Route path="/uye/kitaplar" element={<ProtectedRoute roles={['member']}><MemberBooks /></ProtectedRoute>} />
      <Route path="/uye/kart" element={<ProtectedRoute roles={['member']}><MemberCard /></ProtectedRoute>} />
      <Route path="/uye/oda-rezervasyon" element={<ProtectedRoute roles={['member']}><MemberRoomReservation /></ProtectedRoute>} />
      <Route path="/uye/masa-rezervasyon" element={<ProtectedRoute roles={['member']}><MemberDeskReservation /></ProtectedRoute>} />
      <Route path="/uye/etkinlikler" element={<ProtectedRoute roles={['member']}><MemberEvents /></ProtectedRoute>} />
      <Route path="/uye/kulupler" element={<ProtectedRoute roles={['member']}><MemberClubs /></ProtectedRoute>} />
      <Route path="/uye/dijital-kaynaklar" element={<ProtectedRoute roles={['member']}><MemberDigitalResources /></ProtectedRoute>} />
      <Route path="/uye/tez-arsivi" element={<ProtectedRoute roles={['member']}><MemberThesisArchive /></ProtectedRoute>} />
      <Route path="/uye/okuma-listeleri" element={<ProtectedRoute roles={['member']}><MemberReadingLists /></ProtectedRoute>} />
      <Route path="/uye/satin-alma" element={<ProtectedRoute roles={['member']}><MemberPurchaseRequests /></ProtectedRoute>} />
      <Route path="/uye/bagis" element={<ProtectedRoute roles={['member']}><MemberDonations /></ProtectedRoute>} />
      <Route path="/uye/profil" element={<ProtectedRoute roles={['member']}><MemberProfile /></ProtectedRoute>} />
      <Route path="/uye/bildirimler" element={<ProtectedRoute roles={['member']}><MemberNotifications /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
