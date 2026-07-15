import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { icons } from '../../components/Layout';
import { StatCard } from '../../components/UI';
import { booksApi, loansApi, branchesApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { librarianNav } from '../../constants/librarianNav';
import { useT } from '../../i18n/LocaleContext';

export default function LibrarianDashboard() {
  const { user } = useAuth();
  const t = useT();
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [branchStats, setBranchStats] = useState(null);

  useEffect(() => {
    Promise.all([booksApi.list(), loansApi.active()])
      .then(([b, l]) => { setBooks(b); setLoans(l); })
      .catch(console.error);
    if (user?.branch?.id) {
      branchesApi.stats(user.branch.id).then(setBranchStats).catch(console.error);
    }
  }, [user?.branch?.id]);

  const overdue = loans.filter((l) => l.gecikti);
  const totalStock = books.reduce((s, b) => s + (b.sube_stok ?? b.stok), 0);
  const lowStock = books.filter((b) => (b.sube_stok ?? b.stok) <= 1);

  return (
    <Layout navItems={librarianNav} titleKey="titles.librarianDashboard">
      <p className="text-gray-400 mb-2">{t('dashboard.librarianIntro')}</p>
      {user?.branch && (
        <p className="text-purple-light text-sm mb-6">
          {t('dashboard.branch')}: <strong>{user.branch.ad}</strong>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('dashboard.bookTypes')} value={branchStats?.istatistik?.kitap_turu ?? books.length} icon={icons.books} />
        <StatCard label={t('dashboard.stock')} value={branchStats?.istatistik?.rafta ?? totalStock} icon={icons.books} color="green" />
        <StatCard label={t('dashboard.activeLoanCount')} value={branchStats?.istatistik?.aktif_odunc ?? loans.length} icon={icons.loan} color="yellow" />
        <StatCard label={t('dashboard.overdue')} value={overdue.length} icon={icons.penalty} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Stok Takibi</h3>
            <Link to="/kutuphaneci/kitaplar" className="text-purple-light text-sm hover:underline">Tümünü Gör</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">Düşük stoklu kitap yok</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((b) => (
                <li key={b.id} className="flex justify-between text-sm py-2 border-b border-dark-600 last:border-0">
                  <span className="text-white">{b.ad}</span>
                  <span className={b.stok === 0 ? 'text-red-400' : 'text-yellow-400'}>
                    Stok: {b.sube_stok ?? b.stok}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Hızlı İşlemler</h3>
          </div>
          <div className="space-y-2">
            <Link to="/kutuphaneci/tara" className="block btn-primary text-center text-sm">QR / Barkod ile Tara</Link>
            <Link to="/kutuphaneci/odunc" className="block btn-secondary text-center text-sm">Ödünç Ver / Teslim Al</Link>
            <Link to="/kutuphaneci/kitaplar" className="block btn-secondary text-center text-sm">Stok Güncelle</Link>
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="card border-red-500/30">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Geciken Kitaplar</h3>
          <ul className="space-y-2">
            {overdue.map((l) => (
              <li key={l.id} className="flex justify-between text-sm py-2 border-b border-dark-600 last:border-0">
                <span className="text-white">{l.kitap_adi} — {l.ad} {l.soyad}</span>
                <span className="text-red-400">{Math.abs(l.kalan_gun)} gün gecikme</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Layout>
  );
}
