import { formatDate } from './UI';

function formatDateTime(d) {
  if (!d) return null;
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TransferTimeline({ transfer }) {
  if (!transfer?.adimlar) return null;
  const iptal = transfer.durum === 'iptal';

  return (
    <div className="space-y-1">
      {iptal && (
        <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Bu transfer iptal edildi.
        </div>
      )}
      <ol className="relative border-l border-dark-600 ml-3">
        {transfer.adimlar.map((adim) => (
          <li key={adim.durum} className="ml-6 pb-5 last:pb-0">
            <span
              className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-dark-800 ${
                adim.tamam ? 'bg-purple-primary' : 'bg-dark-600'
              } ${adim.aktif ? 'ring-purple-primary/30' : ''}`}
            >
              {adim.tamam && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${adim.aktif ? 'text-purple-light' : adim.tamam ? 'text-white' : 'text-gray-500'}`}>
                {adim.label}
              </span>
              {adim.tarih && (
                <span className="text-xs text-gray-500">{formatDateTime(adim.tarih)}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
