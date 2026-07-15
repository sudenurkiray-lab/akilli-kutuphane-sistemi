/** Desteklenen diller — kod, yerel ad, yön */
export const LANGUAGES = [
  { code: 'tr', label: 'Türkçe', nativeLabel: 'Türkçe', dir: 'ltr', dateLocale: 'tr-TR' },
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr', dateLocale: 'en-US' },
  { code: 'de', label: 'Deutsch', nativeLabel: 'Deutsch', dir: 'ltr', dateLocale: 'de-DE' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl', dateLocale: 'ar-SA' },
];

export const DEFAULT_LOCALE = 'tr';
export const LOCALE_STORAGE_KEY = 'app_locale';

export function isValidLocale(code) {
  return LANGUAGES.some((l) => l.code === code);
}

export function getLanguageMeta(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

/** Basit interpolasyon: t('hi', { name: 'Ali' }) → "Merhaba Ali" with "Merhaba {{name}}" */
export function translate(dict, key, vars = {}) {
  if (!key) return '';
  const parts = key.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      cur = undefined;
      break;
    }
    cur = cur[p];
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : ''));
}
