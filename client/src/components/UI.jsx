import { useLocale } from '../i18n/LocaleContext';

export function StatCard({ label, value, icon, color = 'purple' }) {
  const colors = {
    purple: 'from-purple-primary/20 to-purple-dark/10 border-purple-primary/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  };

  return (
    <div className={`card bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="text-purple-light opacity-80">{icon}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_CLS = {
  aktif: 'badge-success',
  mevcut: 'badge-success',
  oduncte: 'badge-warning',
  bakimda: 'badge-warning',
  kayip: 'badge-danger',
  gecikti: 'badge-danger',
  iade_edildi: 'badge-info',
  beklemede: 'badge-warning',
  hazir: 'badge-success',
  suresi_doldu: 'badge-danger',
  tamamlandi: 'badge-success',
  iptal: 'badge-danger',
  pasif: 'badge-danger',
  rafta: 'badge-success',
  hasarli: 'badge-danger',
  rezerve: 'badge-warning',
  onaylandi: 'badge-success',
  talep: 'badge-warning',
  hazirlaniyor: 'badge-info',
  transfer_edildi: 'badge-info',
  teslim_noktasinda: 'badge-warning',
  teslim_edildi: 'badge-success',
  taslak: 'badge-warning',
  yayinda: 'badge-success',
  kayitli: 'badge-info',
  katildi: 'badge-success',
  katilmadi: 'badge-danger',
  reddedildi: 'badge-danger',
  arsiv: 'badge-warning',
  taksitli: 'badge-info',
  odendi: 'badge-success',
  bekliyor: 'badge-warning',
  yok: 'badge-info',
  inceleniyor: 'badge-warning',
  kabul_edildi: 'badge-success',
  satin_alindi: 'badge-success',
};

export function StatusBadge({ status }) {
  const { t } = useLocale();
  const cls = STATUS_CLS[status] || 'badge-info';
  const key = `status.${status}`;
  const label = t(key);
  return <span className={cls}>{label === key ? status : label}</span>;
}

export function formatDate(d, locale = 'tr-TR') {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function FormattedDate({ value }) {
  const { dateLocale } = useLocale();
  return <>{formatDate(value, dateLocale)}</>;
}

export function EmptyState({ message }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p>{message}</p>
    </div>
  );
}
