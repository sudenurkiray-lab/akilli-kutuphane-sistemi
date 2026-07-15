import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState({ notifications: [], stats: { unread: 0 } });
  const [open, setOpen] = useState(false);

  const load = () => notificationsApi.list()
    .then((res) => setData({
      notifications: res.notifications || res,
      stats: res.stats || { unread: (res.notifications || res).filter((n) => !n.okundu).length },
    }))
    .catch(() => {});

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, []);

  const { notifications, stats } = data;
  const unread = stats?.unread ?? notifications.filter((n) => !n.okundu).length;

  const markRead = async (n) => {
    if (!n.okundu) await notificationsApi.markRead(n.id);
    load();
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-dark-700 text-gray-300"
        aria-label="Bildirimler"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.6 6.6 0 00-1.5-4.243M9 17H4l1.405-1.405A2.032 2.032 0 017 14.158V11a6 6 0 1112 0v3.159c0 .538-.214 1.055-.595 1.436L15 17z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-dark-800 border border-purple-primary/30 rounded-xl shadow-glow z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-primary/20">
              <span className="text-sm font-semibold text-white">Bildirimler {unread > 0 && `(${unread})`}</span>
              <div className="flex gap-2">
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs text-purple-light hover:underline">
                    Tümünü oku
                  </button>
                )}
                <Link to="/uye/bildirimler" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-white">
                  Merkez →
                </Link>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">Bildirim yok</p>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n)}
                    className={`w-full text-left px-4 py-3 border-b border-dark-600 hover:bg-dark-700 transition-colors ${!n.okundu ? 'bg-purple-primary/5' : ''}`}
                  >
                    <div className="flex gap-2">
                      <span className="text-lg shrink-0">{n.ikon || '🔔'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{n.baslik}</p>
                          {!n.okundu && <span className="w-2 h-2 bg-purple-primary rounded-full shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.mesaj}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] text-purple-light/70">{n.tur_adi || n.tur}</span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(n.tarih).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
