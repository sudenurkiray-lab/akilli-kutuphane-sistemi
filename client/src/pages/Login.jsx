import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import SystemRulesCard from '../components/SystemRulesCard';
import CaptchaField from '../components/CaptchaField';
import ReCaptcha from '../components/ReCaptcha';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLocale } from '../i18n/LocaleContext';

const roleList = [ROLES.admin, ROLES.librarian, ROLES.member];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [step2fa, setStep2fa] = useState(null);
  const [code2fa, setCode2fa] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, complete2FA, sessionMessageKey, clearSessionMessage } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const goHome = (user) => {
    const role = roleList.find((r) => r.key === user.role);
    navigate(role?.path || '/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    clearSessionMessage?.();
    setLoading(true);
    try {
      const data = await login(username, password, {
        captcha_id: captchaId,
        captcha_answer: captchaAnswer,
        recaptcha_token: recaptchaToken,
      });
      if (data.requires_2fa) {
        setStep2fa(data.temp_token);
        return;
      }
      goHome(data.user);
    } catch (err) {
      setError(err.message);
      setRecaptchaToken('');
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await complete2FA(step2fa, code2fa);
      goHome(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    setUsername(role.demo.username);
    setPassword(role.demo.password);
  };

  return (
    <div className="min-h-screen bg-dark-900 relative overflow-hidden py-10 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-dark/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher compact persistRemote={false} />
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-primary to-purple-dark rounded-2xl shadow-glow mb-4">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">{t('brand.full')}</h1>
          <p className="text-gray-400 mt-2">{t('login.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {roleList.map((role) => (
            <div key={role.key} className="card hover:border-purple-primary/40 transition-colors">
              <h3 className="text-purple-light font-semibold">{t(`roles.${role.key}`)}</h3>
              <p className="text-sm text-gray-400 mt-2 mb-3">{t(`roles.${role.key}Desc`)}</p>
              <ul className="text-xs text-gray-500 space-y-1 mb-4">
                {role.capabilities.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => fillDemo(role)}
                className="w-full btn-secondary text-sm"
              >
                {t('login.demo')}: {role.demo.username}
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-md mx-auto card">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">
            {step2fa ? t('login.twoFactor') : t('login.title')}
          </h2>
          {sessionMessageKey && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg text-sm mb-4">
              {t(sessionMessageKey)}
            </div>
          )}

          {!step2fa ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="label">{t('login.username')}</label>
                <input
                  type="text"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">{t('login.password')}</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
                {loading ? t('login.submitting') : t('login.submit')}
              </button>

              <p className="text-center text-sm text-gray-500 pt-2 space-x-3 rtl:space-x-reverse">
                <Link to="/sifremi-unuttum" className="text-purple-light hover:underline">{t('login.forgot')}</Link>
                <span>·</span>
                <Link to="/kayit" className="text-purple-light hover:underline">{t('login.register')}</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handle2fa} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <p className="text-sm text-gray-400 text-center">{t('login.twoFactorHint')}</p>
              <div>
                <label className="label">{t('login.code')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input text-center tracking-widest text-lg"
                  value={code2fa}
                  onChange={(e) => setCode2fa(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary py-3">
                {loading ? t('login.verifying') : t('login.verify')}
              </button>
              <button
                type="button"
                className="w-full btn-secondary text-sm"
                onClick={() => {
                  setStep2fa(null);
                  setCode2fa('');
                  setCaptchaKey((k) => k + 1);
                }}
              >
                {t('login.back')}
              </button>
            </form>
          )}
        </div>

        <div className="max-w-md mx-auto mt-6">
          <SystemRulesCard title={t('login.rules')} />
        </div>
      </div>
    </div>
  );
}
