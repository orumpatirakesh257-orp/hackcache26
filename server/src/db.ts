import fs from 'fs';
import path from 'path';
import {
  Patient,
  QueueToken,
  DigitalSlip,
  EmergencyAlert,
  AssistanceRequest,
  AuditLog,
  SimulatedMessage,
  Doctor,
  Department,
  FHIRResource,
} from '../../shared/types';
import { DEPARTMENTS_DATA, DOCTORS_DATA } from '../../shared/constants';

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'hospital_store.json');

export interface DatabaseStore {
  departments: Department[];
  doctors: Doctor[];
  patients: Patient[];
  tokens: QueueToken[];
  slips: DigitalSlip[];
  emergencyAlerts: EmergencyAlert[];
  assistanceRequests: AssistanceRequest[];
  auditLogs: AuditLog[];
  simulatedMessages: SimulatedMessage[];
  fhirResources: FHIRResource[];
  broadcasts: { id: string; message: string; timestamp: string; active: boolean }[];
}

class InMemoryDatabase {
  private store: DatabaseStore;

  constructor() {
    this.store = this.initializeStore();
  }

  private initializeStore(): DatabaseStore {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          departments: parsed.departments || [...DEPARTMENTS_DATA],
          doctors: parsed.doctors || [...DOCTORS_DATA],
          patients: parsed.patients || [],
          tokens: parsed.tokens || [],
          slips: parsed.slips || [],
          emergencyAlerts: parsed.emergencyAlerts || [],
          assistanceRequests: parsed.assistanceRequests || [],
          auditLogs: parsed.auditLogs || [],
          simulatedMessages: parsed.simulatedMessages || [],
          fhirResources: parsed.fhirResources || [],
          broadcasts: parsed.broadcasts || [],
        };
      } catch (err) {
        console.warn('Failed to parse existing data store, initializing fresh state', err);
      }
    }

    return {
      departments: [...DEPARTMENTS_DATA],
      doctors: [...DOCTORS_DATA],
      patients: [],
      tokens: [],
      slips: [],
      emergencyAlerts: [],
      assistanceRequests: [],
      auditLogs: [],
      simulatedMessages: [],
      fhirResources: [],
      broadcasts: [],
    };
  }

  public persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database to disk', err);
    }
  }

  public getStore(): DatabaseStore {
    return this.store;
  }

  public resetStore(freshSeed?: DatabaseStore): void {
    if (freshSeed) {
      this.store = freshSeed;
    } else {
      this.store = {
        departments: JSON.parse(JSON.stringify(DEPARTMENTS_DATA)),
        doctors: JSON.parse(JSON.stringify(DOCTORS_DATA)),
        patients: [],
        tokens: [],
        slips: [],
        emergencyAlerts: [],
        assistanceRequests: [],
        auditLogs: [],
        simulatedMessages: [],
        fhirResources: [],
        broadcasts: [],
      };
    }
    this.persist();
  }

  public logAudit(action: string, performedBy: string, role: any, details: string, patientId?: string): AuditLog {
    const log: AuditLog = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      action,
      performedBy,
      role,
      details,
      patientId,
    };
    this.store.auditLogs.unshift(log);
    // Keep max 500 logs
    if (this.store.auditLogs.length > 500) {
      this.store.auditLogs.pop();
    }
    return log;
  }

  public addSimulatedMessage(patientId: string, phone: string, channel: 'SMS' | 'WhatsApp', title: string, content: string): SimulatedMessage {
    const msg: SimulatedMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      patientId,
      recipientPhone: phone,
      channel,
      title,
      content,
      sentAt: new Date().toISOString(),
      status: 'delivered',
    };
    this.store.simulatedMessages.unshift(msg);
    if (this.store.simulatedMessages.length > 100) {
      this.store.simulatedMessages.pop();
    }
    return msg;
  }
}

export const db = new InMemoryDatabase();
