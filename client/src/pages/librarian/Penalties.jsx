import AdminPenalties from '../admin/Penalties';
import { librarianNav } from '../../constants/librarianNav';

export default function LibrarianPenalties() {
  return <AdminPenalties navItems={librarianNav} title="Ceza Yönetimi" />;
}
