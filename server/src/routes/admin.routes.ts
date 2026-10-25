import { Router, Request, Response } from 'express';
import { db } from '../db';
import { QueueService } from '../services/queue.service';
import { generateSeedData } from '../seed';
import { broadcastQueueUpdate, notifyEmergencyTriggered } from '../services/notifications.service';
import { Patient, PriorityLevel, DashboardMetrics } from '../../../shared/types';
import { DEPARTMENTS_DATA, DOCTORS_DATA } from '../../../shared/constants';

const router = Router();

// Admin Dashboard KPI Metrics
router.get('/metrics', (req: Request, res: Response) => {
  const store = db.getStore();

  const totalPatientsToday = store.patients.length;
  const waitingTokens = store.tokens.filter(
    (t) => t.status === 'waiting' || t.status === 'almost_turn' || t.status === 'stepped_away'
  );
  const inConsultationTokens = store.tokens.filter((t) => t.status === 'in_consultation');
  const completedTokens = store.tokens.filter((t) => t.status === 'done');
  const activeEmergencies = store.emergencyAlerts.filter(
    (a) => a.status === 'flagged' || a.status === 'assessed'
  );
  const openAssistance = store.assistanceRequests.filter(
    (a) => a.status === 'pending' || a.status === 'accepted'
  );

  const totalWait = waitingTokens.reduce((sum, t) => sum + (t.estimatedWaitMinutes || 0), 0);
  const avgWaitMinutes = waitingTokens.length > 0 ? Math.round(totalWait / waitingTokens.length) : 12;
  const longestWaitMinutes = waitingTokens.reduce(
    (max, t) => Math.max(max, t.estimatedWaitMinutes || 0),
    0
  );

  // Department load & overcrowding alerts
  const departmentLoad = store.departments.map((dept) => {
    const deptTokens = waitingTokens.filter((t) => t.departmentId === dept.id);
    const docs = store.doctors.filter((d) => d.departmentId === dept.id);
    const activeDocs = docs.filter((d) => d.status === 'available' || d.status === 'busy');

    const waitingCount = deptTokens.length;
    const deptAvgWait = deptTokens.length > 0
      ? Math.round(deptTokens.reduce((s, t) => s + (t.estimatedWaitMinutes || 0), 0) / deptTokens.length)
      : 8;

    let status: 'normal' | 'moderate' | 'overcrowded' = 'normal';
    let suggestedAction: string | undefined;

    if (waitingCount >= dept.maxCapacityThreshold || deptAvgWait > 35) {
      status = 'overcrowded';
      suggestedAction = `Queue is ${deptAvgWait - 20} min over target. Suggest opening relief room or redirecting stable cases.`;
    } else if (waitingCount > dept.maxCapacityThreshold * 0.6 || deptAvgWait > 20) {
      status = 'moderate';
      suggestedAction = 'Queue approaching peak. Monitor consultation rate.';
    }

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      waitingCount,
      avgWaitMinutes: deptAvgWait,
      status,
      doctorCount: docs.length,
      activeDoctorCount: activeDocs.length,
      suggestedAction,
    };
  });

  // Hourly traffic breakdown
  const hourlyTraffic = [
    { hour: '08:00 AM', count: 18 },
    { hour: '09:00 AM', count: 34 },
    { hour: '10:00 AM', count: 48 },
    { hour: '11:00 AM', count: 52 },
    { hour: '12:00 PM', count: 39 },
    { hour: '01:00 PM', count: 24 },
    { hour: '02:00 PM', count: 16 },
  ];

  // Language distribution
  const langCounts: Record<string, number> = {};
  store.patients.forEach((p) => {
    langCounts[p.language] = (langCounts[p.language] || 0) + 1;
  });
  const languageDistribution = Object.entries(langCounts).map(([lang, count]) => ({
    language: lang,
    count,
    percentage: Math.round((count / (totalPatientsToday || 1)) * 100),
  }));

  // Registration method distribution
  const regCounts: Record<string, number> = {};
  store.patients.forEach((p) => {
    regCounts[p.registrationMethod] = (regCounts[p.registrationMethod] || 0) + 1;
  });
  const registrationMethodDistribution = Object.entries(regCounts).map(([method, count]) => ({
    method,
    count,
    percentage: Math.round((count / (totalPatientsToday || 1)) * 100),
  }));

  const metrics: DashboardMetrics = {
    totalPatientsToday,
    currentlyWaiting: waitingTokens.length,
    avgWaitMinutes,
    longestWaitMinutes,
    inConsultation: inConsultationTokens.length,
    completedToday: completedTokens.length,
    emergenciesActive: activeEmergencies.length,
    supportRequestsOpen: openAssistance.length,
    departmentLoad,
    hourlyTraffic,
    languageDistribution,
    registrationMethodDistribution,
  };

  res.json(metrics);
});

