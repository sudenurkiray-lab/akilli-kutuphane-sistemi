import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate, Modal } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { useAuth } from '../../context/AuthContext';
import { purchaseRequestsApi } from '../../api';

const STATUS_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  inceleniyor: 'bg-blue-500/20 text-blue-400',
  onaylandi: 'bg-green-500/20 text-green-400',
  satin_alindi: 'bg-purple-primary/20 text-purple-light',
  reddedildi: 'bg-red-500/20 text-red-400',
};

const NEXT_ACTIONS = {
  bekliyor: [
    { durum: 'inceleniyor', label: 'İncelemeye Al', cls: 'btn-secondary' },
    { durum: 'onaylandi', label: 'Onayla', cls: 'btn-primary' },
    { durum: 'reddedildi', label: 'Reddet', cls: 'btn-secondary text-red-400' },
  ],
  inceleniyor: [
    { durum: 'onaylandi', label: 'Onayla', cls: 'btn-primary' },
    { durum: 'reddedildi', label: 'Reddet', cls: 'btn-secondary text-red-400' },
    { durum: 'bekliyor', label: 'Beklemeye Al', cls: 'btn-secondary' },
  ],
  onaylandi: [
    { durum: 'satin_alindi', label: 'Satın Alındı', cls: 'btn-primary' },
    { durum: 'reddedildi', label: 'Reddet', cls: 'btn-secondary text-red-400' },
  ],
  satin_alindi: [],
  reddedildi: [
    { durum: 'inceleniyor', label: 'Yeniden İncele', cls: 'btn-secondary' },
  ],
};

export default function AdminPurchaseRequests() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionDurum, setActionDurum] = useState('');
  const [adminNotu, setAdminNotu] = useState('');
  const [redNedeni, setRedNedeni] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    purchaseRequestsApi.list(filter ? { durum: filter } : {})
      .then(setRequests)
      .catch((e) => setMsg(e.message));
    purchaseRequestsApi.stats().then(setStats).catch(console.error);
  };

  useEffect(() => { load(); }, [filter]);

  const openAction = (request, durum) => {
    setSelected(request);
    setActionDurum(durum);
    setAdminNotu(request.admin_notu || '');
    setRedNedeni(request.red_nedeni || '');
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (!selected || !actionDurum) return;
    setLoading(true);
    try {
      const result = await purchaseRequestsApi.updateStatus(selected.id, {
        durum: actionDurum,
        admin_notu: adminNotu,
        red_nedeni: redNedeni,
      });
      setMsg(result.message);
      setSelected(null);
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { id: '', label: 'Tümü', count: stats?.toplam },
    { id: 'bekliyor', label: 'Bekliyor', count: stats?.bekliyor },
    { id: 'inceleniyor', label: 'İnceleniyor', count: stats?.inceleniyor },
    { id: 'onaylandi', label: 'Onaylandı', count: stats?.onaylandi },
    { id: 'satin_alindi', label: 'Satın alındı', count: stats?.satin_alindi },
    { id: 'reddedildi', label: 'Reddedildi', count: stats?.reddedildi },
  ];

  return (
    <Layout navItems={nav} title="Satın Alma & Tedarik">
      <p className="text-gray-400 mb-6">
        Üyelerin katalog dışı kitap taleplerini inceleyin, onaylayın veya reddedin.
        Onaylanan talepleri satın alındı olarak işaretleyebilirsiniz.
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {filters.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`card text-left py-3 px-4 border transition-colors ${
                filter === f.id ? 'border-purple-primary bg-purple-primary/10' : 'border-transparent hover:border-purple-primary/30'
              }`}
            >
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="text-xl font-bold text-white">{f.count ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState message="Bu filtrede talep yok" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{r.kitap_adi}</p>
                  <p className="text-sm text-gray-400">
                    {r.yazar}
                    {r.yayinevi ? ` · ${r.yayinevi}` : ''}
                    {r.isbn ? ` · ISBN ${r.isbn}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded self-start ${STATUS_STYLE[r.durum] || ''}`}>
                  {r.durum_adi}
                </span>
              </div>

              <p className="text-sm text-gray-300 mt-3">{r.talep_nedeni}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                <span>
                  {r.talep_eden?.ad} (@{r.talep_eden?.username})
                  {r.talep_eden?.bolum ? ` · ${r.talep_eden.bolum}` : ''}
                </span>
                <span>{r.talep_eden_tipi_adi}</span>
                {r.ders_bilgisi && <span>Ders: {r.ders_bilgisi}</span>}
                <span>{formatDate(r.created_at)}</span>
                {r.isleyen && <span>İşleyen: {r.isleyen}</span>}
              </div>

              {r.admin_notu && (
                <p className="mt-2 text-sm text-cyan-300/90">Not: {r.admin_notu}</p>
              )}
              {r.red_nedeni && (
                <p className="mt-2 text-sm text-red-400">Red: {r.red_nedeni}</p>
              )}

              {(NEXT_ACTIONS[r.durum] || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {NEXT_ACTIONS[r.durum].map((a) => (
                    <button
                      key={a.durum}
                      type="button"
                      className={`${a.cls} text-sm`}
                      onClick={() => openAction(r, a.durum)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={actionDurum === 'reddedildi' ? 'Talebi Reddet' : 'Durum Güncelle'}
      >
        {selected && (
          <form onSubmit={submitAction} className="space-y-4">
            <p className="text-sm text-gray-400">
              <strong className="text-white">{selected.kitap_adi}</strong>
              {' → '}
              <span className="text-purple-light">
                {{
                  bekliyor: 'Bekliyor',
                  inceleniyor: 'İnceleniyor',
                  onaylandi: 'Onaylandı',
                  satin_alindi: 'Satın alındı',
                  reddedildi: 'Reddedildi',
                }[actionDurum] || actionDurum}
              </span>
            </p>

            <div>
              <label className="label">Admin Notu</label>
              <textarea
                className="input w-full"
                rows={2}
                value={adminNotu}
                onChange={(e) => setAdminNotu(e.target.value)}
                placeholder="Üyeye görünen kısa not (opsiyonel)"
              />
            </div>

            {actionDurum === 'reddedildi' && (
              <div>
                <label className="label">Red Nedeni *</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={redNedeni}
                  onChange={(e) => setRedNedeni(e.target.value)}
                  required
                  placeholder="Red gerekçesini yazın"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}
