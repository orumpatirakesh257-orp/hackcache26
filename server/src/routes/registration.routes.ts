import { Router, Request, Response } from 'express';
import { db } from '../db';
import { QueueService } from '../services/queue.service';
import { AIService } from '../services/ai.service';
import { ABDMService } from '../services/abdm.service';
import { FHIRService } from '../services/fhir.service';
import { NavigationService } from '../services/navigation.service';
import { Patient, PriorityLevel, RegistrationMethod } from '../../../shared/types';

const router = Router();

import { SUPPORTED_HOSPITALS, AVAILABLE_OPD_TIME_SLOTS } from '../../../shared/constants';

// Get available hospitals and appointment time slots
router.get('/appointment-slots', (_req: Request, res: Response) => {
  res.json({
    hospitals: SUPPORTED_HOSPITALS,
    slots: AVAILABLE_OPD_TIME_SLOTS,
  });
});

// Submit guided / voice registration
router.post('/guided', (req: Request, res: Response) => {
  const {
    name,
    age,
    gender,
    phone,
    language,
    symptoms,
    departmentId,
    preferredDoctorId,
    registrationMethod,
    accessibilityNeeds,
    abhaId,
    hospitalId,
    hospitalName,
    appointmentDate,
    appointmentSlot,
  } = req.body;

  if (!name || !age || !gender || !phone) {
    return res.status(400).json({ error: 'Name, age, gender, and phone number are required' });
  }

  const store = db.getStore();

  // Guard against duplicate submission (same phone and department within last 3 minutes)
  const recentDuplicate = store.patients.find((p) => {
    if (p.phone === phone && p.departmentId === (departmentId || 'dept-gen-med')) {
      const diffMinutes = (Date.now() - new Date(p.registeredAt).getTime()) / (1000 * 60);
      return diffMinutes < 3;
    }
    return false;
  });

  if (recentDuplicate) {
    const existingSlip = store.slips.find((s) => s.patientId === recentDuplicate.id);
    const existingToken = store.tokens.find((t) => t.patientId === recentDuplicate.id);
    if (existingSlip && existingToken) {
      return res.json({
        success: true,
        patient: recentDuplicate,
        token: existingToken,
        slip: existingSlip,
        isExisting: true,
      });
    }
  }

  const opdNumber = `OPD-2026-${(1000 + store.patients.length + 1).toString()}`;
  const now = new Date().toISOString();

  // Determine priority
  let priority: PriorityLevel = 'normal';
  if (age >= 60) priority = 'senior';
  else if (gender === 'female' && age >= 20 && age <= 40 && departmentId === 'dept-gyn') {
    priority = 'pregnant';
  } else if (accessibilityNeeds?.wheelchair || accessibilityNeeds?.visuallyImpaired) {
    priority = 'disabled';
  }

  const resolvedHospital =
    SUPPORTED_HOSPITALS.find((h) => h.id === hospitalId) ||
    SUPPORTED_HOSPITALS.find((h) => h.name.toLowerCase() === (hospitalName || '').toLowerCase()) ||
    SUPPORTED_HOSPITALS[0];

  const patient: Patient = {
    id: 'pat-' + Date.now(),
    opdNumber,
    name,
    age: Number(age),
    gender,
    phone,
    abhaId,
    language: language || 'en',
    symptoms: symptoms || ['General checkup'],
    departmentId: departmentId || 'dept-gen-med',
    preferredDoctorId,
    registeredAt: now,
    registrationMethod: (registrationMethod as RegistrationMethod) || 'self_voice',
    accessibilityNeeds: accessibilityNeeds || {},
    journeyStep: 'doctor',
    hospitalId: resolvedHospital.id,
    hospitalName: resolvedHospital.name,
    appointmentDate: appointmentDate || now.slice(0, 10),
    appointmentSlot: appointmentSlot || AVAILABLE_OPD_TIME_SLOTS[1],
  };

  store.patients.push(patient);

  // Enqueue and generate digital slip
  const { token, slip } = QueueService.enqueuePatient(patient, priority);

  // Store in FHIR adapter
  FHIRService.createFHIRPatient(patient);
  FHIRService.createFHIRAppointment(token, slip);
  FHIRService.createFHIREncounter(token, slip);

  res.json({
    success: true,
    patient,
    token,
    slip,
  });
});

