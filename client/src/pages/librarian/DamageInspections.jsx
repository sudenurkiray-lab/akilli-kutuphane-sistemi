import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { formatDate, Modal } from '../../components/UI';
import { returnInspectionsApi } from '../../api';

export default function DamageInspections({ navItems, title = 'Hasar & Kayıp Kayıtları' }) {
  const [rows, setRows] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  const load = () => {
    returnInspectionsApi.list(filter ? { durum: filter } : {})
      .then(setRows)
      .catch(console.error);
  };

  useEffect(() => {
    returnInspectionsApi.conditions().then((d) => setConditions(d.durumlar || [])).catch(console.error);
    load();
  }, [filter]);

  const openDetail = async (row) => {
    setSelected(row);
    setPhotoUrl(null);
    if (row.foto_yolu) {
      try {
        const blob = await returnInspectionsApi.photo(row.id);
        setPhotoUrl(URL.createObjectURL(blob));
      } catch (_) { /* no photo */ }
    }
  };

  const closeDetail = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setSelected(null);
    setPhotoUrl(null);
  };

  return (
    <Layout navItems={navItems} title={title}>
      <p className="text-gray-400 mb-4">
        Teslim alınırken kaydedilen hasar, kayıp ve durum kontrolleri.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm ${!filter ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Tümü
        </button>
        {conditions.filter((c) => c.id !== 'iyi').map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === c.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
          >
            {c.ad}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Kitap</th>
              <th>Barkod</th>
              <th>Durum</th>
              <th>Ceza</th>
              <th>Kontrol Eden</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-500 py-8">Kayıt yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="text-sm">{formatDate(r.created_at)}</td>
                <td>
                  <p className="text-white">{r.ad} {r.soyad}</p>
                  <p className="text-xs text-gray-500">{r.okul_no}</p>
                </td>
                <td className="text-sm max-w-[180px] truncate">{r.kitap_adi}</td>
                <td className="font-mono text-xs text-purple-light">{r.barkod || '—'}</td>
                <td>
                  <span className={r.kitap_durumu === 'kayip' ? 'text-red-400' : r.kitap_durumu === 'iyi' ? 'text-green-400' : 'text-yellow-400'}>
                    {r.durum_adi}
                  </span>
                </td>
                <td className="text-red-400">{r.ceza_tutari > 0 ? `${r.ceza_tutari} ₺` : '—'}</td>
                <td className="text-sm text-gray-400">
                  {r.kontrol_ad ? `${r.kontrol_ad} ${r.kontrol_soyad}` : '—'}
                </td>
                <td>
                  <button type="button" className="text-purple-light text-sm" onClick={() => openDetail(r)}>
                    Detay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={closeDetail} title="Teslim Kontrol Detayı">
        {selected && (
          <div className="space-y-3 text-sm">
            <p><span className="text-gray-500">Kitap:</span> <span className="text-white">{selected.kitap_adi}</span></p>
            <p><span className="text-gray-500">Öğrenci:</span> {selected.ad} {selected.soyad} ({selected.okul_no})</p>
            <p><span className="text-gray-500">Durum:</span> <span className="text-purple-light">{selected.durum_adi}</span></p>
            {selected.ceza_tutari > 0 && (
              <p><span className="text-gray-500">Ceza:</span> <span className="text-red-400">{selected.ceza_tutari} ₺</span></p>
            )}
            {selected.aciklama && (
              <p className="text-gray-300 bg-dark-800 rounded-lg p-3">{selected.aciklama}</p>
            )}
            {photoUrl && (
              <img src={photoUrl} alt="Hasar fotoğrafı" className="max-h-64 rounded-lg border border-dark-600" />
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
