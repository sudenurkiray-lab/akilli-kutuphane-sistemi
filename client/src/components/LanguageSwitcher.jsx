import { useLocale } from '../i18n/LocaleContext';

/**
 * compact: header/login tarzı dar select
 * block: profil kartı (label + full width)
 */
export default function LanguageSwitcher({ compact = false, className = '', persistRemote = true }) {
  const { locale, setLocale, languages, t } = useLocale();

  const onChange = (e) => {
    setLocale(e.target.value, { persistRemote });
  };

  if (compact) {
    return (
      <label className={`inline-flex items-center gap-2 ${className}`}>
        <span className="sr-only">{t('common.language')}</span>
        <select
          className="bg-dark-700 border border-dark-600 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-primary/50"
          value={locale}
          onChange={onChange}
          aria-label={t('common.language')}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className={className}>
      <label className="label text-xs">{t('profile.language')}</label>
      <p className="text-xs text-gray-500 mb-2">{t('profile.languageHint')}</p>
      <select className="input text-sm" value={locale} onChange={onChange}>
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {t(`languages.${l.code}`)} — {l.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
