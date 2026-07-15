import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { adminNav } from '../constants/adminNav';
import { librarianNav } from '../constants/librarianNav';
import { memberNav } from '../constants/memberNav';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useT } from '../i18n/LocaleContext';

const navByRole = {
  admin: adminNav,
  librarian: librarianNav,
  member: memberNav,
};

export default function SecuritySettings() {
  const { user, refreshUser } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', new_password2: '' });
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [busy, setBusy] = useState(false);

  const load = () => {
    authApi.security()
      .then(setInfo)
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const flash = (msg) => {
    setOk(msg);
    setError('');
    setTimeout(() => setOk(''), 4000);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.new_password !== pwd.new_password2) {
      setError(t('security.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const r = await authApi.changePassword(pwd);
      flash(r.message);
      setPwd({ current_password: '', new_password: '', new_password2: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const start2fa = async () => {
    setError('');
    setBusy(true);
    try {
      const r = await authApi.setup2fa();
      setSetup(r);
      flash(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await authApi.enable2fa(code);
      flash(r.message);
      setSetup(null);
      setCode('');
      load();
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await authApi.disable2fa(disableForm);
      flash(r.message);
      setDisableForm({ password: '', code: '' });
      load();
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resendVerify = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await authApi.resendVerification();
      flash(r.message);
      if (r.demo_email_verify_url) {
        setOk(`${r.message} Bağlantı: ${r.demo_email_verify_url}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  const nav = navByRole[user.role] || memberNav;
  const s = info || user.security || {};

  return (
    <Layout navItems={nav} titleKey="titles.security">
      <div className="max-w-3xl space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {ok && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">{ok}</div>
        )}

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-3">{t('security.languageSection')}</h2>
          <LanguageSwitcher />
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-white">{t('security.summary')}</h2>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• {t('security.passwordsHashed')}</li>
            <li>• {t('security.roleAuth')}: <span className="text-purple-light">{t(`roles.${user.role}`)}</span></li>
            <li>• {t('security.emailVerify')}: {s.email_dogrulandi ? `✓ ${t('security.verified')}` : `✗ ${t('security.pending')}`}</li>
            <li>• {t('security.twoFactor')}: {s.totp_enabled ? `✓ ${t('security.active')}` : `✗ ${t('security.off')}`}</li>
            <li>• {t('security.session', { exp: s.session_expires || '2h', idle: s.idle_timeout_minutes || 30 })}</li>
            <li>• {t('security.failLimit', { max: s.max_failed_attempts || 5, lock: s.lock_minutes || 15 })}</li>
            <li>• {t('security.lastIp')}: {s.last_login_ip || '—'}</li>
            {user.role === 'admin' && (
              <li>
                • {t('security.auditLink')}:{' '}
                <button type="button" className="text-purple-light hover:underline" onClick={() => navigate('/admin/denetim')}>
                  {t('security.auditPage')}
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-3">{t('security.emailTitle')}</h2>
          {s.email_dogrulandi ? (
            <p className="text-sm text-green-400">{t('security.emailOk')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                {s.has_email ? t('security.emailPending') : t('security.emailMissing')}
              </p>
              {s.has_email && (
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={resendVerify}>
                  {t('security.resend')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">{t('security.changePassword')}</h2>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="label">{t('security.currentPassword')}</label>
              <input type="password" className="input" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('security.newPassword')}</label>
              <input type="password" className="input" minLength={6} value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('security.newPassword2')}</label>
              <input type="password" className="input" minLength={6} value={pwd.new_password2} onChange={(e) => setPwd({ ...pwd, new_password2: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>{t('common.update')}</button>
          </form>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-white">{t('security.twoFactorTitle')}</h2>
          {!s.totp_enabled && !setup && (
            <button type="button" className="btn-primary" disabled={busy} onClick={start2fa}>
              {t('security.setup2fa')}
            </button>
          )}
          {setup && (
            <form onSubmit={enable2fa} className="space-y-4">
              <p className="text-sm text-gray-400">{setup.message}</p>
              <div className="bg-white p-3 inline-block rounded-lg">
                <QRCodeSVG value={setup.otpauth_url} size={180} />
              </div>
              <p className="text-xs text-gray-500 font-mono break-all">{t('security.secretKey')}: {setup.secret}</p>
              <div>
                <label className="label">{t('security.authCode')}</label>
                <input type="text" inputMode="numeric" className="input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>{t('security.enable2fa')}</button>
            </form>
          )}
          {s.totp_enabled && (
            <form onSubmit={disable2fa} className="space-y-3 border-t border-dark-600 pt-4">
              <p className="text-sm text-green-400">{t('security.disableHint')}</p>
              <input type="password" className="input" placeholder={t('login.password')} value={disableForm.password} onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })} required />
              <input type="text" className="input" placeholder={t('security.authCode')} maxLength={6} value={disableForm.code} onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value })} required />
              <button type="submit" className="btn-secondary" disabled={busy}>{t('security.disable2fa')}</button>
            </form>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {t('security.suspiciousHint')}{' '}
          <Link to="/sifremi-unuttum" className="text-purple-light hover:underline">{t('common.from')}</Link>.
        </p>
      </div>
    </Layout>
  );
}
