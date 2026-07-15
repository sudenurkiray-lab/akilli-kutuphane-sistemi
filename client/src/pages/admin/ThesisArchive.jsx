import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, StatusBadge, EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { thesisArchiveApi } from '../../api';

export default function AdminThesisArchive() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [published, setPublished] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');

  const loadPending = () => thesisArchiveApi.pending().then(setPending).catch((e) => setMsg(e.message));
  const loadPublished = () => thesisArchiveApi.list({ durum: 'yayinda', limit: 100, offset: 0 })
    .then((res) => setPublished(res.items))
    .catch((e) => setMsg(e.message));

  useEffect(() => {
    loadPending();
    loadPublished();
  }, []);

  const handleApprove = async (id) => {
    try {
      await thesisArchiveApi.approve(id);
      setMsg('Kayıt yayına alındı');
      setModal(null);
      loadPending();
      loadPublished();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      await thesisArchiveApi.reject(selected.id, rejectReason);
      setMsg('Kayıt reddedildi');
      setModal(null);
      setRejectReason('');
      loadPending();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const openReview = (item) => {
    setSelected(item);
    setModal('review');
  };

  const list = tab === 'pending' ? pending : published;

  return (
    <Layout navItems={nav} title="Tez & Makale Arşivi Yönetimi">
      <p className="text-gray-400 mb-6">
        Öğrenci yüklemelerini inceleyin, onaylayın veya reddedin. Onaylanan kayıtlar arşivde yayınlanır.
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Onay Bekleyen ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('published')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'published' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Yayında (ilk 100 / {published.length}+)
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState message={tab === 'pending' ? 'Onay bekleyen kayıt yok' : 'Yayında kayıt yok'} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Yazar / Bölüm</th>
                <th>Tür</th>
                <th>Danışman</th>
                <th>Yıl</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="text-white font-medium">{item.baslik}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{item.konu_alani}</p>
                  </td>
                  <td className="text-sm">
                    {item.yazar_ad}<br />
                    <span className="text-gray-500">{item.bolum}</span>
                  </td>
                  <td className="text-xs text-purple-light">
                    {item.kayit_turu_adi}<br />{item.tez_turu_adi}
                  </td>
                  <td className="text-sm">{item.danisman}</td>
                  <td>{item.yil}</td>
                  <td><StatusBadge status={item.durum} /></td>
                  <td className="whitespace-nowrap space-x-2">
                    <button type="button" onClick={() => openReview(item)} className="text-purple-light text-sm hover:underline">İncele</button>
                    {tab === 'pending' && (
                      <>
                        <button type="button" onClick={() => handleApprove(item.id)} className="text-green-400 text-sm hover:underline">Onayla</button>
                        <button type="button" onClick={() => { setSelected(item); setModal('reject'); }} className="text-red-400 text-sm hover:underline">Reddet</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title={selected?.baslik || 'İnceleme'}>
        {selected && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-300">{selected.ozet}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Yazar:</span> {selected.yazar_ad}</div>
              <div><span className="text-gray-500">Bölüm:</span> {selected.bolum}</div>
              <div><span className="text-gray-500">Danışman:</span> {selected.danisman}</div>
              <div><span className="text-gray-500">Yıl:</span> {selected.yil}</div>
              <div className="col-span-2"><span className="text-gray-500">Anahtar kelimeler:</span> {selected.anahtar_kelimeler}</div>
              <div><span className="text-gray-500">Dosya:</span> {selected.dosya_turu?.toUpperCase()} · {selected.dosya_boyutu_okunur}</div>
            </div>
            {selected.durum === 'beklemede' && (
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => handleApprove(selected.id)} className="btn-primary flex-1">Yayınla</button>
                <button type="button" onClick={() => { setModal('reject'); }} className="btn-secondary flex-1">Reddet</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Reddetme Nedeni">
        <div className="space-y-3">
          <textarea
            className="input min-h-[100px]"
            placeholder="Öğrenciye gösterilecek red nedeni..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button type="button" onClick={handleReject} className="btn-primary w-full">Reddet</button>
        </div>
      </Modal>
    </Layout>
  );
}
