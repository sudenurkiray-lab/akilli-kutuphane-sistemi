import { useEffect, useState, Fragment } from 'react';
import Layout, { icons } from '../../components/Layout';
import { EmptyState, StatCard } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { auditApi } from '../../api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ actions: [] });
  const [filters, setFilters] = useState({ action: '', q: '', from: '', to: '' });
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');

  const load = (override = null) => {
    const f = override || filters;
    const params = {};
    if (f.action) params.action = f.action;
    if (f.q) params.q = f.q;
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    auditApi.list(params).then(setLogs).catch((e) => setError(e.message));
    auditApi.stats().then(setStats).catch(console.error);
  };

  useEffect(() => {
    auditApi.meta().then(setMeta).catch(console.error);
    load();
  }, []);

  return (
    <Layout navItems={adminNav} title="İşlem Geçmişi & Denetim">
      <p className="text-gray-400 mb-6">
        Kitap silme, üye pasifleştirme, ceza değişiklikleri, ödünç işlemleri ve diğer kritik aksiyonların güvenlik kaydı.
      </p>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Toplam Kayıt" value={stats.toplam} icon={icons.report} />
          <StatCard label="Bugün" value={stats.bugun} icon={icons.bell} color="green" />
          <StatCard label="İşlem türü" value={stats.byAction?.length || 0} icon={icons.users} color="yellow" />
          <StatCard label="Listelenen" value={logs.length} icon={icons.penalty} color="green" />
        </div>
      )}

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">İşlem türü</label>
            <select
              className="input"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">Tümü</option>
              {(meta.actions || []).map((a) => (
                <option key={a.id} value={a.id}>{a.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ara</label>
            <input
              className="input"
              placeholder="Kullanıcı, özet..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Başlangıç</label>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
        </div>
        <button type="button" className="btn-primary mt-4" onClick={() => load()}>Filtrele</button>
      </div>

      {stats?.byAction?.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">İşlem dağılımı</h3>
          <div className="flex flex-wrap gap-2">
            {stats.byAction.map((a) => (
              <button
                key={a.action}
                type="button"
                onClick={() => {
                  const next = { ...filters, action: a.action };
                  setFilters(next);
                  load(next);
                }}
                className="text-xs px-2 py-1 rounded bg-dark-700 text-gray-300 hover:text-white"
              >
                {a.action_adi} <span className="text-purple-light">({a.sayi})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <EmptyState message="Denetim kaydı bulunamadı" />
      ) : (
        <div className="table-container">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Özet</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td>
                      <p className="text-white">{l.user_ad || l.username || '—'}</p>
                      <p className="text-xs text-gray-500">@{l.username} · {l.user_role}</p>
                    </td>
                    <td>
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-primary/20 text-purple-light">
                        {l.action_adi}
                      </span>
                    </td>
                    <td className="text-gray-300 max-w-md">{l.ozet}</td>
                    <td className="text-xs text-gray-500 font-mono">{l.ip_adresi || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs text-purple-light hover:underline"
                        onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                      >
                        {expanded === l.id ? 'Gizle' : 'Detay'}
                      </button>
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr>
                      <td colSpan={6} className="bg-dark-700/40 text-xs text-gray-400">
                        <div className="py-2 space-y-1">
                          <p>Varlık: {l.entity_type || '—'} {l.entity_id ? `#${l.entity_id}` : ''}</p>
                          <p>İstek: {l.method} {l.path}</p>
                          {l.detay && (
                            <pre className="mt-2 p-2 rounded bg-dark-800 text-gray-300 overflow-x-auto">
                              {typeof l.detay_obj === 'string' ? l.detay_obj : JSON.stringify(l.detay_obj, null, 2)}
                            </pre>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
