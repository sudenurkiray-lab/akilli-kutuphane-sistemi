import { StatCard } from './UI';

function BarChart({ data, valueKey = 'sayi', labelKey = 'ay', color = 'bg-purple-primary' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-4">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-xs text-purple-light font-medium">{d[valueKey]}</span>
          <div className="w-full flex items-end justify-center h-28">
            <div
              className={`w-full max-w-10 rounded-t-md ${color} transition-all`}
              style={{ height: `${Math.max(8, (d[valueKey] / max) * 100)}%` }}
              title={`${d[labelKey]}: ${d[valueKey]}`}
            />
          </div>
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ data, labelKey, valueKey = 'sayi' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = data[0]?.[valueKey] || 1;

  return (
    <ul className="space-y-3">
      {data.map((item, i) => (
        <li key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300 truncate pr-2">{item[labelKey]}</span>
            <span className="text-purple-light shrink-0">{item[valueKey]}</span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-primary to-purple-light rounded-full"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DonutChart({ data }) {
  if (!data?.length) return null;
  const total = data.reduce((s, d) => s + d.sayi, 0);
  const colors = ['#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ec4899', '#6366f1', '#14b8a6'];
  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = (d.sayi / total) * 100;
    const seg = { ...d, pct, color: colors[i % colors.length], offset };
    offset += pct;
    return seg;
  });

  const gradient = segments.map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(', ');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div
        className="w-36 h-36 rounded-full shrink-0"
        style={{ background: `conic-gradient(${gradient})`, mask: 'radial-gradient(circle, transparent 55%, black 56%)', WebkitMask: 'radial-gradient(circle, transparent 55%, black 56%)' }}
      />
      <ul className="space-y-2 flex-1 w-full">
        {segments.map((s) => (
          <li key={s.kategori} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-gray-300 truncate">{s.kategori}</span>
            </div>
            <span className="text-gray-500 shrink-0 ml-2">{s.sayi} ({Math.round(s.pct)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeBadge({ degisim, yuzde }) {
  if (degisim === 0) {
    return <span className="text-xs text-gray-500">Geçen ayla aynı</span>;
  }
  const up = degisim > 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(degisim)} kitap ({up ? '+' : ''}{yuzde}%)
    </span>
  );
}

export default function ReadingStatsPanel({ data }) {
  if (!data) return null;

  const { ozet, aylik_grafik, kategori_grafik, yazar_sirasi } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bu Ay" value={ozet.bu_ay} icon="📅" />
        <StatCard label="Bu Yıl" value={ozet.bu_yil} icon="📚" color="green" />
        <StatCard label="Toplam Sayfa" value={ozet.toplam_sayfa.toLocaleString('tr-TR')} icon="📄" color="yellow" />
        <StatCard label="Ort. Teslim Süresi" value={`${ozet.ortalama_teslim_gun} gün`} icon="⏱️" />
      </div>

      <div className="card border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Aylık Okuma Trendi</h3>
            <p className="text-xs text-gray-500">Son 6 ayda iade ettiğiniz kitaplar</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Geçen aya göre</p>
            <ChangeBadge degisim={ozet.degisim} yuzde={ozet.degisim_yuzde} />
          </div>
        </div>
        <BarChart data={aylik_grafik} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-1">Kategori Dağılımı</h3>
          <p className="text-xs text-gray-500 mb-4">
            En çok: <span className="text-purple-light">{ozet.en_cok_kategori || '—'}</span>
            {ozet.en_cok_kategori_sayi > 0 && ` (${ozet.en_cok_kategori_sayi} kitap)`}
          </p>
          {kategori_grafik.length > 0 ? (
            <DonutChart data={kategori_grafik} />
          ) : (
            <p className="text-gray-500 text-sm">Henüz okuma verisi yok</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-1">Favori Yazarlar</h3>
          <p className="text-xs text-gray-500 mb-4">
            Favori: <span className="text-purple-light">{ozet.favori_yazar || '—'}</span>
            {ozet.favori_yazar_sayi > 0 && ` (${ozet.favori_yazar_sayi} kitap)`}
          </p>
          <HorizontalBars data={yazar_sirasi} labelKey="yazar" />
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Kategori Karşılaştırması</h3>
        <HorizontalBars data={kategori_grafik} labelKey="kategori" />
      </div>
    </div>
  );
}
