import { create } from 'zustand';
import i18n from '../i18n';
import { LanguageCode } from '../../../shared/types';
import { SUPPORTED_LANGUAGES } from '../../../shared/constants';

interface LanguageState {
  currentLanguage: LanguageCode;
  setLanguage: (code: LanguageCode, speakPrompt?: boolean) => void;
}

const getInitialLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('sahai_setu_lang') as LanguageCode;
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
    return stored;
  }
  return 'en';
};

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: getInitialLanguage(),
  setLanguage: (code: LanguageCode, speakPrompt: boolean = false) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) {
      code = 'en';
    }
    localStorage.setItem('sahai_setu_lang', code);
    sessionStorage.setItem('sahai_setu_lang', code);
    i18n.changeLanguage(code);
    set({ currentLanguage: code });

    if (speakPrompt) {
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === code);
      if (langObj) {
        import('../utils/audio').then(({ speakText }) => {
          speakText(langObj.voicePrompt, code);
        });
      }
    }
  },
}));

// Keep store synchronized with any direct i18n language changes
i18n.on('languageChanged', (lng: string) => {
  const code = (lng ? lng.split('-')[0] : 'en') as LanguageCode;
  if (SUPPORTED_LANGUAGES.some((l) => l.code === code) && useLanguageStore.getState().currentLanguage !== code) {
    localStorage.setItem('sahai_setu_lang', code);
    sessionStorage.setItem('sahai_setu_lang', code);
    useLanguageStore.setState({ currentLanguage: code });
  }
});
