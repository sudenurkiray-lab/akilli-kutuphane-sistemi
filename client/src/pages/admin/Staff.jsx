import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, Modal, formatDate } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { staffApi, branchesApi } from '../../api';

const emptyStaff = {
  username: '',
  password: '',
  role: 'librarian',
  ad: '',
  soyad: '',
  email: '',
  telefon: '',
  sicil_no: '',
  gorev: 'kutuphaneci',
  branch_id: '',
  vardiya: 'tam_gun',
  yetki_seviyesi: 'standart',
  izin_durumu: 'calisiyor',
};

const emptyTask = {
  baslik: '',
  aciklama: '',
  assigned_to: '',
  branch_id: '',
  son_tarih: '',
  oncelik: 'normal',
};

const IZIN_STYLE = {
  calisiyor: 'bg-green-500/20 text-green-400',
  izinli: 'bg-yellow-500/20 text-yellow-400',
  raporlu: 'bg-orange-500/20 text-orange-400',
  uretimizni: 'bg-gray-500/20 text-gray-400',
};

const TASK_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  devam: 'bg-blue-500/20 text-blue-400',
  tamamlandi: 'bg-green-500/20 text-green-400',
  iptal: 'bg-red-500/20 text-red-400',
};

export default function AdminStaff() {
  const [tab, setTab] = useState('personel');
  const [staff, setStaff] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ gorevler: [], vardiyalar: [], yetki_seviyeleri: [], izin_durumlari: [] });
  const [branches, setBranches] = useState([]);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [form, setForm] = useState(emptyStaff);
  const [taskForm, setTaskForm] = useState(emptyTask);

  const load = () => {
    staffApi.list().then(setStaff).catch((e) => setMsg(e.message));
    staffApi.listTasks().then(setTasks).catch(console.error);
  };

  useEffect(() => {
    staffApi.meta().then(setMeta).catch(console.error);
    branchesApi.list().then(setBranches).catch(console.error);
    load();
  }, []);

  const openEdit = (s) => {
    setEdit(s);
    setForm({
      ad: s.ad || '',
      soyad: s.soyad || '',
      email: s.email || '',
      telefon: s.telefon || '',
      sicil_no: s.sicil_no || '',
      gorev: s.gorev || 'kutuphaneci',
      branch_id: s.branch_id || '',
      vardiya: s.vardiya || 'tam_gun',
      yetki_seviyesi: s.yetki_seviyesi || 'standart',
      izin_durumu: s.izin_durumu || 'calisiyor',
      password: '',
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await staffApi.create({
        ...form,
        branch_id: form.branch_id || null,
      });
      setMsg(result.message);
      setShowCreate(false);
      setForm(emptyStaff);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, branch_id: form.branch_id || null };
      if (!payload.password) delete payload.password;
      const result = await staffApi.update(edit.id, payload);
      setMsg(result.message);
      setEdit(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const result = await staffApi.createTask({
        ...taskForm,
        assigned_to: Number(taskForm.assigned_to),
        branch_id: taskForm.branch_id || null,
      });
      setMsg(result.message);
      setShowTask(false);
      setTaskForm(emptyTask);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const updateTaskDurum = async (id, durum) => {
    try {
      await staffApi.updateTask(id, { durum });
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const formatLogin = (d) => {
    if (!d) return 'Henüz giriş yok';
    return new Date(d).toLocaleString('tr-TR');
  };

  return (
    <Layout navItems={adminNav} title="Personel Yönetimi">
      <p className="text-gray-400 mb-6">
        Personel bilgilerini, vardiya ve izin durumunu yönetin; görev atayın.
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('personel')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'personel' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Personel ({staff.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('gorevler')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'gorevler' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Görev Atamaları ({tasks.filter((t) => t.durum !== 'tamamlandi' && t.durum !== 'iptal').length})
        </button>
      </div>

      {tab === 'personel' && (
        <>
          <div className="mb-4">
            <button type="button" className="btn-primary" onClick={() => { setForm(emptyStaff); setShowCreate(true); }}>
              + Yeni Personel
            </button>
          </div>

          <div className="table-container">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Sicil No</th>
                  <th>Görev</th>
                  <th>Şube</th>
                  <th>Vardiya</th>
                  <th>Yetki</th>
                  <th>İzin</th>
                  <th>Son Giriş</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-medium text-white">{s.ad} {s.soyad}</p>
                      <p className="text-xs text-gray-500">@{s.username} · {s.role === 'admin' ? 'Admin' : 'Kütüphaneci'}</p>
                    </td>
                    <td className="font-mono text-xs">{s.sicil_no || '—'}</td>
                    <td>{s.gorev_adi}</td>
                    <td>{s.sube?.ad || '—'}</td>
                    <td className="text-xs">{s.vardiya_adi}</td>
                    <td className="text-xs">{s.yetki_adi}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded ${IZIN_STYLE[s.izin_durumu] || ''}`}>
                        {s.izin_adi}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400">{formatLogin(s.son_giris_tarihi)}</td>
                    <td>
                      <button type="button" onClick={() => openEdit(s)} className="text-purple-light text-sm hover:underline">
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'gorevler' && (
        <>
          <div className="mb-4">
            <button type="button" className="btn-primary" onClick={() => { setTaskForm(emptyTask); setShowTask(true); }}>
              + Görev Ata
            </button>
          </div>

          {tasks.length === 0 ? (
            <EmptyState message="Henüz görev ataması yok" />
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="card">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-white font-medium">{t.baslik}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Atanan: {t.atanan} · Atayan: {t.atayan}
                        {t.sube ? ` · ${t.sube.ad}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded self-start ${TASK_STYLE[t.durum] || ''}`}>
                      {t.durum_adi}
                    </span>
                  </div>
                  {t.aciklama && <p className="text-sm text-gray-300 mt-2">{t.aciklama}</p>}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                    <span>Öncelik: {t.oncelik}</span>
                    {t.son_tarih && <span>Son tarih: {t.son_tarih}</span>}
                    <span>{formatDate(t.created_at)}</span>
                  </div>
                  {t.durum !== 'tamamlandi' && t.durum !== 'iptal' && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {t.durum === 'bekliyor' && (
                        <button type="button" className="btn-secondary text-sm" onClick={() => updateTaskDurum(t.id, 'devam')}>
                          Devama Al
                        </button>
                      )}
                      <button type="button" className="btn-primary text-sm" onClick={() => updateTaskDurum(t.id, 'tamamlandi')}>
                        Tamamla
                      </button>
                      <button type="button" className="btn-secondary text-sm text-red-400" onClick={() => updateTaskDurum(t.id, 'iptal')}>
                        İptal
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Personel">
        <StaffForm form={form} setForm={setForm} meta={meta} branches={branches} onSubmit={handleCreate} isCreate />
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Personel Düzenle">
        <StaffForm form={form} setForm={setForm} meta={meta} branches={branches} onSubmit={handleSave} />
      </Modal>

      <Modal open={showTask} onClose={() => setShowTask(false)} title="Görev Ata">
        <form onSubmit={handleCreateTask} className="space-y-3">
          <div>
            <label className="label">Başlık *</label>
            <input className="input" value={taskForm.baslik} onChange={(e) => setTaskForm({ ...taskForm, baslik: e.target.value })} required />
          </div>
          <div>
            <label className="label">Açıklama</label>
            <textarea className="input" rows={2} value={taskForm.aciklama} onChange={(e) => setTaskForm({ ...taskForm, aciklama: e.target.value })} />
          </div>
          <div>
            <label className="label">Personel *</label>
            <select className="input" value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })} required>
              <option value="">Seçin</option>
              {staff.filter((s) => s.role === 'librarian').map((s) => (
                <option key={s.id} value={s.id}>{s.ad} {s.soyad} ({s.sicil_no || s.username})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Şube</label>
              <select className="input" value={taskForm.branch_id} onChange={(e) => setTaskForm({ ...taskForm, branch_id: e.target.value })}>
                <option value="">—</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Son tarih</label>
              <input type="date" className="input" value={taskForm.son_tarih} onChange={(e) => setTaskForm({ ...taskForm, son_tarih: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Öncelik</label>
            <select className="input" value={taskForm.oncelik} onChange={(e) => setTaskForm({ ...taskForm, oncelik: e.target.value })}>
              <option value="dusuk">Düşük</option>
              <option value="normal">Normal</option>
              <option value="yuksek">Yüksek</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">Ata</button>
        </form>
      </Modal>
    </Layout>
  );
}

function StaffForm({ form, setForm, meta, branches, onSubmit, isCreate }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      {isCreate && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kullanıcı Adı *</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Şifre *</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
          </div>
          <div>
            <label className="label">Sistem Rolü</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="librarian">Kütüphaneci</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </>
      )}
      {!isCreate && (
        <div>
          <label className="label">Yeni Şifre (opsiyonel)</label>
          <input type="password" className="input" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Değiştirmek için doldurun" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Ad *</label>
          <input className="input" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} required />
        </div>
        <div>
          <label className="label">Soyad *</label>
          <input className="input" value={form.soyad} onChange={(e) => setForm({ ...form, soyad: e.target.value })} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Sicil No</label>
          <input className="input" value={form.sicil_no} onChange={(e) => setForm({ ...form, sicil_no: e.target.value })} />
        </div>
        <div>
          <label className="label">Görev</label>
          <select className="input" value={form.gorev} onChange={(e) => setForm({ ...form, gorev: e.target.value })}>
            {(meta.gorevler || []).map((g) => <option key={g.id} value={g.id}>{g.ad}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Çalıştığı Şube</label>
        <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
          <option value="">—</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Vardiya</label>
          <select className="input" value={form.vardiya} onChange={(e) => setForm({ ...form, vardiya: e.target.value })}>
            {(meta.vardiyalar || []).map((v) => <option key={v.id} value={v.id}>{v.ad}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Yetki Seviyesi</label>
          <select className="input" value={form.yetki_seviyesi} onChange={(e) => setForm({ ...form, yetki_seviyesi: e.target.value })}>
            {(meta.yetki_seviyeleri || []).map((y) => <option key={y.id} value={y.id}>{y.ad}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">İzin Durumu</label>
        <select className="input" value={form.izin_durumu} onChange={(e) => setForm({ ...form, izin_durumu: e.target.value })}>
          {(meta.izin_durumlari || []).map((i) => <option key={i.id} value={i.id}>{i.ad}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">E-posta</label>
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input className="input" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full">{isCreate ? 'Oluştur' : 'Kaydet'}</button>
    </form>
  );
}
