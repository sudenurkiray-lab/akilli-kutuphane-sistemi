import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { adminNav } from '../../constants/adminNav';
import { clubApi } from '../../api';
import { useT } from '../../i18n/LocaleContext';

export default function AdminClubs() {
  const t = useT();
  const [clubs, setClubs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [clubsData, statsData] = await Promise.all([
        clubApi.list({ search: search || undefined, durum: filter || undefined }),
        clubApi.stats(),
      ]);
      setClubs(clubsData);
      setStats(statsData);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => load();

  const handleStatusChange = async (clubId, durum) => {
    try {
      await clubApi.update(clubId, { durum });
      load();
      if (selected?.id === clubId) {
        setSelected(await clubApi.get(clubId));
      }
    } catch {}
  };

  const statusColors = {
    aktif: 'bg-green-600/20 text-green-400',
    pasif: 'bg-yellow-600/20 text-yellow-400',
    arsiv: 'bg-gray-600/40 text-gray-400',
  };

  return (
    <Layout navItems={adminNav} titleKey="nav.admin.clubs">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{t('clubs.adminTitle')}</h1>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: t('clubs.totalClubs'), value: stats.toplam, color: 'blue' },
              { label: t('clubs.activeClubs'), value: stats.aktif, color: 'green' },
              { label: t('clubs.totalMembers'), value: stats.toplam_uye, color: 'purple' },
              { label: t('clubs.totalDiscussions'), value: stats.toplam_tartisma, color: 'orange' },
            ].map((s, i) => (
              <div key={i} className={`bg-gray-800 border border-gray-700 rounded-xl p-4`}>
                <p className="text-gray-400 text-sm">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-400 mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('clubs.searchPlaceholder')}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white" />
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setTimeout(load, 0); }}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
            <option value="">{t('common.all')}</option>
            <option value="aktif">{t('clubs.statusActive')}</option>
            <option value="pasif">{t('clubs.statusInactive')}</option>
            <option value="arsiv">{t('clubs.statusArchived')}</option>
          </select>
          <button onClick={handleSearch} className="bg-gray-600 hover:bg-gray-500 text-white rounded-lg px-4 py-2">
            {t('common.search')}
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">{t('common.loading')}</div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{t('clubs.clubName')}</th>
                  <th className="px-4 py-3">{t('clubs.founder')}</th>
                  <th className="px-4 py-3">{t('clubs.memberCount')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('common.date')}</th>
                  <th className="px-4 py-3">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {clubs.map((club) => (
                  <tr key={club.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-gray-400">{club.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{club.ad}</div>
                      {club.aciklama && <div className="text-gray-500 text-xs truncate max-w-xs">{club.aciklama}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {club.kurucu ? `${club.kurucu.ad} ${club.kurucu.soyad}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{club.uye_sayisi}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[club.durum] || ''}`}>
                        {club.durum === 'aktif' ? t('clubs.statusActive') : club.durum === 'pasif' ? t('clubs.statusInactive') : t('clubs.statusArchived')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(club.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {club.durum === 'aktif' && (
                          <button onClick={() => handleStatusChange(club.id, 'pasif')}
                            className="text-yellow-400 hover:bg-yellow-600/20 rounded px-2 py-1 text-xs">
                            {t('clubs.deactivate')}
                          </button>
                        )}
                        {club.durum === 'pasif' && (
                          <button onClick={() => handleStatusChange(club.id, 'aktif')}
                            className="text-green-400 hover:bg-green-600/20 rounded px-2 py-1 text-xs">
                            {t('clubs.activate')}
                          </button>
                        )}
                        {club.durum !== 'arsiv' && (
                          <button onClick={() => handleStatusChange(club.id, 'arsiv')}
                            className="text-gray-400 hover:bg-gray-600/20 rounded px-2 py-1 text-xs">
                            {t('clubs.archive')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {clubs.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8">{t('clubs.noClubs')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
