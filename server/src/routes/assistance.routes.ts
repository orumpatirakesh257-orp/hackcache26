import { Router, Request, Response } from 'express';
import { db } from '../db';
import { AssistanceRequest } from '../../../shared/types';
import { notifyAssistanceRequested } from '../services/notifications.service';

const router = Router();

// Create assistance request (wheelchair, escort, interpreter, reading help)
router.post('/request', (req: Request, res: Response) => {
  const { patientName, phone, location, type, language } = req.body;
  const store = db.getStore();

  const asst: AssistanceRequest = {
    id: 'asst-' + Date.now(),
    patientName: patientName || 'Patient',
    phone,
    location: location || 'Registration / Kiosk 1',
    type: type || 'general',
    language: language || 'en',
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  store.assistanceRequests.unshift(asst);

  db.logAudit(
    'ASSISTANCE_REQUESTED',
    patientName || 'Patient',
    'patient',
    `Requested ${asst.type} at ${asst.location}`
  );

  notifyAssistanceRequested(asst);

  res.json({
    success: true,
    assistance: asst,
    message: 'Staff has been notified. An attendant will arrive shortly.',
  });
});

// List open assistance requests
router.get('/list', (req: Request, res: Response) => {
  const store = db.getStore();
  res.json(store.assistanceRequests);
});

// Accept assistance request
router.post('/accept', (req: Request, res: Response) => {
  const { requestId, staffName } = req.body;
  const store = db.getStore();
  const reqItem = store.assistanceRequests.find((r) => r.id === requestId);
  if (!reqItem) return res.status(404).json({ error: 'Request not found' });

  reqItem.status = 'accepted';
  reqItem.acceptedBy = staffName || 'Staff Member';

  db.logAudit(
    'ASSISTANCE_ACCEPTED',
    staffName || 'Staff',
    'counter_staff',
    `Accepted assistance request ${requestId}`
  );

  notifyAssistanceRequested(reqItem);
  res.json({ success: true, assistance: reqItem });
});

// Resolve assistance request
router.post('/resolve', (req: Request, res: Response) => {
  const { requestId } = req.body;
  const store = db.getStore();
  const reqItem = store.assistanceRequests.find((r) => r.id === requestId);
  if (!reqItem) return res.status(404).json({ error: 'Request not found' });

  reqItem.status = 'resolved';
  reqItem.resolvedAt = new Date().toISOString();

  notifyAssistanceRequested(reqItem);
  res.json({ success: true, assistance: reqItem });
});

export default router;
