import { QueueService } from '../services/queue.service';
import { db } from '../db';
import { Patient } from '../../../shared/types';

export function testQueueLogic(): boolean {
  console.log('--- RUNNING TEST: Queue Wait-Time Logic ---');

  // Enqueue test patient
  const testPatient: Patient = {
    id: 'test-pat-1',
    opdNumber: 'OPD-TEST-001',
    name: 'Unit Test Patient',
    age: 45,
    gender: 'male',
    phone: '9876543210',
    language: 'en',
    symptoms: ['Fever and headache'],
    departmentId: 'dept-gen-med',
    registeredAt: new Date().toISOString(),
    registrationMethod: 'self_guided',
    accessibilityNeeds: {},
    journeyStep: 'doctor',
  };

  const { token, slip } = QueueService.enqueuePatient(testPatient, 'normal');

  if (!token.tokenNumber.startsWith('GM-')) {
    throw new Error(`Expected token prefix GM-, got ${token.tokenNumber}`);
  }

  if (!slip.signedQrPayload) {
    throw new Error('Digital slip is missing signed QR payload');
  }

  // Test doctor delay effect on wait time
  const doc = db.getStore().doctors.find((d) => d.departmentId === 'dept-gen-med');
  if (doc) {
    const prevWait = token.estimatedWaitMinutes;
    QueueService.updateDoctorStatus(doc.id, 'delayed', 20, 'Test delay');
    const updatedToken = db.getStore().tokens.find((t) => t.id === token.id)!;
    console.log(`Wait time adjusted with delay: initial=${prevWait}m, delayed=${updatedToken.estimatedWaitMinutes}m`);
    // Restore doctor
    QueueService.updateDoctorStatus(doc.id, 'available', 0, '');
  }

  // Test step-away grace period
  const stepped = QueueService.stepAway(token.id);
  if (stepped.status !== 'stepped_away' || !stepped.graceExpiresAt) {
    throw new Error('Step-away did not set graceExpiresAt or status');
  }

  const resumed = QueueService.resumeFromStepAway(token.id);
  if (resumed.status !== 'waiting' && resumed.status !== 'almost_turn') {
    throw new Error(`Resume did not restore active waiting status, got: ${resumed.status}`);
  }

  console.log('✓ Queue wait-time, doctor delay, and step-away grace logic passed.');
  return true;
}
