import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardPlus,
  Scan,
  Clock,
  Compass,
  ArrowRight,
  AlertTriangle,
  Languages,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { useAccessibilityStore } from '../store/useAccessibilityStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { LanguageModal } from '../components/LanguageModal';
import { AssistanceModal } from '../components/AssistanceModal';
import { SahaiVoiceAssistant } from '../components/SahaiVoiceAssistant';
import { speakText } from '../utils/audio';
import { SUPPORTED_LANGUAGES } from '../../../shared/constants';
import { LanguageCode } from '../../../shared/types';

export const Landing: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeToken, activeSlip } = useQueueStore();
  const { simpleMode } = useAccessibilityStore();
  const { currentLanguage, setLanguage } = useLanguageStore();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isAssistanceOpen, setIsAssistanceOpen] = useState(false);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  // Play voice greeting on very first load if not previously prompted
  useEffect(() => {
    const hasPrompted = sessionStorage.getItem('sahai_voice_prompted');
    if (!hasPrompted) {
      sessionStorage.setItem('sahai_voice_prompted', 'true');
      speakText(currentLangObj.voicePrompt, currentLanguage);
    }
  }, [currentLanguage, currentLangObj.voicePrompt]);

  return (
    <div className="py-6 px-4 max-w-4xl mx-auto space-y-6 pb-24" id="main-content">
      {/* 1. HIGH-CONTRAST ACCESSIBLE LANGUAGE SELECTION SECTION */}
      <section
        aria-label="Language selection"
        className="p-5 sm:p-6 rounded-3xl bg-white border-2 border-teal-700 shadow-md flex flex-col gap-4 text-slate-900"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-teal-800 text-white text-xl sm:text-2xl shadow-sm shrink-0" aria-hidden="true">
              🌐
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-teal-800 text-white tracking-wider shadow-xs">
                  {t('languagesBadge')}
                </span>
                <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                  • {t('selected')}: <strong className="text-teal-900">{currentLangObj.nativeLabel} ({currentLangObj.label})</strong>
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {t('chooseLanguage')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">
                {t('tapLanguageInstruction')}
              </p>
            </div>
          </div>

          {/* Prominent "Change Language" Button */}
          <button
            onClick={() => setIsLangOpen(true)}
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 active:scale-95 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 border-2 border-teal-700 shrink-0 self-start sm:self-auto"
            aria-label="Open all 10 language options modal"
          >
            <Languages size={19} className="stroke-[2.5]" />
            <span>{t('changeLanguage')}</span>
          </button>
        </div>

        {/* Readable Native Script Language Pills (Direct Tap on Mobile & Desktop) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLanguage === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code, true)}
                className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition active:scale-95 flex items-center gap-1.5 border-2 ${
                  isSelected
                    ? 'bg-teal-800 text-white border-teal-800 shadow-sm ring-2 ring-teal-500'
                    : 'bg-slate-100 hover:bg-teal-50 hover:border-teal-500 text-slate-900 border-slate-300'
                }`}
                aria-label={`Select ${lang.label} (${lang.nativeLabel})`}
              >
                <span>{lang.nativeLabel}</span>
                <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-teal-200' : 'text-slate-500'}`}>
                  ({lang.label})
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. PROMINENT SAHAI VOICE ASSISTANT (Immediately below language section, before service cards) */}
      <SahaiVoiceAssistant
        onOpenLanguage={() => setIsLangOpen(true)}
        onOpenAssistance={() => setIsAssistanceOpen(true)}
      />


      {/* Active Token Quick Widget (if patient already has an active OPD token) */}
      {activeToken && activeSlip && (
        <section
          aria-label="Active Token Notice"
          className="p-4 sm:p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex flex-col items-center justify-center font-black shadow-inner shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider">Token</span>
              <span className="text-xl leading-tight">{activeToken.tokenNumber}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                  {activeToken.status === 'in_consultation' ? 'Now In Room' : 'Your Turn in Progress'}
                </span>
                <span className="text-xs text-slate-500 font-medium">OPD: {activeToken.opdNumber}</span>
              </div>
              <p className="text-base font-bold text-slate-900 mt-1">
                {activeSlip.patientName} • {activeSlip.departmentName} ({activeSlip.roomNumber})
              </p>
              <p className="text-xs text-amber-800 font-medium">
                Wait: ~{activeToken.estimatedWaitMinutes} mins ({activeToken.queuePosition} patients ahead)
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/track')}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition"
          >
            <span>Track My Turn</span>
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {/* SIMPLE MODE (Low Digital Literacy View: 3 Giant Cards) */}
      {simpleMode ? (
        <section aria-label="Simple touch options" className="space-y-4 pt-2">
          <div className="p-3 bg-teal-100/70 border border-teal-300 rounded-2xl flex items-center gap-2 text-teal-900 font-bold text-xs">
            <Sparkles size={16} className="text-teal-700" />
            <span>Simple Voice-First Mode Active. Big Buttons Enabled.</span>
          </div>

          <button
            onClick={() => navigate('/register')}
            className="w-full p-6 sm:p-8 rounded-3xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white shadow-xl flex items-center justify-between text-left border-3 border-teal-500 transition group"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl">
                <ClipboardPlus size={44} />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black">{t('home.registerOpd')}</h3>
                <p className="text-base text-teal-100 font-semibold mt-1">Speak or touch to get hospital slip</p>
              </div>
            </div>
            <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/track')}
            className="w-full p-6 sm:p-8 rounded-3xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-xl flex items-center justify-between text-left border-3 border-blue-500 transition group"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl">
                <Clock size={44} />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black">{t('home.trackMyTurn')}</h3>
                <p className="text-base text-blue-100 font-semibold mt-1">Check how many people ahead</p>
              </div>
            </div>
            <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/emergency')}
            className="w-full p-6 sm:p-8 rounded-3xl bg-red-600 hover:bg-red-700 active:scale-98 text-white shadow-xl flex items-center justify-between text-left border-3 border-red-500 animate-pulse transition group"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl">
                <AlertTriangle size={44} />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black">{t('floating.emergency')}</h3>
                <p className="text-base text-red-100 font-semibold mt-1">Immediate doctor & nurse response</p>
              </div>
            </div>
            <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </section>
      ) : (
        /* STANDARD MODE: 4 Giant Accessible Hospital Touch Cards */
        <section aria-label="Main hospital patient actions" className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          {/* Card 1: Register for OPD */}
          <button
            onClick={() => navigate('/register')}
            className="p-6 sm:p-7 rounded-3xl bg-white hover:bg-teal-50/50 border-2 border-slate-200 hover:border-teal-500 shadow-md hover:shadow-xl text-left transition group relative overflow-hidden flex flex-col justify-between min-h-[180px] active:scale-98"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-teal-100 text-teal-800 rounded-2xl group-hover:scale-110 transition-transform">
                <ClipboardPlus size={32} className="stroke-[2.5]" />
              </div>
              <span className="p-2 rounded-full bg-slate-100 group-hover:bg-teal-600 group-hover:text-white text-slate-400 transition-colors">
                <ArrowRight size={20} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-teal-800">
                {t('home.registerOpd')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                {t('home.registerOpdSub')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-teal-700">
              <CheckCircle size={14} />
              <span>Voice • ABHA • Form</span>
            </div>
          </button>

          {/* Card 2: I already have a slip (Scan or Enter) */}
          <button
            onClick={() => navigate('/scan')}
            className="p-6 sm:p-7 rounded-3xl bg-white hover:bg-indigo-50/50 border-2 border-slate-200 hover:border-indigo-500 shadow-md hover:shadow-xl text-left transition group relative overflow-hidden flex flex-col justify-between min-h-[180px] active:scale-98"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-indigo-100 text-indigo-800 rounded-2xl group-hover:scale-110 transition-transform">
                <Scan size={32} className="stroke-[2.5]" />
              </div>
              <span className="p-2 rounded-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-colors">
                <ArrowRight size={20} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-indigo-800">
                {t('home.alreadyHaveSlip')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                {t('home.alreadyHaveSlipSub')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-indigo-700">
              <CheckCircle size={14} />
              <span>Paper Photo OCR • QR Code</span>
            </div>
          </button>

          {/* Card 3: Track My Turn */}
          <button
            onClick={() => navigate('/track')}
            className="p-6 sm:p-7 rounded-3xl bg-white hover:bg-blue-50/50 border-2 border-slate-200 hover:border-blue-500 shadow-md hover:shadow-xl text-left transition group relative overflow-hidden flex flex-col justify-between min-h-[180px] active:scale-98"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-blue-100 text-blue-800 rounded-2xl group-hover:scale-110 transition-transform">
                <Clock size={32} className="stroke-[2.5]" />
              </div>
              <span className="p-2 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-400 transition-colors">
                <ArrowRight size={20} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-blue-800">
                {t('home.trackMyTurn')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                {t('home.trackMyTurnSub')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-blue-700">
              <CheckCircle size={14} />
              <span>Live Updates • SMS Alerts</span>
            </div>
          </button>

          {/* Card 4: Find My Way (Floor Navigation) */}
          <button
            onClick={() => navigate('/navigation')}
            className="p-6 sm:p-7 rounded-3xl bg-white hover:bg-emerald-50/50 border-2 border-slate-200 hover:border-emerald-500 shadow-md hover:shadow-xl text-left transition group relative overflow-hidden flex flex-col justify-between min-h-[180px] active:scale-98"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-emerald-100 text-emerald-800 rounded-2xl group-hover:scale-110 transition-transform">
                <Compass size={32} className="stroke-[2.5]" />
              </div>
              <span className="p-2 rounded-full bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-400 transition-colors">
                <ArrowRight size={20} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-emerald-800">
                {t('home.findMyWay')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                {t('home.findMyWaySub')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-emerald-700">
              <CheckCircle size={14} />
              <span>Landmarks • Wheelchair Route</span>
            </div>
          </button>
        </section>
      )}

      {/* Hospital Key Quick Facilities */}
      <section aria-label="Quick Hospital Services" className="pt-4 border-t border-slate-200">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          {t('quickFacilities')}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/navigation?destination=Pharmacy')}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 text-left transition flex items-center gap-2.5"
          >
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold">💊</span>
            <div>
              <p className="text-xs font-bold text-slate-900">{t('pharmacy')}</p>
              <p className="text-[10px] text-slate-500">{t('freeMedicine')}</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/navigation?destination=Lab')}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 text-left transition flex items-center gap-2.5"
          >
            <span className="p-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold">🧪</span>
            <div>
              <p className="text-xs font-bold text-slate-900">{t('lab')}</p>
              <p className="text-[10px] text-slate-500">{t('room3Ground')}</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/navigation?destination=Water')}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 text-left transition flex items-center gap-2.5"
          >
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-bold">💧</span>
            <div>
              <p className="text-xs font-bold text-slate-900">{t('drinkingWater')}</p>
              <p className="text-[10px] text-slate-500">{t('centralPurifier')}</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/navigation?destination=Toilet')}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 text-left transition flex items-center gap-2.5"
          >
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">🚻</span>
            <div>
              <p className="text-xs font-bold text-slate-900">{t('restrooms')}</p>
              <p className="text-[10px] text-slate-500">{t('accessible')}</p>
            </div>
          </button>
        </div>
      </section>

      <LanguageModal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} />
      <AssistanceModal isOpen={isAssistanceOpen} onClose={() => setIsAssistanceOpen(false)} />
    </div>
  );
};
