import QrDisplay from './QrDisplay';
import { StatusBadge } from './UI';

function formatCardDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DigitalCard({ card, compact = false }) {
  if (!card) return null;

  const initials = `${card.ad?.[0] || ''}${card.soyad?.[0] || ''}`.toUpperCase();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-purple-primary/30 shadow-2xl shadow-purple-primary/10 ${
        compact ? 'max-w-sm mx-auto' : 'max-w-md mx-auto w-full'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-primary via-purple-dark to-dark-900" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-5 sm:p-6 text-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-light/80 font-medium">
              Dijital Kütüphane Kartı
            </p>
            <p className="text-sm font-semibold text-white/90">Akıllı Kütüphane Sistemi</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">
            📚
          </div>
        </div>

        <div className="flex gap-4 mb-5">
          <div className="shrink-0">
            {card.profil_foto ? (
              <img
                src={card.profil_foto}
                alt={card.ad_soyad}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-white/20 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/15 border-2 border-white/20 flex items-center justify-center text-2xl font-bold">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight truncate">{card.ad_soyad}</h2>
            <p className="text-purple-light/90 text-sm mt-1 truncate">{card.bolum || '—'}</p>
            <p className="text-white/70 text-sm font-mono mt-1">No: {card.okul_no || '—'}</p>
            <div className="mt-2">
              <StatusBadge status={card.uyelik_durumu} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Aktif Ödünç</p>
            <p className="text-xl font-bold mt-0.5">{card.aktif_odunc_sayisi}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Toplam Ceza</p>
            <p className={`text-xl font-bold mt-0.5 ${card.toplam_ceza > 0 ? 'text-red-300' : ''}`}>
              {card.toplam_ceza.toFixed(0)} ₺
            </p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Üyelik Bitiş</p>
            <p className={`text-xs font-semibold mt-1 leading-tight ${card.uyelik_suresi_doldu ? 'text-red-300' : 'text-white'}`}>
              {formatCardDate(card.uyelik_bitis_tarihi)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center bg-white rounded-xl p-4">
          <QrDisplay value={card.qr_url} size={compact ? 120 : 140} />
          <p className="text-dark-900 font-mono text-sm font-semibold mt-2">{card.uye_karti_qr}</p>
          <p className="text-gray-500 text-xs mt-1">Görevliye bu kodu okutun</p>
        </div>
      </div>
    </div>
  );
}
