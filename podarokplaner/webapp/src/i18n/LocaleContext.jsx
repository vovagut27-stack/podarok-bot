import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { detectInitialLocale, translate, dateLocale } from './translations.js';

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitialLocale);

  const setLocale = useCallback((next) => {
    if (next !== 'ru' && next !== 'en') return;
    setLocaleState(next);
    try {
      localStorage.setItem('podarok_locale', next);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key, vars) => translate(locale, key, vars),
    [locale]
  );

  const value = {
    locale,
    setLocale,
    t,
    dateLocale: dateLocale(locale),
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
