import { useEffect, useState } from 'react';
import { Modal } from './UI';
import { prepareReceiptUpload } from '../utils/receiptUpload';

const DEFAULT_FORM = { kitap_durumu: 'iyi', aciklama: '', foto: null, foto_adi: '' };

export default function ReturnInspectionModal({
  open,
  onClose,
  onSubmit,
  title = 'Kitap Teslim Kontrolü',
  subtitle,
  conditions = [],
  loading = false,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setPreview(null);
      setError('');
    }
  }, [open]);

  const selected = conditions.find((c) => c.id === form.kitap_durumu);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await prepareReceiptUpload(file);
      setForm((f) => ({ ...f, foto: dataUrl, foto_adi: file.name }));
      setPreview(dataUrl);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({
        kitap_durumu: form.kitap_durumu,
        aciklama: form.aciklama.trim() || undefined,
        foto: form.foto || undefined,
        foto_adi: form.foto_adi || undefined,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}

        <div>
          <label className="label">Kitap Durumu</label>
          <div className="grid grid-cols-2 gap-2">
            {conditions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kitap_durumu: c.id }))}
                className={`p-3 rounded-lg border text-left text-sm transition-all ${
                  form.kitap_durumu === c.id
                    ? 'border-purple-primary bg-purple-primary/20 text-white'
                    : 'border-dark-600 text-gray-400 hover:border-dark-500'
                }`}
              >
                <span className="font-medium block">{c.ad}</span>
                {c.ceza > 0 && (
                  <span className="text-xs text-red-400">{c.ceza} ₺ ceza</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {selected?.ceza > 0 && (
          <p className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            Bu durum için otomatik <strong>{selected.ceza} ₺</strong> ceza oluşturulacaktır.
          </p>
        )}

        <div>
          <label className="label">Açıklama</label>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Hasar detayı, eksik sayfa numarası vb."
            value={form.aciklama}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Fotoğraf (isteğe bağlı)</label>
          <label className="btn-secondary text-sm cursor-pointer inline-block">
            Fotoğraf Seç
            <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handlePhoto} />
          </label>
          {preview && (
            <img src={preview} alt="Önizleme" className="mt-2 max-h-40 rounded-lg border border-dark-600" />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
            İptal
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? 'İşleniyor…' : 'Teslim Al'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
