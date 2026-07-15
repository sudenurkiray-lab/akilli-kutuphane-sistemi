import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge, EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { eventsApi } from '../../api';

const emptyForm = {
  baslik: '', aciklama: '', tur: 'kitap_soylesi', tarih: '', baslangic: '14:00',
  bitis: '16:00', konum: '', kapasite: 30, egitmen: '', durum: 'yayinda',
};

export default function AdminEvents() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const load = () => eventsApi.list().then(setEvents).catch((e) => setMsg(e.message));

  useEffect(() => {
    load();
    eventsApi.types().then(setTypes).catch(console.error);
  }, []);

  const openRegs = async (event) => {
    setSelectedEvent(event);
    const regs = await eventsApi.registrations(event.id);
    setRegistrations(regs);
    setModal('regs');
  };

  const openCreate = () => { setForm(emptyForm); setModal('form'); };
  const openEdit = (e) => {
    setForm({
      id: e.id, baslik: e.baslik, aciklama: e.aciklama || '', tur: e.tur,
      tarih: e.tarih, baslangic: e.baslangic, bitis: e.bitis,
      konum: e.konum || '', kapasite: e.kapasite, egitmen: e.egitmen || '', durum: e.durum,
    });
    setModal('form');
  };

  const handleSave = async () => {
    try {
      if (form.id) {
        await eventsApi.update(form.id, form);
        setMsg('Etkinlik güncellendi');
      } else {
        await eventsApi.create(form);
        setMsg('Etkinlik oluşturuldu');
      }
      setModal(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleComplete = async (id) => {
    if (!confirm('Etkinliği tamamla ve kayıtlı katılımcılara belge ver?')) return;
    try {
      const result = await eventsApi.complete(id);
      setMsg(result.message);
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleAttend = async (regId, katildi) => {
    try {
      await eventsApi.markAttend(regId, katildi);
      if (selectedEvent) {
        const regs = await eventsApi.registrations(selectedEvent.id);
        setRegistrations(regs);
      }
      setMsg(katildi ? 'Katılım onaylandı' : 'Katılmadı işaretlendi');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={nav} title="Etkinlik & Seminer Yönetimi">
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-400">Kütüphane etkinliklerini yayınlayın ve katılımcıları yönetin.</p>
        <button type="button" onClick={openCreate} className="btn-primary text-sm">+ Yeni Etkinlik</button>
      </div>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState message="Henüz etkinlik yok" />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Etkinlik</th>
                <th>Tür</th>
                <th>Tarih</th>
                <th>Kontenjan</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <p className="text-white font-medium">{e.baslik}</p>
                    <p className="text-xs text-gray-500">{e.konum}</p>
                  </td>
                  <td className="text-sm text-purple-light">{e.tur_adi}</td>
                  <td className="text-sm">{e.tarih}<br /><span className="text-gray-500">{e.baslangic}–{e.bitis}</span></td>
                  <td>{e.kayitli_sayisi}/{e.kapasite}</td>
                  <td><StatusBadge status={e.durum} /></td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button type="button" onClick={() => openRegs(e)} className="text-purple-light text-sm hover:underline">Katılımcılar</button>
                    <button type="button" onClick={() => openEdit(e)} className="text-gray-400 text-sm hover:underline">Düzenle</button>
                    {e.durum === 'yayinda' && (
                      <button type="button" onClick={() => handleComplete(e.id)} className="text-green-400 text-sm hover:underline">Tamamla</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={form.id ? 'Etkinlik Düzenle' : 'Yeni Etkinlik'}>
        <div className="space-y-3">
          <div><label className="label">Başlık</label><input className="input" value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} /></div>
          <div><label className="label">Açıklama</label><textarea className="input min-h-[80px]" value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tür</label>
              <select className="input" value={form.tur} onChange={(e) => setForm({ ...form, tur: e.target.value })}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
            <div><label className="label">Durum</label>
              <select className="input" value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
                <option value="taslak">Taslak</option>
                <option value="yayinda">Yayında</option>
                <option value="iptal">İptal</option>
                <option value="tamamlandi">Tamamlandı</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Tarih</label><input type="date" className="input" value={form.tarih} onChange={(e) => setForm({ ...form, tarih: e.target.value })} /></div>
            <div><label className="label">Başlangıç</label><input type="time" className="input" value={form.baslangic} onChange={(e) => setForm({ ...form, baslangic: e.target.value })} /></div>
            <div><label className="label">Bitiş</label><input type="time" className="input" value={form.bitis} onChange={(e) => setForm({ ...form, bitis: e.target.value })} /></div>
          </div>
          <div><label className="label">Konum</label><input className="input" value={form.konum} onChange={(e) => setForm({ ...form, konum: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Kapasite</label><input type="number" className="input" value={form.kapasite} onChange={(e) => setForm({ ...form, kapasite: parseInt(e.target.value, 10) })} /></div>
            <div><label className="label">Eğitmen / Konuşmacı</label><input className="input" value={form.egitmen} onChange={(e) => setForm({ ...form, egitmen: e.target.value })} /></div>
          </div>
          <button type="button" onClick={handleSave} className="btn-primary w-full">Kaydet</button>
        </div>
      </Modal>

      <Modal open={modal === 'regs'} onClose={() => setModal(null)} title={`Katılımcılar — ${selectedEvent?.baslik || ''}`}>
        {registrations.length === 0 ? (
          <p className="text-gray-500 text-sm">Henüz kayıt yok</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {registrations.map((r) => (
              <div key={r.id} className="flex justify-between items-center p-3 rounded-lg bg-dark-700/50 border border-dark-600">
                <div>
                  <p className="text-white text-sm font-medium">{r.kullanici?.ad} {r.kullanici?.soyad}</p>
                  <p className="text-xs text-gray-500">{r.kullanici?.okul_no}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.durum} />
                  {r.durum === 'kayitli' && (
                    <>
                      <button type="button" onClick={() => handleAttend(r.id, true)} className="text-green-400 text-xs">Katıldı</button>
                      <button type="button" onClick={() => handleAttend(r.id, false)} className="text-red-400 text-xs">Katılmadı</button>
                    </>
                  )}
                  {r.sertifika_kodu && <span className="text-xs text-purple-light font-mono">{r.sertifika_kodu}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
