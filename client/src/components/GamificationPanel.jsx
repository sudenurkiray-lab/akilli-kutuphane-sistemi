export default function GamificationPanel({ data }) {
  if (!data) return null;

  const { hedefler, rozetler, kazanilan_sayisi, toplam_rozet, istatistik } = data;

  return (
    <div className="space-y-6">
      <div className="card border border-purple-primary/20 bg-gradient-to-br from-purple-primary/5 to-transparent">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Okuma Hedefleri</h3>
            <p className="text-xs text-gray-500">İlerlemenizi takip edin</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Toplam okunan: <span className="text-purple-light font-medium">{istatistik.toplam_iade}</span></p>
            <p>Bu ay: {istatistik.bu_ay_iade} · Bu yıl: {istatistik.bu_yil_iade}</p>
          </div>
        </div>
        <div className="space-y-3">
          {hedefler.map((h) => (
            <div key={h.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className={h.tamamlandi ? 'text-green-400' : 'text-gray-300'}>
                  {h.tamamlandi ? '✓ ' : ''}{h.ad}
                </span>
                <span className="text-gray-500">{h.mevcut}/{h.hedef}</span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${h.tamamlandi ? 'bg-green-500' : 'bg-purple-primary'}`}
                  style={{ width: `${h.yuzde}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Rozetlerim</h3>
          <span className="text-sm text-purple-light">{kazanilan_sayisi}/{toplam_rozet}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {rozetler.map((r) => (
            <div
              key={r.id}
              title={r.aciklama}
              className={`p-3 rounded-xl border text-center transition-all ${
                r.kazanildi
                  ? `bg-gradient-to-br ${r.renk} opacity-100`
                  : 'bg-dark-800/50 border-dark-600 opacity-40 grayscale'
              }`}
            >
              <div className="text-3xl mb-1">{r.ikon}</div>
              <p className="text-xs font-medium text-white leading-tight">{r.ad}</p>
              {r.kazanildi && r.kazanma_tarihi && (
                <p className="text-[10px] text-gray-500 mt-1">
                  {new Date(r.kazanma_tarihi).toLocaleDateString('tr-TR')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
