import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { memberNav } from '../../constants/memberNav';
import { notificationsApi } from '../../api';
import { useT } from '../../i18n/LocaleContext';

const CHANNEL_LABELS = {
  kanal_app: 'Sistem içi',
  kanal_email: 'E-posta',
  kanal_sms: 'SMS',
  kanal_push: 'Mobil',
};

export default function MemberNotifications() {
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState('inbox');
  const [filter, setFilter] = useState('');
  const [data, setData] = useState({ notifications: [], stats: {} });
  const [preferences, setPreferences] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [types, setTypes] = useState([]);
  const [msg, setMsg] = useState('');

  const loadInbox = () => {
    notificationsApi.list(filter ? { tur: filter } : {})
      .then((res) => {
        setData({ notifications: res.notifications || [], stats: res.stats || {} });
        setMsg('');
      })
      .catch((e) => setMsg(e.message));
  };

  const loadPrefs = () => {
    notificationsApi.preferences()
      .then((prefs) => {
        setPreferences(prefs);
        setMsg('');
      })
      .catch((e) => setMsg(e.message));
  };

  useEffect(() => {
    notificationsApi.types().then((d) => setTypes(d.turler || [])).catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (tab === 'inbox') loadInbox();
    if (tab === 'preferences') loadPrefs();
    if (tab === 'deliveries') {
      notificationsApi.deliveries()
        .then((d) => { setDeliveries(d); setMsg(''); })
        .catch((e) => setMsg(e.message));
    }
  }, [tab, filter]);

  const markRead = async (n) => {
    if (!n.okundu) await notificationsApi.markRead(n.id);
    loadInbox();
    if (n.link) navigate(n.link);
  };

  const togglePref = (tur, channel) => {
    setPreferences((prev) => prev.map((p) => (
      p.tur === tur ? { ...p, [channel]: !p[channel] } : p
    )));
  };

  const savePrefs = async () => {
    try {
      const result = await notificationsApi.updatePreferences(preferences);
      setPreferences(result.preferences);
      setMsg('Tercihler kaydedildi');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const tabs = [
    { id: 'inbox', label: t('notif.inbox'), count: data.stats?.unread || 0 },
    { id: 'preferences', label: t('notif.prefs') },
    { id: 'deliveries', label: t('notif.deliveries') },
  ];

  return (
    <Layout navItems={memberNav} titleKey="titles.memberNotifications">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('kaydedildi') || msg.includes('başar')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}
        >
          {msg}
        </div>
      )}

      <p className="text-gray-400 mb-6">
        Teslim, rezervasyon, ceza ve etkinlik bildirimlerinizi buradan takip edin. Kanal tercihlerinizi özelleştirebilirsiniz.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}{t.count > 0 && tab !== t.id ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setFilter('')}
              className={`px-3 py-1 rounded-lg text-xs ${!filter ? 'bg-purple-primary/30 text-purple-light' : 'bg-dark-700 text-gray-500'}`}
            >
              Tümü
            </button>
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1 rounded-lg text-xs ${filter === t.id ? 'bg-purple-primary/30 text-purple-light' : 'bg-dark-700 text-gray-500'}`}
              >
                {t.ikon} {t.ad}
              </button>
            ))}
            {data.stats?.unread > 0 && (
              <button
                type="button"
                onClick={() => notificationsApi.markAllRead().then(loadInbox)}
                className="ml-auto text-xs text-purple-light hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="space-y-2">
            {data.notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Bildirim yok</p>
            ) : data.notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n)}
                className={`w-full text-left card hover:border-purple-primary/40 transition-all ${!n.okundu ? 'border-purple-primary/30 bg-purple-primary/5' : ''}`}
              >
                <div className="flex gap-3">
                  <span className="text-2xl">{n.ikon || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-white">{n.baslik}</p>
                      {!n.okundu && <span className="badge-info shrink-0">Yeni</span>}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{n.mesaj}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      <span className="text-purple-light/80">{n.tur_adi}</span>
                      <span>{new Date(n.tarih).toLocaleString('tr-TR')}</span>
                      {n.oncelik === 'yuksek' && <span className="text-red-400">Öncelikli</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'preferences' && (
        <div className="card overflow-x-auto">
          <p className="text-sm text-gray-400 mb-4">
            Her bildirim türü için hangi kanallardan haberdar olmak istediğinizi seçin.
          </p>
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Bildirim Türü</th>
                {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                  <th key={key} className="text-center">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preferences.map((p) => (
                <tr key={p.tur}>
                  <td>
                    <span className="mr-2">{p.ikon}</span>
                    {p.tur_adi}
                  </td>
                  {Object.keys(CHANNEL_LABELS).map((ch) => (
                    <td key={ch} className="text-center">
                      <input
                        type="checkbox"
                        checked={!!p[ch]}
                        onChange={() => togglePref(p.tur, ch)}
                        className="w-4 h-4 accent-purple-primary"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={savePrefs} className="btn-primary mt-4">
            Tercihleri Kaydet
          </button>
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="card">
          <p className="text-sm text-gray-400 mb-4">
            E-posta, SMS ve mobil bildirim gönderim kayıtları (simülasyon).
          </p>
          {deliveries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Gönderim kaydı yok</p>
          ) : (
            <ul className="space-y-2">
              {deliveries.map((d) => (
                <li key={d.id} className="flex justify-between items-center py-2 border-b border-dark-600 text-sm">
                  <div>
                    <span className="text-purple-light uppercase text-xs mr-2">{d.kanal}</span>
                    <span className="text-gray-300">{d.baslik || d.detay}</span>
                  </div>
                  <div className="text-right">
                    <span className={d.durum === 'gonderildi' ? 'text-green-400' : 'text-red-400'}>{d.durum}</span>
                    <p className="text-xs text-gray-600">{new Date(d.tarih).toLocaleString('tr-TR')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Layout>
  );
}
