import { Router, Request, Response } from 'express';
import { TTSService } from '../services/tts.service';
import { LanguageCode } from '../../../shared/types';

const router = Router();

// Get active voice engine status
router.get('/status', (req: Request, res: Response) => {
  const status = TTSService.getVoiceEngineStatus();
  res.json(status);
});

// Synthesize text to speech
router.post('/synthesize', async (req: Request, res: Response) => {
  const { text, language } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required for TTS synthesis' });

  try {
    const result = await TTSService.synthesizeSpeech(text, (language as LanguageCode) || 'en');
    res.json(result);
  } catch (err: any) {
    res.json({
      engine: 'webspeech',
      fallback: true,
      error: err.message,
    });
  }
});

export default router;