// SIMULATION: Add 10 random patients
router.post('/simulate/add-patients', (req: Request, res: Response) => {
  const store = db.getStore();
  const names = ['Arvind Ghosh', 'Deepika Nair', 'Suman Verma', 'Vikas Jain', 'Purnima Rao', 'Nandini Das', 'Siddharth Joshi', 'Tanvi Shah', 'Babu Lal', 'Sunil More'];

  names.forEach((name, idx) => {
    const dept = store.departments[idx % store.departments.length];
    const patient: Patient = {
      id: 'pat-sim-' + Date.now() + '-' + idx,
      opdNumber: `OPD-2026-${2000 + store.patients.length + 1}`,
      name,
      age: Math.floor(Math.random() * 50) + 20,
      gender: idx % 2 === 0 ? 'male' : 'female',
      phone: `9812345${(100 + idx).toString()}`,
      language: 'hi',
      symptoms: ['Simulated consultation follow-up'],
      departmentId: dept.id,
      registeredAt: new Date().toISOString(),
      registrationMethod: 'self_guided',
      accessibilityNeeds: {},
      journeyStep: 'doctor',
    };
    store.patients.push(patient);
    QueueService.enqueuePatient(patient, 'normal');
  });

  db.persist();
  broadcastQueueUpdate();
  res.json({ success: true, message: 'Added 10 simulated patients across departments' });
});

// SIMULATION: Rush Hour Spike in Orthopaedics & Medicine
router.post('/simulate/rush-hour', (req: Request, res: Response) => {
  const store = db.getStore();
  const orthoDept = store.departments.find((d) => d.id === 'dept-ortho');
  if (!orthoDept) return res.status(404).json({ error: 'Ortho department not found' });

  for (let i = 1; i <= 15; i++) {
    const patient: Patient = {
      id: 'pat-rush-' + Date.now() + '-' + i,
      opdNumber: `OPD-2026-${3000 + store.patients.length + 1}`,
      name: `Rush Patient ${i}`,
      age: 45 + (i % 20),
      gender: i % 2 === 0 ? 'female' : 'male',
      phone: `9988776${(100 + i).toString()}`,
      language: 'ta',
      symptoms: ['Acute joint sprain / winter morning stiffness'],
      departmentId: 'dept-ortho',
      registeredAt: new Date().toISOString(),
      registrationMethod: 'self_voice',
      accessibilityNeeds: {},
      journeyStep: 'doctor',
    };
    store.patients.push(patient);
    QueueService.enqueuePatient(patient, 'normal');
  }

  db.persist();
  broadcastQueueUpdate('dept-ortho');
  res.json({ success: true, message: 'Simulated morning rush hour surge (15 patients) in Orthopaedics' });
});

// SIMULATION: Trigger an emergency alert
router.post('/simulate/trigger-emergency', (req: Request, res: Response) => {
  const store = db.getStore();
  const alert = {
    id: 'emerg-sim-' + Date.now(),
    patientName: 'Devraj Chauhan (Kiosk 2)',
    location: 'Waiting Hall near Pillar 4',
    flaggedSymptoms: ['Sudden crushing chest pain', 'Breathing difficulty', 'Cold sweats'],
    priority: 'critical' as const,
    status: 'flagged' as const,
    timestamp: new Date().toISOString(),
    nurseNotes: 'Automated high-priority alert triggered by simulation',
  };

  store.emergencyAlerts.unshift(alert);
  db.logAudit('SIMULATE_EMERGENCY', 'Admin', 'admin', 'Triggered demo emergency alert');

  notifyEmergencyTriggered(alert);
  res.json({ success: true, alert, message: 'Live emergency alert broadcasted to triage nurses and admin' });
});

// SIMULATION: Doctor goes on break
router.post('/simulate/doctor-break', (req: Request, res: Response) => {
  const store = db.getStore();
  const doc = store.doctors.find((d) => d.id === 'doc-ortho-1') || store.doctors[0];
  QueueService.updateDoctorStatus(doc.id, 'on_break', 15, 'Emergency clinical team briefing');
  res.json({ success: true, message: `${doc.name} placed on 15-minute break. Queue wait times recalculated.` });
});

// SIMULATION: Reset demo data
router.post('/simulate/reset', (req: Request, res: Response) => {
  generateSeedData(150);
  broadcastQueueUpdate();
  res.json({ success: true, message: 'Demo database reset to clean 150-patient seed' });
});

// Doctor Management: List all doctors with queue load
router.get('/doctors', (req: Request, res: Response) => {
  const store = db.getStore();
  const doctorsWithDetails = store.doctors.map((doc) => {
    const dept = store.departments.find((d) => d.id === doc.departmentId);
    const waitingTokens = store.tokens.filter(
      (t) => (t.doctorId === doc.id || (!t.doctorId && t.departmentId === doc.departmentId)) &&
        ['waiting', 'almost_turn'].includes(t.status)
    );
    return {
      ...doc,
      departmentName: dept?.name || 'Department',
      waitingCount: waitingTokens.length,
    };
  });
  res.json({
    success: true,
    doctors: doctorsWithDetails,
  });
});

