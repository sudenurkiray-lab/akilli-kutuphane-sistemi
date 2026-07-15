import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge, EmptyState } from '../../components/UI';
import TransferTimeline from '../../components/TransferTimeline';
import { transfersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';

const NEXT_STEP = {
  talep: { durum: 'onaylandi', label: 'Onayla' },
  onaylandi: { durum: 'hazirlaniyor', label: 'Hazırlığa Al' },
  hazirlaniyor: { durum: 'transfer_edildi', label: 'Transfer Et (Yola Çıkar)' },
  transfer_edildi: { durum: 'teslim_noktasinda', label: 'Teslim Noktasına Ulaştı' },
  teslim_noktasinda: { durum: 'teslim_edildi', label: 'Kullanıcıya Teslim Et' },
};

const FILTERS = [
  { id: 'aktif', label: 'Aktif' },
  { id: '', label: 'Tümü' },
  { id: 'talep', label: 'Talepler' },
  { id: 'teslim_edildi', label: 'Tamamlanan' },
  { id: 'iptal', label: 'İptal' },
];

export default function LibrarianTransfers() {
  const { user } = useAuth();
  const nav = user?.role === 'admin' ? adminNav : librarianNav;
  const [transfers, setTransfers] = useState([]);
  const [filter, setFilter] = useState('aktif');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () => {
    transfersApi.list(filter).then(setTransfers).catch((e) => setMsg(e.message));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const advance = async (t) => {
    const next = NEXT_STEP[t.durum];
    if (!next) return;
    setBusy(t.id);
    try {
      const result = await transfersApi.setStatus(t.id, next.durum);
      setMsg(result.message || 'Durum güncellendi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (t) => {
    if (!confirm(`"${t.kitap_adi}" transferini iptal etmek istediğinize emin misiniz?`)) return;
    setBusy(t.id);
    try {
      await transfersApi.cancel(t.id);
      setMsg('Transfer iptal edildi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout navItems={nav} title="Şube Transferleri">
      <p className="text-gray-400 mb-4">
        Öğrencilerin başka şubelerden istediği kitapların transfer sürecini buradan yönetin.
        {user?.branch && <span className="text-purple-light"> Şubeniz: {user.branch.ad}</span>}
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.id
                ? 'bg-purple-primary/20 text-purple-light border border-purple-primary/30'
                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {transfers.length === 0 ? (
        <EmptyState message="Bu filtrede transfer kaydı yok" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {transfers.map((t) => {
            const next = NEXT_STEP[t.durum];
            return (
              <div key={t.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{t.kitap_adi}</h4>
                    <p className="text-sm text-gray-500">{t.yazar}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t.ad} {t.soyad} · No: {t.okul_no}
                    </p>
                    <p className="text-xs text-purple-light mt-1">
                      {t.kaynak_sube_adi} → {t.hedef_sube_adi}
                      {t.barkod && <span className="text-gray-500"> · {t.barkod}</span>}
                    </p>
                  </div>
                  <StatusBadge status={t.durum} />
                </div>

                <TransferTimeline transfer={t} />

                {(next || ['talep', 'onaylandi', 'hazirlaniyor', 'transfer_edildi', 'teslim_noktasinda'].includes(t.durum)) && (
                  <div className="flex gap-2 mt-4">
                    {next && (
                      <button
                        onClick={() => advance(t)}
                        disabled={busy === t.id}
                        className="btn-primary flex-1 text-sm disabled:opacity-40"
                      >
                        {next.label}
                      </button>
                    )}
                    <button
                      onClick={() => cancel(t)}
                      disabled={busy === t.id}
                      className="btn-secondary text-sm disabled:opacity-40"
                    >
                      İptal
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
