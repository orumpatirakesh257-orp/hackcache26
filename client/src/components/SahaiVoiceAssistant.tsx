import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  RotateCcw,
  Send,
  Keyboard,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Languages,
  Compass,
  Clock,
  ClipboardPlus,
  Scan,
  HelpCircle,
  Square,
} from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { speakText, stopSpeaking, isSpeakingCurrently, getSpeechRecognitionClass } from '../utils/audio';
import { SUPPORTED_LANGUAGES, EMERGENCY_DANGER_KEYWORDS, DEPARTMENTS_DATA } from '../../../shared/constants';
import { LanguageCode } from '../../../shared/types';

interface SahaiVoiceAssistantProps {
  onOpenLanguage?: () => void;
  onOpenAssistance?: () => void;
}

interface ActionButton {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'emergency' | 'secondary';
}

export const SahaiVoiceAssistant: React.FC<SahaiVoiceAssistantProps> = ({
  onOpenLanguage,
  onOpenAssistance,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeToken, activeSlip } = useQueueStore();
  const { currentLanguage } = useLanguageStore();
  const currentLang = currentLanguage;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [actionButton, setActionButton] = useState<ActionButton | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTypeInstead, setIsTypeInstead] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<any>(null);

  const speechRecognitionClass = getSpeechRecognitionClass();

  // Language speech code mapping
  const langSpeechCodeMap: Record<LanguageCode, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
  };

  // Welcome prompt on mount or language change
  useEffect(() => {
    setAssistantReply(t('voiceWelcome'));
    setActionButton({
      label: t('startOpdRegistration'),
      onClick: () => navigate('/register'),
      icon: <ClipboardPlus size={18} />,
      variant: 'primary',
    });
    setTranscript('');
    setErrorMessage(null);
  }, [currentLang, t, navigate]);

  // Clean up speech recognition & speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      stopSpeaking();
    };
  }, []);

  // Poll speaking status if audio is playing
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeaking(isSpeakingCurrently());
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // Conversational response processor (Local + Backend)
  const processQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsProcessing(true);
    setStatusMessage(t('listening'));
    setErrorMessage(null);

    const tokenContext = activeToken && activeSlip ? {
      tokenNumber: activeToken.tokenNumber,
      departmentName: activeSlip.departmentName,
      queuePosition: activeToken.queuePosition,
      estimatedWaitMinutes: activeToken.estimatedWaitMinutes,
      roomNumber: activeSlip.roomNumber,
    } : null;

    try {
      // 1. Try backend API first
      const res = await fetch('/api/voice-assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          language: currentLang,
          activeTokenInfo: tokenContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        handleAssistantResponse(data);
        return;
      }
    } catch (err) {
      console.warn('Backend voice assistant call failed, using client-side engine', err);
    } finally {
      setIsProcessing(false);
    }

    // 2. Client-side resilient fallback engine
    const localResult = getClientSideResponse(queryText, currentLang, tokenContext);
    handleAssistantResponse(localResult);
  };

  const handleAssistantResponse = (data: {
    reply: string;
    actionType?: 'register' | 'track' | 'scan' | 'navigation' | 'emergency' | 'assistance';
    actionTarget?: string;
    actionLabel?: string;
    emergencyTriggered: boolean;
    destination?: string;
  }) => {
    setAssistantReply(data.reply);
    setStatusMessage('');

    // Configure action button
    if (data.emergencyTriggered || data.actionType === 'emergency') {
      setActionButton({
        label: data.actionLabel || t('immediateEmergencyHelp'),
        onClick: () => navigate('/emergency'),
        icon: <AlertTriangle size={18} className="stroke-[2.5]" />,
        variant: 'emergency',
      });
    } else if (data.actionType === 'track') {
      setActionButton({
        label: data.actionLabel || t('trackMyTurnLive'),
        onClick: () => navigate('/track'),
        icon: <Clock size={18} />,
        variant: 'primary',
      });
    } else if (data.actionType === 'scan') {
      setActionButton({
        label: data.actionLabel || t('scanPaperSlipButton'),
        onClick: () => navigate('/scan'),
        icon: <Scan size={18} />,
        variant: 'primary',
      });
    } else if (data.actionType === 'navigation') {
      setActionButton({
        label: data.actionLabel || t('openHospitalMap'),
        onClick: () => navigate(data.actionTarget || '/navigation'),
        icon: <Compass size={18} />,
        variant: 'primary',
      });
    } else if (data.actionType === 'assistance') {
      setActionButton({
        label: data.actionLabel || t('requestAssistance'),
        onClick: () => {
          if (onOpenAssistance) onOpenAssistance();
          else navigate('/navigation');
        },
        icon: <HelpCircle size={18} />,
        variant: 'primary',
      });
    } else {
      // Default to registration
      setActionButton({
        label: data.actionLabel || t('startOpdRegistration'),
        onClick: () => navigate(data.actionTarget || '/register'),
        icon: <ClipboardPlus size={18} />,
        variant: 'primary',
      });
    }

    // Speak aloud in user's language
    speakAssistantResponse(data.reply);
  };

  const speakAssistantResponse = async (text: string) => {
    setIsSpeaking(true);
    await speakText(text, currentLang, () => {
      setIsSpeaking(false);
    });
  };

  // Toggle Voice Recording
  const handleToggleListening = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setStatusMessage('');
      return;
    }

    if (!speechRecognitionClass) {
      setErrorMessage(t('speechUnsupported'));
      setIsTypeInstead(true);
      return;
    }

    try {
      const recognition = new speechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.lang = langSpeechCodeMap[currentLang] || 'en-IN';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
        setStatusMessage(t('listening'));
      };

      recognition.onresult = (event: any) => {
        const currentResult = event.results[event.results.length - 1];
        const speechText = currentResult[0].transcript;
        setTranscript(speechText);

        if (currentResult.isFinal) {
          setIsListening(false);
          setStatusMessage('');
          processQuery(speechText);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const errType = event.error;

        if (errType === 'not-allowed' || errType === 'permission-denied') {
          setErrorMessage(t('micBlocked'));
          setIsTypeInstead(true);
        } else if (errType === 'no-speech') {
          setErrorMessage(t('noSpeech'));
        } else if (errType === 'network') {
          setErrorMessage(t('networkError'));
        } else {
          setErrorMessage(`${t('common.error')} (${errType})`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setErrorMessage(t('speechUnsupported'));
      setIsTypeInstead(true);
    }
  };

  // Submit Text Input
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const q = textInput.trim();
    setTranscript(q);
    setTextInput('');
    processQuery(q);
  };

  // Preset Prompts Chips
  const presetChips = [
    t('chipDoctor'),
    t('chipToken'),
    t('chipSlip'),
    t('chipPharmacy'),
    t('chipWheelchair'),
  ];

  return (
    <section
      aria-label="SAHAI Voice Assistant"
      className="p-5 sm:p-7 rounded-3xl bg-linear-to-b from-teal-50/80 via-white to-slate-50 border-2 border-teal-600 shadow-xl transition-all"
    >
      {/* Top Bar: Title, Subtitle & Language Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-teal-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-teal-600 text-white shadow-sm flex items-center justify-center">
              <Sparkles size={20} />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t('talkToSahai')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-1">
            {t('speakInYourLanguage')}
          </p>
        </div>

        {/* Selected Language Indicator with Change Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="px-3 py-1.5 rounded-2xl bg-teal-100/80 border border-teal-300 flex items-center gap-1.5 text-xs font-bold text-teal-900">
            <Languages size={15} className="text-teal-700" />
            <span>{currentLangObj.nativeLabel} ({currentLangObj.label})</span>
          </div>
          {onOpenLanguage && (
            <button
              onClick={onOpenLanguage}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold underline px-1 py-1"
              aria-label={t('changeLanguage')}
            >
              {t('changeLanguage')}
            </button>
          )}
        </div>
      </div>

      {/* Main Voice Interaction Zone */}
      <div className="py-5 flex flex-col items-center text-center">
        {/* Giant Accessible Microphone Button */}
        <div className="relative mb-3 flex items-center justify-center">
          {/* Animated Pulsing Ring when Listening */}
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40 scale-125 pointer-events-none" />
          )}

          <button
            onClick={handleToggleListening}
            aria-label={isListening ? t('tapToStop') : t('tapToSpeak')}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 active:scale-95 focus:outline-none focus:ring-4 ${
              isListening
                ? 'bg-red-600 text-white ring-red-300 shadow-red-200'
                : 'bg-teal-700 hover:bg-teal-800 text-white ring-teal-200 hover:shadow-2xl'
            }`}
          >
            {isListening ? (
              <Square size={36} className="fill-white animate-pulse" />
            ) : (
              <Mic size={38} className="stroke-[2.2]" />
            )}
          </button>
        </div>

        {/* Big Touch-friendly "Tap to Speak" Label */}
        <button
          onClick={handleToggleListening}
          className={`min-h-[44px] px-5 py-2 rounded-2xl font-black text-sm sm:text-base transition flex items-center gap-2 shadow-sm ${
            isListening
              ? 'bg-red-100 text-red-800 border-2 border-red-300 animate-pulse'
              : 'bg-white hover:bg-teal-50 text-slate-900 border-2 border-slate-300 hover:border-teal-500'
          }`}
        >
          <Mic size={18} className={isListening ? 'text-red-600' : 'text-teal-700'} />
          <span>
            {isListening ? t('tapToStop') : t('tapToSpeak')}
          </span>
        </button>

        {/* Visual Listening Sound Waves & Status */}
        {isListening && (
          <div className="mt-3 flex flex-col items-center gap-1.5 animate-fade-in" aria-live="polite">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-4 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-6 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-8 bg-teal-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-6 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-4 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-teal-800">
              {statusMessage || t('listening')}
            </p>
          </div>
        )}

        {/* Error Feedback Message (Microphone permission, silence, unsupported) */}
        {errorMessage && (
          <div
            className="mt-3 p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs sm:text-sm font-bold flex items-center gap-2 max-w-xl text-left"
            role="alert"
          >
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Transcript & Assistant Response Box */}
      <div className="space-y-3 pt-2">
        {/* Patient Transcript (What the user said) */}
        {transcript && (
          <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-left">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 block mb-0.5">
              {t('youSaid')}:
            </span>
            <p className="text-base font-bold text-slate-900 leading-snug">"{transcript}"</p>
          </div>
        )}

        {/* Assistant Spoken Response Display */}
        {assistantReply && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-teal-500 shadow-sm text-left relative">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                <span className="text-xs font-black text-teal-900 uppercase tracking-wider">
                  {t('assistantResponse')}
                </span>
              </div>

              {/* Speech Playback Controls: Stop or Repeat */}
              <div className="flex items-center gap-1.5">
                {isSpeaking ? (
                  <button
                    onClick={() => {
                      stopSpeaking();
                      setIsSpeaking(false);
                    }}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
                    aria-label={t('stopVoice')}
                  >
                    <Square size={14} className="fill-white" />
                    <span>{t('stopVoice')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => speakAssistantResponse(assistantReply)}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold text-xs flex items-center gap-1.5 border border-teal-300 transition active:scale-95"
                    aria-label={t('repeat')}
                  >
                    <RotateCcw size={14} />
                    <span>{t('repeat')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* High-contrast readable reply */}
            <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              {assistantReply}
            </p>

            {/* Direct Connect Action Button (Navigate to Register, Track, Scan, Emergency, Nav) */}
            {actionButton && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={actionButton.onClick}
                  className={`min-h-[48px] px-5 py-2.5 rounded-2xl font-black text-sm sm:text-base shadow-md flex items-center gap-2 transition active:scale-95 ${
                    actionButton.variant === 'emergency'
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse border-2 border-red-500'
                      : 'bg-teal-700 hover:bg-teal-800 text-white border-2 border-teal-600'
                  }`}
                >
                  {actionButton.icon}
                  <span>{actionButton.label}</span>
                  <ArrowRight size={18} />
                </button>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {t('tapToOpenScreen')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* "Type Instead" Section for users who cannot or prefer not to use voice */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsTypeInstead(!isTypeInstead)}
            className="text-xs sm:text-sm font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 py-1 min-h-[44px]"
            aria-expanded={isTypeInstead}
          >
            <Keyboard size={18} className="text-teal-700" />
            <span>{isTypeInstead ? t('hideTextInput') : t('typeInstead')}</span>
          </button>
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            For quiet areas or browsers without mic
          </span>
        </div>

        {isTypeInstead && (
          <form onSubmit={handleTextSubmit} className="mt-2 flex gap-2 animate-fade-in">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t('typePlaceholder')}
              className="flex-1 min-h-[48px] px-4 rounded-2xl border-2 border-slate-300 focus:border-teal-600 focus:outline-none text-slate-900 font-bold text-sm bg-white"
              aria-label="Type your hospital question"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="min-h-[48px] px-5 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-black text-sm flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Send size={16} />
              <span>{t('send')}</span>
            </button>
          </form>
        )}
      </div>

      {/* Suggested Quick Conversation Chips */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
          {t('commonQuestions')}:
        </p>
        <div className="flex flex-wrap gap-2">
          {presetChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTranscript(chip);
                processQuery(chip);
              }}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-slate-900 hover:text-teal-900 border-2 border-slate-200 hover:border-teal-400 text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

// Client-side rule-based fallback response generator supporting all 10 languages
function getClientSideResponse(
  query: string,
  lang: LanguageCode,
  activeTokenInfo: {
    tokenNumber: string;
    departmentName: string;
    queuePosition: number;
    estimatedWaitMinutes: number;
    roomNumber: string;
  } | null
): {
  reply: string;
  actionType?: 'register' | 'track' | 'scan' | 'navigation' | 'emergency' | 'assistance';
  actionTarget?: string;
  actionLabel?: string;
  emergencyTriggered: boolean;
  destination?: string;
} {
  const text = query.trim();
  const lower = text.toLowerCase();

  // 1. Emergency
  for (const kw of EMERGENCY_DANGER_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      const emergencyReplies: Record<LanguageCode, string> = {
        te: '⚠️ అత్యవసరం (EMERGENCY): తీవ్రమైన గుండె నొప్పి, శ్వాస ఆడకపోవడం లేదా రక్తస్రావం ఉంటే దయచేసి సాధారణ టోకెన్ కోసం వేచి ఉండకండి. తక్షణమే ఎమర్జెన్సీ బ్లాక్‌కు వెళ్లండి లేదా 108 కు కాల్ చేయండి!',
        hi: '⚠️ आपातकाल (EMERGENCY): यदि आपको सीने में तेज दर्द, सांस लेने में तकलीफ या भारी रक्तस्राव है, तो टोकन का इंतजार न करें। तुरंत इमरजेंसी कैजुअल्टी वार्ड में जाएं या 108 पर कॉल करें!',
        ta: '⚠️ அவசரநிலை (EMERGENCY): நெஞ்சு வலி, மூச்சுத் திணறல் அல்லது அதிக இரத்தப்போக்கு இருந்தால் சாதாரண டோக்கனுக்காக காத்திருக்க வேண்டாம். உடனடியாக அவசர சிகிச்சைப் பிரிவுக்குச் செல்லுங்கள்!',
        kn: '⚠️ ತುರ್ತು ಪರಿಸ್ಥಿತಿ (EMERGENCY): ತೀವ್ರ ಎದೆ ನೋವು, ಉಸಿರಾಟದ ತೊಂದರೆ ಅಥವಾ ರಕ್ತಸ್ರಾವವಿದ್ದರೆ ದಯವಿಟ್ಟು ಕಾಯಬೇಡಿ. ತಕ್ಷಣವೇ ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗಕ್ಕೆ ತೆರಳಿ ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ!',
        ml: '⚠️ അടിയന്തിരാവസ്ഥ (EMERGENCY): കഠിനമായ നെഞ്ചുവേദനയോ ശ്വാസതടസ്സമോ രക്തസ്രാവമോ ഉണ്ടെങ്കിൽ ദയവായി ടോക്കണിനായി കാത്തിരിക്കരുത്. ഉടൻ എമർജൻസി വിഭാഗത്തിലേക്ക് പോകുക!',
        bn: '⚠️ জরুরি অবস্থা (EMERGENCY): তীব্র বুকে ব্যথা, শ্বাসকষ্ট বা রক্তপাত হলে অনুগ্রহ করে সাধারণ টোকেনের জন্য অপেক্ষা করবেন না। অবিলম্বে জরুরি বিভাগে যান বা ১০৮ নম্বরে কল করুন!',
        mr: '⚠️ आणीबाणी (EMERGENCY): छातीत तीव्र वेदना, श्वास घेण्यास त्रास किंवा जास्त रक्तस्त्राव होत असल्यास कृपया टोकनची वाट पाहू नका. त्वरित आपत्कालीन विभागात जा किंवा १०८ वर कॉल करा!',
        gu: '⚠️ કટોકટી (EMERGENCY): છાતીમાં તીવ્ર દુખાવો, શ્વાસ લેવામાં તકલીફ અથવા ભારે રક્તસ્રાવ હોય તો ટોકનની રાહ જોશો નહીં. તાત્કાલિક ઇમરજન્સી વિભાગમાં જાઓ અથવા ૧૦૮ પર કૉલ કરો!',
        pa: '⚠️ ਐਮਰਜੈਂਸੀ (EMERGENCY): ਛਾਤੀ ਵਿੱਚ ਤੇਜ਼ ਦਰਦ, ਸਾਹ ਲੈਣ ਵਿੱਚ ਤਕਲੀਫ਼ ਜਾਂ ਜ਼ਿਆਦਾ ਖ਼ੂਨ ਵਹਿਣ ਦੀ ਸੂਰਤ ਵਿੱਚ ਕਿਰਪਾ ਕਰਕੇ ਟੋਕਨ ਦੀ ਉਡੀਕ ਨਾ ਕਰੋ। ਤੁਰੰਤ ਐਮਰਜੈਂਸੀ ਵਿਭਾਗ ਜਾਓ ਜਾਂ 108 ਤੇ ਕਾਲ ਕਰੋ!',
        en: '⚠️ EMERGENCY ALERT: If you have severe chest pain, breathing difficulty, or heavy bleeding, please DO NOT wait for a normal OPD token. Proceed immediately to the Emergency Casualty Block or call 108!',
      };
      return {
        reply: emergencyReplies[lang] || emergencyReplies.en,
        actionType: 'emergency',
        actionTarget: '/emergency',
        emergencyTriggered: true,
      };
    }
  }

  // 2. Doctor Consultation
  if (
    lower.includes('doctor') ||
    text.includes('డాక్టర్') ||
    text.includes('వైద్యులు') ||
    text.includes('డాక్టర్ను కలవాలి') ||
    text.includes('डॉक्टर') ||
    text.includes('दिखाना') ||
    text.includes('டாக்டர்') ||
    text.includes('மருத்துவர்') ||
    text.includes('ಡಾಕ್ಟರ್') ||
    text.includes('ವೈದ್ಯ') ||
    text.includes('ഡോക്ടർ') ||
    text.includes('ডাক্তার') ||
    text.includes('ዶክተር') ||
    text.includes('વાત') ||
    text.includes('ਡਾਕਟਰ')
  ) {
    const doctorReplies: Record<LanguageCode, string> = {
      te: 'సరే. మీరు ఏ విభాగానికి వెళ్లాలనుకుంటున్నారు? మీకు తెలియకపోతే, మీ సమస్యను చెప్పండి. నేను మీకు సహాయం చేస్తాను.',
      hi: 'ठीक है। आप किस विभाग में जाना चाहते हैं? यदि आपको जानकारी नहीं है, तो अपनी समस्या या लक्षण बताएं। मैं आपकी मदद करूंगा।',
      ta: 'சரி. நீங்கள் எந்தப் பிரிவுக்குச் செல்ல விரும்புகிறீர்கள்? உங்களுக்குத் தெரியாவிட்டால், உங்கள் பிரச்சனையைச் சொல்லுங்கள். நான் உங்களுக்கு உதவுகிறேன்.',
      kn: 'ಸರಿ. ನೀವು ಯಾವ ವಿಭಾಗಕ್ಕೆ ಭೇಟಿ ನೀಡಲು ಬಯಸುತ್ತೀರಿ? ನಿಮಗೆ ತಿಳಿದಿಲ್ಲದಿದ್ದರೆ, ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಯನ್ನು ತಿಳಿಸಿ. ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
      ml: 'ശരി. ഏത് വിഭാഗത്തിലാണ് പോകേണ്ടത്? അറിയില്ലെങ്കിൽ, നിങ്ങളുടെ ബുദ്ധിമുട്ട് പറയൂ. ഞാൻ സഹായിക്കാം.',
      bn: 'ঠিক আছে। আপনি কোন বিভাগে যেতে চান? যদি জানা না থাকে, তবে আপনার সমস্যা জানান। আমি আপনাকে সাহায্য করব।',
      mr: 'ठीक आहे. तुम्हाला कोणत्या विभागात जायचे आहे? माहिती नसल्यास, तुमची समस्या सांगा. मी तुम्हाला मदत करतो.',
      gu: 'બરાબર. તમે કયા વિભાગમાં જવા માંગો છો? જો ખબર ન હોય તો તમારી તકલીફ જણાવો. હું તમને મદદ કરીશ.',
      pa: 'ਠੀਕ ਹੈ। ਤੁਸੀਂ ਕਿਸ ਵਿਭਾਗ ਵਿੱਚ ਜਾਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਜੇਕਰ ਪਤਾ ਨਹੀਂ ਹੈ ਤਾਂ ਆਪਣੀ ਸਮੱਸਿਆ ਦੱਸੋ। ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰਾਂਗਾ।',
      en: "Sure. Which department would you like to visit? If you're not sure, tell me your symptoms and I will help guide you.",
    };
    return {
      reply: doctorReplies[lang] || doctorReplies.en,
      actionType: 'register',
      actionTarget: '/register',
      emergencyTriggered: false,
    };
  }

  // 3. Queue Token Check
  if (
    lower.includes('token') ||
    lower.includes('wait') ||
    lower.includes('turn') ||
    text.includes('టోకెన్') ||
    text.includes('సమయం') ||
    text.includes('క్యూ') ||
    text.includes('टोकन') ||
    text.includes('बारी') ||
    text.includes('டோக்கன்') ||
    text.includes('ಟೋಕನ್') ||
    text.includes('ടോക്കൺ') ||
    text.includes('টোকেন') ||
    text.includes('ટ્રેક')
  ) {
    if (activeTokenInfo) {
      const tokenReplies: Record<LanguageCode, string> = {
        te: `మీ టోకెన్ సంఖ్య ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}). మీకు ముందు ${activeTokenInfo.queuePosition} మంది రోగులు ఉన్నారు. అంచనా వేసిన వేచి ఉండే సమయం సుమారు ${activeTokenInfo.estimatedWaitMinutes} నిమిషాలు (${activeTokenInfo.roomNumber}).`,
        hi: `आपका टोकन नंबर ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}) है। आपसे आगे ${activeTokenInfo.queuePosition} मरीज हैं। अनुमानित प्रतीक्षा समय लगभग ${activeTokenInfo.estimatedWaitMinutes} मिनट है (${activeTokenInfo.roomNumber})।`,
        ta: `உங்கள் டோக்கன் எண் ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}). உங்களுக்கு முன் ${activeTokenInfo.queuePosition} நோயாளிகள் உள்ளனர். காத்திருக்கும் நேரம் சுமார் ${activeTokenInfo.estimatedWaitMinutes} நிமிடங்கள் (${activeTokenInfo.roomNumber}).`,
        kn: `ನಿಮ್ಮ ಟೋಕನ್ ಸಂಖ್ಯೆ ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}). ನಿಮ್ಮ ಮುಂದೆ ${activeTokenInfo.queuePosition} ರೋಗಿಗಳಿದ್ದಾರೆ. ಅಂದಾಜು ಕಾಯುವ ಸಮಯ ಸುಮಾರು ${activeTokenInfo.estimatedWaitMinutes} ನಿಮಿಷಗಳು (${activeTokenInfo.roomNumber}).`,
        ml: `നിങ്ങളുടെ ടോക്കൺ നമ്പർ ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}) ആണ്. നിങ്ങൾക്ക് മുന്നിൽ ${activeTokenInfo.queuePosition} രോഗികളുണ്ട്. കാത്തിരിപ്പ് സമയം ഏകദേശം ${activeTokenInfo.estimatedWaitMinutes} മിനിറ്റ് (${activeTokenInfo.roomNumber}).`,
        bn: `আপনার টোকেন নম্বর ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName})। আপনার সামনে ${activeTokenInfo.queuePosition} জন রোগী আছেন। আনুমানিক অপেক্ষার সময় প্রায় ${activeTokenInfo.estimatedWaitMinutes} মিনিট (${activeTokenInfo.roomNumber})।`,
        mr: `तुमचा टोकन क्रमांक ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}) आहे. तुमच्या पुढे ${activeTokenInfo.queuePosition} रुग्ण आहेत. अंदाजे प्रतीक्षा वेळ सुमारे ${activeTokenInfo.estimatedWaitMinutes} मिनिटे आहे (${activeTokenInfo.roomNumber})।`,
        gu: `તમારો ટોકન નંબર ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}) છે. તમારી આગળ ${activeTokenInfo.queuePosition} દર્દીઓ છે. અંદાજિત પ્રતીક્ષા સમય આશરે ${activeTokenInfo.estimatedWaitMinutes} મિનિટ છે (${activeTokenInfo.roomNumber}).`,
        pa: `ਤੁਹਾਡਾ ਟੋਕਨ ਨੰਬਰ ${activeTokenInfo.tokenNumber} (${activeTokenInfo.departmentName}) ਹੈ। ਤੁਹਾਡੇ ਤੋਂ ਅੱਗੇ ${activeTokenInfo.queuePosition} ਮਰੀਜ਼ ਹਨ। ਅੰਦਾਜ਼ਨ ਉਡੀਕ ਸਮਾਂ ਲਗਭਗ ${activeTokenInfo.estimatedWaitMinutes} ਮਿੰਟ ਹੈ (${activeTokenInfo.roomNumber})।`,
        en: `Your token is ${activeTokenInfo.tokenNumber} for ${activeTokenInfo.departmentName}. There are ${activeTokenInfo.queuePosition} patients ahead of you. Estimated wait: ~${activeTokenInfo.estimatedWaitMinutes} mins in ${activeTokenInfo.roomNumber}.`,
      };
      return {
        reply: tokenReplies[lang] || tokenReplies.en,
        actionType: 'track',
        actionTarget: '/track',
        emergencyTriggered: false,
      };
    } else {
      const noTokenReplies: Record<LanguageCode, string> = {
        te: 'ప్రస్తుతం మీకు క్రియాశీల క్యూ టోకెన్ లేదు. కొత్త టోకెన్ పొందడానికి OPD నమోదు చేసుకోండి లేదా ఇప్పటికే రసీదు ఉంటే స్కాన్ చేయండి.',
        hi: 'वर्तमान में आपका कोई सक्रिय कतार टोकन नहीं है। नया टोकन पाने के लिए ओपीडी पंजीकरण करें या पर्ची स्कैन करें।',
        ta: 'தற்போது உங்களிடம் செயலில் உள்ள டோக்கன் இல்லை. புதிய டோக்கன் பெற OPD பதிவு செய்யவும் அல்லது சீட்டை ஸ்கேன் செய்யவும்.',
        kn: 'ಪ್ರಸ್ತುತ ನಿಮ್ಮ ಬಳಿ ಸಕ್ರಿಯ ಕ್ಯೂ ಟೋಕನ್ ಇಲ್ಲ. ಹೊಸ ಟೋಕನ್ ಪಡೆಯಲು ಒಪಿಡಿ ನೋಂದಣಿ ಮಾಡಿ ಅಥವಾ ಚೀಟಿಯನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
        ml: 'നിലവിൽ നിങ്ങൾക്ക് സജീവമായ ക്യൂ ടോക്കൺ ഇല്ല. പുതിയ ടോക്കൺ ലഭിക്കാൻ ഒപിഡി രജിസ്ട്രേഷൻ നടത്തുക അല്ലെങ്കിൽ രസീത് സ്കാൻ ചെയ്യുക.',
        bn: 'বর্তমানে আপনার কোনো সক্রিয় কিউ টোকেন নেই। নতুন টোকেন পেতে ওপিডি রেজিস্ট্রেশন করুন বা স্লিপ স্ক্যান করুন।',
        mr: 'सध्या तुमच्याकडे सक्रिय टोकन नाही. नवीन टोकन मिळवण्यासाठी ओपीडी नोंदणी करा किंवा पावती स्कॅन करा.',
        gu: 'હાલમાં તમારી પાસે સક્રિય કતાર ટોકન નથી. નવું ટોકન મેળવવા માટે ઓપીડી નોંધણી કરો અથવા રસીદ સ્કેન કરો.',
        pa: 'ਮੌਜੂਦਾ ਸਮੇਂ ਤੁਹਾਡੇ ਕੋਲ ਕੋਈ ਚਾਲੂ ਕਤਾਰ ਟੋਕਨ ਨਹੀਂ ਹੈ। ਨਵਾਂ ਟੋਕਨ ਲੈਣ ਲਈ ਓਪੀਡੀ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਕਰੋ ਜਾਂ ਪਰਚੀ ਸਕੈਨ ਕਰੋ।',
        en: "You don't have an active queue token in this session. You can register for an OPD token in 4 easy steps or scan your existing paper slip to start tracking.",
      };
      return {
        reply: noTokenReplies[lang] || noTokenReplies.en,
        actionType: 'register',
        actionTarget: '/register',
        emergencyTriggered: false,
      };
    }
  }

  // 4. Paper Slip Scanning
  if (
    lower.includes('slip') ||
    lower.includes('scan') ||
    lower.includes('paper') ||
    text.includes('రసీదు') ||
    text.includes('స్లిప్') ||
    text.includes('పర్చీ') ||
    text.includes('पर्ची') ||
    text.includes('சீட்டு') ||
    text.includes('ರಸೀದಿ') ||
    text.includes('ಸ್ಲಿಪ್') ||
    text.includes('രസീത്') ||
    text.includes('রসিদ')
  ) {
    const slipReplies: Record<LanguageCode, string> = {
      te: 'ఆసుపత్రి కౌంటర్ నుండి మీకు కాగితపు రసీదు ఉంటే, దాని ఫోటో తీయడం ద్వారా లేదా టోకెన్ నంబర్ నమోదు చేయడం ద్వారా మీ ఫోన్‌లో లైవ్ ట్రాకింగ్ పొందవచ్చు.',
      hi: 'यदि आपके पास अस्पताल काउंटर से कागजी पर्ची है, तो आप फोटो खींचकर या टोकन नंबर डालकर अपने फोन पर लाइव ट्रैकिंग प्राप्त कर सकते हैं।',
      ta: 'உங்களிடம் ஏற்கனவே அச்சிடப்பட்ட மருத்துவமனை சீட்டு இருந்தால், புகைப்படம் எடுப்பதன் மூலம் அல்லது டோக்கன் எண்ணை உள்ளிட்டு நேரடி நிலையை அறியலாம்.',
      kn: 'ಆಸ್ಪತ್ರೆಯ ಕೌಂಟರ್‌ನಿಂದ ನಿಮ್ಮ ಬಳಿ ಕಾಗದದ ಚೀಟಿ ಇದ್ದರೆ, ಫೋಟೋ ತೆಗೆದುಕೊಳ್ಳುವ ಮೂಲಕ ಅಥವಾ ಟೋಕನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸುವ ಮೂಲಕ ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಪಡೆಯಬಹುದು.',
      ml: 'ആശുപത്രി കൗണ്ടറിൽ നിന്നുള്ള പേപ്പർ സ്ലിപ്പ് ഉണ്ടെങ്കിൽ, ഫോട്ടോ എടുത്തോ ടോക്കൺ നമ്പർ നൽകിയോ ലൈവ് ട്രാക്കിംഗ് നേടാം.',
      bn: 'হাসপাতাল কাউন্টার থেকে আপনার কাছে কাগজের স্লিপ থাকলে, ছবি তুলে বা টোকেন নম্বর দিয়ে লাইভ ট্র্যাকিং দেখতে পারেন।',
      mr: 'हॉस्पिटल काउंटरवरून कागदी पावती असल्यास, फोटो काढून किंवा टोकन नंबर टाकून तुम्ही लाईव्ह ट्रॅकिंग पाहू शकता.',
      gu: 'હોસ્પિટલ કાઉન્ટર પરથી કાગળની રસીદ હોય તો, ફોટો પાડીને અથવા ટોકન નંબર દાખલ કરીને લાઇવ ટ્રેકિંગ મેળવી શકો છો.',
      pa: 'ਹਸਪਤਾਲ ਕਾਊਂਟਰ ਤੋਂ ਕਾਗਜ਼ੀ ਪਰਚੀ ਹੋਣ ਤੇ, ਫ਼ੋਟੋ ਖਿੱਚ ਕੇ ਜਾਂ ਟੋਕਨ ਨੰਬਰ ਦਰਜ ਕਰਕੇ ਲਾਈਵ ਟਰੈਕਿੰਗ ਦੇਖ ਸਕਦੇ ਹੋ।',
      en: 'If you already have a printed paper OPD slip from the counter, you can take a photo of the slip or enter your token number to track your turn and get directions on your phone.',
    };
    return {
      reply: slipReplies[lang] || slipReplies.en,
      actionType: 'scan',
      actionTarget: '/scan',
      emergencyTriggered: false,
    };
  }

  // 5. How to Register
  if (
    lower.includes('register') ||
    lower.includes('how to') ||
    text.includes('నమోదు') ||
    text.includes('పద్ధతి') ||
    text.includes('पंजीकरण') ||
    text.includes('பதிவு') ||
    text.includes('ನೋಂದಣಿ') ||
    text.includes('രജിസ്ട്രേഷൻ') ||
    text.includes('নিবন্ধন')
  ) {
    const regReplies: Record<LanguageCode, string> = {
      te: 'OPD నమోదు చాలా సులభం: 1. మీ పేరు మరియు వయస్సు చెప్పండి. 2. మీ సమస్య చెప్పండి. 3. విభాగం ఎంచుకుని డిజిటల్ టోకెన్ పొందండి.',
      hi: 'ओपीडी पंजीकरण बहुत आसान है: 1. अपना नाम और उम्र बताएं। 2. अपनी स्वास्थ्य समस्या बताएं। 3. विभाग चुनकर डिजिटल पर्ची पाएं।',
      ta: 'OPD பதிவு மிகவும் எளிதானது: 1. உங்கள் பெயர் மற்றும் வயது. 2. உங்கள் பிரச்சனை. 3. துறையைத் தேர்ந்தெடுத்து டோக்கன் பெறுங்கள்.',
      kn: 'ಒಪಿಡಿ ನೋಂದಣಿ ಸರಳವಾಗಿದೆ: 1. ಹೆಸರು ಮತ್ತು ವಯಸ್ಸು ತಿಳಿಸಿ. 2. ಸಮಸ್ಯೆ ತಿಳಿಸಿ. 3. ವಿಭಾಗ ಆಯ್ಕೆಮಾಡಿ ಡಿಜಿಟಲ್ ಟೋಕನ್ ಪಡೆಯಿರಿ.',
      ml: 'ഒപിഡി രജിസ്ട്രേഷൻ വളരെ എളുപ്പമാണ്: 1. പേരും പ്രായവും പറയുക. 2. അസുഖ വിവരം പറയുക. 3. വിഭാഗം തിരഞ്ഞെടുത്ത് ഡിജിറ്റൽ ടോക്കൺ നേടുക.',
      bn: 'ওপিডি রেজিস্ট্রেশন খুব সহজ: ১. নাম এবং বয়স বলুন। ২. আপনার সমস্যা জানান। ৩. বিভাগ বেছে ডিজিটাল টোকেন পান।',
      mr: 'ओपीडी नोंदणी खूप सोपी आहे: १. नाव आणि वय सांगा. २. समस्या सांगा. ३. विभाग निवडून डिजिटल टोकन मिळवा.',
      gu: 'ઓપીડી નોંધણી ખૂબ સરળ છે: ૧. નામ અને ઉંમર જણાવો. ૨. તકલીફ જણાવો. ૩. વિભાગ પસંદ કરી ડિજિટલ ટોકન મેળવો.',
      pa: 'ਓਪੀਡੀ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਬਹੁਤ ਆਸਾਨ ਹੈ: 1. ਨਾਮ ਅਤੇ ਉਮਰ ਦੱਸੋ। 2. ਆਪਣੀ ਤਕਲੀਫ਼ ਦੱਸੋ। 3. ਵਿਭਾਗ ਚੁਣ ਕੇ ਡਿਜੀਟਲ ਟੋਕਨ ਪ੍ਰਾਪਤ ਕਰੋ।',
      en: 'OPD registration takes just 4 easy steps: enter your name and age, describe your health complaint, select your department, and receive your digital queue token.',
    };
    return {
      reply: regReplies[lang] || regReplies.en,
      actionType: 'register',
      actionTarget: '/register',
      emergencyTriggered: false,
    };
  }

  // 6. Navigation
  if (
    lower.includes('pharmacy') ||
    lower.includes('medicine') ||
    lower.includes('lab') ||
    lower.includes('water') ||
    lower.includes('toilet') ||
    text.includes('మందులు') ||
    text.includes('ల్యాబ్') ||
    text.includes('మంచినీరు') ||
    text.includes('दवा') ||
    text.includes('மருந்து') ||
    text.includes('ಔಷಧ') ||
    text.includes('മരുന്ന്') ||
    text.includes('ওষুধ') ||
    text.includes('દવા') ||
    text.includes('ਦਵਾਈ')
  ) {
    let dest = 'Pharmacy';
    let loc = 'Hospital Pharmacy is on the Ground Floor Central Block, right next to the Main Entrance and Drinking Water station.';
    if (lower.includes('lab') || text.includes('ల్యాబ్') || text.includes('ਲੈਬ') || text.includes('രക്ത')) {
      dest = 'Lab';
      loc = 'Central Diagnostic Lab (Blood & Urine Tests) is in Room 3 on the Ground Floor Central Block.';
    } else if (lower.includes('water') || text.includes('మంచినీరు') || text.includes('પાણી') || text.includes('ਪਾਣੀ')) {
      dest = 'Water';
      loc = 'Purified Drinking Water is located at the Central Purifier on the Ground Floor next to the Pharmacy.';
    }

    const navReplies: Record<LanguageCode, string> = {
      te: `${loc} మీరు ఆసుపత్రి ల్యాండ్‌మార్క్ మ్యాప్ చూడాలనుకుంటున్నారా?`,
      hi: `${loc} क्या आप अस्पताल का लैंडमार्क नक्शा देखना चाहते हैं?`,
      ta: `${loc} மருத்துவமனை வரைபடத்தைப் பார்க்க விரும்புகிறீர்களா?`,
      kn: `${loc} ನೀವು ಆಸ್ಪತ್ರೆಯ ನಕ್ಷೆಯನ್ನು ನೋಡಲು ಬಯಸುವಿರಾ?`,
      ml: `${loc} നിങ്ങൾക്ക് ആശുപത്രി ഭൂപടം കാണണോ?`,
      bn: `${loc} আপনি কি হাসপাতালের মানচিত্র দেখতে চান?`,
      mr: `${loc} तुम्हाला हॉस्पिटलचा नकाशा पाहायचा आहे का?`,
      gu: `${loc} શું તમે હોસ્પિટલનો નકશો જોવા માંગો છો?`,
      pa: `${loc} ਕੀ ਤੁਸੀਂ ਹਸਪਤਾਲ ਦਾ ਨਕਸ਼ਾ ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹੋ?`,
      en: `${loc} Would you like to view step-by-step directions on the hospital map?`,
    };
    return {
      reply: navReplies[lang] || navReplies.en,
      actionType: 'navigation',
      actionTarget: `/navigation?destination=${encodeURIComponent(dest)}`,
      emergencyTriggered: false,
      destination: dest,
    };
  }

  // 7. Assistance / Wheelchair
  if (
    lower.includes('wheelchair') ||
    lower.includes('help') ||
    text.includes('వీల్‌చైర్') ||
    text.includes('సహాయం') ||
    text.includes('व्हीलचेयर') ||
    text.includes('मदद') ||
    text.includes('சக்கர நாற்காலி') ||
    text.includes('ಗಾಲಿಕುರ್ಚಿ') ||
    text.includes('വീൽചെയർ') ||
    text.includes('হুইলচেয়ার') ||
    text.includes('વ્હીલચેર') ||
    text.includes('ਵ੍ਹੀਲਚੇਅਰ')
  ) {
    const assistReplies: Record<LanguageCode, string> = {
      te: 'ఆసుపత్రిలో వీల్‌చైర్ సహాయం, సహాయకుడు మరియు భాషా అనువాదకులు అందుబాటులో ఉన్నారు. సహాయం అభ్యర్థించాలా?',
      hi: 'अस्पताल में व्हीलचेयर, सहायक और भाषा अनुवादक उपलब्ध हैं। क्या आपको मदद चाहिए?',
      ta: 'மருத்துவமனையில் சக்கர நாற்காலி மற்றும் பணியாளர் உதவி உள்ளது. உதவி கோர விரும்புகிறீர்களா?',
      kn: 'ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಗಾಲಿಕುರ್ಚಿ, ಸಹಾಯಕರು ಮತ್ತು ಭಾಷಾ ಅನುವಾದಕರು ಲಭ್ಯವಿದ್ದಾರೆ. ಸಹಾಯ ಬೇಕೇ?',
      ml: 'ആശുപത്രിയിൽ വീൽചെയർ സഹായവും സഹായികളും ലഭ്യമാണ്. സഹായം ആവശ്യമുണ്ടോ?',
      bn: 'হাসপাতালে হুইলচেয়ার, সহকারী এবং ভাষা অনুবাদক উপলব্ধ আছে। সাহায্য চাইবেন কি?',
      mr: 'हॉस्पिटलमध्ये व्हीलचेअर, मदतनीस आणि भाषा दुभाषी उपलब्ध आहेत. मदत हवी आहे का?',
      gu: 'હોસ્પિટલમાં વ્હીલચેર, સહાયક અને ભાષા અનુવાદક ઉપલબ્ધ છે. મદદ જોઈએ છે?',
      pa: 'ਹਸਪਤਾਲ ਵਿੱਚ ਵ੍ਹੀਲਚੇਅਰ, ਸਹਾਇਕ ਅਤੇ ਭਾਸ਼ਾ ਅਨੁਵਾਦਕ ਉਪਲਬਧ ਹਨ। ਕੀ ਸਹਾਇਤਾ ਚਾਹੀਦੀ ਹੈ?',
      en: 'Hospital wheelchairs, personal escorts, and language interpreters are available. Would you like to request assistance now?',
    };
    return {
      reply: assistReplies[lang] || assistReplies.en,
      actionType: 'assistance',
      actionTarget: 'assistance_modal',
      emergencyTriggered: false,
    };
  }

  // 8. Department lookup by common conditions
  let matchedDept = DEPARTMENTS_DATA[0];
  if (lower.includes('bone') || lower.includes('knee') || lower.includes('fracture') || text.includes('ఎముక') || text.includes('మోకాలు') || text.includes('हड्डी')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-ortho') || matchedDept;
  } else if (lower.includes('child') || lower.includes('baby') || text.includes('పిల్లల') || text.includes('बच्चा')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-paed') || matchedDept;
  } else if (lower.includes('preg') || text.includes('గర్భిణీ') || text.includes('गर्भावस्था')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-gyn') || matchedDept;
  } else if (lower.includes('eye') || text.includes('కంటి') || text.includes('आंख')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-eye') || matchedDept;
  } else if (lower.includes('ear') || lower.includes('throat') || text.includes('చెవి') || text.includes('గొంతు') || text.includes('नाक')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-ent') || matchedDept;
  } else if (lower.includes('skin') || lower.includes('rash') || text.includes('చర్మ') || text.includes('त्वचा')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-derma') || matchedDept;
  } else if (lower.includes('tooth') || lower.includes('dental') || text.includes('పంటి') || text.includes('दांत')) {
    matchedDept = DEPARTMENTS_DATA.find((d) => d.id === 'dept-dental') || matchedDept;
  }

  const deptName = matchedDept.localNames[lang] || matchedDept.name;
  const disclaimerMap: Record<LanguageCode, string> = {
    te: ' (గమనిక: ఇది విభాగ మార్గదర్శకత్వం మాత్రమే, వైద్య నిర్ధారణ కాదు. డాక్టర్ మిమ్మల్ని పరీక్షిస్తారు).',
    hi: ' (नोट: यह केवल विभाग मार्गदर्शन है, चिकित्सा निदान नहीं। डॉक्टर आपकी जांच करेंगे)।',
    ta: ' (குறிப்பு: இது வழிகாட்டுதல் மட்டுமே, மருத்துவ நோய் నిర్ధారణ அல்ல. மருத்துவர் பரிசோதிப்பார்).',
    kn: ' (ಗಮನಿಸಿ: ಇದು ವಿಭಾಗದ ಮಾರ್ಗದರ್ಶನ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ ರೋಗನಿರ್ಣಯವಲ್ಲ. ವೈದ್ಯರು ನಿಮ್ಮನ್ನು ಪರೀಕ್ಷಿಸುತ್ತಾರೆ).',
    ml: ' (ശ്രദ്ധിക്കുക: ഇത് വകുപ്പ് വഴികാട്ടൽ മാത്രമാണ്. ഡോക്ടർ പരിശോധിക്കും).',
    bn: ' (নোট: এটি কেবলমাত্র বিভাগীয় নির্দেশিকা, চিকিৎসা নির্ণয় নয়। ডাক্তার পরীক্ষা করবেন)।',
    mr: ' (टीप: हे केवळ विभाग मार्गदर्शन आहे, वैद्यकीय निदान नाही. डॉक्टर तुमची तपासणी करतील).',
    gu: ' (નોંધ: આ માત્ર વિભાગ માર્ગદર્શન છે, તબીબી નિદાન નથી. ડૉક્ટર તમારી તપાસ કરશે).',
    pa: ' (ਨੋਟ: ਇਹ ਸਿਰਫ਼ ਵਿਭਾਗ ਮਾਰਗਦਰਸ਼ਨ ਹੈ, ਡਾਕਟਰੀ ਜਾਂਚ ਨਹੀਂ। ਡਾਕਟਰ ਤੁਹਾਡੀ ਜਾਂਚ ਕਰਨਗੇ)।',
    en: ' (Note: This is department guidance to help you navigate, not a medical diagnosis. A doctor will examine you in person).',
  };

  const deptFormatMap: Record<LanguageCode, string> = {
    te: `మీ లక్షణాలకు ${deptName} (${matchedDept.roomRange}, అంతస్తు ${matchedDept.floor}) అనువైనది.${disclaimerMap.te}`,
    hi: `आपके लक्षणों के आधार पर ${deptName} (${matchedDept.roomRange}, तल ${matchedDept.floor}) उपयुक्त है।${disclaimerMap.hi}`,
    ta: `உங்கள் அறிகுறிகளுக்கு ${deptName} (${matchedDept.roomRange}, தளம் ${matchedDept.floor}) பொருத்தமானது.${disclaimerMap.ta}`,
    kn: `ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳಿಗೆ ${deptName} (${matchedDept.roomRange}, ಮಹಡಿ ${matchedDept.floor}) ಸೂಕ್ತವಾಗಿದೆ.${disclaimerMap.kn}`,
    ml: `നിങ്ങളുടെ ലക്ഷണങ്ങൾക്ക് ${deptName} (${matchedDept.roomRange}, നില ${matchedDept.floor}) അനുയോജ്യമാണ്.${disclaimerMap.ml}`,
    bn: `আপনার লক্ষণগুলির জন্য ${deptName} (${matchedDept.roomRange}, তলা ${matchedDept.floor}) উপযুক্ত।${disclaimerMap.bn}`,
    mr: `तुमच्या लक्षणांसाठी ${deptName} (${matchedDept.roomRange}, मजला ${matchedDept.floor}) योग्य आहे.${disclaimerMap.mr}`,
    gu: `તમારા લક્ષણો માટે ${deptName} (${matchedDept.roomRange}, માળ ${matchedDept.floor}) યોગ્ય છે.${disclaimerMap.gu}`,
    pa: `ਤੁਹਾਡੇ ਲੱਛਣਾਂ ਲਈ ${deptName} (${matchedDept.roomRange}, ਮੰਜ਼ਿਲ ${matchedDept.floor}) ਢੁਕਵਾਂ ਹੈ।${disclaimerMap.pa}`,
    en: `For your symptoms, ${deptName} (${matchedDept.roomRange}, Floor ${matchedDept.floor}) is recommended.${disclaimerMap.en}`,
  };

  return {
    reply: deptFormatMap[lang] || deptFormatMap.en,
    actionType: 'register',
    actionTarget: `/register?dept=${matchedDept.id}`,
    emergencyTriggered: false,
  };
}
