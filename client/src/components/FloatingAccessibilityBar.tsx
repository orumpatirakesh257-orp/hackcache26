import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  HelpCircle,
  Volume2,
  VolumeX,
  Languages,
  Type,
  Sparkles,
} from 'lucide-react';
import { useAccessibilityStore } from '../store/useAccessibilityStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { speakText, stopSpeaking, getActiveVoiceEngine } from '../utils/audio';
import { LanguageModal } from './LanguageModal';
import { AssistanceModal } from './AssistanceModal';
import { LanguageCode } from '../../../shared/types';

export const FloatingAccessibilityBar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    fontSize,
    cycleFontSize,
    simpleMode,
    toggleSimpleMode,
  } = useAccessibilityStore();
  const { currentLanguage } = useLanguageStore();

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<'elevenlabs' | 'webspeech'>('webspeech');

  useEffect(() => {
    // Check TTS engine status from server
    fetch('/api/tts/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.activeEngine) setVoiceEngine(data.activeEngine);
      })
      .catch(() => {});
  }, []);

  const handleReadAloud = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    // Read main visible content text
    const mainContent = document.getElementById('main-content');
    const textToRead = mainContent?.innerText || document.body.innerText.slice(0, 350);

    setIsSpeaking(true);
    const engineUsed = await speakText(textToRead, currentLanguage);
    setVoiceEngine(engineUsed);
  };

  const handleEmergency = () => {
    navigate('/emergency');
  };

  return (
    <>
      {/* Voice Engine Micro-Indicator */}
      <div className="fixed top-2 right-4 z-40 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur shadow-sm border border-slate-200 text-[11px] text-slate-600">
        <span className={`w-2 h-2 rounded-full ${voiceEngine === 'elevenlabs' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-400'}`}></span>
        <span>Voice: <strong className="font-semibold text-slate-800">{voiceEngine === 'elevenlabs' ? 'ElevenLabs AI' : 'Web Speech'}</strong></span>
      </div>

      {/* Persistent Floating Bottom Accessibility Dock */}
      <nav
        aria-label="Accessibility and Quick Help Toolbar"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-slate-200 shadow-2xl px-2 sm:px-6 py-2.5"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-1 sm:gap-2">
          {/* Emergency Button - Distinct Red reserved ONLY for emergency */}
          <button
            onClick={handleEmergency}
            className="flex-1 sm:flex-initial min-w-[76px] sm:min-w-[130px] min-h-[48px] px-2 sm:px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-1.5 border-2 border-red-500 animate-pulse transition"
            aria-label="One-tap Emergency Request"
          >
            <AlertTriangle size={20} className="stroke-[2.5]" />
            <span className="tracking-wide uppercase font-black">{t('floating.emergency')}</span>
          </button>

          {/* Need Help / Assistance */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="min-w-[48px] min-h-[48px] px-2.5 sm:px-3 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition"
            aria-label="Request Assistance: Wheelchair, Escort, or Interpreter"
          >
            <HelpCircle size={19} className="text-teal-700" />
            <span className="hidden sm:inline">{t('floating.needHelp')}</span>
          </button>

          {/* Listen Screen Aloud */}
          <button
            onClick={handleReadAloud}
            className={`min-w-[48px] min-h-[48px] px-2.5 sm:px-3 py-2 rounded-2xl border font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
              isSpeaking
                ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
            aria-label="Listen to page read aloud"
          >
            {isSpeaking ? <VolumeX size={19} className="text-amber-700" /> : <Volume2 size={19} className="text-teal-700" />}
            <span className="hidden sm:inline">{isSpeaking ? t('floating.stopListening') : t('floating.listen')}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setIsLangOpen(true)}
            className="min-w-[48px] min-h-[48px] px-2.5 sm:px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition"
            aria-label="Change Language"
          >
            <Languages size={19} className="text-teal-700" />
            <span className="font-semibold uppercase text-[11px] sm:text-xs">{currentLanguage}</span>
          </button>

          {/* Text Size (A- / A / A+) */}
          <button
            onClick={cycleFontSize}
            className="min-w-[48px] min-h-[48px] px-2.5 sm:px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition"
            aria-label={`Cycle Text Size: currently ${fontSize}`}
            title="Cycle Text Size"
          >
            <Type size={19} className="text-teal-700" />
            <span className="text-[11px] font-black uppercase">
              {fontSize === 'normal' ? 'A' : fontSize === 'large' ? 'A+' : 'A++'}
            </span>
          </button>

          {/* Simple Mode (Low digital literacy) */}
          <button
            onClick={toggleSimpleMode}
            className={`min-w-[48px] min-h-[48px] px-2.5 sm:px-3 py-2 rounded-2xl border font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
              simpleMode
                ? 'bg-teal-600 border-teal-700 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
            aria-label="Toggle Simple Mode"
            title="Low Digital Literacy Mode"
          >
            <Sparkles size={18} className={simpleMode ? 'text-yellow-300' : 'text-teal-700'} />
            <span className="hidden sm:inline">{t('floating.simpleMode')}</span>
          </button>
        </div>
      </nav>

      <LanguageModal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} />
      <AssistanceModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};
