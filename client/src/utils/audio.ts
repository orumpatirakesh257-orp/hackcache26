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

    if (data.engine === 'elevenlabs' && data.audioBase64) {
      activeEngine = 'elevenlabs';
      const audio = new Audio(data.audioBase64);
      currentAudio = audio;
      audio.onended = () => {
        currentAudio = null;
        if (onEndCallback) {
          onEndCallback();
          onEndCallback = null;
        }
      };
      audio.onerror = () => {
        currentAudio = null;
        if (onEndCallback) {
          onEndCallback();
          onEndCallback = null;
        }
      };
      await audio.play();
      return 'elevenlabs';
    }
  } catch (err) {
    console.warn('ElevenLabs API request failed, falling back to Web Speech API', err);
  }

  // Fallback: Browser Web Speech API
  activeEngine = 'webspeech';
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Language code map
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

    utterance.lang = langMap[lang] || 'en-IN';
    utterance.rate = 0.9; // Slightly slower, clear cadence for accessibility

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
  } else {
    // Neither supported
    if (onEndCallback) {
      onEndCallback();
      onEndCallback = null;
    }
  }

  return 'webspeech';
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

