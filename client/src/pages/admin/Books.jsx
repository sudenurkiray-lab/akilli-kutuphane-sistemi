import Layout, { icons } from '../../components/Layout';
import BookManagement from '../../components/BookManagement';
import { adminNav } from '../../constants/adminNav';

const nav = adminNav;

export default function AdminBooks() {
  return (
    <Layout navItems={nav} title="Kitap Yönetimi">
      <BookManagement title="Admin olarak kitap bilgilerini ekleyebilir, güncelleyebilir ve silebilirsiniz." />
    </Layout>
  );
}
