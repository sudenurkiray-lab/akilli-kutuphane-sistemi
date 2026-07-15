import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate, Modal } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { useAuth } from '../../context/AuthContext';
import { donationsApi } from '../../api';

const STATUS_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  inceleniyor: 'bg-blue-500/20 text-blue-400',
  kabul_edildi: 'bg-green-500/20 text-green-400',
  reddedildi: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = {
  bekliyor: 'Bekliyor',
  inceleniyor: 'İnceleniyor',
  kabul_edildi: 'Kabul edildi',
  reddedildi: 'Reddedildi',
};

const NEXT_ACTIONS = {
  bekliyor: [
    { durum: 'inceleniyor', label: 'İncelemeye Al', cls: 'btn-secondary' },
    { durum: 'kabul_edildi', label: 'Kabul Et', cls: 'btn-primary' },
    { durum: 'reddedildi', label: 'Reddet', cls: 'btn-secondary text-red-400' },
  ],
  inceleniyor: [
    { durum: 'kabul_edildi', label: 'Kabul Et', cls: 'btn-primary' },
    { durum: 'reddedildi', label: 'Reddet', cls: 'btn-secondary text-red-400' },
    { durum: 'bekliyor', label: 'Beklemeye Al', cls: 'btn-secondary' },
  ],
  kabul_edildi: [],
  reddedildi: [
    { durum: 'inceleniyor', label: 'Yeniden İncele', cls: 'btn-secondary' },
  ],
};

export default function AdminDonations() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionDurum, setActionDurum] = useState('');
  const [adminNotu, setAdminNotu] = useState('');
  const [redNedeni, setRedNedeni] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    donationsApi.list(filter ? { durum: filter } : {})
      .then(setDonations)
      .catch((e) => setMsg(e.message));
    donationsApi.stats().then(setStats).catch(console.error);
  };

  useEffect(() => { load(); }, [filter]);

  const openAction = (donation, durum) => {
    setSelected(donation);
    setActionDurum(durum);
    setAdminNotu(donation.admin_notu || '');
    setRedNedeni(donation.red_nedeni || '');
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (!selected || !actionDurum) return;
    setLoading(true);
    try {
      const result = await donationsApi.updateStatus(selected.id, {
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
    { id: 'kabul_edildi', label: 'Kabul', count: stats?.kabul_edildi },
    { id: 'reddedildi', label: 'Red', count: stats?.reddedildi },
  ];

  return (
    <Layout navItems={nav} title="Bağış Kitap Yönetimi">
      <p className="text-gray-400 mb-6">
        Bağış başvurularını inceleyin. Kabul edilen kitaplar kataloğa eklenir ve
        {' '}<span className="text-amber-400">Bağış Kitap</span> etiketi alır.
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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

      {donations.length === 0 ? (
        <EmptyState message="Bu filtrede bağış kaydı yok" />
      ) : (
        <div className="space-y-3">
          {donations.map((d) => (
            <div key={d.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{d.kitap_adi}</p>
                  <p className="text-sm text-gray-400">
                    {d.yazar}
                    {d.yayinevi ? ` · ${d.yayinevi}` : ''}
                    {d.isbn ? ` · ISBN ${d.isbn}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded self-start ${STATUS_STYLE[d.durum] || ''}`}>
                  {d.durum_adi}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Bağışçı</p>
                  <p className="text-white">{d.bagisci_tam_ad}</p>
                  <p className="text-xs text-gray-500">
                    {[d.bagisci_email, d.bagisci_telefon].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {d.uye && <p className="text-xs text-purple-light mt-1">Üye: @{d.uye.username}</p>}
                </div>
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Kitap durumu & tarih</p>
                  <p className="text-white">{d.kitap_durumu_adi}</p>
                  <p className="text-xs text-gray-500">Bağış tarihi: {d.bagis_tarihi} · Başvuru: {formatDate(d.created_at)}</p>
                  {d.kategori && <p className="text-xs text-gray-500">Kategori: {d.kategori}</p>}
                </div>
              </div>

              {d.aciklama && <p className="text-sm text-gray-300 mt-3">{d.aciklama}</p>}
              {d.admin_notu && <p className="mt-2 text-sm text-cyan-300/90">Not: {d.admin_notu}</p>}
              {d.red_nedeni && <p className="mt-2 text-sm text-red-400">Red: {d.red_nedeni}</p>}
              {d.katalog_kitap && (
                <p className="mt-2 text-sm text-amber-400">
                  Kataloğa eklendi: #{d.katalog_kitap.id} {d.katalog_kitap.ad}
                  {d.katalog_kitap.bagis ? ' · Bağış Kitap' : ''}
                </p>
              )}

              {(NEXT_ACTIONS[d.durum] || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {NEXT_ACTIONS[d.durum].map((a) => (
                    <button
                      key={a.durum}
                      type="button"
                      className={`${a.cls} text-sm`}
                      onClick={() => openAction(d, a.durum)}
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
        title={actionDurum === 'reddedildi' ? 'Bağışı Reddet' : 'Durum Güncelle'}
      >
        {selected && (
          <form onSubmit={submitAction} className="space-y-4">
            <p className="text-sm text-gray-400">
              <strong className="text-white">{selected.kitap_adi}</strong>
              {' → '}
              <span className="text-purple-light">{STATUS_LABELS[actionDurum]}</span>
            </p>
            {actionDurum === 'kabul_edildi' && (
              <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Kitap kataloğa eklenecek ve Bağış Kitap etiketi uygulanacak.
              </p>
            )}
            <div>
              <label className="label">Admin Notu</label>
              <textarea className="input w-full" rows={2} value={adminNotu} onChange={(e) => setAdminNotu(e.target.value)} />
            </div>
            {actionDurum === 'reddedildi' && (
              <div>
                <label className="label">Red Nedeni *</label>
                <textarea className="input w-full" rows={2} value={redNedeni} onChange={(e) => setRedNedeni(e.target.value)} required />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Vazgeç</button>
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
