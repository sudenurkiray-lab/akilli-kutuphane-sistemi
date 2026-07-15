const MAX_BYTES = 4 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const approxBytes = Math.ceil((dataUrl.length * 3) / 4);
      if (approxBytes > MAX_BYTES) {
        reject(new Error('Görsel sıkıştırıldıktan sonra bile 4 MB sınırını aşıyor. Daha küçük bir dosya deneyin.'));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel işlenemedi'));
    };
    img.src = url;
  });
}

export async function prepareReceiptUpload(file) {
  if (!file) throw new Error('Dosya seçilmedi');

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
    throw new Error('Yalnızca PDF, JPG, PNG veya WEBP yükleyebilirsiniz');
  }

  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return compressImage(file);
  }

  if (file.size > MAX_BYTES) {
    throw new Error('PDF dosyası 4 MB sınırını aşıyor');
  }
  return readAsDataUrl(file);
}
