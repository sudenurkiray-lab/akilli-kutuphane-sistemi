import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate } from '../../components/UI';
import { librarianNav } from '../../constants/librarianNav';
import { staffApi } from '../../api';

const TASK_STYLE = {
  bekliyor: 'bg-yellow-500/20 text-yellow-400',
  devam: 'bg-blue-500/20 text-blue-400',
  tamamlandi: 'bg-green-500/20 text-green-400',
  iptal: 'bg-red-500/20 text-red-400',
};

export default function LibrarianTasks() {
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState('');

  const load = () => staffApi.listTasks().then(setTasks).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  const update = async (id, durum) => {
    try {
      await staffApi.updateTask(id, { durum });
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={librarianNav} title="Görevlerim">
      <p className="text-gray-400 mb-6">Size atanan görevleri buradan takip edin.</p>
      {msg && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{msg}</div>
      )}
      {tasks.length === 0 ? (
        <EmptyState message="Atanmış görev yok" />
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="card">
              <div className="flex justify-between gap-2">
                <p className="text-white font-medium">{t.baslik}</p>
                <span className={`text-xs px-2 py-1 rounded ${TASK_STYLE[t.durum] || ''}`}>{t.durum_adi}</span>
              </div>
              {t.aciklama && <p className="text-sm text-gray-400 mt-2">{t.aciklama}</p>}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                <span>Atayan: {t.atayan}</span>
                {t.son_tarih && <span>Son tarih: {t.son_tarih}</span>}
                <span>{formatDate(t.created_at)}</span>
              </div>
              {t.durum !== 'tamamlandi' && t.durum !== 'iptal' && (
                <div className="flex gap-2 mt-3">
                  {t.durum === 'bekliyor' && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => update(t.id, 'devam')}>Başla</button>
                  )}
                  <button type="button" className="btn-primary text-sm" onClick={() => update(t.id, 'tamamlandi')}>Tamamla</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
