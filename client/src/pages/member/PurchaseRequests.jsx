import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { purchaseRequestsApi } from '../../api';

const STATUS_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  inceleniyor: 'bg-blue-500/20 text-blue-400',
  onaylandi: 'bg-green-500/20 text-green-400',
  satin_alindi: 'bg-purple-primary/20 text-purple-light',
  reddedildi: 'bg-red-500/20 text-red-400',
};

const emptyForm = {
  kitap_adi: '',
  yazar: '',
  isbn: '',
  yayinevi: '',
  talep_nedeni: '',
  ders_bilgisi: '',
  talep_eden_tipi: 'ogrenci',
};

export default function MemberPurchaseRequests() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    purchaseRequestsApi.mine()
      .then(setRequests)
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await purchaseRequestsApi.create(form);
      setMsg(result.katalog_uyari ? `${result.message} Not: ${result.katalog_uyari}` : result.message);
      setForm(emptyForm);
      setShowForm(false);
      load();
      setTimeout(() => setMsg(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Bu talebi iptal etmek istiyor musunuz?')) return;
    try {
      await purchaseRequestsApi.cancel(id);
      setMsg('Talep iptal edildi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Satın Alma Talepleri">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <p className="text-gray-400 max-w-xl">
          Kataloğumuzda olmayan kitaplar için satın alma talebi oluşturun. Öğrenci veya akademisyen olarak
          kitap bilgilerini ve ihtiyacınızı bildirin; kütüphane yönetimi talebi değerlendirir.
        </p>
        <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Formu Kapat' : 'Yeni Talep'}
        </button>
      </div>

      {msg && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-semibold text-white">Yeni Satın Alma Talebi</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Kitap Adı *</label>
              <input
                className="input w-full"
                value={form.kitap_adi}
                onChange={(e) => setForm({ ...form, kitap_adi: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Yazar *</label>
              <input
                className="input w-full"
                value={form.yazar}
                onChange={(e) => setForm({ ...form, yazar: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">ISBN</label>
              <input
                className="input w-full"
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                placeholder="978..."
              />
            </div>
            <div>
              <label className="label">Yayınevi</label>
              <input
                className="input w-full"
                value={form.yayinevi}
                onChange={(e) => setForm({ ...form, yayinevi: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Talep Eden *</label>
              <select
                className="input w-full"
                value={form.talep_eden_tipi}
                onChange={(e) => setForm({ ...form, talep_eden_tipi: e.target.value })}
              >
                <option value="ogrenci">Öğrenci</option>
                <option value="akademisyen">Akademisyen</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Ders Bilgisi</label>
              <input
                className="input w-full"
                value={form.ders_bilgisi}
                onChange={(e) => setForm({ ...form, ders_bilgisi: e.target.value })}
                placeholder="Örn. Yazılım Mimarisi (BLM401)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Talep Nedeni *</label>
              <textarea
                className="input w-full"
                rows={3}
                value={form.talep_nedeni}
                onChange={(e) => setForm({ ...form, talep_nedeni: e.target.value })}
                placeholder="Bu kitaba neden ihtiyaç duyduğunuzu kısaca açıklayın (en az 10 karakter)"
                required
                minLength={10}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Gönderiliyor…' : 'Talep Oluştur'}
          </button>
        </form>
      )}

      <h3 className="text-lg font-semibold text-white mb-4">Taleplerim</h3>
      {requests.length === 0 ? (
        <EmptyState message="Henüz satın alma talebiniz yok" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{r.kitap_adi}</p>
                  <p className="text-sm text-gray-400">{r.yazar}{r.yayinevi ? ` · ${r.yayinevi}` : ''}</p>
                  {r.isbn && <p className="text-xs text-gray-500 mt-1">ISBN: {r.isbn}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded self-start ${STATUS_STYLE[r.durum] || 'badge-info'}`}>
                  {r.durum_adi}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-3">{r.talep_nedeni}</p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                <span>{r.talep_eden_tipi_adi}</span>
                {r.ders_bilgisi && <span>Ders: {r.ders_bilgisi}</span>}
                <span>{formatDate(r.created_at)}</span>
              </div>
              {r.admin_notu && (
                <p className="mt-2 text-sm text-cyan-300/90">Admin notu: {r.admin_notu}</p>
              )}
              {r.red_nedeni && (
                <p className="mt-2 text-sm text-red-400">Red nedeni: {r.red_nedeni}</p>
              )}
              {r.durum === 'bekliyor' && (
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  className="mt-3 text-xs text-red-400 hover:underline"
                >
                  Talebi iptal et
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
