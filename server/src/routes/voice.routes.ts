import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { LanguageCode } from '../../../shared/types';

const router = Router();

// Process conversational voice / text query from home assistant
router.post('/query', async (req: Request, res: Response) => {
  const { query, language, activeTokenInfo } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required' });
  }

  try {
    const result = await AIService.processVoiceAssistantQuery(
      query,
      (language as LanguageCode) || 'en',
      activeTokenInfo
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to process query' });
  }
});

export default router;