// Doctor Management: Toggle doctor status & room assignment
router.post('/doctors/status', (req: Request, res: Response) => {
  const { doctorId, status, delayMinutes, delayReason, roomNumber } = req.body;
  const store = db.getStore();
  const doc = store.doctors.find((d) => d.id === doctorId);

  if (!doc) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  if (status) doc.status = status;
  if (delayMinutes !== undefined) doc.delayMinutes = delayMinutes;
  if (delayReason !== undefined) doc.delayReason = delayReason;
  if (roomNumber) doc.roomNumber = roomNumber;

  db.logAudit(
    'DOCTOR_STATUS_UPDATE',
    'Admin / Staff',
    'admin',
    `Updated ${doc.name} status to ${doc.status}${delayMinutes ? ` (Delay: ${delayMinutes}m)` : ''}`
  );

  broadcastQueueUpdate();
  res.json({ success: true, doctor: doc });
});

// Department & Layout Management: List all departments with layout info
router.get('/departments', (req: Request, res: Response) => {
  const store = db.getStore();
  const depts = store.departments.map((dept) => {
    const docs = store.doctors.filter((d) => d.departmentId === dept.id);
    const waitingTokens = store.tokens.filter(
      (t) => t.departmentId === dept.id && ['waiting', 'almost_turn'].includes(t.status)
    );
    return {
      ...dept,
      doctorsCount: docs.length,
      activeDoctorsCount: docs.filter((d) => d.status === 'available' || d.status === 'busy').length,
      waitingPatients: waitingTokens.length,
    };
  });
  res.json({
    success: true,
    departments: depts,
  });
});

// Staff Management: List all hospital staff members
router.get('/staff', (req: Request, res: Response) => {
  const store = db.getStore();
  const staffRoster = [
    {
      id: 'demo-staff-1',
      name: 'Suresh Verma',
      role: 'counter_staff',
      roleLabel: 'Registration Staff',
      assignedLocation: 'OPD Counter 2 (Ground Floor)',
      status: 'on_duty',
      shift: 'Morning (08:00 AM - 04:00 PM)',
      actionsToday: store.patients.filter((p) => p.registrationMethod === 'assisted').length + 18,
    },
    {
      id: 'demo-staff-2',
      name: 'Anita Kumari',
      role: 'counter_staff',
      roleLabel: 'Registration Staff',
      assignedLocation: 'OPD Counter 1 (Ground Floor)',
      status: 'on_duty',
      shift: 'Morning (08:00 AM - 04:00 PM)',
      actionsToday: 24,
    },
    {
      id: 'doc-ortho-1',
      name: 'Dr. Priya Sharma',
      role: 'doctor',
      roleLabel: 'Consultant Orthopaedics',
      assignedLocation: 'Room 12 (1st Floor)',
      status: 'on_duty',
      shift: 'Full Day (09:00 AM - 05:00 PM)',
      actionsToday: store.tokens.filter((t) => t.departmentId === 'dept-ortho' && t.status === 'done').length + 14,
    },
    {
      id: 'doc-gen-1',
      name: 'Dr. Rajesh Rao',
      role: 'doctor',
      roleLabel: 'Consultant General Medicine',
      assignedLocation: 'Room 4 (Ground Floor)',
      status: 'on_duty',
      shift: 'Full Day (09:00 AM - 05:00 PM)',
      actionsToday: 21,
    },
    {
      id: 'demo-nurse-1',
      name: 'Sister Anjali Nair',
      role: 'triage_nurse',
      roleLabel: 'Senior Triage Nurse',
      assignedLocation: 'Emergency Assessment Desk (Ground Floor)',
      status: 'on_duty',
      shift: 'Emergency Shift A (07:00 AM - 03:00 PM)',
      actionsToday: store.emergencyAlerts.length + 8,
    },
    {
      id: 'demo-nurse-2',
      name: 'Nurse Biju Joseph',
      role: 'triage_nurse',
      roleLabel: 'Trauma & Resuscitation Nurse',
      assignedLocation: 'Trauma Bay 1',
      status: 'on_duty',
      shift: 'Emergency Shift A (07:00 AM - 03:00 PM)',
      actionsToday: 6,
    },
    {
      id: 'demo-admin-1',
      name: 'Dr. Arvind Mehta (MS)',
      role: 'admin',
      roleLabel: 'Medical Superintendent',
      assignedLocation: 'Admin Block, Room 101',
      status: 'on_duty',
      shift: 'Executive Shift (08:30 AM - 05:30 PM)',
      actionsToday: store.auditLogs.length,
    },
  ];

  res.json({
    success: true,
    staff: staffRoster,
  });
});

export default router;
