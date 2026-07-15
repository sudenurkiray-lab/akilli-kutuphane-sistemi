import { useState, useEffect } from 'react';
import { Modal } from './UI';
import TransferTimeline from './TransferTimeline';

import { useAuth } from '../context/AuthContext';

export default function TransferModal({ open, onClose, book, branches = [], onCreate, onCancel, loading }) {
  const { user } = useAuth();
  const transfer = book?.benim_transferim;
  const tercihId = user?.tercih_sube?.id;
  const musaitSubeler = (book?.subeler || []).filter(
    (s) => s.musait_kopya > 0 && Number(s.id) !== Number(tercihId),
  );
  const [kaynak, setKaynak] = useState('');

  useEffect(() => {
    if (open) {
      setKaynak(musaitSubeler[0]?.id ? String(musaitSubeler[0].id) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book?.id]);

  const handleSubmit = () => {
    if (!kaynak || !tercihId) return;
    onCreate({
      book_id: book.id,
      kaynak_sube_id: parseInt(kaynak, 10),
      hedef_sube_id: tercihId,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Şube Transferi — ${book?.ad || ''}`}>
      {transfer ? (
        <div>
          <div className="mb-4 text-sm text-gray-400">
            <p><span className="text-gray-500">Kaynak:</span> {transfer.kaynak_sube_adi}</p>
            <p><span className="text-gray-500">Hedef:</span> {transfer.hedef_sube_adi}</p>
          </div>
          <TransferTimeline transfer={transfer} />
          {transfer.iptal_edilebilir_uye && (
            <button
              type="button"
              onClick={() => onCancel(transfer.id)}
              disabled={loading}
              className="btn-secondary w-full mt-4 text-sm"
            >
              Transferi İptal Et
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Kitabın bulunduğu şubeden <strong className="text-purple-light">{user?.tercih_sube?.ad || 'teslim şubenize'}</strong> transfer talebi oluşturun.
            Süreci “İşlemlerim” sayfasından takip edebilirsiniz.
          </p>

          {!tercihId ? (
            <p className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
              Önce İşlemlerim sayfasından teslim şubenizi seçin.
            </p>
          ) : musaitSubeler.length === 0 ? (
            <p className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
              Şu an hiçbir şubede transfer edilebilir müsait kopya yok.
            </p>
          ) : (
            <>
              <div>
                <label className="label">Kaynak Şube (kitabın bulunduğu)</label>
                <select className="input" value={kaynak} onChange={(e) => setKaynak(e.target.value)}>
                  {musaitSubeler.map((s) => (
                    <option key={s.id} value={s.id}>{s.ad} ({s.musait_kopya} müsait)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Teslim Noktası (hedef şube)</label>
                <input className="input bg-dark-700" value={user.tercih_sube.ad} readOnly />
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !kaynak || !tercihId}
                className="btn-primary w-full disabled:opacity-40"
              >
                Transfer Talebi Oluştur
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
