import { useEffect, useState } from 'react';
import Layout, { icons } from '../../components/Layout';
import { Modal, StatusBadge, formatDate } from '../../components/UI';
import ReturnInspectionModal from '../../components/ReturnInspectionModal';
import { loansApi, booksApi, membersApi, returnInspectionsApi } from '../../api';
import { librarianNav } from '../../constants/librarianNav';

export default function LibrarianLoans() {
  const [loans, setLoans] = useState([]);
  const [showLend, setShowLend] = useState(false);
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [lendForm, setLendForm] = useState({ book_id: '', user_id: '' });
  const [msg, setMsg] = useState('');
  const [conditions, setConditions] = useState([]);
  const [returnLoan, setReturnLoan] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);

  const load = () => loansApi.active().then(setLoans).catch(console.error);

  useEffect(() => {
    load();
    returnInspectionsApi.conditions().then((d) => setConditions(d.durumlar || [])).catch(console.error);
  }, []);

  const openLend = async () => {
    const [b, m] = await Promise.all([booksApi.list(), membersApi.list()]);
    setBooks(b.filter((book) => book.stok > 0 && book.durum === 'mevcut'));
    setMembers(m);
    setShowLend(true);
  };

  const handleLend = async () => {
    try {
      const result = await loansApi.create(lendForm);
      setMsg(`Ödünç verildi. Teslim tarihi: ${formatDate(result.teslim_tarihi)}`);
      setShowLend(false);
      setLendForm({ book_id: '', user_id: '' });
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleReturnSubmit = async (inspection) => {
    if (!returnLoan) return;
    setReturnLoading(true);
    try {
      const result = await loansApi.return(returnLoan.id, inspection);
      let message = result.message || 'Kitap iade alındı';
      if (result.penalty) message += `. Gecikme cezası: ${result.penalty.tutar} ₺`;
      if (result.hasar_cezasi) message += `. ${result.hasar_cezasi.durum_adi} cezası: ${result.hasar_cezasi.tutar} ₺`;
      setMsg(message);
      setReturnLoan(null);
      load();
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      throw e;
    } finally {
      setReturnLoading(false);
    }
  };

  const handleCheckOverdue = async () => {
    try {
      const result = await loansApi.checkOverdue();
      setMsg(`${result.count} geciken ödünç tespit edildi`);
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={librarianNav} title="Ödünç Verme & Teslim Alma">
      {msg && <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">{msg}</div>}

      <div className="flex gap-3 mb-6">
        <button type="button" onClick={openLend} className="btn-primary">Ödünç Ver</button>
        <button type="button" onClick={handleCheckOverdue} className="btn-secondary">Gecikme Kontrolü</button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Kitap</th>
              <th>Barkod</th>
              <th>Üye</th>
              <th>Okul No</th>
              <th>Ödünç Tarihi</th>
              <th>Teslim Tarihi</th>
              <th>Kalan Gün</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className={l.gecikti ? 'bg-red-500/5' : ''}>
                <td className="font-medium text-white">{l.kitap_adi}</td>
                <td className="font-mono text-xs text-purple-light">{l.barkod || '—'}</td>
                <td>{l.ad} {l.soyad}</td>
                <td>{l.okul_no}</td>
                <td>{formatDate(l.odunc_tarihi)}</td>
                <td>{formatDate(l.teslim_tarihi)}</td>
                <td className={l.kalan_gun < 0 ? 'text-red-400' : l.kalan_gun <= 3 ? 'text-yellow-400' : ''}>
                  {l.kalan_gun < 0 ? `${Math.abs(l.kalan_gun)} gün gecikme` : `${l.kalan_gun} gün`}
                </td>
                <td><StatusBadge status={l.gecikti ? 'gecikti' : l.durum} /></td>
                <td>
                  <button
                    type="button"
                    onClick={() => setReturnLoan(l)}
                    className="text-green-400 hover:text-green-300 text-sm"
                  >
                    İade Al
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReturnInspectionModal
        open={!!returnLoan}
        onClose={() => setReturnLoan(null)}
        onSubmit={handleReturnSubmit}
        conditions={conditions}
        loading={returnLoading}
        subtitle={returnLoan ? `"${returnLoan.kitap_adi}" — ${returnLoan.ad} ${returnLoan.soyad}` : ''}
      />

      <Modal open={showLend} onClose={() => setShowLend(false)} title="Ödünç Ver">
        <div className="space-y-4">
          <div>
            <label className="label">Kitap</label>
            <select className="input" value={lendForm.book_id} onChange={(e) => setLendForm({ ...lendForm, book_id: e.target.value })}>
              <option value="">Kitap seçin</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.ad} — {b.yazar} (Stok: {b.stok})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Üye</label>
            <select className="input" value={lendForm.user_id} onChange={(e) => setLendForm({ ...lendForm, user_id: e.target.value })}>
              <option value="">Üye seçin</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.ad} {m.soyad} — {m.okul_no}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={handleLend} className="btn-primary w-full">Ödünç Ver</button>
        </div>
      </Modal>
    </Layout>
  );
}
