import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { StatCard } from '../../components/UI';
import SystemRulesCard from '../../components/SystemRulesCard';
import {
  BarChart, LineAreaChart, HorizontalBars, DonutChart, MetricRing, HeatmapHours,
} from '../../components/AdminAnalyticsCharts';
import { reportsApi, branchesApi } from '../../api';
import { adminNav } from '../../constants/adminNav';
import { useLocale } from '../../i18n/LocaleContext';

export default function AdminDashboard() {
  const { t, dateLocale } = useLocale();
  const [data, setData] = useState(null);
  const [basic, setBasic] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState('');

  const params = branchId ? { branch_id: branchId } : {};

  useEffect(() => {
    branchesApi.list().then(setBranches).catch(console.error);
  }, []);

  useEffect(() => {
    setError('');
    Promise.all([
      reportsApi.analytics(params),
      reportsApi.dashboard(params),
    ])
      .then(([analytics, dashboard]) => {
        setData(analytics);
        setBasic(dashboard);
      })
      .catch((e) => setError(e.message));
  }, [branchId]);

  const fmtMoney = (n) => `${Number(n || 0).toLocaleString(dateLocale)} ₺`;

  return (
    <Layout navItems={adminNav} titleKey="titles.adminDashboard">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-gray-400">{t('dashboard.adminIntro')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('dashboard.adminSub')}</p>
        </div>
        <select
          className="input w-56"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">{t('common.all')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.ad}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {data && basic && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
            <StatCard label="Toplam Kitap" value={basic.stats.toplam_kitap} icon={icons.books} />
            <StatCard label="Aktif Ödünç" value={basic.stats.aktif_odunc} icon={icons.loan} color="yellow" />
            <StatCard label="Günlük Ort. Ödünç" value={data.ozet.gunluk_ortalama} icon="📈" color="green" />
            <StatCard label="Gecikme Oranı" value={`%${data.ozet.gecikme_orani}`} icon={icons.penalty} color="red" />
            <StatCard label="Aktif Kullanıcı" value={`%${data.ozet.aktif_kullanici_orani}`} icon={icons.users} color="green" />
            <StatCard label="Kayıp Maliyet" value={fmtMoney(data.ozet.kayip_maliyet)} icon="📉" color="red" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-1">Günlük Ödünç Alma</h3>
              <p className="text-xs text-gray-500 mb-4">Son 14 gün</p>
              <BarChart data={data.gunluk_odunc} color="bg-purple-primary" />
            </div>

            <div className="card border border-cyan-500/20">
              <h3 className="text-lg font-semibold text-white mb-1">Aylık İade Oranı</h3>
              <p className="text-xs text-gray-500 mb-4">Zamanında iade edilen kitapların yüzdesi</p>
              <LineAreaChart data={data.aylik_iade} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="card lg:col-span-1">
              <h3 className="text-lg font-semibold text-white mb-4">Gecikme & Aktif Kullanıcı</h3>
              <div className="flex justify-around py-4">
                <MetricRing value={data.gecikme.oran} label="Gecikme oranı" color="text-red-400" />
                <MetricRing value={data.aktif_kullanicilar.oran} label="30 gün aktif üye" color="text-green-400" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Geciken</p>
                  <p className="text-red-400 font-semibold">{data.gecikme.geciken}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Aktif ödünç</p>
                  <p className="text-yellow-400 font-semibold">{data.gecikme.aktif}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Son 30 gün aktif</p>
                  <p className="text-green-400 font-semibold">{data.aktif_kullanicilar.son_30_gun}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Toplam üye</p>
                  <p className="text-white font-semibold">{data.aktif_kullanicilar.toplam_uye}</p>
                </div>
              </div>
            </div>

            <div className="card lg:col-span-1">
              <h3 className="text-lg font-semibold text-white mb-1">Rezervasyon Dönüşümü</h3>
              <p className="text-xs text-gray-500 mb-4">Kitap rezervasyon kuyruğu</p>
              <div className="flex flex-col items-center py-4">
                <MetricRing value={data.rezervasyon_donusum.oran} label="Başarılı dönüşüm" size="w-28 h-28" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <span className="text-gray-400">Toplam: <strong className="text-white">{data.rezervasyon_donusum.toplam}</strong></span>
                <span className="text-gray-400">Başarılı: <strong className="text-green-400">{data.rezervasyon_donusum.basarili}</strong></span>
                <span className="text-gray-400">Bekleyen: <strong className="text-yellow-400">{data.rezervasyon_donusum.bekleyen}</strong></span>
                <span className="text-gray-400">İptal/Süre doldu: <strong className="text-red-400">{data.rezervasyon_donusum.iptal + data.rezervasyon_donusum.suresi_doldu}</strong></span>
              </div>
            </div>

            <div className="card lg:col-span-1">
              <h3 className="text-lg font-semibold text-white mb-1">Kayıp Kitap Maliyeti</h3>
              <p className="text-xs text-gray-500 mb-4">Kayıp kopya toplam maliyeti</p>
              <p className="text-3xl font-bold text-red-400 mb-2">{fmtMoney(data.kayip_maliyet.toplam_maliyet)}</p>
              <p className="text-sm text-gray-400">{data.kayip_maliyet.kayip_adet} kayıp kopya</p>
              <div className="mt-6 pt-4 border-t border-dark-600">
                <p className="text-xs text-gray-500 mb-2">Oda rezervasyon dönüşümü</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${data.ozet.oda_rezervasyon_donusum}%` }} />
                  </div>
                  <span className="text-cyan-300 text-sm">%{data.ozet.oda_rezervasyon_donusum}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">En Çok Okunan Kitaplar</h3>
              <HorizontalBars
                data={data.populer_kitaplar.map((b) => ({ ad: b.ad, sayi: b.odunc_sayisi }))}
                labelKey="ad"
              />
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">En Çok Tercih Edilen Kategoriler</h3>
              <DonutChart data={data.populer_kategoriler} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Şubelere Göre Kullanım</h3>
              <HorizontalBars
                data={data.sube_kullanim.map((s) => ({ sube: s.sube, sayi: s.odunc_sayisi }))}
                labelKey="sube"
              />
              <div className="mt-4 space-y-2">
                {data.sube_kullanim.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs text-gray-500">
                    <span>{s.sube}</span>
                    <span>{s.aktif_odunc} aktif ödünç</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-1">Saatlere Göre Yoğunluk</h3>
              <p className="text-xs text-gray-500 mb-4">Ödünç alma işlemlerinin saat dağılımı</p>
              <HeatmapHours data={data.saatlik_yogunluk} />
            </div>
          </div>

          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">En Fazla Ceza Alan Kullanıcılar</h3>
            {data.ceza_liderleri.length === 0 ? (
              <p className="text-gray-500 text-sm">Ceza kaydı yok</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Kullanıcı</th>
                      <th>Ceza Sayısı</th>
                      <th>Toplam Tutar</th>
                      <th>Ödenmemiş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ceza_liderleri.map((u, i) => (
                      <tr key={i}>
                        <td>
                          <p className="text-white">{u.ad} {u.soyad}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </td>
                        <td className="text-purple-light font-medium">{u.ceza_sayisi}</td>
                        <td>{fmtMoney(u.toplam_tutar)}</td>
                        <td className={u.odenmemis > 0 ? 'text-red-400' : 'text-green-400'}>{u.odenmemis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <SystemRulesCard />
        </>
      )}
    </Layout>
  );
}
