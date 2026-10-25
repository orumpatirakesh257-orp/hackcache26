import { LanguageCode } from '../../../shared/types';

export interface TTSResult {
  engine: 'elevenlabs' | 'google_tts' | 'webspeech';
  audioBase64?: string;
  fallback: boolean;
  message?: string;
}

export class TTSService {
  public static getVoiceEngineStatus(): { activeEngine: 'elevenlabs' | 'google_tts' | 'webspeech'; hasKey: boolean } {
    const key = process.env.ELEVENLABS_API_KEY;
    const hasKey = !!(key && key !== 'YOUR_ELEVENLABS_API_KEY_HERE');
    return {
      activeEngine: hasKey ? 'elevenlabs' : 'google_tts',
      hasKey,
    };
  }

  /**
   * Chunks text into natural sentence/phrase pieces under maxLen characters for crisp audio synthesis
   */
  private static chunkText(text: string, maxLen = 150): string[] {
    const clean = text.replace(/[*_#`~]/g, '').trim();
    if (!clean) return [];
    if (clean.length <= maxLen) return [clean];

    // Split on sentence boundaries (including Indic danda '।')
    const rawSentences = clean.match(/[^.!?।\n]+[.!?।\n]*/g)?.map((s) => s.trim()).filter(Boolean) || [clean];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of rawSentences) {
      if ((current + ' ' + sentence).trim().length <= maxLen) {
        current = (current + ' ' + sentence).trim();
      } else {
        if (current) {
          chunks.push(current);
          current = '';
        }

        if (sentence.length <= maxLen) {
          current = sentence;
        } else {
          // Long sentence: split on clauses or commas
          const phrases = sentence.split(/([,;:\-،、]+)/).map((p) => p.trim()).filter(Boolean);
          for (const phrase of phrases) {
            if ((current + ' ' + phrase).trim().length <= maxLen) {
              current = (current + ' ' + phrase).trim();
            } else {
              if (current) chunks.push(current);
              if (phrase.length <= maxLen) {
                current = phrase;
              } else {
                // Split on spaces
                const words = phrase.split(/\s+/);
                current = '';
                for (const w of words) {
                  if ((current + ' ' + w).trim().length <= maxLen) {
                    current = (current + ' ' + w).trim();
                  } else {
                    if (current) chunks.push(current);
                    current = w;
                  }
                }
              }
            }
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [clean.slice(0, maxLen)];
  }

  /**
   * Synthesize natural, clear spoken speech in any of the 10 Indic languages:
   * 1. ElevenLabs if valid key is configured
   * 2. High-fidelity Neural Multilingual Speech (zero config, pristine native pronunciation)
   * 3. Browser Web Speech API fallback
   */
  public static async synthesizeSpeech(text: string, lang: LanguageCode = 'en'): Promise<TTSResult> {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    // 1. Try ElevenLabs if valid key is set
    if (elevenKey && elevenKey !== 'YOUR_ELEVENLABS_API_KEY_HERE') {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          return {
            engine: 'elevenlabs',
            audioBase64: `data:audio/mpeg;base64,${base64}`,
            fallback: false,
          };
        }
      } catch (err: any) {
        console.warn('ElevenLabs API unavailable, proceeding to neural voice synthesis', err?.message);
      }
    }

    // 2. High-fidelity Neural Speech for all 10 Indic languages
    try {
      const chunks = this.chunkText(text, 150);
      if (chunks.length === 0) {
        return { engine: 'webspeech', fallback: true };
      }

      const audioBuffers: Buffer[] = [];
      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
          lang
        )}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!res.ok) {
          throw new Error(`TTS service returned ${res.status}`);
        }

        const ab = await res.arrayBuffer();
        audioBuffers.push(Buffer.from(ab));
      }

      const combined = Buffer.concat(audioBuffers);
      const base64 = combined.toString('base64');

      return {
        engine: 'google_tts',
        audioBase64: `data:audio/mpeg;base64,${base64}`,
        fallback: false,
      };
    } catch (gErr: any) {
      console.warn('Neural TTS synthesis failed, falling back to Web Speech API', gErr?.message);
      return {
        engine: 'webspeech',
        fallback: true,
        message: 'Using browser Web Speech API.',
      };
    }
  }
}
