import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge, EmptyState } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { thesisArchiveApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const emptyForm = {
  baslik: '', ozet: '', kayit_turu: 'bitirme_projesi', tez_turu: 'bitirme_projesi',
  bolum: '', danisman: '', yil: new Date().getFullYear(), anahtar_kelimeler: '', konu_alani: '',
};

export default function MemberThesisArchive() {
  const { user } = useAuth();
  const [tab, setTab] = useState('arsiv');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [filterOpts, setFilterOpts] = useState({ bolumler: [], danismanlar: [], konu_alanlari: [], yillar: [], kayit_turleri: [], tez_turleri: [] });
  const [localFilters, setLocalFilters] = useState({
    bolum: '', danisman: '', yazar: '', yil: '', tez_turu: '', konu_alani: '', anahtar_kelime: '', kayit_turu: '',
  });
  const [form, setForm] = useState({ ...emptyForm, bolum: user?.bolum || '' });
  const [file, setFile] = useState(null);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState('');

  const loadArchive = () => {
    const params = Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v));
    thesisArchiveApi.list({ ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch((e) => setMsg(e.message));
  };

  const loadMine = () => {
    thesisArchiveApi.list({ mine: '1', limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch((e) => setMsg(e.message));
  };

  useEffect(() => {
    thesisArchiveApi.filters().then(setFilterOpts).catch(console.error);
  }, []);

  useEffect(() => { setPage(0); }, [localFilters]);

  useEffect(() => {
    if (tab === 'arsiv') loadArchive();
    else if (tab === 'yuklemelerim') loadMine();
  }, [tab, localFilters, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const readFileAsBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });

  const handleSubmit = async () => {
    if (!form.baslik || !form.danisman) {
      setMsg('Başlık ve danışman zorunludur');
      return;
    }
    if (!file) {
      setMsg('Lütfen dosya seçin (PDF, DOC, DOCX veya TXT)');
      return;
    }
    try {
      const dosya_icerik = await readFileAsBase64(file);
      await thesisArchiveApi.submit({
        ...form,
        yil: parseInt(form.yil, 10),
        dosya_icerik,
        dosya_adi: file.name,
      });
      setMsg('Çalışmanız onay için gönderildi. Yayınlandığında arşivde görünecektir.');
      setModal(null);
      setForm({ ...emptyForm, bolum: user?.bolum || '' });
      setFile(null);
      setTab('yuklemelerim');
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleDownload = async (id) => {
    try {
      const { blob, filename } = await thesisArchiveApi.downloadBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (tab === 'arsiv') loadArchive();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const openDetail = async (id) => {
    try {
      const data = await thesisArchiveApi.get(id);
      setDetail(data);
      setModal('detail');
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Tez & Makale Arşivi">
      <p className="text-gray-400 mb-6">
        Üniversite tezleri, makaleler ve bitirme projelerini arayın. Kendi çalışmanızı yükleyerek onaya gönderebilirsiniz.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('gönderildi') || msg.includes('onay')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
          <button type="button" onClick={() => setMsg('')} className="ml-2 text-xs underline">Kapat</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'arsiv', label: 'Arşiv' },
          { id: 'yuklemelerim', label: 'Yüklemelerim' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
        <button type="button" onClick={() => setModal('upload')} className="btn-primary text-sm ml-auto">
          + Çalışma Yükle
        </button>
      </div>

      {tab === 'arsiv' && (
        <div className="card mb-6 space-y-3">
          <p className="text-sm text-purple-light font-medium">Filtrele</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="input text-sm" value={localFilters.bolum} onChange={(e) => setLocalFilters({ ...localFilters, bolum: e.target.value })}>
              <option value="">Bölüm</option>
              {filterOpts.bolumler.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="input text-sm" value={localFilters.danisman} onChange={(e) => setLocalFilters({ ...localFilters, danisman: e.target.value })}>
              <option value="">Danışman</option>
              {filterOpts.danismanlar.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="input text-sm" placeholder="Yazar" value={localFilters.yazar} onChange={(e) => setLocalFilters({ ...localFilters, yazar: e.target.value })} />
            <select className="input text-sm" value={localFilters.yil} onChange={(e) => setLocalFilters({ ...localFilters, yil: e.target.value })}>
              <option value="">Yıl</option>
              {filterOpts.yillar.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input text-sm" value={localFilters.tez_turu} onChange={(e) => setLocalFilters({ ...localFilters, tez_turu: e.target.value })}>
              <option value="">Tez türü</option>
              {filterOpts.tez_turleri.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
            </select>
            <select className="input text-sm" value={localFilters.konu_alani} onChange={(e) => setLocalFilters({ ...localFilters, konu_alani: e.target.value })}>
              <option value="">Konu alanı</option>
              {filterOpts.konu_alanlari.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="input text-sm" value={localFilters.kayit_turu} onChange={(e) => setLocalFilters({ ...localFilters, kayit_turu: e.target.value })}>
              <option value="">Kayıt türü</option>
              {filterOpts.kayit_turleri.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
            <input className="input text-sm" placeholder="Anahtar kelime" value={localFilters.anahtar_kelime} onChange={(e) => setLocalFilters({ ...localFilters, anahtar_kelime: e.target.value })} />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState message={tab === 'arsiv' ? 'Arşivde kayıt bulunamadı' : 'Henüz yükleme yapmadınız'} />
      ) : (
        <>
        <p className="text-xs text-gray-500 mb-3">{total} kayıt · Sayfa {page + 1}/{totalPages}</p>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card flex flex-wrap justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs text-purple-light">{item.kayit_turu_adi} · {item.tez_turu_adi}</span>
                  {tab === 'yuklemelerim' && <StatusBadge status={item.durum} />}
                </div>
                <h3 className="text-white font-semibold">{item.baslik}</h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.ozet}</p>
                <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>👤 {item.yazar_ad}</span>
                  <span>🏛 {item.bolum}</span>
                  <span>📋 {item.danisman}</span>
                  <span>📅 {item.yil}</span>
                  <span>🏷 {item.konu_alani}</span>
                </div>
                {item.anahtar_kelimeler && (
                  <p className="text-xs text-purple-light/70 mt-1">#{item.anahtar_kelimeler.replace(/,/g, ' #')}</p>
                )}
                {item.red_nedeni && item.durum === 'reddedildi' && (
                  <p className="text-xs text-red-400 mt-2">Red nedeni: {item.red_nedeni}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openDetail(item.id)} className="btn-secondary text-sm">Detay</button>
                {item.indirilebilir && (
                  <button type="button" onClick={() => handleDownload(item.id)} className="btn-primary text-sm">İndir</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm disabled:opacity-40">Önceki</button>
            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Sonraki</button>
          </div>
        )}
        </>
      )}

      <Modal open={modal === 'upload'} onClose={() => setModal(null)} title="Çalışma Yükle">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-gray-500">Yüklediğiniz çalışma admin veya kütüphaneci onayından sonra arşivde yayınlanır.</p>
          <div><label className="label">Başlık *</label><input className="input" value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} /></div>
          <div><label className="label">Özet</label><textarea className="input min-h-[80px]" value={form.ozet} onChange={(e) => setForm({ ...form, ozet: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kayıt türü</label>
              <select className="input" value={form.kayit_turu} onChange={(e) => setForm({ ...form, kayit_turu: e.target.value })}>
                {filterOpts.kayit_turleri.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tez türü</label>
              <select className="input" value={form.tez_turu} onChange={(e) => setForm({ ...form, tez_turu: e.target.value })}>
                {filterOpts.tez_turleri.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Bölüm</label><input className="input" value={form.bolum} onChange={(e) => setForm({ ...form, bolum: e.target.value })} /></div>
            <div><label className="label">Danışman *</label><input className="input" value={form.danisman} onChange={(e) => setForm({ ...form, danisman: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Yıl</label><input type="number" className="input" value={form.yil} onChange={(e) => setForm({ ...form, yil: e.target.value })} /></div>
            <div><label className="label">Konu alanı</label><input className="input" value={form.konu_alani} onChange={(e) => setForm({ ...form, konu_alani: e.target.value })} /></div>
          </div>
          <div><label className="label">Anahtar kelimeler (virgülle ayırın)</label><input className="input" placeholder="kütüphane, yapay zeka, IoT" value={form.anahtar_kelimeler} onChange={(e) => setForm({ ...form, anahtar_kelimeler: e.target.value })} /></div>
          <div>
            <label className="label">Dosya (PDF, DOC, DOCX, TXT — max 8 MB) *</label>
            <input type="file" accept=".pdf,.doc,.docx,.txt" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
          </div>
          <button type="button" onClick={handleSubmit} className="btn-primary w-full">Onaya Gönder</button>
        </div>
      </Modal>

      <Modal open={modal === 'detail'} onClose={() => { setModal(null); setDetail(null); }} title={detail?.baslik || 'Detay'}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detail.durum} />
              <span className="text-purple-light">{detail.kayit_turu_adi}</span>
              <span className="text-gray-500">{detail.tez_turu_adi}</span>
            </div>
            <p className="text-gray-300">{detail.ozet}</p>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-dark-700/50 border border-dark-600 text-xs">
              <div><span className="text-gray-500">Yazar:</span> {detail.yazar_ad}</div>
              <div><span className="text-gray-500">Bölüm:</span> {detail.bolum}</div>
              <div><span className="text-gray-500">Danışman:</span> {detail.danisman}</div>
              <div><span className="text-gray-500">Yıl:</span> {detail.yil}</div>
              <div><span className="text-gray-500">Konu:</span> {detail.konu_alani}</div>
              <div><span className="text-gray-500">İndirme:</span> {detail.indirme_sayisi}</div>
              {detail.onaylayan && <div className="col-span-2"><span className="text-gray-500">Onaylayan:</span> {detail.onaylayan}</div>}
            </div>
            {detail.indirilebilir && (
              <button type="button" onClick={() => handleDownload(detail.id)} className="btn-primary w-full">Dosyayı İndir</button>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
