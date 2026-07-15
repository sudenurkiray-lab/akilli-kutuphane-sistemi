import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { Modal, StatusBadge } from '../../components/UI';
import { membersApi } from '../../api';
import { adminNav } from '../../constants/adminNav';

const nav = adminNav;

const emptyForm = {
  username: '', password: '', ad: '', soyad: '', okul_no: '', email: '', telefon: '', bolum: '', uyelik_durumu: 'aktif',
};

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [editMember, setEditMember] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const load = () => membersApi.list().then(setMembers).catch(console.error);
  useEffect(() => { load(); }, []);

  const openEdit = (m) => {
    setEditMember(m);
    setForm({ ad: m.ad, soyad: m.soyad, okul_no: m.okul_no, email: m.email, telefon: m.telefon, bolum: m.bolum, uyelik_durumu: m.uyelik_durumu });
  };

  const handleSave = async () => {
    try {
      await membersApi.update(editMember.id, form);
      setMsg('Üye güncellendi');
      setEditMember(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleCreate = async () => {
    try {
      await membersApi.create(form);
      setMsg('Üye kaydı oluşturuldu');
      setShowCreate(false);
      setForm(emptyForm);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={nav} title="Üye Yönetimi">
      {msg && <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">{msg}</div>}
      <p className="text-gray-400 mb-4">Ad, soyad, öğrenci numarası, e-posta, telefon, bölüm ve üyelik durumu.</p>

      <div className="mb-4">
        <button onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="btn-primary">+ Yeni Üye Kaydı</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Öğrenci No</th><th>E-posta</th><th>Telefon</th><th>Bölüm</th><th>Üyelik Durumu</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium text-white">{m.ad} {m.soyad}</td>
                <td>{m.username}</td>
                <td>{m.okul_no}</td>
                <td>{m.email}</td>
                <td>{m.telefon || '-'}</td>
                <td>{m.bolum || '-'}</td>
                <td><StatusBadge status={m.uyelik_durumu} /></td>
                <td>
                  <button onClick={() => openEdit(m)} className="text-purple-light hover:text-purple-glow text-sm">Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Üye Düzenle">
        <MemberForm form={form} setForm={setForm} onSubmit={handleSave} submitLabel="Kaydet" />
      </Modal>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Üye Kaydı">
        <MemberForm form={form} setForm={setForm} onSubmit={handleCreate} submitLabel="Oluştur" isCreate />
      </Modal>
    </Layout>
  );
}

function MemberForm({ form, setForm, onSubmit, submitLabel, isCreate }) {
  return (
    <div className="space-y-4">
      {isCreate && (
        <>
          <div><label className="label">Kullanıcı Adı *</label><input className="input" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><label className="label">Şifre *</label><input type="password" className="input" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Ad *</label><input className="input" value={form.ad || ''} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></div>
        <div><label className="label">Soyad *</label><input className="input" value={form.soyad || ''} onChange={(e) => setForm({ ...form, soyad: e.target.value })} /></div>
      </div>
          <div><label className="label">Öğrenci Numarası *</label><input className="input" value={form.okul_no || ''} onChange={(e) => setForm({ ...form, okul_no: e.target.value })} /></div>
      <div><label className="label">E-posta</label><input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><label className="label">Telefon</label><input className="input" value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
      <div><label className="label">Bölüm</label><input className="input" value={form.bolum || ''} onChange={(e) => setForm({ ...form, bolum: e.target.value })} /></div>
      <div>
        <label className="label">Üyelik Durumu</label>
        <select className="input" value={form.uyelik_durumu || 'aktif'} onChange={(e) => setForm({ ...form, uyelik_durumu: e.target.value })}>
          <option value="aktif">Aktif</option>
          <option value="pasif">Pasif</option>
        </select>
      </div>
      <button onClick={onSubmit} className="btn-primary w-full">{submitLabel}</button>
    </div>
  );
}
