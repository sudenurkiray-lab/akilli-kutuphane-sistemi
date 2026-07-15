import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge } from '../../components/UI';
import SystemRulesCard from '../../components/SystemRulesCard';
import BookQueueModal from '../../components/BookQueueModal';
import BookReviewsModal from '../../components/BookReviewsModal';
import AddToListModal from '../../components/AddToListModal';
import TransferModal from '../../components/TransferModal';
import { memberNav } from '../../constants/memberNav';
import { booksApi, loansApi, favoritesApi, ratingsApi, reservationsApi, branchesApi, transfersApi } from '../../api';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LocaleContext';

function isBookAvailable(book) {
  return book.musait ?? (book.stok > 0 && book.durum === 'mevcut');
}

function canRequestTransfer(book, tercihSubeId) {
  if (book.benim_transferim) return true;
  if (!tercihSubeId) return false;
  const atPreferred = book.subeler?.find((s) => s.id === tercihSubeId)?.musait_kopya > 0;
  if (atPreferred) return false;
  return book.subeler?.some((s) => s.id !== tercihSubeId && s.musait_kopya > 0);
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-sm ${star <= value ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-300'}`}
          title={`${star} yıldız`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function MemberBooks() {
  const { user } = useAuth();
  const t = useT();
  const tercihSubeId = user?.tercih_sube?.id;
  const [books, setBooks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [kategori, setKategori] = useState('');
  const [branchId, setBranchId] = useState('');
  const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1);
  const [queueBook, setQueueBook] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [transferBook, setTransferBook] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [reviewsBook, setReviewsBook] = useState(null);
  const [listBook, setListBook] = useState(null);
  const PAGE_SIZE = 12;
  const viewedRef = useRef(new Set());

  useEffect(() => {
    booksApi.categories().then(setCategories).catch(console.error);
    branchesApi.list().then(setBranches).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (kategori) params.kategori = kategori;
    if (branchId) params.branch_id = branchId;
    booksApi.list(params).then(setBooks).catch(console.error);
  }, [debouncedSearch, kategori, branchId]);

  const totalPages = Math.ceil(books.length / PAGE_SIZE);
  const pagedBooks = books.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reloadBooks = () => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (kategori) params.kategori = kategori;
    if (branchId) params.branch_id = branchId;
    return booksApi.list(params).then((data) => {
      setBooks(data);
      return data;
    });
  };

  const updateBookLocal = (bookId, patch) => {
    setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, ...patch } : b)));
  };

  const handleView = (bookId) => {
    if (viewedRef.current.has(bookId)) return;
    viewedRef.current.add(bookId);
    booksApi.view(bookId).catch(() => {});
  };

  const handleBorrow = async (bookId) => {
    handleView(bookId);
    try {
      const result = await loansApi.create({ book_id: bookId });
      setMsg(`Kitap ödünç alındı! Teslim tarihi: ${new Date(result.teslim_tarihi).toLocaleDateString('tr-TR')}`);
      await reloadBooks();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const openQueue = async (book) => {
    setQueueBook(book);
    try {
      const data = await reservationsApi.queue(book.id);
      setQueueData(data);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const closeQueue = () => {
    setQueueBook(null);
    setQueueData(null);
  };

  const handleJoinQueue = async () => {
    if (!queueBook) return;
    setQueueLoading(true);
    try {
      const result = await reservationsApi.create(queueBook.id);
      setMsg(result.message || 'Sıraya eklendiniz');
      await reloadBooks();
      const data = await reservationsApi.queue(queueBook.id);
      setQueueData(data);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleCancelQueue = async (id) => {
    try {
      await reservationsApi.cancel(id);
      setMsg('Sıradan çıktınız');
      await reloadBooks();
      if (queueBook) {
        const data = await reservationsApi.queue(queueBook.id);
        setQueueData(data);
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleFavorite = async (book) => {
    handleView(book.id);
    try {
      if (book.favori) {
        await favoritesApi.remove(book.id);
        updateBookLocal(book.id, { favori: false, favori_sayisi: Math.max(0, (book.favori_sayisi || 1) - 1) });
      } else {
        await favoritesApi.add(book.id);
        updateBookLocal(book.id, { favori: true, favori_sayisi: (book.favori_sayisi || 0) + 1 });
      }
    } catch (e) {
      setMsg(e.message);
    }
  };

  const openTransfer = (book) => setTransferBook(book);
  const closeTransfer = () => setTransferBook(null);

  const syncTransferBook = async () => {
    const fresh = await reloadBooks();
    if (fresh && transferBook) {
      const updated = fresh.find((b) => b.id === transferBook.id);
      if (updated) setTransferBook(updated);
    }
  };

  const handleCreateTransfer = async (payload) => {
    setTransferLoading(true);
    try {
      const result = await transfersApi.create(payload);
      setMsg(result.message || 'Transfer talebi oluşturuldu');
      await syncTransferBook();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCancelTransfer = async (id) => {
    setTransferLoading(true);
    try {
      await transfersApi.cancel(id);
      setMsg('Transfer iptal edildi');
      await syncTransferBook();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleRate = async (bookId, puan) => {
    handleView(bookId);
    try {
      const result = await ratingsApi.set(bookId, puan);
      updateBookLocal(bookId, {
        kullanici_puani: puan,
        ortalama_puan: result.ortalama_puan,
        puan_sayisi: result.puan_sayisi,
      });
    } catch (e) {
      setMsg(e.message);
    }
  };

  const refreshBookStats = async (bookId) => {
    const data = await reloadBooks();
    const updated = data?.find((b) => b.id === bookId);
    if (updated) {
      setReviewsBook(updated);
      updateBookLocal(bookId, {
        yorum_sayisi: updated.yorum_sayisi,
        ortalama_puan: updated.ortalama_puan,
        puan_sayisi: updated.puan_sayisi,
      });
    }
  };

  return (
    <Layout navItems={memberNav} titleKey="titles.memberBooks">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('alındı')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          className="input max-w-sm"
          placeholder={t('books.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={kategori} onChange={(e) => setKategori(e.target.value)}>
          <option value="">{t('books.filterAll')} ({categories.length})</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{books.length}</span>
      </div>

      <div className="mb-6">
        <SystemRulesCard compact />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedBooks.map((b) => {
          const musait = isBookAvailable(b);
          const siram = b.benim_siram;
          const hazir = siram?.durum === 'hazir';
          const sirada = siram?.durum === 'beklemede';
          return (
            <div
              key={b.id}
              className="card hover:border-purple-primary/40 transition-colors"
              onMouseEnter={() => handleView(b.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="pr-2 min-w-0">
                  <h3 className="font-semibold text-white text-lg leading-tight">{b.ad}</h3>
                  {!!b.bagis && (
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Bağış Kitap
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleFavorite(b)}
                    className={`text-lg ${b.favori ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`}
                    title={b.favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                  >
                    {b.favori ? '♥' : '♡'}
                  </button>
                  <StatusBadge status={b.durum} />
                </div>
              </div>
              <p className="text-purple-light text-sm mb-1">{b.yazar}</p>
              <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                <p>Kategori: {b.kategori}</p>
                <p>ISBN: {b.isbn}</p>
                <p>Raf: {b.raf_no} | Stok: {b.stok}</p>
                {b.subeler?.length > 0 && (
                  <p className="text-purple-light/90">
                    Şubeler:{' '}
                    {b.subeler.map((s, i) => (
                      <span key={s.id}>
                        {s.ad}
                        {s.musait_kopya > 0 ? ` (${s.musait_kopya} müsait)` : ''}
                        {i < b.subeler.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </p>
                )}
                {b.oda_adi && <p className="text-purple-light/80">Konum: {b.oda_adi}</p>}
                {b.sira_sayisi > 0 && (
                  <p className="text-yellow-400/90">Sırada {b.sira_sayisi} kişi</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                <span className="text-yellow-400/90" title="Ortalama puan">
                  ★ {b.ortalama_puan ?? '—'}{b.puan_sayisi ? ` (${b.puan_sayisi})` : ''}
                </span>
                <span title="Yorum sayısı">💬 {b.yorum_sayisi || 0}</span>
                <span title="Okuma sayısı">👁 {b.goruntulenme_sayisi || 0}</span>
                <span title="Favori sayısı">♥ {b.favori_sayisi || 0}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <StarRating value={b.kullanici_puani || 0} onChange={(puan) => handleRate(b.id, puan)} />
                <button
                  type="button"
                  onClick={() => { handleView(b.id); setReviewsBook(b); }}
                  className="text-xs text-purple-light hover:underline"
                >
                  Yorumlar ({b.yorum_sayisi || 0})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setListBook(b)}
                className="text-xs text-gray-500 hover:text-purple-light mb-3 block"
              >
                + Okuma listesine ekle
              </button>
              {hazir ? (
                <button onClick={() => handleBorrow(b.id)} className="btn-primary w-full text-sm">
                  Kitabı Al ({siram.kalan_saat} saat kaldı)
                </button>
              ) : musait ? (
                <button onClick={() => handleBorrow(b.id)} className="btn-primary w-full text-sm">
                  Ödünç Al
                </button>
              ) : sirada ? (
                <div className="space-y-2">
                  <p className="text-sm text-yellow-400 text-center">{siram.sira_no}. sıradasınız</p>
                  <button type="button" onClick={() => openQueue(b)} className="btn-secondary w-full text-sm">
                    Sırayı Gör
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button type="button" onClick={() => openQueue(b)} className="btn-primary w-full text-sm">
                    Sıraya Gir
                  </button>
                  {b.sira_sayisi > 0 && (
                    <button type="button" onClick={() => openQueue(b)} className="btn-secondary w-full text-sm">
                      Sırayı Gör ({b.sira_sayisi})
                    </button>
                  )}
                </div>
              )}

              {b.benim_transferim ? (
                <button
                  type="button"
                  onClick={() => openTransfer(b)}
                  className="mt-2 w-full text-xs text-purple-light hover:text-purple-glow border border-purple-primary/30 rounded-lg py-1.5"
                >
                  Transfer: {b.benim_transferim.aktif_adim_label} →
                </button>
              ) : (canRequestTransfer(b, tercihSubeId) && (
                <button
                  type="button"
                  onClick={() => openTransfer(b)}
                  className="mt-2 w-full text-xs text-gray-400 hover:text-purple-light border border-dark-600 hover:border-purple-primary/30 rounded-lg py-1.5"
                >
                  {tercihSubeId ? 'Kendi Şubeme İstet' : 'Başka Şubeden İstet'}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {books.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Kitap bulunamadı</p>
      ) : totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-secondary text-sm disabled:opacity-40">Önceki</button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="btn-secondary text-sm disabled:opacity-40">Sonraki</button>
        </div>
      )}

      <BookQueueModal
        open={!!queueBook}
        onClose={closeQueue}
        book={queueBook}
        queue={queueData}
        onJoin={handleJoinQueue}
        onCancel={handleCancelQueue}
        loading={queueLoading}
      />

      <TransferModal
        open={!!transferBook}
        onClose={closeTransfer}
        book={transferBook}
        branches={branches}
        onCreate={handleCreateTransfer}
        onCancel={handleCancelTransfer}
        loading={transferLoading}
      />

      <BookReviewsModal
        open={!!reviewsBook}
        onClose={() => setReviewsBook(null)}
        book={reviewsBook}
        userRating={reviewsBook?.kullanici_puani}
        onRatingChange={(puan, result) => {
          if (reviewsBook) {
            updateBookLocal(reviewsBook.id, {
              kullanici_puani: puan,
              ortalama_puan: result?.ortalama_puan,
              puan_sayisi: result?.puan_sayisi,
            });
            setReviewsBook((prev) => prev && {
              ...prev,
              kullanici_puani: puan,
              ortalama_puan: result?.ortalama_puan,
              puan_sayisi: result?.puan_sayisi,
            });
          }
        }}
        onStatsChange={() => reviewsBook && refreshBookStats(reviewsBook.id)}
      />

      <AddToListModal open={!!listBook} onClose={() => setListBook(null)} book={listBook} />
    </Layout>
  );
}
