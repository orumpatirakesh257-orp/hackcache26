export type LanguageCode =
  | 'en'
  | 'hi'
  | 'ta'
  | 'te'
  | 'kn'
  | 'ml'
  | 'bn'
  | 'mr'
  | 'gu'
  | 'pa';

export type UserRole =
  | 'patient'
  | 'counter_staff'
  | 'doctor'
  | 'triage_nurse'
  | 'admin';

export type Gender = 'male' | 'female' | 'other';

export type PriorityLevel =
  | 'normal'
  | 'senior'
  | 'pregnant'
  | 'disabled'
  | 'emergency_critical'
  | 'emergency_urgent'
  | 'emergency_non_urgent';

export type QueueStatus =
  | 'waiting'
  | 'almost_turn'
  | 'go_to_room'
  | 'in_consultation'
  | 'done'
  | 'missed'
  | 'rescheduled'
  | 'stepped_away'
  | 'emergency_escalated';

export type DoctorStatus =
  | 'available'
  | 'busy'
  | 'on_break'
  | 'not_in_today'
  | 'delayed';

export type EmergencyPriority = 'critical' | 'urgent' | 'non_urgent';

export type RegistrationMethod =
  | 'self_guided'
  | 'self_voice'
  | 'abha'
  | 'assisted'
  | 'paper_scan'
  | 'emergency_quick';

export type JourneyStep = 'registration' | 'doctor' | 'lab' | 'pharmacy' | 'completed';

export interface AccessibilityNeeds {
  wheelchair?: boolean;
  escort?: boolean;
  interpreter?: boolean;
  readingHelp?: boolean;
  visuallyImpaired?: boolean;
  hearingImpaired?: boolean;
  lowDigitalLiteracy?: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  localNames: Record<LanguageCode, string>;
  floor: number;
  block: string;
  roomRange: string;
  avgConsultMinutes: number;
  maxCapacityThreshold: number;
  doctorIds: string[];
  icon: string;
  description: string;
}

export interface Doctor {
  id: string;
  name: string;
  departmentId: string;
  roomNumber: string;
  floor: number;
  block: string;
  status: DoctorStatus;
  delayMinutes: number;
  delayReason?: string;
  avgConsultMinutes: number;
  currentToken?: string;
  patientsSeenToday: number;
}

export interface HospitalInfo {
  id: string;
  name: string;
  city: string;
  type: string;
  district: string;
}

export interface Patient {
  id: string;
  opdNumber: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  abhaId?: string;
  language: LanguageCode;
  symptoms: string[];
  symptomDescription?: string;
  departmentId: string;
  preferredDoctorId?: string;
  registeredAt: string;
  registrationMethod: RegistrationMethod;
  accessibilityNeeds: AccessibilityNeeds;
  journeyStep: JourneyStep;
  hospitalId?: string;
  hospitalName?: string;
  appointmentDate?: string;
  appointmentSlot?: string;
}

