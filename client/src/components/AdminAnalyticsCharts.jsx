export function BarChart({ data, valueKey = 'sayi', labelKey = 'etiket', color = 'bg-purple-primary', height = 'h-40' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className={`flex items-end justify-between gap-1 ${height} pt-4`}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] text-purple-light font-medium">{d[valueKey]}</span>
          <div className="w-full flex items-end justify-center h-28">
            <div
              className={`w-full max-w-8 rounded-t-md ${color} transition-all`}
              style={{ height: `${Math.max(6, (d[valueKey] / max) * 100)}%` }}
              title={`${d[labelKey]}: ${d[valueKey]}`}
            />
          </div>
          <span className="text-[9px] text-gray-500 truncate w-full text-center">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export function LineAreaChart({ data, valueKey = 'iade_orani', labelKey = 'etiket' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = Math.max(...data.map((d) => d[valueKey]), 100);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-36">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-cyan-300">{d[valueKey]}%</span>
            <div className="w-full h-28 bg-dark-700/50 rounded-t-lg relative overflow-hidden flex items-end">
              <div
                className="w-full bg-gradient-to-t from-cyan-600/80 to-cyan-400/40 rounded-t-lg"
                style={{ height: `${Math.max(8, (d[valueKey] / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{d[labelKey]}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {data.map((d) => (
          <span key={d.ay}>{d.etiket}: {d.zamaninda}/{d.iade_sayisi} zamanında</span>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBars({ data, labelKey, valueKey = 'sayi', suffix = '' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = data[0]?.[valueKey] || 1;

  return (
    <ul className="space-y-3">
      {data.map((item, i) => (
        <li key={i}>
          <div className="flex justify-between text-sm mb-1 gap-2">
            <span className="text-gray-300 truncate">{item[labelKey]}</span>
            <span className="text-purple-light shrink-0">{item[valueKey]}{suffix}</span>
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

export function DonutChart({ data, labelKey = 'kategori', valueKey = 'sayi' }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  const colors = ['#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ec4899', '#6366f1', '#14b8a6'];
  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = total > 0 ? (d[valueKey] / total) * 100 : 0;
    const seg = { ...d, pct, color: colors[i % colors.length], offset };
    offset += pct;
    return seg;
  });
  const gradient = segments.map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(', ');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div
        className="w-32 h-32 rounded-full shrink-0"
        style={{
          background: `conic-gradient(${gradient})`,
          mask: 'radial-gradient(circle, transparent 55%, black 56%)',
          WebkitMask: 'radial-gradient(circle, transparent 55%, black 56%)',
        }}
      />
      <ul className="space-y-2 flex-1 w-full">
        {segments.map((s) => (
          <li key={s[labelKey]} className="flex items-center justify-between text-sm gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-gray-300 truncate">{s[labelKey]}</span>
            </div>
            <span className="text-gray-500 shrink-0">{s[valueKey]} ({Math.round(s.pct)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MetricRing({ value, label, color = 'text-purple-light', size = 'w-24 h-24' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${size} rounded-full flex items-center justify-center relative`}
        style={{
          background: `conic-gradient(#8b5cf6 ${pct}%, #1f2937 ${pct}%)`,
          mask: 'radial-gradient(circle, transparent 62%, black 63%)',
          WebkitMask: 'radial-gradient(circle, transparent 62%, black 63%)',
        }}
      >
        <span className={`text-xl font-bold ${color}`}>{pct}%</span>
      </div>
      <p className="text-xs text-gray-400 text-center">{label}</p>
    </div>
  );
}

export function HeatmapHours({ data }) {
  if (!data?.length) return <p className="text-gray-500 text-sm">Henüz veri yok</p>;
  const max = Math.max(...data.map((d) => d.sayi), 1);

  return (
    <div className="grid grid-cols-12 gap-1">
      {data.map((d) => {
        const intensity = d.sayi / max;
        return (
          <div
            key={d.saat}
            className="aspect-square rounded-md flex flex-col items-center justify-center text-[9px]"
            style={{ background: `rgba(139, 92, 246, ${Math.max(0.08, intensity * 0.9)})` }}
            title={`${d.etiket}: ${d.sayi} işlem`}
          >
            <span className="text-gray-400">{d.saat}</span>
            <span className="text-purple-light font-medium">{d.sayi}</span>
          </div>
        );
      })}
    </div>
  );
}