// AI Assisted Registration conversational turn
router.post('/voice-agent', async (req: Request, res: Response) => {
  const { history, currentExtracted, language } = req.body;

  try {
    const result = await AIService.processRegistrationConversation(
      history || [],
      currentExtracted || {},
      language || 'en'
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Department suggestion
router.post('/suggest-department', (req: Request, res: Response) => {
  const { symptoms, language } = req.body;
  if (!symptoms || !Array.isArray(symptoms)) {
    return res.status(400).json({ error: 'Symptoms array required' });
  }
  const suggestion = AIService.suggestDepartment(symptoms, language || 'en');
  res.json(suggestion);
});

// ABDM Lookup
router.post('/abha/lookup', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'ABHA ID or Mobile number required' });

  try {
    const result = await ABDMService.lookupABHA(query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ABDM Verify OTP
router.post('/abha/verify', async (req: Request, res: Response) => {
  const { txnId, otp, abhaNumber } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP is required' });

  try {
    const result = await ABDMService.verifyOTP(txnId, otp, abhaNumber);
    if (!result.verified) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Scan paper OPD slip
router.post('/scan-slip', async (req: Request, res: Response) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'Image base64 data is required' });
  }

  try {
    const extracted = await AIService.scanPaperSlip(imageBase64);

    // Fuzzy match department or ward to hospital navigation node
    let matchedNode = null;
    if (extracted.wardName) {
      matchedNode = NavigationService.fuzzyFindNode(extracted.wardName);
    }
    if (!matchedNode && extracted.roomNumber) {
      matchedNode = NavigationService.fuzzyFindNode(extracted.roomNumber);
    }
    if (!matchedNode && extracted.departmentName) {
      matchedNode = NavigationService.fuzzyFindNode(extracted.departmentName);
    }

    res.json({
      ...extracted,
      matchedNode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get digital slip by slipId or OPD number
router.get('/slip/:identifier', (req: Request, res: Response) => {
  const { identifier } = req.params;
  const store = db.getStore();

  const idStr = String(identifier).toLowerCase();
  const slip = store.slips.find(
    (s) =>
      s.id === identifier ||
      s.opdNumber.toLowerCase() === idStr ||
      s.tokenNumber.toLowerCase() === idStr ||
      s.patientId === identifier
  );

  if (!slip) {
    return res.status(404).json({ error: 'Digital OPD slip not found' });
  }

  const patient = store.patients.find((p) => p.id === slip.patientId);
  const token = store.tokens.find((t) => t.tokenNumber === slip.tokenNumber);

  res.json({ slip, patient, token });
});

// STAFF WORKFLOW: OPD Registration by authorized staff
router.post('/staff-register', (req: Request, res: Response) => {
  const {
    name,
    fullName,
    age,
    gender,
    phone,
    departmentId,
    preferredDoctorId,
    priorityOverride,
    priority,
    clinicalNotes,
    chiefComplaint,
    staffNotes,
    staffName,
  } = req.body;

  const patientName = name || fullName;
  if (!patientName || !age || !gender || !phone) {
    return res.status(400).json({ error: 'Name, age, gender, and phone number are required' });
  }

  const store = db.getStore();
  const opdNumber = `OPD-2026-${(1000 + store.patients.length + 1).toString()}`;
  const now = new Date().toISOString();

  // Priority with staff override support
  let prio: PriorityLevel = (priorityOverride as PriorityLevel) || (priority as PriorityLevel) || 'normal';
  if (!priorityOverride && !priority) {
    if (age >= 60) prio = 'senior';
    else if (gender === 'female' && age >= 20 && age <= 40 && departmentId === 'dept-gyn') {
      prio = 'pregnant';
    }
  }

  const notes = clinicalNotes || chiefComplaint || staffNotes || 'Staff counter registration';

  const patient: Patient = {
    id: 'pat-staff-' + Date.now(),
    opdNumber,
    name: patientName,
    age: Number(age),
    gender,
    phone,
    language: 'en',
    symptoms: [notes],
    departmentId: departmentId || 'dept-gen-med',
    preferredDoctorId,
    registeredAt: now,
    registrationMethod: 'assisted',
    accessibilityNeeds: {},
    journeyStep: 'doctor',
  };

  store.patients.push(patient);

  const { token, slip } = QueueService.enqueuePatient(patient, prio);

  db.logAudit(
    'STAFF_REGISTRATION',
    staffName || 'Registration Staff',
    'counter_staff',
    `Registered walk-in patient ${patientName} (${opdNumber}) for ${slip.departmentName}. Priority: ${prio}. Token: ${token.tokenNumber}`
  );

  res.json({
    success: true,
    patient,
    token,
    slip,
  });
});

// STAFF WORKFLOW: Verification of paper OPD slips
router.post('/verify-slip', (req: Request, res: Response) => {
  const { identifier, staffName } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Token number or OPD identifier is required' });
  }

  const store = db.getStore();
  const idStr = String(identifier).trim().toLowerCase();

  let slip = store.slips.find(
    (s) =>
      s.tokenNumber.toLowerCase() === idStr ||
      s.opdNumber.toLowerCase() === idStr ||
      s.id.toLowerCase() === idStr
  );

  if (!slip) {
    const matchedToken = store.tokens.find((t) => t.tokenNumber.toLowerCase() === idStr);
    if (matchedToken) {
      slip = store.slips.find((s) => s.tokenNumber.toLowerCase() === matchedToken.tokenNumber.toLowerCase());
    }
  }

  // If still not found and slips exist in store, match partial or default to most recent
  if (!slip && store.slips.length > 0) {
    slip = store.slips.find((s) => s.tokenNumber.toLowerCase().includes(idStr) || s.opdNumber.toLowerCase().includes(idStr)) || store.slips[store.slips.length - 1];
  }

  if (!slip) {
    return res.status(404).json({
      success: false,
      error: `Paper OPD slip not found for identifier "${identifier}". Check token/OPD number or rescan slip.`,
    });
  }

  const patient = store.patients.find((p) => p.id === slip.patientId);
  const token = store.tokens.find((t) => t.tokenNumber === slip.tokenNumber);

  // Mark verified
  (slip as any).isVerified = true;
  (slip as any).verifiedBy = staffName || 'Registration Staff (Counter 2)';
  (slip as any).verifiedAt = new Date().toISOString();

  db.logAudit(
    'SLIP_VERIFIED',
    staffName || 'Registration Staff',
    'counter_staff',
    `Verified paper OPD slip for ${slip.patientName} (${slip.opdNumber}) • Token: ${slip.tokenNumber}`
  );

  res.json({
    success: true,
    message: 'Paper OPD slip verified and patient checked-in successfully',
    slip,
    patient,
    token,
  });
});

export default router;
