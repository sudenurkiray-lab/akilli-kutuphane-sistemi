import DamageInspections from '../librarian/DamageInspections';
import { adminNav } from '../../constants/adminNav';

export default function AdminDamageInspections() {
  return <DamageInspections navItems={adminNav} />;
}
