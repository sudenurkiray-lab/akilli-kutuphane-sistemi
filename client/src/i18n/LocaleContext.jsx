import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLanguageMeta,
  isValidLocale,
  translate,
  LANGUAGES,
} from './config';
import messages from './messages';

const LocaleContext = createContext(null);

function applyDocumentLocale(code) {
  const meta = getLanguageMeta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta.dir;
  document.title = messages[code]?.brand?.full || messages.tr.brand.full;
}

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isValidLocale(stored)) return stored;
  } catch (_) { /* ignore */ }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  const setLocale = useCallback((code, { persistRemote } = {}) => {
    if (!isValidLocale(code)) return;
    setLocaleState(code);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch (_) { /* ignore */ }
    applyDocumentLocale(code);
    if (persistRemote && localStorage.getItem('token')) {
      authApi.setLocale(code).catch(() => {});
    }
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const t = useCallback(
    (key, vars) => translate(messages[locale] || messages.tr, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      languages: LANGUAGES,
      meta: getLanguageMeta(locale),
      dir: getLanguageMeta(locale).dir,
      dateLocale: getLanguageMeta(locale).dateLocale,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useT() {
  return useLocale().t;
}
