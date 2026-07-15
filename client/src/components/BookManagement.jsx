import { useEffect, useState } from 'react';
import { Modal, StatusBadge } from './UI';
import { booksApi } from '../api';
import { useDebounce } from '../hooks/useDebounce';

const emptyForm = {
  ad: '', yazar: '', kategori: '', isbn: '', yayinevi: '', basim_yili: '', raf_no: '', stok: 1, durum: 'mevcut',
};

export default function BookManagement({ title = 'Kitap Yönetimi' }) {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const load = () => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (kategori) params.kategori = kategori;
    setLoading(true);
    booksApi.list(params).then(setBooks).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { booksApi.categories().then(setCategories).catch(console.error); }, []);
  useEffect(() => { load(); }, [debouncedSearch, kategori]);

  const openAdd = () => { setForm(emptyForm); setModal('add'); };
  const openEdit = (b) => {
    setForm({ ...b, basim_yili: b.basim_yili || '' });
    setModal('edit');
  };

  const handleSave = async () => {
    try {
      const data = {
        ...form,
        basim_yili: form.basim_yili ? parseInt(form.basim_yili) : null,
        stok: parseInt(form.stok) || 1,
      };
      if (modal === 'add') {
        await booksApi.create(data);
        setMsg('Kitap eklendi');
      } else {
        await booksApi.update(form.id, data);
        setMsg('Kitap güncellendi');
      }
      setModal(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu kitabı silmek istediğinize emin misiniz?')) return;
    try {
      await booksApi.delete(id);
      setMsg('Kitap silindi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <p className="text-gray-400 mb-4">{title}</p>
      {msg && <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">{msg}</div>}

      <div className="flex flex-wrap gap-4 mb-6">
        <input className="input max-w-xs" placeholder="Ad, yazar, ISBN, kategori ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-xs" value={kategori} onChange={(e) => setKategori(e.target.value)}>
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={openAdd} className="btn-primary">+ Yeni Kitap Ekle</button>
        {loading && <span className="text-sm text-gray-500 self-center">Aranıyor...</span>}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Kitap Adı</th><th>Yazar</th><th>Kategori</th><th>ISBN</th>
              <th>Raf</th><th>Rafta</th><th>Toplam Kopya</th><th>Durum</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id}>
                <td className="font-medium text-white">
                  {b.ad}
                  {!!b.bagis && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      Bağış
                    </span>
                  )}
                </td>
                <td>{b.yazar}</td>
                <td>{b.kategori}</td>
                <td className="text-xs">{b.isbn}</td>
                <td>{b.raf_no}</td>
                <td className="text-green-400">{b.kopya_ozet?.rafta ?? b.stok}</td>
                <td>{b.kopya_ozet?.toplam ?? b.stok}</td>
                <td><StatusBadge status={b.durum} /></td>
                <td className="space-x-2">
                  <button onClick={() => openEdit(b)} className="text-purple-light hover:text-purple-glow text-sm">Düzenle</button>
                  <button onClick={() => handleDelete(b.id)} className="text-red-400 hover:text-red-300 text-sm">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Yeni Kitap Ekle' : 'Kitap Düzenle'}>
        <div className="space-y-3">
          <div><label className="label">Kitap Adı *</label><input className="input" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></div>
          <div><label className="label">Yazar *</label><input className="input" value={form.yazar} onChange={(e) => setForm({ ...form, yazar: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Kategori</label><input className="input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></div>
            <div><label className="label">ISBN</label><input className="input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Yayınevi</label><input className="input" value={form.yayinevi} onChange={(e) => setForm({ ...form, yayinevi: e.target.value })} /></div>
            <div><label className="label">Basım Yılı</label><input type="number" className="input" value={form.basim_yili} onChange={(e) => setForm({ ...form, basim_yili: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Raf No</label><input className="input" value={form.raf_no} onChange={(e) => setForm({ ...form, raf_no: e.target.value })} /></div>
            <div><label className="label">Stok</label><input type="number" className="input" value={form.stok} onChange={(e) => setForm({ ...form, stok: e.target.value })} /></div>
            <div>
              <label className="label">Durum</label>
              <select className="input" value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
                <option value="mevcut">Mevcut</option>
                <option value="oduncte">Ödünçte</option>
                <option value="bakimda">Bakımda</option>
                <option value="kayip">Kayıp</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary w-full mt-2">Kaydet</button>
        </div>
      </Modal>
    </>
  );
}
