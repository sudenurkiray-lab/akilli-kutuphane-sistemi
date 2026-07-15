import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { shelfApi, booksApi } from '../../api';
import { librarianNav } from '../../constants/librarianNav';

export default function LibrarianShelf() {
  const [shelves, setShelves] = useState([]);
  const [books, setBooks] = useState([]);
  const [moveBook, setMoveBook] = useState(null);
  const [newRaf, setNewRaf] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    shelfApi.list().then(setShelves).catch(console.error);
    booksApi.list().then(setBooks).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const handleMove = async () => {
    try {
      await shelfApi.move(moveBook.id, newRaf);
      setMsg(`${moveBook.ad} → Raf ${newRaf}`);
      setMoveBook(null);
      setNewRaf('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={librarianNav} titleKey="nav.librarian.shelf">
      {msg && <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {shelves.map((s) => (
          <div key={s.raf_no} className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-purple-light">Raf {s.raf_no}</h3>
              <span className="badge-info">{s.kitap_sayisi} tür / {s.toplam_stok} adet</span>
            </div>
            <p className="text-sm text-gray-400 line-clamp-3">{s.kitaplar}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Kitap Taşıma</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Kitap</th>
                <th>Yazar</th>
                <th>Mevcut Raf</th>
                <th>Stok</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td className="text-white font-medium">{b.ad}</td>
                  <td>{b.yazar}</td>
                  <td>{b.raf_no || '-'}</td>
                  <td>{b.stok}</td>
                  <td>
                    {moveBook?.id === b.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input !py-1 !px-2 w-24 text-sm"
                          placeholder="Raf no"
                          value={newRaf}
                          onChange={(e) => setNewRaf(e.target.value)}
                        />
                        <button onClick={handleMove} className="text-green-400 text-sm">Taşı</button>
                        <button onClick={() => setMoveBook(null)} className="text-gray-400 text-sm">İptal</button>
                      </div>
                    ) : (
                      <button onClick={() => { setMoveBook(b); setNewRaf(b.raf_no || ''); }} className="text-purple-light text-sm">
                        Taşı
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
