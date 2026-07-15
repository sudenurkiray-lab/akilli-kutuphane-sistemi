import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge } from '../../components/UI';
import { roomReservationsApi, penaltiesApi } from '../../api';
import { adminNav } from '../../constants/adminNav';

export default function AdminReservations() {
  const [reservations, setReservations] = useState([]);
  const [msg, setMsg] = useState('');

  const load = () => roomReservationsApi.list().then(setReservations).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleNoShow = async (r) => {
    if (!confirm(`${r.ad} ${r.soyad} için "gelinmedi" cezası uygulanacak. Devam?`)) return;
    try {
      const result = await penaltiesApi.roomNoShow(r.id);
      setMsg(result.message || 'Gelmeme cezası oluşturuldu');
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={adminNav} title="Çalışma Odası Rezervasyonları">
      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}
      <p className="text-gray-400 mb-6">
        Öğrencilerin çalışma odası rezervasyon kayıtları. Gelinmedi durumunda ceza uygulayabilirsiniz.
      </p>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Öğrenci No</th>
              <th>Oda</th>
              <th>Şube</th>
              <th>Tarih</th>
              <th>Saat</th>
              <th>Tip</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-gray-500 py-8">Kayıt yok</td></tr>
            ) : reservations.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-white">{r.ad} {r.soyad}</td>
                <td>{r.okul_no}</td>
                <td>{r.oda_adi}</td>
                <td className="text-sm text-gray-400">{r.sube || '—'}</td>
                <td>{new Date(r.tarih + 'T12:00:00').toLocaleDateString('tr-TR')}</td>
                <td>{r.baslangic} – {r.bitis}</td>
                <td className="text-xs text-gray-400">
                  {r.sessiz_oda && 'Sessiz '}
                  {r.grup_odasi && 'Grup '}
                  {!r.sessiz_oda && !r.grup_odasi && '—'}
                </td>
                <td><StatusBadge status={r.durum} /></td>
                <td>
                  {['beklemede', 'onaylandi'].includes(r.durum) && (
                    <button
                      type="button"
                      onClick={() => handleNoShow(r)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Gelinmedi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
