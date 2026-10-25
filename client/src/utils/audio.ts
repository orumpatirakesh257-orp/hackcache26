import { LanguageCode } from '../../../shared/types';

let currentAudio: HTMLAudioElement | null = null;
let activeEngine: 'elevenlabs' | 'webspeech' = 'webspeech';

/**
 * Plays a pleasant hospital chime (two-tone chime: F5 -> C6)
 */
export function playHospitalChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, now); // F5
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.3); // C5
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second ding
    setTimeout(() => {
      const now2 = ctx.currentTime;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now2); // A5
      gain2.gain.setValueAtTime(0.4, now2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now2);
      osc2.stop(now2 + 0.8);
    }, 280);
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

/**
 * Plays emergency high-priority warning tone
 */
export function playEmergencyAlertSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.25);
    osc.frequency.linearRampToValueAtTime(800, now + 0.5);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.75);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.0);
  } catch (err) {
    console.warn('Emergency sound error:', err);
  }
}

let onEndCallback: (() => void) | null = null;

/**
 * Checks if voice is currently speaking via audio element or Web Speech API
 */
export function isSpeakingCurrently(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
    return true;
  }
  return false;
}

/**
 * Text-to-Speech: ElevenLabs API primary, with seamless automatic fallback to Web Speech API
 */
export async function speakText(
  text: string,
  lang: LanguageCode = 'en',
  onEnd?: () => void
): Promise<'elevenlabs' | 'webspeech'> {
  stopSpeaking();

  if (!text) {
    onEnd?.();
    return activeEngine;
  }

  onEndCallback = onEnd || null;

  try {
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: lang }),
    });

    const data = await res.json();

    // 1. If server synthesized pristine audio (ElevenLabs or Neural Google TTS), play it directly
    if (data.audioBase64) {
      activeEngine = data.engine || 'elevenlabs';
      const audio = new Audio(data.audioBase64);
      currentAudio = audio;

      audio.onended = () => {
        currentAudio = null;
        if (onEndCallback) {
          onEndCallback();
          onEndCallback = null;
        }
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error, trying web speech fallback', e);
        currentAudio = null;
        speakViaWebSpeech(text, lang, onEndCallback);
      };

      try {
        await audio.play();
        return activeEngine;
      } catch (playErr) {
        console.warn('Audio play() rejected, falling back to Web Speech', playErr);
      }
    }
  } catch (err) {
    console.warn('Audio synthesis endpoint unavailable, falling back to Web Speech API', err);
  }

  // 2. Resilient Browser Web Speech API fallback with explicit Indic voice matching
  activeEngine = 'webspeech';
  speakViaWebSpeech(text, lang, onEndCallback);
  return 'webspeech';
}

/**
 * Robust fallback using the browser's native SpeechSynthesis API
 * Explicitly matches the optimal regional voice rather than defaulting to English
 */
function speakViaWebSpeech(text: string, lang: LanguageCode, onEnd?: (() => void) | null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  const langMap: Record<LanguageCode, string> = {
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

  const targetLang = langMap[lang] || 'en-IN';
  utterance.lang = targetLang;
  utterance.rate = 0.95; // Clear natural pace

  // Find the best voice for this language
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    // 1. Exact match (e.g. 'te-IN')
    let matched = voices.find((v) => v.lang === targetLang || v.lang.replace('_', '-') === targetLang);

    // 2. Prefix match (e.g. starts with 'te')
    if (!matched) {
      matched = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    }

    // 3. Name match for Indic voices
    if (!matched) {
      const nameKeywords: Record<LanguageCode, string[]> = {
        en: ['india', 'indian', 'english'],
        hi: ['hindi', 'हिन्दी', 'kalpana', 'hemant'],
        te: ['telugu', 'తెలుగు', 'chitra', 'mohan'],
        ta: ['tamil', 'தமிழ்', 'valluvar'],
        kn: ['kannada', 'ಕನ್ನಡ'],
        ml: ['malayalam', 'മലയാളം'],
        bn: ['bengali', 'bangla', 'বাংলা'],
        mr: ['marathi', 'मराठी'],
        gu: ['gujarati', 'ગુજરાતી'],
        pa: ['punjabi', 'ਪੰਜਾਬੀ'],
      };
      const kwList = nameKeywords[lang] || [];
      matched = voices.find((v) => {
        const vName = v.name.toLowerCase();
        return kwList.some((kw) => vName.includes(kw));
      });
    }

    if (matched) {
      utterance.voice = matched;
    }
  }

  utterance.onend = () => {
    if (onEndCallback) {
      onEndCallback();
      onEndCallback = null;
    }
  };

  utterance.onerror = () => {
    if (onEndCallback) {
      onEndCallback();
      onEndCallback = null;
    }
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (onEndCallback) {
    onEndCallback();
    onEndCallback = null;
  }
}

export function getActiveVoiceEngine(): 'elevenlabs' | 'webspeech' {
  return activeEngine;
}

export function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