export interface QueueToken {
  id: string;
  tokenNumber: string; // e.g. "A-042"
  departmentId: string;
  doctorId?: string;
  patientId: string;
  opdNumber: string;
  status: QueueStatus;
  priority: PriorityLevel;
  estimatedWaitMinutes: number;
  waitReason: string;
  queuePosition: number;
  calledAt?: string;
  completedAt?: string;
  steppedAwayAt?: string;
  graceExpiresAt?: string;
  consultationStartedAt?: string;
  journeyStep: JourneyStep;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalSlip {
  id: string;
  patientId: string;
  tokenNumber: string;
  opdNumber: string;
  patientName: string;
  age: number;
  gender: Gender;
  departmentId: string;
  departmentName: string;
  doctorName: string;
  roomNumber: string;
  floor: number;
  block: string;
  dateStr: string;
  timeStr: string;
  estimatedWaitMinutes: number;
  navigationHint: string;
  signedQrPayload: string;
  qrCodeDataUrl?: string;
  hospitalId?: string;
  hospitalName?: string;
  appointmentDate?: string;
  appointmentSlot?: string;
}

export interface EmergencyAlert {
  id: string;
  patientId?: string;
  patientName?: string;
  location: string;
  flaggedSymptoms: string[];
  priority: EmergencyPriority;
  status: 'flagged' | 'acknowledged' | 'assessed' | 'assigned' | 'downgraded' | 'resolved';
  timestamp: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  nurseNotes?: string;
  assignedTeam?: string;
  downgradeReason?: string;
  responseTimeSeconds?: number;
}

export interface AssistanceRequest {
  id: string;
  patientName: string;
  phone?: string;
  location: string;
  type: 'wheelchair' | 'escort' | 'interpreter' | 'reading_help' | 'general';
  language?: LanguageCode;
  status: 'pending' | 'accepted' | 'resolved';
  requestedAt: string;
  acceptedBy?: string;
  resolvedAt?: string;
}

export interface HospitalNode {
  id: string;
  name: string;
  localNames?: Partial<Record<LanguageCode, string>>;
  floor: number; // 0 = Ground, 1 = First, 2 = Second
  block: 'A' | 'B' | 'Central';
  x: number; // coordinates on floor plan (0 to 1000)
  y: number;
  type:
    | 'entrance'
    | 'counter'
    | 'opd_room'
    | 'ward'
    | 'lab'
    | 'pharmacy'
    | 'xray'
    | 'toilet'
    | 'water_point'
    | 'lift'
    | 'stairs'
    | 'emergency'
    | 'canteen'
    | 'help_desk'
    | 'corridor'
    | 'landmark';
  landmarkImage?: string;
  landmarkIcon?: string;
  accessible: boolean;
  departmentId?: string;
  roomNumber?: string;
}

export interface HospitalEdge {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  isStairs: boolean;
  isLift: boolean;
  isRamp: boolean;
  accessible: boolean;
  instructions: Partial<Record<LanguageCode, string>>;
}

export interface RouteStep {
  stepNumber: number;
  instruction: string;
  fromNodeId: string;
  toNodeId: string;
  fromNodeName: string;
  toNodeName: string;
  floor: number;
  block: string;
  distanceMeters: number;
  landmark?: {
    name: string;
    image?: string;
    icon?: string;
  };
  isStairs?: boolean;
  isLift?: boolean;
}

export interface NavigationRoute {
  fromNode: HospitalNode;
  toNode: HospitalNode;
  steps: RouteStep[];
  totalDistanceMeters: number;
  totalTimeMinutes: number;
  isAccessible: boolean;
  floorTransitions: { fromFloor: number; toFloor: number; via: 'lift' | 'stairs' | 'ramp' }[];
  pathNodeIds: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  role: UserRole;
  details: string;
  patientId?: string;
  ipAddress?: string;
}

export interface SimulatedMessage {
  id: string;
  patientId: string;
  recipientPhone: string;
  channel: 'SMS' | 'WhatsApp';
  title: string;
  content: string;
  sentAt: string;
  status: 'delivered' | 'sent';
}

export interface ABHAProfile {
  abhaNumber: string; // 14-digit: XX-XXXX-XXXX-XXXX
  abhaAddress: string; // e.g. name@abdm
  name: string;
  gender: Gender;
  dateOfBirth: string;
  mobile: string;
  address: string;
  stateName: string;
  districtName: string;
  pincode: string;
  photoUrl?: string;
}

export interface FHIRResource {
  resourceType: 'Patient' | 'Appointment' | 'Encounter';
  id: string;
  meta: {
    versionId: string;
    lastUpdated: string;
    profile: string[];
  };
  [key: string]: unknown;
}

export interface SlipOCRExtraction {
  patientName: string;
  opdNumber: string;
  departmentName: string;
  roomNumber: string;
  wardName: string;
  doctorName?: string;
  dateStr: string;
  tokenNumber?: string;
  confidence: {
    patientName: number;
    opdNumber: number;
    departmentName: number;
    roomNumber: number;
    dateStr: number;
  };
  matchedNodeId?: string;
}

export interface DashboardMetrics {
  totalPatientsToday: number;
  currentlyWaiting: number;
  avgWaitMinutes: number;
  longestWaitMinutes: number;
  inConsultation: number;
  completedToday: number;
  emergenciesActive: number;
  supportRequestsOpen: number;
  departmentLoad: {
    departmentId: string;
    departmentName: string;
    waitingCount: number;
    avgWaitMinutes: number;
    status: 'normal' | 'moderate' | 'overcrowded';
    doctorCount: number;
    activeDoctorCount: number;
    suggestedAction?: string;
  }[];
  hourlyTraffic: { hour: string; count: number }[];
  languageDistribution: { language: string; count: number; percentage: number }[];
  registrationMethodDistribution: { method: string; count: number; percentage: number }[];
}
