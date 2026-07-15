import { useEffect, useState } from 'react';
import { Modal } from './UI';
import { readingListsApi } from '../api';

export default function AddToListModal({ open, onClose, book }) {
  const [lists, setLists] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (open) {
      readingListsApi.mine().then(setLists).catch((e) => setMsg(e.message));
      setMsg('');
    }
  }, [open]);

  const handleAdd = async (listId) => {
    if (!book?.id) return;
    try {
      await readingListsApi.addBook(listId, book.id);
      setMsg('Listeye eklendi');
      setTimeout(onClose, 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Listeye Ekle — ${book?.ad || ''}`}>
      {lists.length === 0 ? (
        <p className="text-sm text-gray-500">Henüz listeniz yok. Okuma Listelerim sayfasından oluşturun.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => handleAdd(l.id)}
              className="w-full text-left p-3 rounded-lg bg-dark-700/50 border border-dark-600 hover:border-purple-primary/40"
            >
              <p className="text-white text-sm font-medium">{l.ad}</p>
              <p className="text-xs text-gray-500">{l.kitap_sayisi} kitap · {l.gizlilik_adi}</p>
            </button>
          ))}
        </div>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.includes('eklendi') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
    </Modal>
  );
}
