import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Volume2, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../../shared/constants';
import { useLanguageStore } from '../store/useLanguageStore';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { currentLanguage, setLanguage } = useLanguageStore();

  if (!isOpen) return null;

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (code: typeof currentLanguage) => {
    setLanguage(code, true);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border-2 border-teal-600 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 gap-2 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl sm:text-2xl" aria-hidden="true">🌐</span>
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-teal-800 text-white tracking-wide">
                {t('languagesBadge')}
              </span>
            </div>
            <h2 id="lang-modal-title" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {t('chooseLanguage')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1">
              {t('tapLanguageInstruction')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close language selector"
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={22} className="stroke-[2.5]" />
          </button>
        </div>

        {/* 10 Language Buttons (Large, high-contrast, easy to tap) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 overflow-y-auto pr-1 py-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLanguage === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                className={`min-h-[64px] flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition text-left group active:scale-98 ${
                  isSelected
                    ? 'border-teal-700 bg-teal-50 shadow-md ring-2 ring-teal-600'
                    : 'border-slate-300 bg-slate-50/70 hover:border-teal-600 hover:bg-teal-50/40 text-slate-900'
                }`}
                aria-label={`Select ${lang.label} (${lang.nativeLabel})`}
              >
                <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-black text-slate-950 group-hover:text-teal-900 leading-tight">
                    {lang.nativeLabel}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 mt-1">
                    {lang.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {isSelected ? (
                    <span className="p-1.5 rounded-full bg-teal-700 text-white shadow-xs">
                      <Check size={18} className="stroke-[3]" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-full bg-white text-slate-500 group-hover:text-teal-700 group-hover:bg-teal-100 border border-slate-200">
                      <Volume2 size={18} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {t('selected')}: <strong className="text-slate-800">{currentLangObj.nativeLabel} ({currentLangObj.label})</strong>
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm min-h-[44px] transition active:scale-95 shadow-sm"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
};
