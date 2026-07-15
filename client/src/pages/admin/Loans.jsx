import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { StatusBadge, formatDate } from '../../components/UI';
import { loansApi } from '../../api';

import { adminNav } from '../../constants/adminNav';

const nav = adminNav;

export default function AdminLoans() {
  const [tab, setTab] = useState('aktif');
  const [activeLoans, setActiveLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);

  useEffect(() => {
    loansApi.active().then(setActiveLoans).catch(console.error);
    loansApi.all().then(setAllLoans).catch(console.error);
  }, []);

  const loans = tab === 'aktif' ? activeLoans : allLoans;

  return (
    <Layout navItems={nav} title="Ödünç Kayıtları">
      <p className="text-gray-400 mb-4">
        Kitap, öğrenci, alış tarihi, teslim tarihi, gerçek teslim tarihi ve durum bilgileri.
      </p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('aktif')} className={tab === 'aktif' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
          Aktif ({activeLoans.length})
        </button>
        <button onClick={() => setTab('tumu')} className={tab === 'tumu' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
          Tüm Kayıtlar ({allLoans.length})
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Kitap</th>
              <th>Öğrenci</th>
              <th>Öğrenci No</th>
              <th>Alış Tarihi</th>
              <th>Teslim Tarihi</th>
              <th>Gerçek Teslim</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-500 py-8">Kayıt yok</td></tr>
            ) : loans.map((l) => (
              <tr key={l.id} className={l.gecikti ? 'bg-red-500/5' : ''}>
                <td className="font-medium text-white">{l.kitap_adi}</td>
                <td>{l.ad} {l.soyad}</td>
                <td>{l.okul_no}</td>
                <td>{formatDate(l.odunc_tarihi)}</td>
                <td>{formatDate(l.teslim_tarihi)}</td>
                <td>{formatDate(l.iade_tarihi)}</td>
                <td><StatusBadge status={l.gecikti ? 'gecikti' : l.durum} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
