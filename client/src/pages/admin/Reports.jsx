import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { StatCard, formatDate } from '../../components/UI';
import { reportsApi } from '../../api';
import { adminNav } from '../../constants/adminNav';

const nav = adminNav;

export default function AdminReports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    reportsApi.dashboard().then(setData).catch(console.error);
  }, []);

  const handlePrint = () => window.print();

  return (
    <Layout navItems={nav} title="Raporlar">
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-400">En çok ödünç alınan kitaplar, geciken kitaplar ve aktif üyeler</p>
        <button onClick={handlePrint} className="btn-secondary text-sm">Yazdır</button>
      </div>

      {data && (
        <div id="report-content" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Toplam Üye" value={data.stats.toplam_uye} icon={icons.users} />
            <StatCard label="Aktif Üye" value={data.stats.aktif_uye} icon={icons.users} color="green" />
            <StatCard label="Geciken Kitap" value={data.stats.geciken} icon={icons.penalty} color="red" />
            <StatCard label="Aktif Ödünç" value={data.stats.aktif_odunc} icon={icons.loan} color="yellow" />
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">En Çok Ödünç Alınan Kitaplar</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>#</th><th>Kitap</th><th>Yazar</th><th>Ödünç Sayısı</th></tr></thead>
                <tbody>
                  {data.populer.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-gray-500">Veri yok</td></tr>
                  ) : data.populer.map((b, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className="text-white font-medium">{b.ad}</td>
                      <td>{b.yazar}</td>
                      <td><span className="badge-info">{b.odunc_sayisi}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Geciken Kitaplar</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Kitap</th><th>Üye</th><th>Okul No</th><th>Teslim Tarihi</th></tr></thead>
                <tbody>
                  {data.gecikenKitaplar.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-gray-500">Geciken kitap yok</td></tr>
                  ) : data.gecikenKitaplar.map((l) => (
                    <tr key={l.id} className="bg-red-500/5">
                      <td className="text-white font-medium">{l.kitap_adi}</td>
                      <td>{l.ad} {l.soyad}</td>
                      <td>{l.okul_no}</td>
                      <td className="text-red-400">{formatDate(l.teslim_tarihi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Aktif Üyeler</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Ad Soyad</th><th>Okul No</th><th>Bölüm</th><th>E-posta</th><th>Aktif Ödünç</th></tr></thead>
                <tbody>
                  {data.aktifUyeler.map((u) => (
                    <tr key={u.id}>
                      <td className="text-white font-medium">{u.ad} {u.soyad}</td>
                      <td>{u.okul_no}</td>
                      <td>{u.bolum || '-'}</td>
                      <td>{u.email}</td>
                      <td><span className="badge-info">{u.aktif_odunc}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-600 text-right">
            Rapor tarihi: {new Date().toLocaleString('tr-TR')}
          </p>
        </div>
      )}
    </Layout>
  );
}
