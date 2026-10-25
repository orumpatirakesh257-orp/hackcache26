import { Router, Request, Response } from 'express';
import { db } from '../db';
import { QueueService } from '../services/queue.service';
import { broadcastAnnouncement } from '../services/notifications.service';

const router = Router();

// Get tokens and doctors for a department
router.get('/department/:departmentId', (req: Request, res: Response) => {
  const { departmentId } = req.params;
  const store = db.getStore();

  const dept = store.departments.find((d) => d.id === departmentId);
  if (!dept) {
    return res.status(404).json({ error: 'Department not found' });
  }

  const doctors = store.doctors.filter((d) => d.departmentId === departmentId);
  const tokens = store.tokens.filter(
    (t) =>
      t.departmentId === departmentId &&
      ['waiting', 'almost_turn', 'in_consultation', 'stepped_away', 'emergency_escalated'].includes(t.status)
  ).sort((a, b) => a.queuePosition - b.queuePosition);

  res.json({ department: dept, doctors, tokens });
});

// Get single token status
router.get('/token/:tokenNumber', (req: Request, res: Response) => {
  const { tokenNumber } = req.params;
  const store = db.getStore();

  const tokenNumStr = String(tokenNumber).toLowerCase();
  const token = store.tokens.find(
    (t) => t.tokenNumber.toLowerCase() === tokenNumStr || t.opdNumber.toLowerCase() === tokenNumStr
  );

  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }

  const patient = store.patients.find((p) => p.id === token.patientId);
  const dept = store.departments.find((d) => d.id === token.departmentId);
  const doc = token.doctorId ? store.doctors.find((d) => d.id === token.doctorId) : null;
  const slip = store.slips.find((s) => s.tokenNumber === token.tokenNumber || s.patientId === token.patientId);

  // Calculate now serving token for this department
  const currentConsultingToken = store.tokens.find(
    (t) => t.departmentId === token.departmentId && t.status === 'in_consultation'
  );

  // Calculate people ahead
  const peopleAhead = Math.max(0, token.queuePosition - 1);

  res.json({
    token,
    patient,
    department: dept,
    doctor: doc,
    slip,
    nowServingToken: currentConsultingToken ? currentConsultingToken.tokenNumber : 'None',
    peopleAhead,
  });
});

// Step away
router.post('/step-away', (req: Request, res: Response) => {
  const { tokenId } = req.body;
  try {
    const updated = QueueService.stepAway(tokenId);
    res.json({ success: true, token: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Resume from stepping away
router.post('/resume', (req: Request, res: Response) => {
  const { tokenId } = req.body;
  try {
    const updated = QueueService.resumeFromStepAway(tokenId);
    res.json({ success: true, token: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Doctor calls next
router.post('/call-next', (req: Request, res: Response) => {
  const { doctorId } = req.body;
  try {
    const result = QueueService.callNext(doctorId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Doctor marks done
router.post('/mark-done', (req: Request, res: Response) => {
  const { tokenId, nextStep, targetDepartmentId } = req.body;
  try {
    const updated = QueueService.markDone(tokenId, nextStep, targetDepartmentId);
    res.json({ success: true, token: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Doctor delay or break declaration
router.post('/update-doctor', (req: Request, res: Response) => {
  const { doctorId, status, delayMinutes, delayReason } = req.body;
  try {
    const updatedDoc = QueueService.updateDoctorStatus(doctorId, status, delayMinutes, delayReason);
    res.json({ success: true, doctor: updatedDoc });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Escalate queued patient to emergency
router.post('/escalate-emergency', (req: Request, res: Response) => {
  const { tokenId, reason, staffName } = req.body;
  try {
    const token = QueueService.escalatePatientToEmergency(tokenId, reason, staffName);
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reorder queue
router.post('/reorder', (req: Request, res: Response) => {
  const { tokenId, newPosition, reason, staffName } = req.body;
  const store = db.getStore();
  const token = store.tokens.find((t) => t.id === tokenId);
  if (!token) return res.status(404).json({ error: 'Token not found' });

  token.queuePosition = newPosition;
  db.logAudit(
    'QUEUE_REORDER',
    staffName || 'Staff',
    'counter_staff',
    `Manually moved Token ${token.tokenNumber} to position ${newPosition}: ${reason || 'Priority accommodation'}`,
    token.patientId
  );

  QueueService.recalculateDepartmentQueue(token.departmentId);
  res.json({ success: true, token });
});

// Public Broadcast Announcement
router.post('/broadcast', (req: Request, res: Response) => {
  const { message, languages } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const store = db.getStore();
  store.broadcasts.unshift({
    id: 'bc-' + Date.now(),
    message,
    timestamp: new Date().toISOString(),
    active: true,
  });

  broadcastAnnouncement(message, languages);
  db.logAudit('BROADCAST_ANNOUNCEMENT', 'Admin', 'admin', `Broadcast: "${message}"`);
  res.json({ success: true, message: 'Broadcast sent to all patient screens and display boards' });
});

export default router;
