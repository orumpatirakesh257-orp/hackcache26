import { db } from '../db';
import {
  QueueToken,
  Patient,
  DigitalSlip,
  Doctor,
  Department,
  PriorityLevel,
  QueueStatus,
  JourneyStep,
} from '../../../shared/types';
import {
  broadcastQueueUpdate,
  notifyTokenCalled,
  notifyEmergencyTriggered,
} from './notifications.service';

export class QueueService {
  /**
   * Recalculates estimated wait time and positions for all waiting tokens in a department
   */
  public static recalculateDepartmentQueue(departmentId: string): void {
    const store = db.getStore();
    const dept = store.departments.find((d) => d.id === departmentId);
    if (!dept) return;

    // Get active doctors for this department
    const doctors = store.doctors.filter(
      (doc) => doc.departmentId === departmentId && doc.status !== 'not_in_today'
    );
    const activeDoctorCount = Math.max(
      1,
      doctors.filter((d) => d.status === 'available' || d.status === 'busy').length
    );

    // Get active waiting or stepped-away tokens for this department
    const waitingTokens = store.tokens
      .filter(
        (t) =>
          t.departmentId === departmentId &&
          (t.status === 'waiting' ||
            t.status === 'almost_turn' ||
            t.status === 'stepped_away' ||
            t.status === 'emergency_escalated')
      )
      .sort((a, b) => {
        // Emergency priority comes first
        const isEmergA = a.priority.startsWith('emergency') ? 1 : 0;
        const isEmergB = b.priority.startsWith('emergency') ? 1 : 0;
        if (isEmergA !== isEmergB) return isEmergB - isEmergA;

        // Special priority (senior, pregnant, disabled)
        const isSpecialA = ['senior', 'pregnant', 'disabled'].includes(a.priority) ? 1 : 0;
        const isSpecialB = ['senior', 'pregnant', 'disabled'].includes(b.priority) ? 1 : 0;
        if (isSpecialA !== isSpecialB) return isSpecialB - isSpecialA;

        // Then by creation timestamp / position
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    // Check doctor delay or break penalty
    let doctorDelayMinutes = 0;
    let delayReason = '';
    const delayedDoctor = doctors.find((d) => d.status === 'delayed' && d.delayMinutes > 0);
    const breakDoctor = doctors.find((d) => d.status === 'on_break');

    if (delayedDoctor) {
      doctorDelayMinutes = delayedDoctor.delayMinutes;
      delayReason = `Doctor delayed by ${delayedDoctor.delayMinutes} mins (${delayedDoctor.delayReason || 'Emergency procedure'})`;
    } else if (breakDoctor) {
      doctorDelayMinutes = breakDoctor.delayMinutes || 10;
      delayReason = `Doctor on short break (${breakDoctor.delayReason || 'resumes shortly'})`;
    }

    const avgConsultMinutes = dept.avgConsultMinutes || 7;

    waitingTokens.forEach((token, index) => {
      token.queuePosition = index + 1;

      if (token.priority.startsWith('emergency')) {
        token.estimatedWaitMinutes = 0;
        token.waitReason = 'Immediate Emergency Priority - Triage assessment in progress';
        token.status = 'emergency_escalated';
        return;
      }

      // Check if stepped away and expired
      if (token.status === 'stepped_away' && token.graceExpiresAt) {
        if (new Date().getTime() > new Date(token.graceExpiresAt).getTime()) {
          // Grace expired -> move back 3 positions
          token.status = 'waiting';
          token.graceExpiresAt = undefined;
          token.steppedAwayAt = undefined;
          db.logAudit(
            'QUEUE_GRACE_EXPIRED',
            'system',
            'admin',
            `Token ${token.tokenNumber} grace period expired. Resumed in queue.`,
            token.patientId
          );
        }
      }

      // Base wait time: (people ahead / active doctors) * avgConsultMinutes
      const peopleAhead = Math.max(0, index);
      let calculatedWait = Math.ceil((peopleAhead / activeDoctorCount) * avgConsultMinutes);

      // Add doctor delay impact
      if (doctorDelayMinutes > 0 && index < 6) {
        calculatedWait += Math.ceil(doctorDelayMinutes / activeDoctorCount);
      }

      token.estimatedWaitMinutes = calculatedWait;

      if (delayReason) {
        token.waitReason = delayReason;
      } else if (index === 0) {
        token.waitReason = 'You are next! Please be ready near the room.';
        if (token.status === 'waiting') {
          token.status = 'almost_turn';
        }
      } else if (index <= 2) {
        token.waitReason = 'Almost your turn (only 1-2 patients ahead).';
        if (token.status === 'waiting') {
          token.status = 'almost_turn';
        }
      } else {
        token.waitReason = `Queue running normally with ${activeDoctorCount} active consultation room(s).`;
        if (token.status === 'almost_turn') {
          token.status = 'waiting';
        }
      }

      token.updatedAt = new Date().toISOString();
    });

    db.persist();
    broadcastQueueUpdate(departmentId);
  }

  /**
   * Enqueue a new patient and create a token + digital slip
   */
  public static enqueuePatient(
    patient: Patient,
    priority: PriorityLevel = 'normal'
  ): { token: QueueToken; slip: DigitalSlip } {
    const store = db.getStore();
    const dept = store.departments.find((d) => d.id === patient.departmentId) || store.departments[0];

    // Generate token number: e.g. A-042 or ORTHO-012
    const prefix = dept.code || 'A';
    const existingTokensForDept = store.tokens.filter((t) => t.departmentId === dept.id);
    const tokenSeq = existingTokensForDept.length + 1;
    const tokenNumber = `${prefix}-${tokenSeq.toString().padStart(3, '0')}`;

    // Select doctor
    const availableDocs = store.doctors.filter(
      (d) => d.departmentId === dept.id && d.status !== 'not_in_today'
    );
    const assignedDoc =
      (patient.preferredDoctorId && store.doctors.find((d) => d.id === patient.preferredDoctorId)) ||
      availableDocs[0] ||
      store.doctors[0];

    const now = new Date();
    const token: QueueToken = {
      id: 'token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      tokenNumber,
      departmentId: dept.id,
      doctorId: assignedDoc.id,
      patientId: patient.id,
      opdNumber: patient.opdNumber,
      status: priority.startsWith('emergency') ? 'emergency_escalated' : 'waiting',
      priority,
      estimatedWaitMinutes: 15,
      waitReason: 'Calculating wait time...',
      queuePosition: 1,
      journeyStep: patient.journeyStep || 'doctor',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    store.tokens.push(token);

    // Generate digital OPD slip
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const signedPayload = JSON.stringify({
      slipId: 'slip-' + Date.now(),
      opdNumber: patient.opdNumber,
      tokenNumber,
      patientName: patient.name,
      department: dept.name,
      room: assignedDoc.roomNumber,
      date: dateStr,
      hash: Math.random().toString(36).substring(2, 10).toUpperCase(),
    });

    const slip: DigitalSlip = {
      id: 'slip-' + Date.now(),
      patientId: patient.id,
      tokenNumber,
      opdNumber: patient.opdNumber,
      patientName: patient.name,
      age: patient.age,
      gender: patient.gender,
      departmentId: dept.id,
      departmentName: dept.name,
      doctorName: assignedDoc.name,
      roomNumber: assignedDoc.roomNumber,
      floor: assignedDoc.floor,
      block: assignedDoc.block,
      dateStr: patient.appointmentDate || dateStr,
      timeStr: patient.appointmentSlot || timeStr,
      estimatedWaitMinutes: 15,
      navigationHint:
        assignedDoc.floor === 0
          ? `Ground Floor, turn left after the Water Purifier to ${assignedDoc.roomNumber}`
          : `Floor ${assignedDoc.floor}, take the elevator or stairs next to the Ficus plant to ${assignedDoc.roomNumber}`,
      signedQrPayload: signedPayload,
      hospitalId: patient.hospitalId || 'hosp-aiims-delhi',
      hospitalName: patient.hospitalName || 'AIIMS New Delhi (Main Campus)',
      appointmentDate: patient.appointmentDate || dateStr,
      appointmentSlot: patient.appointmentSlot || timeStr,
    };

    store.slips.push(slip);

    // Initial recalculation
    this.recalculateDepartmentQueue(dept.id);

    db.logAudit(
      'PATIENT_ENQUEUED',
      patient.name,
      'patient',
      `Assigned token ${tokenNumber} for ${dept.name} (${assignedDoc.roomNumber})`,
      patient.id
    );

    return { token, slip };
  }

  /**
   * Doctor calls next patient in queue
   */
  public static callNext(doctorId: string): { token: QueueToken | null; patient: Patient | null } {
    const store = db.getStore();
    const doc = store.doctors.find((d) => d.id === doctorId);
    if (!doc) throw new Error('Doctor not found');

    // Complete any currently consulting token
    const currentConsulting = store.tokens.find(
      (t) => t.doctorId === doctorId && t.status === 'in_consultation'
    );
    if (currentConsulting) {
      currentConsulting.status = 'done';
      currentConsulting.completedAt = new Date().toISOString();
      doc.patientsSeenToday += 1;
    }

    // Find next eligible token: either assigned to this doc or unassigned in department
    const candidateTokens = store.tokens
      .filter(
        (t) =>
          t.departmentId === doc.departmentId &&
          (t.status === 'waiting' || t.status === 'almost_turn' || t.status === 'emergency_escalated')
      )
      .sort((a, b) => a.queuePosition - b.queuePosition);

    if (candidateTokens.length === 0) {
      doc.currentToken = undefined;
      doc.status = 'available';
      db.persist();
      broadcastQueueUpdate(doc.departmentId);
      return { token: null, patient: null };
    }

    const nextToken = candidateTokens[0];
    nextToken.status = 'in_consultation';
    nextToken.doctorId = doc.id;
    nextToken.calledAt = new Date().toISOString();
    nextToken.consultationStartedAt = new Date().toISOString();
    nextToken.updatedAt = new Date().toISOString();

    doc.currentToken = nextToken.tokenNumber;
    doc.status = 'busy';

    const patient = store.patients.find((p) => p.id === nextToken.patientId) || null;

    db.logAudit(
      'DOCTOR_CALL_NEXT',
      doc.name,
      'doctor',
      `Called token ${nextToken.tokenNumber} to ${doc.roomNumber}`,
      patient?.id
    );

    db.persist();

    // Recalculate remaining queue
    this.recalculateDepartmentQueue(doc.departmentId);

    // Fire notifications (realtime socket, SMS/WhatsApp simulation)
    notifyTokenCalled(nextToken, patient, doc);

    return { token: nextToken, patient };
  }

  /**
   * Mark token consultation done and optionally advance journey step (e.g. to Lab or Pharmacy)
   */
  public static markDone(
    tokenId: string,
    nextStep?: 'lab' | 'pharmacy' | 'completed' | 'other_department',
    targetDepartmentId?: string
  ): QueueToken {
    const store = db.getStore();
    const token = store.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    const patient = store.patients.find((p) => p.id === token.patientId);

    token.status = 'done';
    token.completedAt = new Date().toISOString();
    token.updatedAt = new Date().toISOString();

    if (token.doctorId) {
      const doc = store.doctors.find((d) => d.id === token.doctorId);
      if (doc && doc.currentToken === token.tokenNumber) {
        doc.currentToken = undefined;
        doc.status = 'available';
        doc.patientsSeenToday += 1;
      }
    }

    // Handle journey progression
    if (patient && nextStep) {
      if (nextStep === 'lab') {
        patient.journeyStep = 'lab';
        // Enqueue into Diagnostic Lab
        this.enqueuePatient(patient, token.priority);
      } else if (nextStep === 'pharmacy') {
        patient.journeyStep = 'pharmacy';
        // Enqueue into Pharmacy
        this.enqueuePatient(patient, token.priority);
      } else if (nextStep === 'other_department' && targetDepartmentId) {
        patient.departmentId = targetDepartmentId;
        patient.journeyStep = 'doctor';
        this.enqueuePatient(patient, token.priority);
      } else {
        patient.journeyStep = 'completed';
      }
    }

    db.logAudit(
      'TOKEN_COMPLETED',
      token.doctorId ? 'Doctor' : 'Staff',
      'doctor',
      `Consultation completed for ${token.tokenNumber}. Next step: ${nextStep || 'completed'}`,
      patient?.id
    );

    this.recalculateDepartmentQueue(token.departmentId);
    return token;
  }

  /**
   * Step away: gives 10-minute grace period
   */
  public static stepAway(tokenId: string): QueueToken {
    const store = db.getStore();
    const token = store.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    const now = new Date();
    const graceExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    token.status = 'stepped_away';
    token.steppedAwayAt = now.toISOString();
    token.graceExpiresAt = graceExpiry.toISOString();
    token.waitReason = 'Stepped away for 10 minutes. Return before timer ends to keep your place.';
    token.updatedAt = now.toISOString();

    db.logAudit(
      'PATIENT_STEPPED_AWAY',
      'Patient',
      'patient',
      `Token ${token.tokenNumber} stepped away with 10 min grace period until ${graceExpiry.toLocaleTimeString()}`,
      token.patientId
    );

    this.recalculateDepartmentQueue(token.departmentId);
    return token;
  }

  /**
   * Resume from stepping away
   */
  public static resumeFromStepAway(tokenId: string): QueueToken {
    const store = db.getStore();
    const token = store.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    token.status = 'waiting';
    token.steppedAwayAt = undefined;
    token.graceExpiresAt = undefined;
    token.updatedAt = new Date().toISOString();

    db.logAudit(
      'PATIENT_RESUMED',
      'Patient',
      'patient',
      `Token ${token.tokenNumber} resumed back in queue`,
      token.patientId
    );

    this.recalculateDepartmentQueue(token.departmentId);
    return token;
  }

  /**
   * Doctor delay or tea break declaration
   */
  public static updateDoctorStatus(
    doctorId: string,
    status: 'available' | 'busy' | 'on_break' | 'delayed',
    delayMinutes: number = 0,
    delayReason: string = ''
  ): Doctor {
    const store = db.getStore();
    const doc = store.doctors.find((d) => d.id === doctorId);
    if (!doc) throw new Error('Doctor not found');

    doc.status = status;
    doc.delayMinutes = delayMinutes;
    doc.delayReason = delayReason;

    db.logAudit(
      'DOCTOR_STATUS_UPDATE',
      doc.name,
      'doctor',
      `Status: ${status}, Delay: ${delayMinutes} mins (${delayReason})`
    );

    this.recalculateDepartmentQueue(doc.departmentId);
    return doc;
  }

  /**
   * Escalate any queued patient to Emergency
   */
  public static escalatePatientToEmergency(
    tokenId: string,
    reason: string,
    staffName: string = 'Staff'
  ): QueueToken {
    const store = db.getStore();
    const token = store.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    const patient = store.patients.find((p) => p.id === token.patientId);

    token.priority = 'emergency_critical';
    token.status = 'emergency_escalated';
    token.estimatedWaitMinutes = 0;
    token.waitReason = 'Emergency escalated: immediate nurse assessment';

    // Create an emergency alert
    const alert = {
      id: 'emerg-' + Date.now(),
      patientId: token.patientId,
      patientName: patient?.name || 'Queued Patient',
      location: `Waiting outside ${token.departmentId}`,
      flaggedSymptoms: [reason || 'Condition deteriorated while waiting'],
      priority: 'critical' as const,
      status: 'flagged' as const,
      timestamp: new Date().toISOString(),
      nurseNotes: `Escalated from normal queue by ${staffName}. Original Token: ${token.tokenNumber}`,
    };

    store.emergencyAlerts.unshift(alert);

    db.logAudit(
      'EMERGENCY_ESCALATION',
      staffName,
      'triage_nurse',
      `Escalated Token ${token.tokenNumber} to EMERGENCY: ${reason}`,
      token.patientId
    );

    notifyEmergencyTriggered(alert);
    this.recalculateDepartmentQueue(token.departmentId);

    return token;
  }
}
