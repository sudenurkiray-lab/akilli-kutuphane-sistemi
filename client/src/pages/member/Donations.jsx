import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { useAuth } from '../../context/AuthContext';
import { donationsApi } from '../../api';

const STATUS_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  inceleniyor: 'bg-blue-500/20 text-blue-400',
  kabul_edildi: 'bg-green-500/20 text-green-400',
  reddedildi: 'bg-red-500/20 text-red-400',
};

const emptyForm = {
  bagisci_ad: '',
  bagisci_soyad: '',
  bagisci_email: '',
  bagisci_telefon: '',
  kitap_adi: '',
  yazar: '',
  isbn: '',
  yayinevi: '',
  basim_yili: '',
  kategori: '',
  kitap_durumu: 'iyi',
  bagis_tarihi: new Date().toISOString().slice(0, 10),
  aciklama: '',
};

export default function MemberDonations() {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [meta, setMeta] = useState({ kosullar: [] });
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    donationsApi.mine().then(setDonations).catch((e) => setError(e.message));
  };

  useEffect(() => {
    donationsApi.meta().then(setMeta).catch(console.error);
    load();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        bagisci_ad: f.bagisci_ad || user.ad || '',
        bagisci_soyad: f.bagisci_soyad || user.soyad || '',
        bagisci_email: f.bagisci_email || user.email || '',
        bagisci_telefon: f.bagisci_telefon || user.telefon || '',
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await donationsApi.create(form);
      setMsg(result.message);
      setForm({
        ...emptyForm,
        bagisci_ad: user?.ad || '',
        bagisci_soyad: user?.soyad || '',
        bagisci_email: user?.email || '',
        bagisci_telefon: user?.telefon || '',
        bagis_tarihi: new Date().toISOString().slice(0, 10),
      });
      setShowForm(false);
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Bu bağış başvurusunu iptal etmek istiyor musunuz?')) return;
    try {
      await donationsApi.cancel(id);
      setMsg('Başvuru iptal edildi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Kitap Bağışı">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <p className="text-gray-400 max-w-xl">
          Kütüphaneye kitap bağışı başvurusu yapın. Kabul edilen kitaplar kataloğa
          {' '}<span className="text-amber-400">Bağış Kitap</span> etiketiyle eklenir.
        </p>
        <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Formu Kapat' : 'Bağış Başvurusu'}
        </button>
      </div>

      {msg && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">{msg}</div>
      )}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-semibold text-white">Yeni Bağış Başvurusu</h3>

          <p className="text-xs text-gray-500 uppercase tracking-wide">Bağışçı bilgileri</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Ad *</label>
              <input className="input w-full" value={form.bagisci_ad} onChange={(e) => setForm({ ...form, bagisci_ad: e.target.value })} required />
            </div>
            <div>
              <label className="label">Soyad *</label>
              <input className="input w-full" value={form.bagisci_soyad} onChange={(e) => setForm({ ...form, bagisci_soyad: e.target.value })} required />
            </div>
            <div>
              <label className="label">E-posta</label>
              <input type="email" className="input w-full" value={form.bagisci_email} onChange={(e) => setForm({ ...form, bagisci_email: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input w-full" value={form.bagisci_telefon} onChange={(e) => setForm({ ...form, bagisci_telefon: e.target.value })} />
            </div>
          </div>

          <p className="text-xs text-gray-500 uppercase tracking-wide pt-2">Kitap bilgileri</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Kitap Adı *</label>
              <input className="input w-full" value={form.kitap_adi} onChange={(e) => setForm({ ...form, kitap_adi: e.target.value })} required />
            </div>
            <div>
              <label className="label">Yazar *</label>
              <input className="input w-full" value={form.yazar} onChange={(e) => setForm({ ...form, yazar: e.target.value })} required />
            </div>
            <div>
              <label className="label">ISBN</label>
              <input className="input w-full" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div>
              <label className="label">Yayınevi</label>
              <input className="input w-full" value={form.yayinevi} onChange={(e) => setForm({ ...form, yayinevi: e.target.value })} />
            </div>
            <div>
              <label className="label">Basım Yılı</label>
              <input type="number" className="input w-full" value={form.basim_yili} onChange={(e) => setForm({ ...form, basim_yili: e.target.value })} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <input className="input w-full" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder="Örn. Roman" />
            </div>
            <div>
              <label className="label">Kitap Durumu *</label>
              <select className="input w-full" value={form.kitap_durumu} onChange={(e) => setForm({ ...form, kitap_durumu: e.target.value })}>
                {(meta.kosullar.length ? meta.kosullar : [
                  { id: 'iyi', ad: 'İyi' },
                  { id: 'hafif_hasarli', ad: 'Hafif hasarlı' },
                  { id: 'orta', ad: 'Orta' },
                  { id: 'kotu', ad: 'Kötü' },
                ]).map((k) => (
                  <option key={k.id} value={k.id}>{k.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bağış Tarihi *</label>
              <input type="date" className="input w-full" value={form.bagis_tarihi} onChange={(e) => setForm({ ...form, bagis_tarihi: e.target.value })} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Açıklama</label>
              <textarea className="input w-full" rows={2} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} placeholder="Opsiyonel not" />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Gönderiliyor…' : 'Başvuruyu Gönder'}
          </button>
        </form>
      )}

      <h3 className="text-lg font-semibold text-white mb-4">Başvurularım</h3>
      {donations.length === 0 ? (
        <EmptyState message="Henüz bağış başvurunuz yok" />
      ) : (
        <div className="space-y-3">
          {donations.map((d) => (
            <div key={d.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{d.kitap_adi}</p>
                  <p className="text-sm text-gray-400">{d.yazar}{d.yayinevi ? ` · ${d.yayinevi}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded self-start ${STATUS_STYLE[d.durum] || ''}`}>
                  {d.durum_adi}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                <span>Bağışçı: {d.bagisci_tam_ad}</span>
                <span>Durum: {d.kitap_durumu_adi}</span>
                <span>Bağış tarihi: {d.bagis_tarihi}</span>
                <span>Başvuru: {formatDate(d.created_at)}</span>
              </div>
              {d.aciklama && <p className="text-sm text-gray-300 mt-2">{d.aciklama}</p>}
              {d.admin_notu && <p className="mt-2 text-sm text-cyan-300/90">Admin notu: {d.admin_notu}</p>}
              {d.red_nedeni && <p className="mt-2 text-sm text-red-400">Red nedeni: {d.red_nedeni}</p>}
              {d.durum === 'kabul_edildi' && (
                <p className="mt-2 text-sm text-amber-400">✓ Kataloğa Bağış Kitap etiketiyle eklendi</p>
              )}
              {d.durum === 'bekliyor' && (
                <button type="button" onClick={() => handleCancel(d.id)} className="mt-3 text-xs text-red-400 hover:underline">
                  Başvuruyu iptal et
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
