import { Link } from 'react-router-dom';
import { useT } from '../i18n/LocaleContext';

function BookCard({ book, availableLabel }) {
  return (
    <Link
      to="/uye/kitaplar"
      className="block shrink-0 w-52 p-4 rounded-lg border border-gray-700 bg-dark-800 hover:border-purple-primary/50 transition-colors"
    >
      <h4 className="text-white font-medium text-sm leading-tight line-clamp-2">{book.ad}</h4>
      <p className="text-purple-light text-xs mt-1 truncate">{book.yazar}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span className="truncate">{book.kategori}</span>
        {book.ortalama_puan > 0 && (
          <span className="text-yellow-400 shrink-0 ms-1">★ {book.ortalama_puan}</span>
        )}
      </div>
      {book.musait && (
        <span className="inline-block mt-2 text-xs text-green-400">{availableLabel}</span>
      )}
    </Link>
  );
}

function Section({ title, subtitle, books, availableLabel }) {
  if (!books?.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {books.map((book) => (
          <BookCard key={book.id} book={book} availableLabel={availableLabel} />
        ))}
      </div>
    </section>
  );
}

export default function BookRecommendations({ data }) {
  const t = useT();
  if (!data) return null;

  const hasAny = ['sana_ozel', 'benzer_kullanicilar', 'bolumune_uygun', 'son_baktiklarina_benzer']
    .some((k) => data[k]?.length > 0);
  const availableLabel = t('common.available');

  if (!hasAny) {
    return (
      <div className="card mb-8 border-purple-primary/20">
        <h3 className="text-lg font-semibold text-white mb-2">{t('recs.emptyTitle')}</h3>
        <p className="text-gray-500 text-sm">{t('recs.emptyBody')}</p>
      </div>
    );
  }

  const bolumLabel = data.meta?.bolum ? ` (${data.meta.bolum})` : '';

  return (
    <div className="card mb-8 border-purple-primary/30">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">{t('recs.title')}</h2>
        {data.meta?.favori_kategoriler?.length > 0 && (
          <p className="text-sm text-purple-light mt-1">
            {t('recs.interests', { list: data.meta.favori_kategoriler.join(', ') })}
          </p>
        )}
      </div>

      <Section title={t('recs.personal')} subtitle={t('recs.personalSub')} books={data.sana_ozel} availableLabel={availableLabel} />
      <Section title={t('recs.similar')} subtitle={t('recs.similarSub')} books={data.benzer_kullanicilar} availableLabel={availableLabel} />
      <Section title={t('recs.dept')} subtitle={t('recs.deptSub', { dept: bolumLabel })} books={data.bolumune_uygun} availableLabel={availableLabel} />
      <Section title={t('recs.recent')} subtitle={t('recs.recentSub')} books={data.son_baktiklarina_benzer} availableLabel={availableLabel} />
    </div>
  );
}
