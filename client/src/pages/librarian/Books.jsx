import Layout from '../../components/Layout';
import BookManagement from '../../components/BookManagement';
import { librarianNav } from '../../constants/librarianNav';

export default function LibrarianBooks() {
  return (
    <Layout navItems={librarianNav} titleKey="nav.librarian.books">
      <BookManagement title="Kitap ekleme, listeleme, arama, güncelleme ve silme işlemleri." />
    </Layout>
  );
}
