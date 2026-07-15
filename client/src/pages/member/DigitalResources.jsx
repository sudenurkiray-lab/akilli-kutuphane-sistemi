import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge, EmptyState } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { digitalResourcesApi } from '../../api';

const TUR_RENK = {
  e_kitap: 'border-blue-500/30 bg-blue-500/5',
  makale: 'border-cyan-500/30 bg-cyan-500/5',
  tez: 'border-indigo-500/30 bg-indigo-500/5',
  dergi: 'border-pink-500/30 bg-pink-500/5',
  sesli_kitap: 'border-green-500/30 bg-green-500/5',
  video_egitim: 'border-yellow-500/30 bg-yellow-500/5',
  akademik_veritabani: 'border-purple-500/30 bg-purple-500/5',
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

export default function MemberDigitalResources() {
  const [resources, setResources] = useState([]);
  const [types, setTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [tur, setTur] = useState('');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (tur) params.tur = tur;
    digitalResourcesApi.list(params).then(setResources).catch((e) => setMsg(e.message));
  };

  useEffect(() => {
    digitalResourcesApi.types().then(setTypes).catch(console.error);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, tur]);

  const handleView = async (resource) => {
    if (!resource.erisebilir) {
      setMsg(resource.erisim_engel_nedeni || 'Bu kaynağa erişim yetkiniz yok');
      return;
    }

    // await sonrası window.open pop-up engeline takılır; harici kaynaklarda önce boş sekme aç
    const isExternal = resource.harici_baglanti
      || resource.tur === 'akademik_veritabani'
      || resource.dosya_turu === 'url';
    const newTab = isExternal ? window.open('about:blank', '_blank') : null;

    setLoading(true);
    setMsg('');
    try {
      const result = await digitalResourcesApi.view(resource.id);

      if (result.harici && result.erisim_url) {
        if (newTab) {
          newTab.location.replace(result.erisim_url);
        } else {
          const opened = window.open(result.erisim_url, '_blank', 'noopener,noreferrer');
          if (!opened) {
            window.location.assign(result.erisim_url);
          }
        }
      } else if (result.erisim_url) {
        if (newTab) newTab.close();
        const token = localStorage.getItem('token');
        const res = await fetch(result.erisim_url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Dosya açılamadı');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const fileTab = window.open(url, '_blank');
        if (!fileTab) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else if (newTab) {
        newTab.close();
        setMsg('Bu kaynak için erişim adresi tanımlı değil');
      }

      load();
      if (detail?.id === resource.id) {
        const updated = await digitalResourcesApi.get(resource.id);
        setDetail(updated);
      }
    } catch (e) {
      if (newTab) newTab.close();
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resource) => {
    if (!resource.indirebilir) {
      setMsg(resource.erisim_engel_nedeni || 'İndirme yetkiniz yok');
      return;
    }
    setLoading(true);
    try {
      const { blob, filename } = await digitalResourcesApi.downloadBlob(resource.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const data = await digitalResourcesApi.get(id);
      setDetail(data);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Dijital Kaynaklar">
      <p className="text-gray-400 mb-6">
        E-kitap, makale, tez, dergi, sesli kitap, video eğitim ve akademik veri tabanlarına erişin.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('kayıt') || msg.includes('başarı')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
          <button type="button" onClick={() => setMsg('')} className="ml-2 text-xs underline">Kapat</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input flex-1"
          placeholder="Başlık, yazar veya ISBN/DOI ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:w-48" value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="">Tüm türler</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
      </div>

      {resources.length === 0 ? (
        <EmptyState message="Dijital kaynak bulunamadı" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map((r) => {
            const renk = TUR_RENK[r.tur] || 'border-dark-600';
            return (
              <div key={r.id} className={`card border ${renk}`}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="text-xs text-purple-light">{TUR_ICON[r.tur]} {r.tur_adi}</span>
                    <h3 className="text-lg font-semibold text-white mt-1">{r.baslik}</h3>
                    {r.yazar && <p className="text-sm text-gray-400">{r.yazar}</p>}
                  </div>
                  {!r.erisebilir && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Kısıtlı</span>
                  )}
                </div>

                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{r.aciklama}</p>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p>📁 {r.dosya_turu?.toUpperCase()} · {r.dosya_boyutu_okunur}</p>
                  <p>🔐 {r.erisim_yetkisi_adi} · {r.indirme_izni ? 'İndirilebilir' : 'Yalnızca görüntüleme'}</p>
                  <p>📜 {r.yayin_lisansi_adi}</p>
                  {r.son_erisim_tarihi && (
                    <p className="text-yellow-500/80">Lisans bitiş: {r.son_erisim_tarihi}</p>
                  )}
                  {r.son_kullanici_erisim && (
                    <p className="text-purple-light/70">
                      Son erişiminiz: {new Date(r.son_kullanici_erisim).toLocaleString('tr-TR')}
                    </p>
                  )}
                  <p className="text-gray-600">👁 {r.goruntulenme_sayisi} görüntüleme · ⬇ {r.indirme_sayisi} indirme</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openDetail(r.id)} className="btn-secondary text-sm flex-1">
                    Detay
                  </button>
                  {r.erisebilir && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleView(r)}
                      className="btn-primary text-sm flex-1"
                    >
                      {r.tur === 'akademik_veritabani' ? 'Veri Tabanına Git' : 'Görüntüle'}
                    </button>
                  )}
                  {r.indirebilir && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDownload(r)}
                      className="btn-secondary text-sm"
                    >
                      İndir
                    </button>
                  )}
                </div>
                {!r.erisebilir && r.erisim_engel_nedeni && (
                  <p className="text-xs text-red-400 mt-2 text-center">{r.erisim_engel_nedeni}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.baslik || 'Kaynak Detayı'}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.durum} />
              <span className="text-purple-light">{detail.tur_adi}</span>
            </div>
            {detail.yazar && <p><span className="text-gray-500">Yazar:</span> {detail.yazar}</p>}
            {detail.yayinevi && <p><span className="text-gray-500">Yayınevi:</span> {detail.yayinevi} ({detail.yayin_yili})</p>}
            {detail.isbn_doi && <p><span className="text-gray-500">ISBN/DOI:</span> {detail.isbn_doi}</p>}
            <p className="text-gray-300">{detail.aciklama}</p>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-dark-700/50 border border-dark-600">
              <div><p className="text-gray-500 text-xs">Dosya türü</p><p className="text-white">{detail.dosya_turu?.toUpperCase()}</p></div>
              <div><p className="text-gray-500 text-xs">Dosya boyutu</p><p className="text-white">{detail.dosya_boyutu_okunur}</p></div>
              <div><p className="text-gray-500 text-xs">Erişim yetkisi</p><p className="text-white">{detail.erisim_yetkisi_adi}</p></div>
              <div><p className="text-gray-500 text-xs">Yayın lisansı</p><p className="text-white">{detail.yayin_lisansi_adi}</p></div>
              <div><p className="text-gray-500 text-xs">İndirme sayısı</p><p className="text-white">{detail.indirme_sayisi}</p></div>
              <div><p className="text-gray-500 text-xs">Görüntülenme</p><p className="text-white">{detail.goruntulenme_sayisi}</p></div>
              {detail.son_erisim_tarihi && (
                <div className="col-span-2"><p className="text-gray-500 text-xs">Lisans son erişim tarihi</p><p className="text-yellow-400">{detail.son_erisim_tarihi}</p></div>
              )}
              {detail.son_kullanici_erisim && (
                <div className="col-span-2"><p className="text-gray-500 text-xs">Sizin son erişiminiz</p><p className="text-purple-light">{new Date(detail.son_kullanici_erisim).toLocaleString('tr-TR')}</p></div>
              )}
            </div>

            <div className="flex gap-2">
              {detail.erisebilir && (
                <button type="button" onClick={() => handleView(detail)} className="btn-primary flex-1 text-sm">
                  {detail.tur === 'akademik_veritabani' ? 'Veri Tabanına Git' : 'Görüntüle'}
                </button>
              )}
              {detail.indirebilir && (
                <button type="button" onClick={() => handleDownload(detail)} className="btn-secondary flex-1 text-sm">
                  İndir
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
