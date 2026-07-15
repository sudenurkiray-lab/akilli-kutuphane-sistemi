import { useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import DigitalCard from '../../components/DigitalCard';
import { memberNav } from '../../constants/memberNav';
import { cardApi } from '../../api';

function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MemberCard() {
  const [card, setCard] = useState(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = () => cardApi.get().then(setCard).catch(console.error);

  useEffect(() => { load(); }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('Lütfen bir resim dosyası seçin');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      await cardApi.updatePhoto(dataUrl);
      setMsg('Profil fotoğrafı güncellendi');
      load();
    } catch (err) {
      setMsg(err.message || 'Fotoğraf yüklenemedi');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const removePhoto = async () => {
    try {
      await cardApi.updatePhoto(null);
      setMsg('Profil fotoğrafı kaldırıldı');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Dijital Öğrenci Kartı">
      <p className="text-gray-400 mb-4 text-center sm:text-left">
        Bu kartı telefonunuzdan kütüphane gişesinde gösterebilir veya QR kodu okutabilirsiniz.
      </p>

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-purple-primary/10 border-purple-primary/30 text-purple-light text-center max-w-md mx-auto">
          {msg}
        </div>
      )}

      <div className="flex flex-col items-center gap-6 pb-8">
        {card ? (
          <>
            <DigitalCard card={card} />
            <div className="flex flex-wrap gap-2 justify-center max-w-md w-full">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhoto}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn-primary text-sm flex-1 min-w-[140px]"
              >
                {uploading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
              </button>
              {card.profil_foto && (
                <button type="button" onClick={removePhoto} className="btn-secondary text-sm">
                  Fotoğrafı Kaldır
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center max-w-sm">
              Parlak ekranda kartınızı görevliye gösterin veya QR kodu okutun.
              Ödünç işlemi için görevli önce kartınızı, sonra kitabı okutur.
            </p>
          </>
        ) : (
          <div className="card max-w-md w-full text-center py-12 text-gray-500">
            Kart yükleniyor...
          </div>
        )}
      </div>
    </Layout>
  );
}
