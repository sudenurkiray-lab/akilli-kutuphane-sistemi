import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Modal, EmptyState } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { readingListsApi, booksApi } from '../../api';

const emptyForm = { ad: '', aciklama: '', gizlilik: 'ozel' };

export default function MemberReadingLists() {
  const [tab, setTab] = useState('mine');
  const [lists, setLists] = useState([]);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [bookSearch, setBookSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [msg, setMsg] = useState('');

  const loadLists = () => {
    const fn = tab === 'public' ? readingListsApi.public : readingListsApi.mine;
    fn().then(setLists).catch((e) => setMsg(e.message));
  };

  useEffect(() => { loadLists(); }, [tab]);

  const openDetail = async (id) => {
    try {
      const data = await readingListsApi.get(id);
      setDetail(data);
      setModal('detail');
    } catch (e) {
      setMsg(e.message);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setModal('form');
  };

  const openEdit = (list) => {
    setForm({ id: list.id, ad: list.ad, aciklama: list.aciklama || '', gizlilik: list.gizlilik });
    setModal('form');
  };

  const handleSave = async () => {
    if (!form.ad.trim()) {
      setMsg('Liste adı gerekli');
      return;
    }
    try {
      if (form.id) {
        await readingListsApi.update(form.id, form);
        setMsg('Liste güncellendi');
      } else {
        await readingListsApi.create(form);
        setMsg('Liste oluşturuldu');
      }
      setModal(null);
      loadLists();
      if (detail?.liste?.id === form.id) {
        const updated = await readingListsApi.get(form.id);
        setDetail(updated);
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu listeyi silmek istiyor musunuz?')) return;
    try {
      await readingListsApi.remove(id);
      setModal(null);
      setDetail(null);
      loadLists();
      setMsg('Liste silindi');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const searchBooks = async (q) => {
    setBookSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const books = await booksApi.list({ search: q });
      setSearchResults(books.slice(0, 8));
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddBook = async (bookId) => {
    if (!detail?.liste?.id) return;
    try {
      await readingListsApi.addBook(detail.liste.id, bookId);
      const updated = await readingListsApi.get(detail.liste.id);
      setDetail(updated);
      setBookSearch('');
      setSearchResults([]);
      loadLists();
      setMsg('Kitap eklendi');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleRemoveBook = async (bookId) => {
    if (!detail?.liste?.id) return;
    try {
      await readingListsApi.removeBook(detail.liste.id, bookId);
      const updated = await readingListsApi.get(detail.liste.id);
      setDetail(updated);
      loadLists();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Okuma Listelerim">
      <p className="text-gray-400 mb-6">
        Kendi kitap listelerinizi oluşturun. Listeler özel veya herkese açık olabilir.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('oluşturuldu') || msg.includes('güncellendi') || msg.includes('eklendi')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
          <button type="button" onClick={() => setMsg('')} className="ml-2 text-xs underline">Kapat</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'mine' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Listelerim
        </button>
        <button
          type="button"
          onClick={() => setTab('public')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'public' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Herkese Açık Listeler
        </button>
        {tab === 'mine' && (
          <button type="button" onClick={openCreate} className="btn-primary text-sm ml-auto">
            + Yeni Liste
          </button>
        )}
      </div>

      {lists.length === 0 ? (
        <EmptyState message={tab === 'mine' ? 'Henüz liste oluşturmadınız' : 'Herkese açık liste yok'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <div
              key={list.id}
              className="card border border-dark-600 hover:border-purple-primary/40 cursor-pointer transition-colors"
              onClick={() => openDetail(list.id)}
              onKeyDown={(e) => e.key === 'Enter' && openDetail(list.id)}
              role="button"
              tabIndex={0}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-semibold">📚 {list.ad}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${list.gizlilik === 'herkese_acik' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                  {list.gizlilik_adi}
                </span>
              </div>
              {list.aciklama && <p className="text-sm text-gray-400 mb-2 line-clamp-2">{list.aciklama}</p>}
              <div className="text-xs text-gray-500 flex justify-between">
                <span>{list.kitap_sayisi} kitap</span>
                {tab === 'public' && <span>{list.sahip_ad}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={form.id ? 'Listeyi Düzenle' : 'Yeni Okuma Listesi'}>
        <div className="space-y-3">
          <div>
            <label className="label">Liste adı</label>
            <input className="input" placeholder="Örn: Yazın okuyacaklarım" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          </div>
          <div>
            <label className="label">Açıklama</label>
            <textarea className="input min-h-[60px]" value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} />
          </div>
          <div>
            <label className="label">Gizlilik</label>
            <select className="input" value={form.gizlilik} onChange={(e) => setForm({ ...form, gizlilik: e.target.value })}>
              <option value="ozel">Özel — yalnızca siz görürsünüz</option>
              <option value="herkese_acik">Herkese açık — diğer üyeler görebilir</option>
            </select>
          </div>
          <button type="button" onClick={handleSave} className="btn-primary w-full">Kaydet</button>
        </div>
      </Modal>

      <Modal open={modal === 'detail'} onClose={() => { setModal(null); setDetail(null); }} title={detail?.liste?.ad || 'Liste'}>
        {detail && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${detail.liste.gizlilik === 'herkese_acik' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                {detail.liste.gizlilik_adi}
              </span>
              <span className="text-gray-500">{detail.liste.kitap_sayisi} kitap</span>
              {!detail.liste.benim_listem && (
                <span className="text-purple-light">Liste sahibi: {detail.liste.sahip_ad}</span>
              )}
            </div>
            {detail.liste.aciklama && <p className="text-sm text-gray-400">{detail.liste.aciklama}</p>}

            {detail.liste.benim_listem && (
              <div className="space-y-2 p-3 rounded-lg bg-dark-800 border border-dark-600">
                <p className="text-sm text-purple-light">Kitap ekle</p>
                <input
                  className="input text-sm"
                  placeholder="Kitap adı veya yazar ara..."
                  value={bookSearch}
                  onChange={(e) => searchBooks(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleAddBook(b.id)}
                        className="w-full text-left p-2 rounded hover:bg-dark-700 text-sm"
                      >
                        <span className="text-white">{b.ad}</span>
                        <span className="text-gray-500"> — {b.yazar}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detail.kitaplar.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Listede henüz kitap yok</p>
            ) : (
              <div className="space-y-2">
                {detail.kitaplar.map((item, idx) => (
                  <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-dark-700/50 border border-dark-600">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {idx + 1}. {item.kitap?.ad}
                      </p>
                      <p className="text-xs text-gray-500">{item.kitap?.yazar}</p>
                    </div>
                    {detail.liste.benim_listem && (
                      <button type="button" onClick={() => handleRemoveBook(item.book_id)} className="text-red-400 text-xs hover:underline">
                        Çıkar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detail.liste.benim_listem && (
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => openEdit(detail.liste)} className="btn-secondary flex-1 text-sm">Düzenle</button>
                <button type="button" onClick={() => handleDelete(detail.liste.id)} className="btn-secondary flex-1 text-sm text-red-400">Sil</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
