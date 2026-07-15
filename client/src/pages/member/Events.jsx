import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge, EmptyState } from '../../components/UI';
import EventCertificate from '../../components/EventCertificate';
import { memberNav } from '../../constants/memberNav';
import { eventsApi } from '../../api';

const TUR_RENK = {
  kitap_soylesi: 'border-pink-500/30 bg-pink-500/5',
  akademik_egitim: 'border-blue-500/30 bg-blue-500/5',
  yazar_bulusmasi: 'border-purple-500/30 bg-purple-500/5',
  veritabani_egitimi: 'border-cyan-500/30 bg-cyan-500/5',
  sessiz_okuma: 'border-green-500/30 bg-green-500/5',
  yazilim_atolyesi: 'border-yellow-500/30 bg-yellow-500/5',
};

export default function MemberEvents() {
  const [events, setEvents] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [tab, setTab] = useState('yaklasan');
  const [msg, setMsg] = useState('');
  const [certData, setCertData] = useState(null);
  const [certOpen, setCertOpen] = useState(false);

  const load = () => {
    eventsApi.list().then(setEvents).catch((e) => setMsg(e.message));
    eventsApi.my().then(setMyRegs).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const yaklasan = events.filter((e) => e.durum === 'yayinda' && e.tarih >= today);
  const gecmis = events.filter((e) => e.durum === 'tamamlandi' || e.tarih < today);

  const handleRegister = async (id) => {
    try {
      const result = await eventsApi.register(id);
      setMsg(result.message);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await eventsApi.cancelRegister(id);
      setMsg('Kayıt iptal edildi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const showCertificate = async (regId) => {
    try {
      const data = await eventsApi.certificate(regId);
      setCertData(data.sertifika);
      setCertOpen(true);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const EventCard = ({ event }) => {
    const kayit = event.benim_kayit;
    const renk = TUR_RENK[event.tur] || 'border-dark-600';
    return (
      <div className={`card border ${renk}`}>
        <div className="flex justify-between items-start gap-3 mb-3">
          <div>
            <span className="text-xs text-purple-light font-medium">{event.tur_adi}</span>
            <h3 className="text-lg font-semibold text-white mt-1">{event.baslik}</h3>
          </div>
          <StatusBadge status={event.durum} />
        </div>
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{event.aciklama}</p>
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <p>📅 {new Date(event.tarih + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p>🕐 {event.baslangic} – {event.bitis}</p>
          <p>📍 {event.konum}</p>
          {event.egitmen && <p>👤 {event.egitmen}</p>}
          <p className="text-purple-light/80">
            Kontenjan: {event.kayitli_sayisi}/{event.kapasite} ({event.kalan_kontenjan} kalan)
          </p>
        </div>
        {kayit?.durum === 'katildi' && kayit.sertifika_alinabilir ? (
          <button type="button" onClick={() => showCertificate(kayit.id)} className="btn-primary w-full text-sm">
            Katılım Belgesi Al
          </button>
        ) : kayit?.durum === 'kayitli' ? (
          <div className="space-y-2">
            <p className="text-sm text-green-400 text-center">Kayıtlısınız</p>
            {event.durum === 'yayinda' && !event.gecmis && (
              <button type="button" onClick={() => handleCancel(event.id)} className="btn-secondary w-full text-sm">
                Kaydı İptal Et
              </button>
            )}
          </div>
        ) : event.musait_kayit ? (
          <button type="button" onClick={() => handleRegister(event.id)} className="btn-primary w-full text-sm">
            Kayıt Ol
          </button>
        ) : (
          <p className="text-sm text-gray-500 text-center">
            {event.gecmis ? 'Etkinlik sona erdi' : event.kalan_kontenjan === 0 ? 'Kontenjan dolu' : 'Kayıt kapalı'}
          </p>
        )}
      </div>
    );
  };

  const list = tab === 'yaklasan' ? yaklasan : tab === 'gecmis' ? gecmis : [];

  return (
    <Layout navItems={memberNav} title="Etkinlikler & Seminerler">
      <p className="text-gray-400 mb-6">
        Kütüphanede düzenlenen etkinliklere kayıt olun. Katıldığınız etkinlikler için katılım belgesi alabilirsiniz.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('kayıt') || msg.includes('Kayıt') || msg.includes('belge')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'yaklasan', label: `Yaklaşan (${yaklasan.length})` },
          { id: 'gecmis', label: `Geçmiş (${gecmis.length})` },
          { id: 'kayitlarim', label: `Kayıtlarım (${myRegs.filter((r) => r.durum !== 'iptal').length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kayitlarim' ? (
        myRegs.filter((r) => r.durum !== 'iptal').length === 0 ? (
          <EmptyState message="Henüz etkinlik kaydınız yok" />
        ) : (
          <div className="space-y-3">
            {myRegs.filter((r) => r.durum !== 'iptal').map((r) => (
              <div key={r.id} className="card flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-white font-medium">{r.etkinlik?.baslik}</p>
                  <p className="text-sm text-gray-500">
                    {r.etkinlik?.tarih} · {r.etkinlik?.baslangic}–{r.etkinlik?.bitis}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.durum} />
                  {r.sertifika_alinabilir && (
                    <button type="button" onClick={() => showCertificate(r.id)} className="btn-primary text-sm">
                      Belge Al
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState message={tab === 'yaklasan' ? 'Yaklaşan etkinlik yok' : 'Geçmiş etkinlik yok'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      <EventCertificate open={certOpen} onClose={() => setCertOpen(false)} data={certData} />
    </Layout>
  );
}
