import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const STORAGE_KEY = 'music3-studio-ui-language';
const LEGACY_KEY = 'language';
const VALID: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'ko', 'ru', 'tr']);

function asLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return VALID.has(normalized) ? (normalized as Language) : null;
}

function readStoredLanguage(): Language | null {
  try {
    return asLanguage(localStorage.getItem(STORAGE_KEY))
      || asLanguage(localStorage.getItem(LEGACY_KEY));
  } catch {
    return null;
  }
}

function writeStoredLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    localStorage.setItem(LEGACY_KEY, lang);
  } catch {
    // Private mode / blocked storage — disk preference may still save.
  }
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // First launch: English. Once the user picks a language, keep it.
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() ?? 'en');

  useEffect(() => {
    let cancelled = false;
    void fetch('/v1/ui-preferences')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { ui_language?: string | null } | null) => {
        if (cancelled) return;
        const fromDisk = asLanguage(body?.ui_language ?? null);
        const fromLocal = readStoredLanguage();
        if (fromLocal) {
          // Browser choice is authoritative; mirror it to disk so restarts keep it.
          if (fromLocal !== fromDisk) {
            void fetch('/v1/ui-preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ui_language: fromLocal }),
            }).catch(() => undefined);
          }
          return;
        }
        if (fromDisk) {
          setLanguageState(fromDisk);
          writeStoredLanguage(fromDisk);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguageState(lang);
    writeStoredLanguage(lang);
    void fetch('/v1/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_language: lang }),
    }).catch(() => undefined);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
