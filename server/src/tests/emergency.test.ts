import { QueueService } from '../services/queue.service';
import { AIService } from '../services/ai.service';
import { db } from '../db';
import { Patient } from '../../../shared/types';

export function testEmergencyLogic(): boolean {
  console.log('--- RUNNING TEST: Emergency Escalation & Danger Word Detection ---');

  // 1. Test Danger Keyword Detection across languages
  const danger1 = AIService.checkDangerKeywords('Patient complains of severe chest pain and breathlessness');
  if (!danger1.isEmergency) {
    throw new Error('Failed to detect "chest pain" emergency keyword in English');
  }

  const danger2 = AIService.checkDangerKeywords('मरीज को छाती में दर्द हो रहा है');
  if (!danger2.isEmergency) {
    throw new Error('Failed to detect "छाती में दर्द" emergency keyword in Hindi');
  }

  const danger3 = AIService.checkDangerKeywords('நோயாளிக்கு நெஞ்சு வலி அதிகமாக உள்ளது');
  if (!danger3.isEmergency) {
    throw new Error('Failed to detect "நெஞ்சு வலி" emergency keyword in Tamil');
  }

  console.log('✓ Multilingual danger keywords accurately detected in English, Hindi, and Tamil.');

  // 2. Test Emergency Escalation of Queued Patient
  const patient: Patient = {
    id: 'test-emerg-pat',
    opdNumber: 'OPD-EMERG-001',
    name: 'Emergency Test Patient',
    age: 52,
    gender: 'female',
    phone: '9876500000',
    language: 'en',
    symptoms: ['Mild backache'],
    departmentId: 'dept-ortho',
    registeredAt: new Date().toISOString(),
    registrationMethod: 'self_guided',
    accessibilityNeeds: {},
    journeyStep: 'doctor',
  };

  const { token } = QueueService.enqueuePatient(patient, 'normal');

  // Patient's condition worsens -> Escalate to emergency
  const escalatedToken = QueueService.escalatePatientToEmergency(
    token.id,
    'Sudden collapse and breathing distress in waiting area',
    'Triage Nurse Anjali'
  );

  if (escalatedToken.priority !== 'emergency_critical') {
    throw new Error(`Expected priority emergency_critical, got ${escalatedToken.priority}`);
  }

  if (escalatedToken.estimatedWaitMinutes !== 0) {
    throw new Error(`Expected wait time 0 for emergency, got ${escalatedToken.estimatedWaitMinutes}`);
  }

  // Verify an emergency alert was created in the triage desk
  const store = db.getStore();
  const alert = store.emergencyAlerts.find((a) => a.patientId === patient.id);
  if (!alert) {
    throw new Error('Emergency alert was not created on escalation');
  }

  console.log('✓ Emergency escalation moved token to top priority with 0 wait time and notified triage desk.');
  return true;
}
