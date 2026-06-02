// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: true,
    detection: {
      /** 사용자가 선택한 언어(localStorage)를 쿼리/브라우저보다 우선 — 전체 새로고침 후에도 유지 */
      order: ['localStorage', 'sessionStorage', 'cookie', 'queryString', 'navigator', 'htmlTag', 'path', 'subdomain'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

function syncDocumentLang(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng.split('-')[0] || 'en';
  }
}

i18n.on('languageChanged', (lng) => {
  syncDocumentLang(lng);
});
i18n.on('initialized', () => {
  syncDocumentLang(i18n.language);
});

export default i18n;
