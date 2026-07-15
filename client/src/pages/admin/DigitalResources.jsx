import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge, EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { digitalResourcesApi } from '../../api';

const emptyForm = {
  baslik: '', yazar: '', tur: 'e_kitap', aciklama: '', kategori: '',
  yayinevi: '', yayin_yili: '', isbn_doi: '', dosya_yolu: '', dosya_turu: 'pdf',
  dosya_boyutu: 0, erisim_yetkisi: 'uye', indirme_izni: true,
  yayin_lisansi: 'kurumsal', son_erisim_tarihi: '', durum: 'yayinda',
};

const TUR_ICON = {
  e_kitap: '📖',
  makale: '📄',
  tez: '🎓',
  dergi: '📰',
  sesli_kitap: '🎧',
  video_egitim: '🎬',
  akademik_veritabani: '🗄️',
};

export default function AdminDigitalResources() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [resources, setResources] = useState([]);
  const [types, setTypes] = useState([]);
  const [accessLevels, setAccessLevels] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [filterTur, setFilterTur] = useState('');

  const load = () => {
    const params = filterTur ? { tur: filterTur } : {};
    digitalResourcesApi.list(params).then(setResources).catch((e) => setMsg(e.message));
  };

  useEffect(() => {
    load();
    digitalResourcesApi.types().then(setTypes).catch(console.error);
    digitalResourcesApi.accessLevels().then(setAccessLevels).catch(console.error);
    digitalResourcesApi.licenses().then(setLicenses).catch(console.error);
  }, [filterTur]);

  const openCreate = () => { setForm(emptyForm); setModal('form'); };
  const openEdit = (r) => {
    setForm({
      id: r.id, baslik: r.baslik, yazar: r.yazar || '', tur: r.tur,
      aciklama: r.aciklama || '', kategori: r.kategori || '',
      yayinevi: r.yayinevi || '', yayin_yili: r.yayin_yili || '',
      isbn_doi: r.isbn_doi || '', dosya_yolu: r.dosya_yolu || '',
      dosya_turu: r.dosya_turu || 'pdf', dosya_boyutu: r.dosya_boyutu || 0,
      erisim_yetkisi: r.erisim_yetkisi, indirme_izni: !!r.indirme_izni,
      yayin_lisansi: r.yayin_lisansi || 'kurumsal',
      son_erisim_tarihi: r.son_erisim_tarihi || '', durum: r.durum,
    });
    setModal('form');
  };

  const openLogs = async (r) => {
    setSelected(r);
    const data = await digitalResourcesApi.logs(r.id);
    setLogs(data);
    setModal('logs');
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        yayin_yili: form.yayin_yili ? parseInt(form.yayin_yili, 10) : null,
        dosya_boyutu: form.dosya_boyutu ? parseInt(form.dosya_boyutu, 10) : 0,
      };
      if (form.id) {
        await digitalResourcesApi.update(form.id, payload);
        setMsg('Kaynak güncellendi');
      } else {
        await digitalResourcesApi.create(payload);
        setMsg('Kaynak eklendi');
      }
      setModal(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Bu kaynağı arşivlemek istiyor musunuz?')) return;
    try {
      await digitalResourcesApi.archive(id);
      setMsg('Kaynak arşivlendi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={nav} title="Dijital Kaynak Yönetimi">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <p className="text-gray-400">E-kitap, makale, tez ve diğer dijital kaynakları yönetin.</p>
        <button type="button" onClick={openCreate} className="btn-primary text-sm">+ Yeni Kaynak</button>
      </div>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setFilterTur('')} className={`px-3 py-1.5 rounded-lg text-sm ${!filterTur ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}>
          Tümü
        </button>
        {types.map((t) => (
          <button key={t.id} type="button" onClick={() => setFilterTur(t.id)} className={`px-3 py-1.5 rounded-lg text-sm ${filterTur === t.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}>
            {TUR_ICON[t.id]} {t.ad}
          </button>
        ))}
      </div>

      {resources.length === 0 ? (
        <EmptyState message="Dijital kaynak bulunamadı" />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Tür</th>
                <th>Dosya</th>
                <th>Erişim</th>
                <th>İstatistik</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="text-white font-medium">{TUR_ICON[r.tur]} {r.baslik}</p>
                    <p className="text-xs text-gray-500">{r.yazar}</p>
                  </td>
                  <td className="text-sm text-purple-light">{r.tur_adi}</td>
                  <td className="text-xs text-gray-400">
                    <p>{r.dosya_turu?.toUpperCase()} · {r.dosya_boyutu_okunur}</p>
                    <p className="text-gray-500">{r.yayin_lisansi_adi}</p>
                  </td>
                  <td className="text-xs">
                    <p>{r.erisim_yetkisi_adi}</p>
                    <p className="text-gray-500">{r.indirme_izni ? 'İndirilebilir' : 'Yalnızca görüntüleme'}</p>
                    {r.son_erisim_tarihi && (
                      <p className="text-yellow-500/80">Lisans: {r.son_erisim_tarihi}</p>
                    )}
                  </td>
                  <td className="text-xs text-gray-400">
                    <p>👁 {r.goruntulenme_sayisi} · ⬇ {r.indirme_sayisi}</p>
                  </td>
                  <td><StatusBadge status={r.durum} /></td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button type="button" onClick={() => openLogs(r)} className="text-purple-light text-sm hover:underline">Loglar</button>
                    <button type="button" onClick={() => openEdit(r)} className="text-gray-400 text-sm hover:underline">Düzenle</button>
                    {r.durum !== 'arsiv' && (
                      <button type="button" onClick={() => handleArchive(r.id)} className="text-red-400 text-sm hover:underline">Arşivle</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={form.id ? 'Kaynak Düzenle' : 'Yeni Dijital Kaynak'}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div><label className="label">Başlık</label><input className="input" value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Yazar</label><input className="input" value={form.yazar} onChange={(e) => setForm({ ...form, yazar: e.target.value })} /></div>
            <div>
              <label className="label">Tür</label>
              <select className="input" value={form.tur} onChange={(e) => setForm({ ...form, tur: e.target.value })}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Açıklama</label><textarea className="input min-h-[60px]" value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Kategori</label><input className="input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></div>
            <div><label className="label">Yayınevi</label><input className="input" value={form.yayinevi} onChange={(e) => setForm({ ...form, yayinevi: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Yayın Yılı</label><input type="number" className="input" value={form.yayin_yili} onChange={(e) => setForm({ ...form, yayin_yili: e.target.value })} /></div>
            <div><label className="label">ISBN / DOI</label><input className="input" value={form.isbn_doi} onChange={(e) => setForm({ ...form, isbn_doi: e.target.value })} /></div>
          </div>
          <div><label className="label">Dosya yolu veya URL</label><input className="input" placeholder="ornek.pdf veya https://..." value={form.dosya_yolu} onChange={(e) => setForm({ ...form, dosya_yolu: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Dosya türü</label><input className="input" placeholder="pdf, epub, mp3, url" value={form.dosya_turu} onChange={(e) => setForm({ ...form, dosya_turu: e.target.value })} /></div>
            <div><label className="label">Dosya boyutu (byte)</label><input type="number" className="input" value={form.dosya_boyutu} onChange={(e) => setForm({ ...form, dosya_boyutu: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Erişim yetkisi</label>
              <select className="input" value={form.erisim_yetkisi} onChange={(e) => setForm({ ...form, erisim_yetkisi: e.target.value })}>
                {accessLevels.map((a) => <option key={a.id} value={a.id}>{a.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Yayın lisansı</label>
              <select className="input" value={form.yayin_lisansi} onChange={(e) => setForm({ ...form, yayin_lisansi: e.target.value })}>
                {licenses.map((l) => <option key={l.id} value={l.id}>{l.ad}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Son erişim tarihi (lisans)</label><input type="date" className="input" value={form.son_erisim_tarihi} onChange={(e) => setForm({ ...form, son_erisim_tarihi: e.target.value })} /></div>
            <div>
              <label className="label">Durum</label>
              <select className="input" value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
                <option value="taslak">Taslak</option>
                <option value="yayinda">Yayında</option>
                <option value="arsiv">Arşiv</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.indirme_izni} onChange={(e) => setForm({ ...form, indirme_izni: e.target.checked })} />
            İndirmeye izin ver
          </label>
          <button type="button" onClick={handleSave} className="btn-primary w-full">Kaydet</button>
        </div>
      </Modal>

      <Modal open={modal === 'logs'} onClose={() => setModal(null)} title={`Erişim Logları — ${selected?.baslik || ''}`}>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">Henüz erişim kaydı yok</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="flex justify-between items-center p-3 rounded-lg bg-dark-700/50 border border-dark-600 text-sm">
                <div>
                  <p className="text-white">{l.ad} {l.soyad}</p>
                  <p className="text-xs text-gray-500">{l.okul_no}</p>
                </div>
                <div className="text-right">
                  <p className={l.islem === 'indirme' ? 'text-green-400' : 'text-purple-light'}>
                    {l.islem === 'indirme' ? 'İndirme' : 'Görüntüleme'}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(l.tarih).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
