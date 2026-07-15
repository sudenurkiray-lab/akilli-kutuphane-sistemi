import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { StatusBadge, formatDate, EmptyState } from '../../components/UI';
import TransferTimeline from '../../components/TransferTimeline';
import { memberNav } from '../../constants/memberNav';
import { loansApi, penaltiesApi, roomReservationsApi, reservationsApi, transfersApi, branchesApi, membersApi, gamificationApi, readingStatsApi } from '../../api';
import GamificationPanel from '../../components/GamificationPanel';
import ReadingStatsPanel from '../../components/ReadingStatsPanel';
import { prepareReceiptUpload } from '../../utils/receiptUpload';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useLocale } from '../../i18n/LocaleContext';

export default function MemberProfile() {
  const { user, refreshUser } = useAuth();
  const { t, dateLocale } = useLocale();
  const [loans, setLoans] = useState([]);
  const [penalties, setPenalties] = useState([]);
  const [roomReservations, setRoomReservations] = useState([]);
  const [bookQueues, setBookQueues] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [gamification, setGamification] = useState(null);
  const [readingStats, setReadingStats] = useState(null);
  const [tab, setTab] = useState('aktif');
  const [msg, setMsg] = useState('');
  const [uploadingReceiptId, setUploadingReceiptId] = useState(null);

  useEffect(() => {
    Promise.all([
      loansApi.my(), penaltiesApi.my(), roomReservationsApi.my(),
      reservationsApi.my(), transfersApi.my(), branchesApi.list(),
      gamificationApi.me(),
      readingStatsApi.me(),
    ])
      .then(([l, p, r, q, t, b, g, rs]) => {
        setLoans(l); setPenalties(p); setRoomReservations(r);
        setBookQueues(q); setTransfers(t); setBranches(b);
        setGamification(g);
        setReadingStats(rs);
      })
      .catch(console.error);
  }, []);

  const handleReturn = async (loan) => {
    if (!confirm(`"${loan.kitap_adi}" kitabını iade etmek istediğinize emin misiniz?`)) return;
    try {
      const result = await loansApi.return(loan.id);
      let message = result.message || 'Kitap iade edildi';
      if (result.penalty) {
        message += `. Gecikme cezası: ${result.penalty.tutar} ₺ (${result.penalty.daysLate} gün)`;
      }
      setMsg(message);
      loansApi.my().then(setLoans);
      penaltiesApi.my().then(setPenalties);
      gamificationApi.me().then(setGamification);
      readingStatsApi.me().then(setReadingStats);
      if (result.yeni_rozetler?.length) {
        setTimeout(() => {
          setMsg(`${message} · Yeni rozet: ${result.yeni_rozetler.map((b) => b.ad).join(', ')}`);
        }, 100);
      }
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleExtend = async (loan) => {
    if (!confirm(`"${loan.kitap_adi}" için teslim süresini 7 gün uzatmak istiyor musunuz?`)) return;
    try {
      const result = await loansApi.extend(loan.id);
      setMsg(`${result.message}. Yeni teslim: ${new Date(result.teslim_tarihi).toLocaleDateString('tr-TR')} (Kalan uzatma: ${result.kalan_uzatma})`);
      loansApi.my().then(setLoans);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const activeLoans = loans.filter(l => l.durum === 'aktif' || l.durum === 'gecikti');
  const historyLoans = loans.filter(l => l.durum === 'iade_edildi');
  const overdueLoans = activeLoans.filter(l => l.gecikti);
  const unpaidPenalties = penalties.filter(p => !p.odendi && p.durum !== 'iptal');

  const handleCancelQueue = async (id) => {
    try {
      await reservationsApi.cancel(id);
      setMsg('Sıradan çıktınız');
      reservationsApi.my().then(setBookQueues);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const activeQueues = bookQueues.filter((q) => q.durum === 'beklemede' || q.durum === 'hazir');

  const AKTIF_TRANSFER = ['talep', 'onaylandi', 'hazirlaniyor', 'transfer_edildi', 'teslim_noktasinda'];
  const activeTransfers = transfers.filter((t) => AKTIF_TRANSFER.includes(t.durum));

  const handleCancelTransfer = async (id) => {
    try {
      await transfersApi.cancel(id);
      setMsg('Transfer iptal edildi');
      transfersApi.my().then(setTransfers);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleCancelRoomReservation = async (id) => {
    try {
      await roomReservationsApi.cancel(id);
      setMsg('Oda rezervasyonu iptal edildi');
      roomReservationsApi.my().then(setRoomReservations);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleBranchChange = async (e) => {
    const id = parseInt(e.target.value, 10);
    if (!id) return;
    try {
      await membersApi.setPreferredBranch(id);
      await refreshUser();
      setMsg('Teslim şubeniz güncellendi');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const tabs = [
    { id: 'istatistik', label: t('profile.tabStats'), count: readingStats?.ozet?.bu_ay || 0 },
    { id: 'rozetler', label: t('profile.tabBadges'), count: gamification?.kazanilan_sayisi || 0 },
    { id: 'aktif', label: t('profile.tabActive'), count: activeLoans.length },
    { id: 'sira', label: t('profile.tabQueue'), count: activeQueues.length },
    { id: 'transfer', label: t('profile.tabTransfer'), count: activeTransfers.length },
    { id: 'gecmis', label: t('profile.tabHistory'), count: historyLoans.length },
    { id: 'geciken', label: t('profile.tabOverdue'), count: overdueLoans.length },
    { id: 'ceza', label: t('profile.tabPenalty'), count: unpaidPenalties.length },
    { id: 'oda', label: t('profile.tabRoom'), count: roomReservations.filter((r) => r.durum === 'beklemede' || r.durum === 'onaylandi').length },
  ];

  return (
    <Layout navItems={memberNav} titleKey="titles.memberProfile">
      <p className="text-gray-400 mb-6">Ödünç kitaplarınızı görüntüleyin ve iade edin.</p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('yüklendi') || msg.includes('iade')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : msg.includes('hata') || msg.includes('büyük') || msg.includes('sınır') || msg.includes('inceleniyor')
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-purple-primary/10 border-purple-primary/30 text-purple-light'
        }`}>{msg}</div>
      )}

      <div className="card mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-primary to-purple-dark rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {user?.ad?.[0]}{user?.soyad?.[0]}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{user?.ad} {user?.soyad}</h3>
            <p className="text-gray-400 text-sm">{t('profile.schoolNo')}: {user?.okul_no} | {user?.bolum}</p>
            <p className="text-gray-500 text-sm">{user?.email} | {user?.telefon}</p>
            <StatusBadge status={user?.uyelik_durumu} />
            {gamification && gamification.kazanilan_sayisi > 0 && (
              <p className="text-xs text-purple-light mt-1">
                🏅 {t('profile.badgesEarned', { n: gamification.kazanilan_sayisi })}
              </p>
            )}
            <div className="mt-3 max-w-xs space-y-4">
              <LanguageSwitcher />
              <div>
                <label className="label text-xs">{t('profile.preferredBranch')}</label>
                <select className="input text-sm" value={user?.tercih_sube?.id || ''} onChange={handleBranchChange}>
                  <option value="">{t('profile.selectBranch')}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <Link to="/uye/kart" className="btn-primary text-sm whitespace-nowrap">
          {t('profile.showCard')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-purple-primary/20 text-purple-light border border-purple-primary/30'
                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'istatistik' && <ReadingStatsPanel data={readingStats} />}

      {tab === 'rozetler' && <GamificationPanel data={gamification} />}

      {tab === 'aktif' && (
        <div className="table-container">
          {activeLoans.length === 0 ? <EmptyState message="Aktif ödünç kitabınız yok" /> : (
            <table className="table">
              <thead><tr><th>Kitap</th><th>Şube</th><th>Yazar</th><th>Alış Tarihi</th><th>Teslim Tarihi</th><th>Kalan</th><th>Uzatma</th><th>Durum</th><th>İşlem</th></tr></thead>
              <tbody>
                {activeLoans.map(l => (
                  <tr key={l.id}>
                    <td className="text-white font-medium">{l.kitap_adi}</td>
                    <td className="text-sm text-purple-light">{l.sube_adi || l.sube || '—'}</td>
                    <td>{l.yazar}</td>
                    <td>{formatDate(l.odunc_tarihi)}</td>
                    <td>{formatDate(l.teslim_tarihi)}</td>
                    <td className={l.gecikti ? 'text-red-400' : ''}>{l.gecikti ? `${Math.abs(l.kalan_gun)} gün gecikme` : `${l.kalan_gun} gün`}</td>
                    <td className="text-xs text-gray-400">{l.uzatma_sayisi || 0}/2</td>
                    <td><StatusBadge status={l.gecikti ? 'gecikti' : l.durum} /></td>
                    <td className="space-x-2 whitespace-nowrap">
                      {l.uzatilabilir && (
                        <button onClick={() => handleExtend(l)} className="text-purple-light hover:text-purple-glow text-sm font-medium">+7 Gün</button>
                      )}
                      {!l.uzatilabilir && l.uzatma_sebep && !l.gecikti && (l.uzatma_sayisi || 0) < 2 && (
                        <span className="text-gray-500 text-xs" title={l.uzatma_sebep}>
                          Uzatılamaz: {l.uzatma_sebep}
                        </span>
                      )}
                      <button onClick={() => handleReturn(l)} className="text-green-400 hover:text-green-300 text-sm font-medium">İade</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'gecmis' && (
        <div className="table-container">
          {historyLoans.length === 0 ? <EmptyState message="Geçmiş ödünç kaydı yok" /> : (
            <table className="table">
              <thead><tr><th>Kitap</th><th>Ödünç</th><th>İade</th></tr></thead>
              <tbody>
                {historyLoans.map(l => (
                  <tr key={l.id}>
                    <td className="text-white font-medium">{l.kitap_adi}</td>
                    <td>{formatDate(l.odunc_tarihi)}</td>
                    <td>{formatDate(l.iade_tarihi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'geciken' && (
        <div className="table-container">
          {overdueLoans.length === 0 ? <EmptyState message="Geciken kitabınız yok" /> : (
            <table className="table">
              <thead><tr><th>Kitap</th><th>Teslim Tarihi</th><th>Gecikme</th><th>İşlem</th></tr></thead>
              <tbody>
                {overdueLoans.map(l => (
                  <tr key={l.id} className="bg-red-500/5">
                    <td className="text-white font-medium">{l.kitap_adi}</td>
                    <td>{formatDate(l.teslim_tarihi)}</td>
                    <td className="text-red-400 font-medium">{Math.abs(l.kalan_gun)} gün</td>
                    <td>
                      <button onClick={() => handleReturn(l)} className="text-green-400 hover:text-green-300 text-sm font-medium">İade Et</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'ceza' && (
        <div className="space-y-4">
          {penalties.length === 0 ? <EmptyState message="Ceza kaydınız yok" /> : (
            penalties.map((p) => (
              <div key={p.id} className="card border border-dark-600">
                <div className="flex flex-wrap justify-between gap-3 mb-3">
                  <div>
                    <p className="text-purple-light text-sm">{p.tur_adi || 'Ceza'}</p>
                    <p className="text-white font-medium">{p.sebep || p.kitap_adi || '—'}</p>
                    {p.kitap_adi && p.sebep && <p className="text-xs text-gray-500">{p.kitap_adi}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-lg">{Number(p.tutar).toFixed(2)} ₺</p>
                    {p.indirim_tutari > 0 && (
                      <p className="text-xs text-green-400">İndirim: {Number(p.indirim_tutari).toFixed(2)} ₺</p>
                    )}
                    <StatusBadge status={p.durum || (p.odendi ? 'odendi' : 'aktif')} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                  <span>{formatDate(p.tarih)}</span>
                  {p.geciken_gun != null && <span>{p.geciken_gun} gün gecikme</span>}
                  {p.durum === 'taksitli' && (
                    <span>Taksit: {p.taksit_odenen || 0}/{p.taksit_sayisi}</span>
                  )}
                  {p.dekont_durumu && p.dekont_durumu !== 'yok' && (
                    <StatusBadge status={p.dekont_durumu} />
                  )}
                </div>
                {p.aciklama && <p className="text-sm text-gray-400 mb-3">{p.aciklama}</p>}
                {p.taksitler?.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm">
                    {p.taksitler.map((t) => (
                      <li key={t.id} className="flex justify-between text-gray-400">
                        <span>{t.taksit_no}. taksit — {t.tutar.toFixed(2)} ₺ (vade: {formatDate(t.vade_tarihi)})</span>
                        {t.odendi ? <span className="text-green-400">Ödendi</span> : <span className="text-yellow-400">Bekliyor</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {!p.odendi && p.durum !== 'iptal' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {p.dekont_durumu === 'bekliyor' ? (
                      <p className="text-sm text-yellow-400">
                        Dekontunuz inceleniyor. Kütüphane onayladığında ceza kapanır.
                      </p>
                    ) : (
                      <label className={`btn-secondary text-sm cursor-pointer ${uploadingReceiptId === p.id ? 'opacity-60 pointer-events-none' : ''}`}>
                        {uploadingReceiptId === p.id ? 'Yükleniyor…' : p.dekont_durumu === 'reddedildi' ? 'Yeni Dekont Yükle' : 'Dekont Yükle'}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                          className="hidden"
                          disabled={uploadingReceiptId === p.id}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingReceiptId(p.id);
                            try {
                              const icerik = await prepareReceiptUpload(file);
                              await penaltiesApi.uploadReceipt(p.id, { dosya_adi: file.name, icerik });
                              setMsg('Dekont yüklendi. Kütüphane onayından sonra ceza kapanacaktır.');
                              penaltiesApi.my().then(setPenalties);
                              setTimeout(() => setMsg(''), 6000);
                            } catch (err) {
                              setMsg(err.message);
                            } finally {
                              setUploadingReceiptId(null);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                    {p.dekont_yolu && (
                      <button
                        type="button"
                        className="text-purple-light text-sm"
                        onClick={async () => {
                          try {
                            const blob = await penaltiesApi.downloadReceipt(p.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = p.dekont_yolu;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            setMsg(err.message);
                          }
                        }}
                      >
                        Dekontu Gör
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'sira' && (
        <div className="table-container">
          {activeQueues.length === 0 ? <EmptyState message="Aktif kitap sıranız yok" /> : (
            <table className="table">
              <thead><tr><th>Kitap</th><th>Yazar</th><th>Sıra</th><th>Durum</th><th>Süre</th><th>İşlem</th></tr></thead>
              <tbody>
                {activeQueues.map((q) => (
                  <tr key={q.id}>
                    <td className="text-white font-medium">{q.kitap_adi}</td>
                    <td>{q.yazar}</td>
                    <td>{q.durum === 'hazir' ? '—' : `${q.sira_no}. sıra`}</td>
                    <td><StatusBadge status={q.durum} /></td>
                    <td>
                      {q.durum === 'hazir' && q.kalan_saat != null
                        ? <span className="text-yellow-400">{q.kalan_saat} saat kaldı</span>
                        : '—'}
                    </td>
                    <td className="space-x-2">
                      {q.durum === 'hazir' && (
                        <Link to="/uye/kitaplar" className="text-green-400 text-sm hover:text-green-300">Kitabı Al</Link>
                      )}
                      <button onClick={() => handleCancelQueue(q.id)} className="text-red-400 text-sm hover:text-red-300">Sıradan Çık</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'transfer' && (
        <div>
          {transfers.length === 0 ? <EmptyState message="Şube transfer talebiniz yok" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {transfers.map((t) => (
                <div key={t.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-white font-semibold">{t.kitap_adi}</h4>
                      <p className="text-sm text-gray-500">{t.yazar}</p>
                      <p className="text-xs text-purple-light mt-1">
                        {t.kaynak_sube_adi} → {t.hedef_sube_adi}
                      </p>
                    </div>
                    <StatusBadge status={t.durum} />
                  </div>
                  <TransferTimeline transfer={t} />
                  {t.iptal_edilebilir_uye && (
                    <button
                      onClick={() => handleCancelTransfer(t.id)}
                      className="btn-secondary w-full mt-3 text-sm"
                    >
                      Transferi İptal Et
                    </button>
                  )}
                  {t.tamamlandi && (
                    <p className="mt-3 text-sm text-green-400 text-center">
                      Kitap teslim edildi, ödünç kayıtlarınızda görünüyor.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'oda' && (
        <div className="table-container">
          {roomReservations.length === 0 ? <EmptyState message="Oda rezervasyonunuz yok" /> : (
            <table className="table">
              <thead><tr><th>Oda</th><th>Kat</th><th>Tarih</th><th>Saat</th><th>Durum</th><th>İşlem</th></tr></thead>
              <tbody>
                {roomReservations.map(r => (
                  <tr key={r.id}>
                    <td className="text-white font-medium">{r.oda_adi}</td>
                    <td>{r.kat || '—'}</td>
                    <td>{new Date(r.tarih + 'T12:00:00').toLocaleDateString('tr-TR')}</td>
                    <td>{r.baslangic} – {r.bitis}</td>
                    <td><StatusBadge status={r.durum} /></td>
                    <td>
                      {(r.durum === 'beklemede' || r.durum === 'onaylandi') && (
                        <button onClick={() => handleCancelRoomReservation(r.id)} className="text-red-400 text-sm hover:text-red-300">İptal</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}
