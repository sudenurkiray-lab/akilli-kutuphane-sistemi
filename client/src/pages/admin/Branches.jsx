import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { StatCard, Modal } from '../../components/UI';
import { branchesApi } from '../../api';
import { adminNav } from '../../constants/adminNav';

export default function AdminBranches() {
  const [branches, setBranches] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await branchesApi.list();
      setBranches(list);
      const entries = await Promise.all(
        list.map(async (b) => [b.id, await branchesApi.stats(b.id)])
      );
      setStatsMap(Object.fromEntries(entries));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (branch) => {
    setSelected(branch);
    setForm({
      adres: branch.adres || '',
      hafta_ici: branch.hafta_ici || '',
      cumartesi: branch.cumartesi || '',
      pazar: branch.pazar || '',
    });
  };

  const handleSave = async () => {
    try {
      await branchesApi.update(selected.id, form);
      setMsg('Çalışma saatleri güncellendi');
      setSelected(null);
      await load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={adminNav} title="Şube Yönetimi">
      <p className="text-gray-400 mb-6">
        Kampüsteki tüm kütüphane şubelerini, çalışma saatlerini ve şube bazlı istatistikleri buradan yönetin.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('güncellendi')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Yükleniyor...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {branches.map((b) => {
            const data = statsMap[b.id];
            const s = data?.istatistik || {};
            return (
              <div key={b.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{b.ad}</h3>
                    <p className="text-xs text-purple-light mt-1">{b.kod}</p>
                    {b.adres && <p className="text-sm text-gray-500 mt-1">{b.adres}</p>}
                  </div>
                  <button type="button" onClick={() => openEdit(b)} className="btn-secondary text-xs">
                    Saatleri Düzenle
                  </button>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p>Hafta içi: <span className="text-gray-300">{b.hafta_ici}</span></p>
                  <p>Cumartesi: <span className="text-gray-300">{b.cumartesi}</span></p>
                  <p>Pazar: <span className="text-gray-300">{b.pazar}</span></p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <StatCard label="Kitap Türü" value={s.kitap_turu ?? '—'} icon={icons.books} />
                  <StatCard label="Kopya" value={s.toplam_kopya ?? '—'} icon={icons.shelf} color="green" />
                  <StatCard label="Rafta" value={s.rafta ?? '—'} icon={icons.books} color="yellow" />
                  <StatCard label="Aktif Ödünç" value={s.aktif_odunc ?? '—'} icon={icons.loan} />
                  <StatCard label="Görevli" value={s.gorevli_sayisi ?? '—'} icon={icons.users} color="green" />
                  <StatCard label="Raf" value={s.raf_sayisi ?? '—'} icon={icons.shelf} />
                </div>

                {data?.populer?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Şubede Popüler</h4>
                    <ul className="space-y-1">
                      {data.populer.slice(0, 3).map((p, i) => (
                        <li key={i} className="text-sm flex justify-between">
                          <span className="text-gray-300 truncate pr-2">{p.ad}</span>
                          <span className="text-purple-light shrink-0">{p.odunc_sayisi} ödünç</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`${selected?.ad} — Çalışma Saatleri`}>
        <div className="space-y-3">
          <div>
            <label className="label">Adres</label>
            <input className="input" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
          </div>
          <div>
            <label className="label">Hafta İçi</label>
            <input className="input" value={form.hafta_ici} onChange={(e) => setForm({ ...form, hafta_ici: e.target.value })} />
          </div>
          <div>
            <label className="label">Cumartesi</label>
            <input className="input" value={form.cumartesi} onChange={(e) => setForm({ ...form, cumartesi: e.target.value })} />
          </div>
          <div>
            <label className="label">Pazar</label>
            <input className="input" value={form.pazar} onChange={(e) => setForm({ ...form, pazar: e.target.value })} />
          </div>
          <button type="button" onClick={handleSave} className="btn-primary w-full">Kaydet</button>
        </div>
      </Modal>
    </Layout>
  );
}
