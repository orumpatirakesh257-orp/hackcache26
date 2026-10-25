import { Router, Request, Response } from 'express';
import { db } from '../db';
import { FHIRService } from '../services/fhir.service';

const router = Router();

// Export CSV of daily patient and queue records
router.get('/csv', (req: Request, res: Response) => {
  const store = db.getStore();

  let csv = 'TokenNumber,OPDNumber,PatientName,Age,Gender,Phone,Department,Doctor,Status,Priority,EstimatedWaitMinutes,RegisteredAt\n';

  store.tokens.forEach((token) => {
    const patient = store.patients.find((p) => p.id === token.patientId);
    const dept = store.departments.find((d) => d.id === token.departmentId);
    const doc = token.doctorId ? store.doctors.find((d) => d.id === token.doctorId) : null;

    csv += `"${token.tokenNumber}","${token.opdNumber}","${patient?.name || ''}","${patient?.age || ''}","${patient?.gender || ''}","${patient?.phone || ''}","${dept?.name || ''}","${doc?.name || ''}","${token.status}","${token.priority}","${token.estimatedWaitMinutes}","${token.createdAt}"\n`;
  });

  res.header('Content-Type', 'text/csv');
  res.attachment(`sahai-setu-opd-report-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

// View FHIR R4 resources
router.get('/fhir', (req: Request, res: Response) => {
  const type = req.query.type as 'Patient' | 'Appointment' | 'Encounter' | undefined;
  const resources = FHIRService.getResources(type);
  res.json({
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((r) => ({ resource: r })),
  });
});

// View Audit Logs
router.get('/audit', (req: Request, res: Response) => {
  const store = db.getStore();
  res.json(store.auditLogs);
});

// View Simulated SMS/WhatsApp message logs
router.get('/messages', (req: Request, res: Response) => {
  const store = db.getStore();
  res.json(store.simulatedMessages);
});

export default router;
