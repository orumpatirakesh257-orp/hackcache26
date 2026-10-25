import { Router, Request, Response } from 'express';
import { db } from '../db';
import { EmergencyAlert, EmergencyPriority } from '../../../shared/types';
import { notifyEmergencyTriggered } from '../services/notifications.service';

const router = Router();

// Flag new emergency (1-tap patient flow)
router.post('/flag', (req: Request, res: Response) => {
  const { patientName, location, flaggedSymptoms, patientId } = req.body;
  const store = db.getStore();

  const alert: EmergencyAlert = {
    id: 'emerg-' + Date.now(),
    patientId,
    patientName: patientName || 'Walk-in / Kiosk Patient',
    location: location || 'Main Entrance Atrium',
    flaggedSymptoms: flaggedSymptoms || ['Chest pain / shortness of breath'],
    priority: 'critical',
    status: 'flagged',
    timestamp: new Date().toISOString(),
  };

  store.emergencyAlerts.unshift(alert);

  db.logAudit(
    'EMERGENCY_FLAGGED',
    patientName || 'Anonymous',
    'patient',
    `EMERGENCY ALERT: ${alert.flaggedSymptoms.join(', ')} at ${alert.location}`,
    patientId
  );

  notifyEmergencyTriggered(alert);

  res.json({
    success: true,
    alert,
    instructions: {
      en: 'Proceed immediately to the Emergency Block. If you cannot walk, please STAY WHERE YOU ARE. A triage response nurse is en route.',
      hi: 'तुरंत आपातकालीन ब्लॉक (Emergency Block) की ओर जाएं। यदि आप चल नहीं सकते, तो कृपया वहीं रुकें। सहायता आ रही है।',
    },
    emergencyPhone: '108',
  });
});

// List all emergency alerts
router.get('/list', (req: Request, res: Response) => {
  const store = db.getStore();
  res.json(store.emergencyAlerts);
});

// Nurse assesses and sets priority
router.post('/assess', (req: Request, res: Response) => {
  const { alertId, priority, nurseNotes, nurseName, assignedTeam } = req.body;
  const store = db.getStore();
  const alert = store.emergencyAlerts.find((a) => a.id === alertId);

  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = 'assessed';
  alert.priority = priority as EmergencyPriority;
  alert.acknowledgedAt = alert.acknowledgedAt || new Date().toISOString();
  alert.nurseNotes = nurseNotes;
  alert.assignedTeam = assignedTeam || 'Trauma Team Alpha';

  // Calculate response time
  const start = new Date(alert.timestamp).getTime();
  const end = Date.now();
  alert.responseTimeSeconds = Math.round((end - start) / 1000);

  db.logAudit(
    'EMERGENCY_ASSESSED',
    nurseName || 'Nurse',
    'triage_nurse',
    `Assessed Emergency ${alert.id} as ${priority}. Notes: ${nurseNotes}`
  );

  notifyEmergencyTriggered(alert);
  res.json({ success: true, alert });
});

// Nurse downgrades with logged reason
router.post('/downgrade', (req: Request, res: Response) => {
  const { alertId, reason, nurseName } = req.body;
  if (!reason) return res.status(400).json({ error: 'Mandatory clinical reason required for downgrade' });

  const store = db.getStore();
  const alert = store.emergencyAlerts.find((a) => a.id === alertId);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = 'downgraded';
  alert.priority = 'non_urgent';
  alert.downgradeReason = reason;

  db.logAudit(
    'EMERGENCY_DOWNGRADED',
    nurseName || 'Nurse',
    'triage_nurse',
    `Downgraded Emergency ${alert.id} to Non-urgent. Clinical Rationale: ${reason}`
  );

  notifyEmergencyTriggered(alert);
  res.json({ success: true, alert });
});

// Resolve emergency
router.post('/resolve', (req: Request, res: Response) => {
  const { alertId, staffName } = req.body;
  const store = db.getStore();
  const alert = store.emergencyAlerts.find((a) => a.id === alertId);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = 'resolved';
  alert.resolvedAt = new Date().toISOString();

  db.logAudit(
    'EMERGENCY_RESOLVED',
    staffName || 'Nurse',
    'triage_nurse',
    `Resolved Emergency ${alert.id}`
  );

  notifyEmergencyTriggered(alert);
  res.json({ success: true, alert });
});

export default router;
