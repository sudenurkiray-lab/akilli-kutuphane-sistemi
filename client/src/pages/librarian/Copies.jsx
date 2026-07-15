import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge } from '../../components/UI';
import QrDisplay from '../../components/QrDisplay';
import { copiesApi, booksApi, branchesApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';

const DURUMLAR = [
  { value: 'rafta', label: 'Rafta' },
  { value: 'oduncte', label: 'Ödünçte' },
  { value: 'hasarli', label: 'Hasarlı' },
  { value: 'kayip', label: 'Kayıp' },
  { value: 'rezerve', label: 'Rezerve' },
  { value: 'bakimda', label: 'Bakımda' },
];

const emptyForm = {
  fiziksel_durum: 'rafta',
  branch_id: '',
  sube: '',
  kat: '',
  raf_no: '',
  satin_alma_tarihi: '',
  maliyet: '',
};

export default function LibrarianCopies() {
  const { user } = useAuth();
  const nav = user?.role === 'admin' ? adminNav : librarianNav;
  const isAdmin = user?.role === 'admin';
  const [copies, setCopies] = useState([]);
  const [books, setBooks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filter, setFilter] = useState({ barkod: '', durum: '', book_id: '' });
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [addBookId, setAddBookId] = useState('');

  const load = () => {
    const params = {};
    if (filter.barkod) params.barkod = filter.barkod;
    if (filter.durum) params.durum = filter.durum;
    if (filter.book_id) params.book_id = filter.book_id;
    copiesApi.list(params).then(setCopies).catch(console.error);
  };

  useEffect(() => { booksApi.list().then(setBooks).catch(console.error); }, []);
  useEffect(() => { branchesApi.list().then(setBranches).catch(console.error); }, []);
  useEffect(() => { load(); }, [filter.barkod, filter.durum, filter.book_id]);

  const openEdit = (copy) => {
    setForm({
      id: copy.id,
      fiziksel_durum: copy.fiziksel_durum,
      branch_id: copy.branch_id || '',
      sube: copy.sube || copy.sube_adi || '',
      kat: copy.kat || '',
      raf_no: copy.raf_no || '',
      satin_alma_tarihi: copy.satin_alma_tarihi || '',
      maliyet: copy.maliyet ?? '',
    });
    setModal('edit');
  };

  const handleSave = async () => {
    try {
      await copiesApi.update(form.id, {
        ...form,
        maliyet: form.maliyet !== '' ? parseFloat(form.maliyet) : null,
      });
      setMsg('Kopya güncellendi');
      setModal(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleAdd = async () => {
    try {
      await copiesApi.create({
        book_id: parseInt(addBookId, 10),
        ...form,
        maliyet: form.maliyet !== '' ? parseFloat(form.maliyet) : null,
      });
      setMsg('Yeni kopya eklendi');
      setModal(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const stats = copies.reduce((acc, c) => {
    acc[c.fiziksel_durum] = (acc[c.fiziksel_durum] || 0) + 1;
    return acc;
  }, {});

  return (
    <Layout navItems={nav} title="Fiziksel Kopya Yönetimi">
      <p className="text-gray-400 mb-4">
        Her fiziksel kitap kopyasının barkodu, QR kodu, konumu ve durumu ayrı takip edilir.
      </p>
      {msg && <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {DURUMLAR.map((d) => (
          <div key={d.value} className="card text-center py-3">
            <div className="text-2xl font-bold text-white">{stats[d.value] || 0}</div>
            <div className="text-xs text-gray-500">{d.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input max-w-xs"
          placeholder="Barkod ara..."
          value={filter.barkod}
          onChange={(e) => setFilter({ ...filter, barkod: e.target.value })}
        />
        <select className="input max-w-xs" value={filter.durum} onChange={(e) => setFilter({ ...filter, durum: e.target.value })}>
          <option value="">Tüm Durumlar</option>
          {DURUMLAR.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select className="input max-w-sm" value={filter.book_id} onChange={(e) => setFilter({ ...filter, book_id: e.target.value })}>
          <option value="">Tüm Kitaplar</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setForm(emptyForm); setAddBookId(''); setModal('add'); }}
        >
          + Yeni Kopya Ekle
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Kitap</th>
              <th>Kopya #</th>
              <th>Barkod</th>
              <th>QR Kod</th>
              <th>Şube</th>
              <th>Kat / Raf</th>
              <th>Durum</th>
              <th>Alım Tarihi</th>
              <th>Maliyet</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {copies.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-gray-500 py-8">Kopya bulunamadı</td></tr>
            ) : copies.map((c) => (
              <tr key={c.id}>
                <td className="text-white font-medium">{c.kitap_adi}</td>
                <td>{c.kopya_no}</td>
                <td className="font-mono text-xs text-purple-light">{c.barkod}</td>
                <td><QrDisplay value={c.qr_kod} size={64} /></td>
                <td>{c.sube_adi || c.sube}</td>
                <td>{c.kat} / {c.raf_no || '—'}</td>
                <td><StatusBadge status={c.fiziksel_durum} /></td>
                <td>{c.satin_alma_tarihi || '—'}</td>
                <td>{c.maliyet != null ? `${c.maliyet.toFixed(0)} ₺` : '—'}</td>
                <td>
                  <button type="button" onClick={() => openEdit(c)} className="text-purple-light hover:text-purple-glow text-sm">Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Kopya Düzenle">
        <CopyForm form={form} setForm={setForm} onSave={handleSave} branches={branches} isAdmin={isAdmin} />
      </Modal>

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Yeni Kopya Ekle">
        <div className="mb-3">
          <label className="label">Kitap *</label>
          <select className="input" value={addBookId} onChange={(e) => setAddBookId(e.target.value)}>
            <option value="">Kitap seçin</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.ad} — {b.yazar}</option>)}
          </select>
        </div>
        <CopyForm form={form} setForm={setForm} onSave={handleAdd} branches={branches} isAdmin={isAdmin} librarianBranch={user?.branch} />
      </Modal>
    </Layout>
  );
}

function CopyForm({ form, setForm, onSave, branches = [], isAdmin = false, librarianBranch }) {
  const handleBranchChange = (branchId) => {
    const branch = branches.find((b) => String(b.id) === String(branchId));
    setForm({ ...form, branch_id: branchId, sube: branch?.ad || '' });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Fiziksel Durum</label>
        <select className="input" value={form.fiziksel_durum} onChange={(e) => setForm({ ...form, fiziksel_durum: e.target.value })}>
          {DURUMLAR.filter((d) => d.value !== 'oduncte').map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Şube</label>
        {isAdmin ? (
          <select className="input" value={form.branch_id} onChange={(e) => handleBranchChange(e.target.value)}>
            <option value="">Şube seçin</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
          </select>
        ) : (
          <input className="input bg-dark-700" value={librarianBranch?.ad || form.sube} readOnly />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Kat</label><input className="input" value={form.kat} onChange={(e) => setForm({ ...form, kat: e.target.value })} /></div>
        <div><label className="label">Raf No</label><input className="input" value={form.raf_no} onChange={(e) => setForm({ ...form, raf_no: e.target.value })} /></div>
      </div>
      <div><label className="label">Satın Alma Tarihi</label><input type="date" className="input" value={form.satin_alma_tarihi} onChange={(e) => setForm({ ...form, satin_alma_tarihi: e.target.value })} /></div>
      <div><label className="label">Maliyet (₺)</label><input type="number" className="input" value={form.maliyet} onChange={(e) => setForm({ ...form, maliyet: e.target.value })} /></div>
      <button type="button" onClick={onSave} className="btn-primary w-full mt-2">Kaydet</button>
    </div>
  );
}
