import { useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState, formatDate, Modal, StatCard } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi, branchesApi } from '../../api';

const SONUC_STYLE = {
  bulundu: 'text-green-400',
  yanlis_raf: 'text-yellow-400',
  beklenmeyen: 'text-orange-400',
};

export default function InventoryCount() {
  const { user } = useAuth();
  const nav = user?.role === 'admin' ? adminNav : librarianNav;
  const inputRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rafs, setRafs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [view, setView] = useState('list'); // list | active | report
  const [showStart, setShowStart] = useState(false);
  const [form, setForm] = useState({ branch_id: '', raf_no: '', notlar: '' });
  const [scanValue, setScanValue] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [reportTab, setReportTab] = useState('eksik');

  const loadSessions = () => {
    inventoryApi.list().then(setSessions).catch((e) => showMsg(e.message, 'error'));
  };

  useEffect(() => {
    loadSessions();
    branchesApi.list().then(setBranches).catch(console.error);
  }, []);

  useEffect(() => {
    const params = form.branch_id ? { branch_id: form.branch_id } : {};
    inventoryApi.rafs(params).then((d) => setRafs(d.raflar || [])).catch(console.error);
  }, [form.branch_id]);

  useEffect(() => {
    if (view === 'active') inputRef.current?.focus();
  }, [view, activeId]);

  const showMsg = (text, type = 'info') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 6000);
  };

  const startSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await inventoryApi.create({
        branch_id: form.branch_id || undefined,
        raf_no: form.raf_no || undefined,
        notlar: form.notlar || undefined,
      });
      setShowStart(false);
      setForm({ branch_id: '', raf_no: '', notlar: '' });
      setActiveId(result.session.id);
      setSession(result.session);
      setReport(null);
      setView('active');
      loadSessions();
      showMsg(result.message, 'success');
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (id, asReport = false) => {
    try {
      const s = await inventoryApi.get(id);
      setActiveId(id);
      setSession(s);
      if (asReport || s.durum === 'tamamlandi') {
        const r = await inventoryApi.report(id);
        setReport(r.rapor);
        setView('report');
      } else {
        setReport(null);
        setView('active');
      }
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleScan = async (e) => {
    e?.preventDefault?.();
    if (!activeId || !scanValue.trim()) return;
    setLoading(true);
    try {
      const result = await inventoryApi.scan(activeId, scanValue.trim());
      setSession(result.session);
      setScanValue('');
      const type = result.sonuc === 'bulundu' ? 'success' : result.sonuc === 'yanlis_raf' ? 'warn' : 'error';
      showMsg(result.message, type);
      inputRef.current?.focus();
    } catch (err) {
      showMsg(err.message, 'error');
      setScanValue('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Sayımı tamamlayıp rapor oluşturmak istiyor musunuz?')) return;
    try {
      const result = await inventoryApi.complete(activeId);
      setSession(result.session);
      setReport(result.report?.rapor || null);
      if (!result.report?.rapor) {
        const r = await inventoryApi.report(activeId);
        setReport(r.rapor);
      }
      setView('report');
      loadSessions();
      showMsg(result.message, 'success');
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Sayımı iptal etmek istiyor musunuz?')) return;
    try {
      await inventoryApi.cancel(activeId);
      setView('list');
      setActiveId(null);
      setSession(null);
      loadSessions();
      showMsg('Sayım iptal edildi', 'info');
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const printReport = () => window.print();

  const ozet = session?.ozet || report?.ozet;

  return (
    <Layout navItems={nav} title="Envanter Sayımı">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { margin: 0 !important; }
          .card { break-inside: avoid; border: 1px solid #333; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 no-print">
        <p className="text-gray-400 max-w-2xl">
          Rafta olması gereken kopyaları QR / barkod ile sayın. Sistem eksik ve yanlış raftaki kitapları tespit eder; tamamlandığında rapor oluşturur.
        </p>
        <div className="flex gap-2">
          {view !== 'list' && (
            <button type="button" className="btn-secondary" onClick={() => { setView('list'); loadSessions(); }}>
              Tüm Sayımlar
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => setShowStart(true)}>
            Yeni Sayım
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border no-print ${
          msgType === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : msgType === 'warn' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : msgType === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-purple-primary/10 border-purple-primary/30 text-purple-light'
        }`}
        >
          {msg}
        </div>
      )}

      {view === 'list' && (
        <>
          {sessions.length === 0 ? (
            <EmptyState message="Henüz envanter sayımı yok — Yeni Sayım ile başlayın" />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSession(s.id, s.durum !== 'aktif')}
                  className="card w-full text-left hover:border-purple-primary/40 transition-colors"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-white font-medium">
                        Sayım #{s.id} · {s.kapsam}
                        {s.sube ? ` · ${s.sube.ad}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {s.baslatan} · {formatDate(s.started_at)}
                        {s.completed_at ? ` → ${formatDate(s.completed_at)}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded self-start ${
                      s.durum === 'aktif' ? 'bg-green-500/20 text-green-400'
                        : s.durum === 'tamamlandi' ? 'bg-purple-primary/20 text-purple-light'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                    >
                      {s.durum_adi}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
                    <span>Beklenen: {s.ozet.beklenen}</span>
                    <span className="text-green-400">Bulunan: {s.ozet.bulundu}</span>
                    <span className="text-red-400">Eksik: {s.ozet.eksik}</span>
                    <span className="text-yellow-400">Yanlış raf: {s.ozet.yanlis_raf}</span>
                    <span>%{s.ozet.tamamlanan_yuzde}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {(view === 'active' || view === 'report') && session && ozet && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Beklenen" value={ozet.beklenen} icon="📚" />
            <StatCard label="Bulunan" value={ozet.bulundu} icon="✓" color="green" />
            <StatCard label="Eksik" value={ozet.eksik} icon="!" color="red" />
            <StatCard label="Yanlış Raf" value={ozet.yanlis_raf} icon="⚠" color="yellow" />
            <StatCard label="Kapsam Dışı" value={ozet.beklenmeyen} icon="？" color="yellow" />
            <StatCard label="Tamamlanan" value={`%${ozet.tamamlanan_yuzde}`} icon="📈" color="green" />
          </div>

          <div className="card mb-6">
            <p className="text-white font-medium">
              Sayım #{session.id} · {session.kapsam}
              {session.sube ? ` · ${session.sube.ad}` : ''}
            </p>
            <p className="text-xs text-gray-500 mt-1">{session.baslatan} · {formatDate(session.started_at)}</p>
            {session.notlar && <p className="text-sm text-gray-400 mt-2">{session.notlar}</p>}
          </div>
        </>
      )}

      {view === 'active' && session?.durum === 'aktif' && (
        <div className="no-print">
          <form onSubmit={handleScan} className="card mb-6">
            <label className="label">QR / Barkod Okut</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="input flex-1 font-mono"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="KTP-00001-01 veya QR kod..."
                autoComplete="off"
                disabled={loading}
              />
              <button type="submit" className="btn-primary" disabled={loading || !scanValue.trim()}>
                Tara
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">USB barkod okuyucu Enter ile gönderir.</p>
          </form>

          <div className="flex flex-wrap gap-2 mb-6">
            <button type="button" className="btn-primary" onClick={handleComplete}>
              Sayımı Bitir & Rapor
            </button>
            <button type="button" className="btn-secondary text-red-400" onClick={handleCancel}>
              İptal
            </button>
          </div>

          {report === null && (
            <p className="text-sm text-gray-500 mb-4">
              İlerleme: {ozet?.bulundu + ozet?.yanlis_raf || 0} / {ozet?.beklenen} tarandı · {ozet?.eksik} eksik kaldı
            </p>
          )}
        </div>
      )}

      {view === 'report' && report && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4 no-print">
            <button type="button" className="btn-primary" onClick={printReport}>Yazdır / PDF</button>
            {[
              { id: 'eksik', label: `Eksik (${report.eksik?.length || 0})` },
              { id: 'yanlis_raf', label: `Yanlış raf (${report.yanlis_raf?.length || 0})` },
              { id: 'bulunan', label: `Bulunan (${report.bulunan?.length || 0})` },
              { id: 'beklenmeyen', label: `Kapsam dışı (${report.beklenmeyen?.length || 0})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  reportTab === t.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-1">Envanter Raporu</h3>
            <p className="text-xs text-gray-500 mb-4">
              Sayım #{session.id} · {session.kapsam} · {new Date(report.olusturma_tarihi).toLocaleString('tr-TR')}
            </p>

            {reportTab === 'eksik' && (
              report.eksik?.length ? (
                <table className="table text-sm">
                  <thead><tr><th>Kitap</th><th>Yazar</th><th>Barkod</th><th>Beklenen Raf</th></tr></thead>
                  <tbody>
                    {report.eksik.map((r) => (
                      <tr key={r.copy_id}>
                        <td className="text-white">{r.kitap_adi}</td>
                        <td>{r.yazar}</td>
                        <td className="font-mono text-xs">{r.barkod}</td>
                        <td className="text-red-400">{r.expected_raf_no || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-green-400 text-sm">Eksik kitap yok</p>
            )}

            {reportTab === 'yanlis_raf' && (
              report.yanlis_raf?.length ? (
                <table className="table text-sm">
                  <thead><tr><th>Kitap</th><th>Barkod</th><th>Beklenen</th><th>Kayıtlı Raf</th></tr></thead>
                  <tbody>
                    {report.yanlis_raf.map((r) => (
                      <tr key={r.id}>
                        <td className="text-white">{r.kitap_adi}</td>
                        <td className="font-mono text-xs">{r.barkod}</td>
                        <td>{r.expected_raf_no || '—'}</td>
                        <td className="text-yellow-400">{r.actual_raf_no || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-gray-500 text-sm">Yanlış raf kaydı yok</p>
            )}

            {reportTab === 'bulunan' && (
              report.bulunan?.length ? (
                <table className="table text-sm">
                  <thead><tr><th>Kitap</th><th>Yazar</th><th>Barkod</th><th>Raf</th></tr></thead>
                  <tbody>
                    {report.bulunan.map((r) => (
                      <tr key={r.copy_id}>
                        <td className="text-white">{r.kitap_adi}</td>
                        <td>{r.yazar}</td>
                        <td className="font-mono text-xs">{r.barkod}</td>
                        <td className="text-green-400">{r.expected_raf_no || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-gray-500 text-sm">Henüz bulunan yok</p>
            )}

            {reportTab === 'beklenmeyen' && (
              report.beklenmeyen?.length ? (
                <ul className="space-y-2 text-sm">
                  {report.beklenmeyen.map((r) => (
                    <li key={r.id} className="flex justify-between border-b border-dark-600 py-2">
                      <span className="text-white">{r.kitap_adi} <span className="text-gray-500 font-mono text-xs">{r.barkod}</span></span>
                      <span className={SONUC_STYLE.beklenmeyen}>{r.fiziksel_durum || 'kapsam dışı'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 text-sm">Kapsam dışı tarama yok</p>
            )}
          </div>
        </div>
      )}

      <Modal open={showStart} onClose={() => setShowStart(false)} title="Yeni Envanter Sayımı">
        <form onSubmit={startSession} className="space-y-4">
          {user?.role === 'admin' && (
            <div>
              <label className="label">Şube</label>
              <select className="input w-full" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value, raf_no: '' })}>
                <option value="">Tüm şubeler / varsayılan</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Raf (opsiyonel)</label>
            <select className="input w-full" value={form.raf_no} onChange={(e) => setForm({ ...form, raf_no: e.target.value })}>
              <option value="">Tüm raflar (şube geneli)</option>
              {rafs.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Boş bırakılırsa raftaki tüm kopyalar sayılır.</p>
          </div>
          <div>
            <label className="label">Not</label>
            <input className="input w-full" value={form.notlar} onChange={(e) => setForm({ ...form, notlar: e.target.value })} placeholder="Örn. 2026 Q2 dönem sayımı" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowStart(false)}>Vazgeç</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : 'Sayımı Başlat'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
