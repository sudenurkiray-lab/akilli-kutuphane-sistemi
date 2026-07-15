import { Modal } from './UI';

export default function EventCertificate({ open, onClose, data }) {
  if (!open || !data) return null;

  const tarih = data.etkinlik_tarihi
    ? new Date(data.etkinlik_tarihi + 'T12:00:00').toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    : '—';

  const handlePrint = () => window.print();

  return (
    <Modal open={open} onClose={onClose} title="Katılım Belgesi">
      <div id="katilim-belgesi" className="bg-white text-gray-900 rounded-xl p-8 border-4 border-purple-800 print:border-purple-900">
        <div className="text-center border-b-2 border-purple-200 pb-6 mb-6">
          <p className="text-sm uppercase tracking-widest text-purple-700 font-semibold">Akıllı Kütüphane Sistemi</p>
          <h2 className="text-2xl font-bold text-purple-900 mt-2">KATILIM BELGESİ</h2>
          <p className="text-sm text-gray-500 mt-1">Certificate of Participation</p>
        </div>

        <p className="text-center text-gray-600 mb-4">Bu belge,</p>
        <p className="text-center text-2xl font-bold text-gray-900 mb-1">{data.katilimci}</p>
        <p className="text-center text-sm text-gray-500 mb-6">
          {data.okul_no && `Öğrenci No: ${data.okul_no}`}
          {data.bolum && ` · ${data.bolum}`}
        </p>

        <p className="text-center text-gray-600 leading-relaxed mb-2">
          aşağıdaki etkinliğe katıldığını onaylar:
        </p>
        <p className="text-center text-lg font-semibold text-purple-900 mb-1">{data.etkinlik}</p>
        <p className="text-center text-sm text-gray-500 mb-6">{data.etkinlik_turu}</p>

        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6 max-w-md mx-auto">
          <div><span className="text-gray-400">Tarih:</span> {tarih}</div>
          <div><span className="text-gray-400">Saat:</span> {data.etkinlik_saati}</div>
          <div className="col-span-2"><span className="text-gray-400">Konum:</span> {data.konum || '—'}</div>
          {data.egitmen && (
            <div className="col-span-2"><span className="text-gray-400">Eğitmen:</span> {data.egitmen}</div>
          )}
        </div>

        <div className="flex justify-between items-end border-t border-gray-200 pt-6 mt-6">
          <div>
            <p className="text-xs text-gray-400">Belge Kodu</p>
            <p className="font-mono text-sm font-semibold text-purple-800">{data.kod}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Düzenlenme</p>
            <p className="text-sm">
              {data.tarih ? new Date(data.tarih).toLocaleDateString('tr-TR') : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-4 print:hidden">
        <button type="button" onClick={handlePrint} className="btn-primary flex-1">Yazdır / PDF Kaydet</button>
        <button type="button" onClick={onClose} className="btn-secondary">Kapat</button>
      </div>
    </Modal>
  );
}
