import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../api';
import { useT } from '../i18n/LocaleContext';

export default function CaptchaField({ value, onChange, idValue, onIdChange, className = '' }) {
  const t = useT();
  const [question, setQuestion] = useState('…');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.captcha();
      onIdChange(data.captcha_id);
      onChange('');
      setQuestion(data.question);
    } catch {
      setQuestion('—');
    } finally {
      setLoading(false);
    }
  }, [onChange, onIdChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className={className}>
      <label className="label">{t('login.captcha')}</label>
      <div className="flex gap-2 items-center">
        <div className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-purple-light font-mono text-sm">
          {loading ? t('common.loading') : question}
        </div>
        <button type="button" onClick={refresh} className="btn-secondary text-sm px-3" title="↻">
          ↻
        </button>
      </div>
      <input
        type="text"
        inputMode="numeric"
        className="input mt-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('login.captchaPlaceholder')}
        required
        autoComplete="off"
      />
      <input type="hidden" value={idValue || ''} readOnly />
    </div>
  );
}
