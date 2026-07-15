import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';
import ReCaptcha from '../components/ReCaptcha';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLocale } from '../i18n/LocaleContext';

const BOLUMLER = [
  'Bilgisayar Mühendisliği', 'Elektrik Mühendisliği', 'Makine Mühendisliği',
  'Endüstri Mühendisliği', 'İnşaat Mühendisliği', 'Yazılım Mühendisliği',
  'İşletme', 'Hukuk', 'Tıp', 'Eczacılık', 'Mimarlık', 'Psikoloji',
  'Sosyoloji', 'Tarih', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
];

export default function Register() {
  const [form, setForm] = useState({
    username: '', password: '', password2: '', ad: '', soyad: '',
    email: '', telefon: '', okul_no: '', bolum: '',
  });
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (form.password !== form.password2) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        username: form.username,
        password: form.password,
        ad: form.ad,
        soyad: form.soyad,
        email: form.email,
        telefon: form.telefon,
        okul_no: form.okul_no,
        bolum: form.bolum || undefined,
        captcha_id: captchaId,
        captcha_answer: captchaAnswer,
        recaptcha_token: recaptchaToken,
      });
      if (result.demo_email_verify_url) {
        setInfo(`Doğrulama bağlantısı (demo): ${result.demo_email_verify_url}`);
      }
      navigate('/uye');
    } catch (err) {
      setError(err.message);
      setRecaptchaToken('');
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-dark-900 relative overflow-hidden py-10 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-dark/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher compact persistRemote={false} />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t('register.title')}</h1>
          <p className="text-gray-400 mt-2">{t('register.subtitle')}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            {info && (
              <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-lg text-sm break-all">{info}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('register.firstName')} *</label><input className="input" value={form.ad} onChange={set('ad')} required /></div>
              <div><label className="label">{t('register.lastName')} *</label><input className="input" value={form.soyad} onChange={set('soyad')} required /></div>
            </div>

            <div><label className="label">{t('login.username')} *</label><input className="input" value={form.username} onChange={set('username')} required /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('login.password')} *</label><input type="password" className="input" value={form.password} onChange={set('password')} required minLength={6} /></div>
              <div><label className="label">{t('register.passwordAgain')} *</label><input type="password" className="input" value={form.password2} onChange={set('password2')} required /></div>
            </div>

            <div><label className="label">{t('register.email')} *</label><input type="email" className="input" value={form.email} onChange={set('email')} required /></div>
            <div><label className="label">{t('register.phone')}</label><input className="input" value={form.telefon} onChange={set('telefon')} placeholder="05XX XXX XX XX" /></div>
            <div><label className="label">{t('register.studentNo')} *</label><input className="input" value={form.okul_no} onChange={set('okul_no')} required /></div>
            <div>
              <label className="label">{t('register.department')}</label>
              <select className="input" value={form.bolum} onChange={set('bolum')}>
                <option value="">{t('register.selectDepartment')}</option>
                {BOLUMLER.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <CaptchaField
              key={captchaKey}
              value={captchaAnswer}
              onChange={setCaptchaAnswer}
              idValue={captchaId}
              onIdChange={setCaptchaId}
            />

            <ReCaptcha
              onVerify={setRecaptchaToken}
              resetKey={captchaKey}
            />

            <button type="submit" disabled={loading} className="w-full btn-primary py-3">
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            {t('register.hasAccount')}{' '}
            <Link to="/login" className="text-purple-light hover:underline">{t('register.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
