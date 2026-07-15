import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { StatCard } from '../../components/UI';
import SystemRulesCard from '../../components/SystemRulesCard';
import { memberNav } from '../../constants/memberNav';
import { loansApi, penaltiesApi, roomReservationsApi, recommendationsApi } from '../../api';
import BookRecommendations from '../../components/BookRecommendations';
import { useLocale } from '../../i18n/LocaleContext';

export default function MemberDashboard() {
  const { t, dateLocale } = useLocale();
  const [loans, setLoans] = useState([]);
  const [penalties, setPenalties] = useState([]);
  const [roomReservations, setRoomReservations] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      loansApi.my(),
      penaltiesApi.my(),
      roomReservationsApi.my(),
      recommendationsApi.get(),
    ])
      .then(([l, p, r, rec]) => {
        setLoans(l);
        setPenalties(p);
        setRoomReservations(r);
        setRecommendations(rec);
      })
      .catch(console.error);
  }, []);

  const handleReturn = async (loan) => {
    if (!confirm(t('dashboard.confirmReturn', { title: loan.kitap_adi }))) return;
    try {
      const result = await loansApi.return(loan.id);
      let message = t('dashboard.returned');
      if (result.penalty) message += `. ${t('dashboard.penaltyAdded', { amount: result.penalty.tutar })}`;
      setMsg(message);
      loansApi.my().then(setLoans);
      penaltiesApi.my().then(setPenalties);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleExtend = async (loan) => {
    try {
      const result = await loansApi.extend(loan.id);
      setMsg(`${result.message} — ${new Date(result.teslim_tarihi).toLocaleDateString(dateLocale)}`);
      loansApi.my().then(setLoans);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const activeLoans = loans.filter((l) => l.durum === 'aktif' || l.durum === 'gecikti');
  const overdueLoans = activeLoans.filter((l) => l.gecikti);
  const unpaidPenalties = penalties.filter((p) => !p.odendi);
  const pendingRoomReservations = roomReservations.filter((r) => r.durum === 'beklemede' || r.durum === 'onaylandi');

  return (
    <Layout navItems={memberNav} titleKey="titles.memberDashboard">
      {msg && <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      <p className="text-gray-400 mb-6">{t('dashboard.memberIntro')}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('dashboard.activeLoans')} value={activeLoans.length} icon={memberNav[2].icon} />
        <StatCard label={t('dashboard.overdue')} value={overdueLoans.length} icon={memberNav[4].icon} color="red" />
        <StatCard label={t('dashboard.roomRes')} value={pendingRoomReservations.length} icon={memberNav[3].icon} color="yellow" />
        <StatCard label={t('dashboard.penalty')} value={unpaidPenalties.reduce((s, p) => s + p.tutar, 0).toFixed(2)} icon={memberNav[4].icon} color="red" />
      </div>

      {overdueLoans.length > 0 && (
        <div className="card border-red-500/30 mb-6">
          <h3 className="text-red-400 font-semibold mb-2">{t('dashboard.overdueTitle')}</h3>
          {overdueLoans.map((l) => (
            <p key={l.id} className="text-sm text-gray-300">
              {l.kitap_adi} — {t('profile.daysLate', { n: Math.abs(l.kalan_gun) })}
            </p>
          ))}
        </div>
      )}

      <BookRecommendations data={recommendations} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{t('dashboard.myLoans')}</h3>
              <Link to="/uye/profil" className="text-purple-light text-sm hover:underline">{t('nav.member.profile')}</Link>
            </div>
            {activeLoans.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('dashboard.emptyLoans')}</p>
            ) : (
              <ul className="space-y-2">
                {activeLoans.slice(0, 3).map((l) => (
                  <li key={l.id} className="flex justify-between items-center text-sm py-2 border-b border-dark-600">
                    <span className="text-white">{l.kitap_adi}</span>
                    <div className="flex items-center gap-2">
                      <span className={l.gecikti ? 'text-red-400' : 'text-gray-400'}>
                        {l.gecikti ? t('common.overdue') : t('profile.daysLeft', { n: l.kalan_gun })}
                      </span>
                      {l.uzatilabilir && (
                        <button onClick={() => handleExtend(l)} className="text-purple-light hover:text-purple-glow text-xs">{t('common.extend')}</button>
                      )}
                      <button onClick={() => handleReturn(l)} className="text-green-400 hover:text-green-300 text-xs">{t('common.return')}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-4">{t('dashboard.quickActions')}</h3>
            <div className="space-y-2">
              <Link to="/uye/kart" className="block btn-primary text-center">{t('dashboard.showCard')}</Link>
              <Link to="/uye/kitaplar" className="block btn-secondary text-center">{t('dashboard.searchBorrow')}</Link>
              <Link to="/uye/oda-rezervasyon" className="block btn-secondary text-center">{t('dashboard.reserveRoom')}</Link>
              <Link to="/uye/profil" className="block btn-secondary text-center">{t('dashboard.viewActivity')}</Link>
            </div>
          </div>
        </div>

        <SystemRulesCard />
      </div>
    </Layout>
  );
}
