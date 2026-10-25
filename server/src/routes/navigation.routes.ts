import { Router, Request, Response } from 'express';
import { NavigationService } from '../services/navigation.service';
import { LanguageCode } from '../../../shared/types';

const router = Router();

// Get all hospital nodes
router.get('/nodes', (req: Request, res: Response) => {
  res.json(NavigationService.getNodes());
});

// Get all hospital edges
router.get('/edges', (req: Request, res: Response) => {
  res.json(NavigationService.getEdges());
});

// Calculate route between two nodes
router.post('/route', (req: Request, res: Response) => {
  const { fromNodeId, toNodeId, accessibleOnly, language } = req.body;

  if (!fromNodeId || !toNodeId) {
    return res.status(400).json({ error: 'fromNodeId and toNodeId are required' });
  }

  try {
    const route = NavigationService.findRoute(
      fromNodeId,
      toNodeId,
      Boolean(accessibleOnly),
      (language as LanguageCode) || 'en'
    );
    res.json(route);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Fuzzy find nearest node by search term, room, ward, or doctor
router.get('/fuzzy-search', (req: Request, res: Response) => {
  const term = req.query.q as string;
  if (!term) return res.status(400).json({ error: 'Search term query "q" required' });

  const matchedNode = NavigationService.fuzzyFindNode(term);
  if (!matchedNode) {
    return res.status(404).json({ error: 'No hospital location matched your query' });
  }

  res.json({ node: matchedNode });
});

export default router;
