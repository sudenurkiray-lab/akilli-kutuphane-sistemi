import { Modal } from './UI';

export default function BookQueueModal({ open, onClose, book, queue, onJoin, onCancel, loading }) {
  if (!book) return null;

  const myEntry = queue?.sira?.find((s) => s.benim);

  return (
    <Modal open={open} onClose={onClose} title={`Sıra: ${book.ad}`}>
      <p className="text-gray-400 text-sm mb-4">
        Kitap iade edildiğinde ilk sıradaki kullanıcıya bildirim gider.
        Almak için {queue?.alma_suresi_saat || 24} saatiniz olur.
      </p>

      {queue?.sira?.length > 0 ? (
        <ol className="space-y-2 mb-6">
          {queue.sira.map((person) => (
            <li
              key={person.id}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                person.benim ? 'border-purple-primary/40 bg-purple-primary/10' : 'border-dark-600 bg-dark-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-sm font-bold text-purple-light">
                  {person.sira_no}
                </span>
                <div>
                  <p className="text-white font-medium">
                    {person.benim ? 'Siz' : person.ad}
                    {person.durum === 'hazir' && <span className="text-green-400 text-xs ml-2">• Almaya hazır</span>}
                  </p>
                  {person.durum === 'hazir' && person.kalan_saat != null && (
                    <p className="text-xs text-yellow-400">{person.kalan_saat} saat kaldı</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-gray-500 text-sm mb-6 text-center py-4">Henüz sırada kimse yok</p>
      )}

      <div className="flex gap-2">
        {!myEntry && (
          <button type="button" onClick={onJoin} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Ekleniyor...' : 'Sıraya Gir'}
          </button>
        )}
        {myEntry && (
          <button type="button" onClick={() => onCancel(myEntry.id)} className="btn-secondary flex-1">
            Sıradan Çık
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-secondary">Kapat</button>
      </div>
    </Modal>
  );
}
