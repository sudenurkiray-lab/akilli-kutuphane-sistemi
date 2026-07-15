import { useEffect, useState } from 'react';
import { Modal } from './UI';
import { reviewsApi, ratingsApi } from '../api';

function StarRating({ value, onChange, readonly }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`text-base ${star <= value ? 'text-yellow-400' : 'text-gray-600'} ${!readonly ? 'hover:text-yellow-300' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewItem({ review, onLike, onReport, onDelete, canModerate }) {
  const [showSpoiler, setShowSpoiler] = useState(!review.spoiler);

  return (
    <div className="p-3 rounded-lg bg-dark-700/50 border border-dark-600">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <p className="text-white text-sm font-medium">{review.yazar_ad}</p>
          {review.kullanici_puani && (
            <span className="text-xs text-yellow-400">{'★'.repeat(review.kullanici_puani)}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(review.created_at).toLocaleDateString('tr-TR')}
        </span>
      </div>

      {review.spoiler && !showSpoiler ? (
        <button
          type="button"
          onClick={() => setShowSpoiler(true)}
          className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2 w-full"
        >
          ⚠ Spoiler içeriyor — görmek için tıklayın
        </button>
      ) : (
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{review.yorum}</p>
      )}

      {review.spoiler && showSpoiler && (
        <span className="inline-block mt-1 text-xs text-yellow-500/80">Spoiler</span>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={() => onLike(review.id)}
          className={`text-xs ${review.ben_begendim ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
        >
          {review.ben_begendim ? '♥' : '♡'} {review.begeni_sayisi}
        </button>
        {!review.benim_yorumum && !review.sikayet_edildi && (
          <button
            type="button"
            onClick={() => onReport(review.id)}
            className="text-xs text-gray-500 hover:text-orange-400"
          >
            Şikâyet et
          </button>
        )}
        {review.sikayet_edildi && (
          <span className="text-xs text-orange-400/70">Şikâyet edildi</span>
        )}
        {(review.benim_yorumum || canModerate) && (
          <button
            type="button"
            onClick={() => onDelete(review.id)}
            className="text-xs text-red-400 hover:underline ml-auto"
          >
            Sil
          </button>
        )}
      </div>
    </div>
  );
}

export default function BookReviewsModal({ open, onClose, book, userRating, onRatingChange, onStatsChange }) {
  const [reviews, setReviews] = useState([]);
  const [yorum, setYorum] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!book?.id) return;
    reviewsApi.list(book.id).then(setReviews).catch((e) => setMsg(e.message));
  };

  useEffect(() => {
    if (open && book?.id) {
      load();
    }
  }, [open, book?.id]);

  useEffect(() => {
    const mine = reviews.find((r) => r.benim_yorumum);
    if (mine) {
      setYorum(mine.yorum);
      setSpoiler(mine.spoiler);
    } else {
      setYorum('');
      setSpoiler(false);
    }
  }, [reviews]);

  const handleSubmitReview = async () => {
    if (!yorum.trim()) {
      setMsg('Yorum yazın');
      return;
    }
    setLoading(true);
    try {
      await reviewsApi.submit(book.id, { yorum: yorum.trim(), spoiler });
      setMsg('Yorum kaydedildi');
      load();
      onStatsChange?.();
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (puan) => {
    try {
      const result = await ratingsApi.set(book.id, puan);
      onRatingChange?.(puan, result);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleLike = async (reviewId) => {
    try {
      await reviewsApi.like(reviewId);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleReport = async (reviewId) => {
    const sebep = window.prompt('Şikâyet nedeniniz (isteğe bağlı):');
    if (sebep === null) return;
    try {
      await reviewsApi.report(reviewId, sebep);
      setMsg('Şikâyetiniz alındı');
      load();
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!confirm('Bu yorumu silmek istiyor musunuz?')) return;
    try {
      await reviewsApi.remove(reviewId);
      load();
      onStatsChange?.();
    } catch (e) {
      setMsg(e.message);
    }
  };

  if (!book) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Yorumlar — ${book.ad}`}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 p-3 rounded-lg bg-dark-800 border border-dark-600">
          <span>★ Ort: {book.ortalama_puan || '—'} ({book.puan_sayisi || 0} puan)</span>
          <span>💬 {book.yorum_sayisi || 0} yorum</span>
          <span>👁 {book.goruntulenme_sayisi || 0} okuma</span>
          <span>♥ {book.favori_sayisi || 0} favori</span>
        </div>

        <div className="p-3 rounded-lg border border-purple-primary/20 bg-purple-primary/5">
          <p className="text-sm text-purple-light mb-2">Puanınız</p>
          <StarRating value={userRating || 0} onChange={handleRate} />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-white font-medium">Yorum yazın</p>
          <textarea
            className="input min-h-[80px] text-sm"
            placeholder="Kitap hakkındaki düşünceleriniz..."
            value={yorum}
            onChange={(e) => setYorum(e.target.value)}
            maxLength={2000}
          />
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
            Spoiler içeriyor
          </label>
          <button type="button" disabled={loading} onClick={handleSubmitReview} className="btn-primary text-sm w-full">
            {reviews.some((r) => r.benim_yorumum) ? 'Yorumu Güncelle' : 'Yorum Gönder'}
          </button>
        </div>

        {msg && (
          <p className={`text-sm ${msg.includes('kaydedildi') || msg.includes('alındı') ? 'text-green-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm text-gray-400">{reviews.length} yorum</p>
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Henüz yorum yok — ilk yorumu siz yazın!</p>
          ) : (
            reviews.map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                onLike={handleLike}
                onReport={handleReport}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
