import { LanguageCode } from '../../../shared/types';

export interface TTSResult {
  engine: 'elevenlabs' | 'webspeech';
  audioBase64?: string;
  fallback: boolean;
  message?: string;
}

export class TTSService {
  public static getVoiceEngineStatus(): { activeEngine: 'elevenlabs' | 'webspeech'; hasKey: boolean } {
    const key = process.env.ELEVENLABS_API_KEY;
    const hasKey = !!(key && key !== 'YOUR_ELEVENLABS_API_KEY_HERE');
    return {
      activeEngine: hasKey ? 'elevenlabs' : 'webspeech',
      hasKey,
    };
  }

  public static async synthesizeSpeech(text: string, lang: LanguageCode = 'en'): Promise<TTSResult> {
    const key = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel / Indian English or default

    if (!key || key === 'YOUR_ELEVENLABS_API_KEY_HERE') {
      return {
        engine: 'webspeech',
        fallback: true,
        message: 'No ElevenLabs API key provided. Using browser Web Speech API fallback.',
      };
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
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

      if (!response.ok) {
        console.warn(`ElevenLabs API returned ${response.status}: ${response.statusText}, falling back to Web Speech API`);
        return {
          engine: 'webspeech',
          fallback: true,
          message: `ElevenLabs quota exceeded or unavailable (${response.status}). Using browser Web Speech API.`,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        engine: 'elevenlabs',
        audioBase64: `data:audio/mpeg;base64,${base64}`,
        fallback: false,
      };
    } catch (err: any) {
      console.warn('ElevenLabs API request failed, falling back to Web Speech API', err?.message || err);
      return {
        engine: 'webspeech',
        fallback: true,
        message: 'Network error connecting to ElevenLabs. Using browser Web Speech API.',
      };
    }
  }
}
