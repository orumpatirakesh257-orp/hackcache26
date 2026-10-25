import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ClipboardList,
  Stethoscope,
  HeartPulse,
  Sliders,
  Tv,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  RefreshCw,
  Search,
  ArrowRight,
  Sparkles,
  AlertOctagon,
  Megaphone,
  Download,
  ShieldCheck,
  LogOut,
  Printer,
  FileCheck,
  UserCheck,
  Lock,
  MapPin,
  Check,
  X,
  PlusCircle,
  QrCode,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useQueueStore } from '../store/useQueueStore';
import {
  DashboardMetrics,
  QueueToken,
  EmergencyAlert,
  AssistanceRequest,
  Doctor,
  AuditLog,
  UserRole,
  PriorityLevel,
  Gender,
  DigitalSlip,
  Patient,
} from '../../../shared/types';
import { DEPARTMENTS_DATA, DOCTORS_DATA } from '../../../shared/constants';
import { playEmergencyAlertSound, playHospitalChime } from '../utils/audio';

type StaffTab =
  | 'overview'
  | 'counter'
  | 'doctor'
  | 'triage'
  | 'queue_controls'
  | 'departments'
  | 'staff_mgmt'
  | 'simulation'
  | 'reports';

interface TabDefinition {
  id: StaffTab;
  label: string;
  icon: any;
  roles: UserRole[];
  description: string;
}

const ALL_STAFF_TABS: TabDefinition[] = [
  {
    id: 'overview',
    label: 'Overview & Analytics',
    icon: LayoutDashboard,
    roles: ['admin'],
    description: 'Hospital crowd KPIs, wait times, and overcrowding analytics',
  },
  {
    id: 'counter',
    label: 'OPD Registration & Slips',
    icon: ClipboardList,
    roles: ['admin', 'counter_staff'],
    description: 'Staff-assisted registration & paper OPD slip verification',
  },
  {
    id: 'doctor',
    label: 'Doctor Room View',
    icon: Stethoscope,
    roles: ['admin', 'doctor'],
    description: 'Clinical consultation queue, timer, and referral controls',
  },
  {
    id: 'triage',
    label: 'Emergency Triage Desk',
    icon: HeartPulse,
    roles: ['admin', 'triage_nurse'],
    description: 'Live emergency monitoring, rapid triage priority & trauma response',
  },
  {
    id: 'queue_controls',
    label: 'Hospital Queue & Broadcast',
    icon: Sliders,
    roles: ['admin', 'counter_staff', 'doctor', 'triage_nurse'],
    description: 'Hospital-wide queue monitoring & public PA announcements',
  },
  {
    id: 'departments',
    label: 'Doctors & Departments',
    icon: Building2,
    roles: ['admin'],
    description: 'Doctor roster, status toggles, department capacities & layout',
  },
  {
    id: 'staff_mgmt',
    label: 'Staff Management',
    icon: Users,
    roles: ['admin'],
    description: 'Authorized hospital staff directory, shifts & operational roles',
  },
  {
    id: 'reports',
    label: 'System Logs & FHIR',
    icon: FileSpreadsheet,
    roles: ['admin'],
    description: 'Security audit logs, CSV exports, and ABDM FHIR R4 records',
  },
  {
    id: 'simulation',
    label: 'Simulation Panel',
    icon: Sparkles,
    roles: ['admin'],
    description: 'Demonstration controls for rush hour, emergencies, and resets',
  },
];

export const StaffDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { socket } = useQueueStore();

  // Role permissions check
  const permittedTabs = ALL_STAFF_TABS.filter((tab) => tab.roles.includes(user.role));

  const [activeTab, setActiveTab] = useState<StaffTab>(() => {
    if (user.role === 'doctor') return 'doctor';
    if (user.role === 'triage_nurse') return 'triage';
    if (user.role === 'counter_staff') return 'counter';
    return 'overview';
  });

  // Guard tab if role changed or forbidden tab selected
  useEffect(() => {
    const isAllowed = permittedTabs.some((t) => t.id === activeTab);
    if (!isAllowed && permittedTabs.length > 0) {
      setActiveTab(permittedTabs[0].id);
    }
  }, [user.role, permittedTabs, activeTab]);

  // Live Metrics & Lists
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [assistanceReqs, setAssistanceReqs] = useState<AssistanceRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [staffRoster, setStaffRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Doctor View Specific
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc-ortho-1');
  const [doctorQueue, setDoctorQueue] = useState<QueueToken[]>([]);
  const [consultTimer, setConsultTimer] = useState<number>(0);
  const [activeConsultToken, setActiveConsultToken] = useState<QueueToken | null>(null);

  // Broadcast & Controls
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Triage Notes
  const [assessPriority, setAssessPriority] = useState<'critical' | 'urgent' | 'non_urgent'>('urgent');
  const [nurseNotes, setNurseNotes] = useState('');
  const [downgradeReason, setDowngradeReason] = useState('');

  // Staff OPD Registration Form State
  const [staffRegName, setStaffRegName] = useState('');
  const [staffRegAge, setStaffRegAge] = useState('');
  const [staffRegGender, setStaffRegGender] = useState<Gender>('male');
  const [staffRegPhone, setStaffRegPhone] = useState('');
  const [staffRegDeptId, setStaffRegDeptId] = useState('dept-gen-med');
  const [staffRegPriority, setStaffRegPriority] = useState<PriorityLevel>('normal');
  const [staffRegNotes, setStaffRegNotes] = useState('');
  const [staffRegSuccess, setStaffRegSuccess] = useState<{
    token: QueueToken;
    slip: DigitalSlip;
    patient: Patient;
  } | null>(null);
  const [staffRegLoading, setStaffRegLoading] = useState(false);
  const [staffRegError, setStaffRegError] = useState('');

  // Paper Slip Verification State
  const [verifySearchId, setVerifySearchId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    slip: DigitalSlip;
    patient: Patient;
    token: QueueToken;
  } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Fetch metrics & lists
  const fetchAllData = async () => {
    try {
      const [metricsRes, emergRes, asstRes, docRes, deptRes, staffRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/emergency/list'),
        fetch('/api/assistance/list'),
        fetch('/api/admin/doctors'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/staff'),
      ]);
      const metricsData = await metricsRes.json();
      const emergData = await emergRes.json();
      const asstData = await asstRes.json();
      const docData = await docRes.json();
      const deptData = await deptRes.json();
      const staffData = await staffRes.json();

      setMetrics(metricsData);
      setEmergencies(emergData);
      setAssistanceReqs(asstData);
      if (Array.isArray(docData)) setAllDoctors(docData);
      else if (docData && Array.isArray(docData.doctors)) setAllDoctors(docData.doctors);

      if (Array.isArray(deptData)) setAllDepartments(deptData);
      else if (deptData && Array.isArray(deptData.departments)) setAllDepartments(deptData.departments);

      if (Array.isArray(staffData)) setStaffRoster(staffData);
      else if (staffData && Array.isArray(staffData.staff)) setStaffRoster(staffData.staff);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Doctor specific queue
  const fetchDoctorQueue = async (docId: string) => {
    try {
      const doc = DOCTORS_DATA.find((d) => d.id === docId);
      if (!doc) return;
      const res = await fetch(`/api/queue/department/${doc.departmentId}`);
      const data = await res.json();
      if (data.tokens) {
        setDoctorQueue(data.tokens);
        const inConsult = data.tokens.find((t: QueueToken) => t.status === 'in_consultation');
        setActiveConsultToken(inConsult || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchDoctorQueue(selectedDoctorId);

    const interval = setInterval(() => {
      fetchAllData();
      fetchDoctorQueue(selectedDoctorId);
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  // Consultation timer for active consultation
  useEffect(() => {
    let timer: any;
    if (activeConsultToken) {
      timer = setInterval(() => {
        setConsultTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setConsultTimer(0);
    }
    return () => clearInterval(timer);
  }, [activeConsultToken]);

  // Handle Staff Assisted Registration
  const handleStaffRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffRegError('');
    setStaffRegSuccess(null);

    if (!staffRegName || !staffRegAge || !staffRegPhone) {
      setStaffRegError('Please provide patient name, age, and phone number.');
      return;
    }

    setStaffRegLoading(true);
    try {
      const res = await fetch('/api/registration/staff-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffRegName,
          age: staffRegAge,
          gender: staffRegGender,
          phone: staffRegPhone,
          departmentId: staffRegDeptId,
          priorityOverride: staffRegPriority,
          clinicalNotes: staffRegNotes,
          staffName: user.name,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStaffRegSuccess(data);
        setStaffRegName('');
        setStaffRegAge('');
        setStaffRegPhone('');
        setStaffRegNotes('');
        fetchAllData();
      } else {
        setStaffRegError(data.error || 'Failed to complete registration.');
      }
    } catch (err: any) {
      setStaffRegError('Network error while processing registration.');
    } finally {
      setStaffRegLoading(false);
    }
  };

  // Handle Paper Slip Verification
  const handleVerifySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyResult(null);

    if (!verifySearchId.trim()) {
      setVerifyError('Please enter a Token number or OPD Number to verify.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetch('/api/registration/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: verifySearchId.trim(),
          staffName: user.name,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyResult(data);
        fetchAllData();
      } else {
        setVerifyError(data.error || 'Slip not found in database.');
      }
    } catch (err) {
      setVerifyError('Verification failed. Check token/OPD number and retry.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Doctor Action: Call Next
  const handleCallNext = async () => {
    setLoading(true);
    try {
      await fetch('/api/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: selectedDoctorId }),
      });
      fetchDoctorQueue(selectedDoctorId);
      fetchAllData();
      setConsultTimer(0);
      playHospitalChime();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Doctor Action: Mark Done & Refer
  const handleMarkDone = async (nextStep: 'lab' | 'pharmacy' | 'completed') => {
    if (!activeConsultToken) return;
    setLoading(true);
    try {
      await fetch('/api/queue/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: activeConsultToken.id, nextStep }),
      });
      fetchDoctorQueue(selectedDoctorId);
      fetchAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Doctor Delay Flag
  const handleMarkDelay = async (delayMinutes: number, reason: string) => {
    await fetch('/api/queue/delay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: selectedDoctorId, delayMinutes, reason }),
    });
    fetchDoctorQueue(selectedDoctorId);
    fetchAllData();
  };

  // Toggle Doctor Status (Admin)
  const handleToggleDoctorStatus = async (doctorId: string, status: string) => {
    await fetch('/api/admin/doctors/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, status }),
    });
    fetchAllData();
  };

  // Emergency Triage Assessment
  const handleAssessEmergency = async (id: string) => {
    await fetch('/api/emergency/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertId: id,
        assessedPriority: assessPriority,
        nurseNotes: nurseNotes || 'Assessed by Triage Nurse on duty',
      }),
    });
    fetchAllData();
    setNurseNotes('');
  };

  // Emergency Downgrade
  const handleDowngradeEmergency = async (id: string) => {
    if (!downgradeReason.trim()) {
      alert('Clinical reason is mandatory for downgrading an emergency flag.');
      return;
    }
    await fetch('/api/emergency/downgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id, clinicalReason: downgradeReason }),
    });
    fetchAllData();
    setDowngradeReason('');
  };

  // Resolve Emergency
  const handleResolveEmergency = async (id: string) => {
    await fetch('/api/emergency/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    });
    fetchAllData();
  };

  // Accept / Resolve Assistance Requests
  const handleAcceptAssistance = async (id: string) => {
    await fetch('/api/assistance/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, attendantName: user.name }),
    });
    fetchAllData();
  };

  const handleResolveAssistance = async (id: string) => {
    await fetch('/api/assistance/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id }),
    });
    fetchAllData();
  };

  // Send Broadcast Announcement
  const handleSendBroadcast = async () => {
    if (!broadcastMsg) return;
    await fetch('/api/queue/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: broadcastMsg }),
    });
    setBroadcastSent(true);
    setBroadcastMsg('');
    setTimeout(() => setBroadcastSent(false), 3500);
  };

  // Simulation Triggers (for Judges / 3-minute demo)
  const runSimulation = async (endpoint: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/simulate/${endpoint}`, { method: 'POST' });
      await res.json();
      fetchAllData();
      fetchDoctorQueue(selectedDoctorId);
      if (endpoint === 'trigger-emergency') {
        playEmergencyAlertSound();
      } else {
        playHospitalChime();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="py-6 px-3 sm:px-6 max-w-6xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Top Staff Navigation, Role Display & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border-2 border-teal-600 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-800 text-white rounded-2xl shadow-sm shrink-0">
            <Building2 size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                Hospital Command Center
              </h2>
              <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Authenticated Staff: <strong className="text-teal-950">{user.name}</strong> • {user.details || 'On Duty'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {/* Public TV Display Button */}
          <Link
            to="/display"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Tv size={15} />
            <span className="hidden sm:inline">TV Display</span>
          </Link>

          {/* Switch Role (Password Protected) */}
          <Link
            to="/login"
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition"
            title="Switch demo role (requires password 1234)"
          >
            Switch Role
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs border border-red-300 flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            title="Sign out of hospital staff portal"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Role-Enforced Staff Tab Switcher */}
      <div className="flex p-1.5 bg-slate-200/90 rounded-2xl gap-1 overflow-x-auto text-xs font-bold shadow-inner">
        {permittedTabs.map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-3.5 rounded-xl whitespace-nowrap transition flex items-center gap-2 shrink-0 ${
                isSel
                  ? 'bg-teal-800 text-white shadow-md ring-1 ring-teal-900 font-black'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
              title={tab.description}
            >
              <Icon size={16} className={isSel ? 'text-teal-200' : 'text-slate-500'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Permission Banner */}
      <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-600">
        <span>
          Current View: <strong className="text-slate-900">{ALL_STAFF_TABS.find((t) => t.id === activeTab)?.label}</strong>
        </span>
        <span className="font-semibold text-slate-500 hidden sm:inline">
          {ALL_STAFF_TABS.find((t) => t.id === activeTab)?.description}
        </span>
      </div>

      {/* ======================================================== */}
      {/* 1. OVERVIEW & ANALYTICS (ADMIN)                         */}
      {/* ======================================================== */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6 animate-fade-in">
          {/* Live KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Patients Today
              </span>
              <span className="text-3xl font-black text-slate-900 block mt-1">
                {metrics.totalPatientsToday}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Live registered</span>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Currently Waiting
              </span>
              <span className="text-3xl font-black text-teal-700 block mt-1">
                {metrics.currentlyWaiting}
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Active in queues</span>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Average Wait Time
              </span>
              <span className="text-3xl font-black text-slate-900 block mt-1">
                ~{metrics.avgWaitMinutes}m
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                Longest: ~{metrics.longestWaitMinutes}m
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Emergencies
              </span>
              <span className="text-3xl font-black text-red-600 block mt-1">
                {metrics.emergenciesActive}
              </span>
              <span className="text-[10px] text-red-600 font-bold mt-1 block">Triage priority</span>
            </div>
          </div>

          {/* Overcrowding Alerts Banner */}
          {metrics.departmentLoad.some((d) => d.status === 'overcrowded') && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm">
                <AlertTriangle size={18} className="text-amber-600" />
                <span>OVERCROWDING ALERTS DETECTED</span>
              </div>
              <ul className="text-xs font-semibold space-y-1 list-disc pl-5">
                {metrics.departmentLoad
                  .filter((d) => d.status === 'overcrowded')
                  .map((d) => (
                    <li key={d.departmentId}>
                      <strong>{d.departmentName}:</strong> {d.suggestedAction}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Department Load & Crowd Analytics */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              Department Crowd Load & Doctor Allocation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {metrics.departmentLoad.map((dept) => (
                <div
                  key={dept.departmentId}
                  className={`p-4 rounded-2xl border transition ${
                    dept.status === 'overcrowded'
                      ? 'border-red-400 bg-red-50/40'
                      : dept.status === 'moderate'
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">{dept.departmentName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        dept.status === 'overcrowded'
                          ? 'bg-red-600 text-white animate-pulse'
                          : dept.status === 'moderate'
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {dept.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Waiting: <strong>{dept.waitingCount} patients</strong></span>
                    <span>Wait: <strong>~{dept.avgWaitMinutes}m</strong></span>
                    <span>Doctors: <strong>{dept.activeDoctorCount} / {dept.doctorCount} active</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. OPD REGISTRATION & SLIP VERIFICATION (STAFF / ADMIN)   */}
      {/* ======================================================== */}
      {activeTab === 'counter' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section A: OPD Registration by Authorized Staff */}
          <div className="bg-white rounded-3xl border-2 border-teal-600 shadow-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-teal-100 text-teal-800 rounded-2xl">
                  <PlusCircle size={24} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    OPD Registration Management (Staff Counter)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Register walk-in patients on their behalf with priority overrides & immediate slip printing
                  </p>
                </div>
              </div>
              <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-teal-800 text-white">
                Authorized Counter Workflow
              </span>
            </div>

            {staffRegError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-bold">
                {staffRegError}
              </div>
            )}

            {staffRegSuccess && (
              <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-base text-emerald-900">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                    <span>Patient Registered Successfully!</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-mono font-black text-sm">
                    Token: {staffRegSuccess.token.tokenNumber}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Patient Name:</span>
                    <strong className="text-slate-900">{staffRegSuccess.patient.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">OPD Number:</span>
                    <strong className="text-slate-900">{staffRegSuccess.patient.opdNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Department:</span>
                    <strong className="text-slate-900">{staffRegSuccess.slip.departmentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Room Number:</span>
                    <strong className="text-slate-900">{staffRegSuccess.slip.roomNumber}</strong>
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <Printer size={15} />
                    <span>Print Thermal Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffRegSuccess(null)}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-xs"
                  >
                    Register Next Patient
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleStaffRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anand Kumar"
                    value={staffRegName}
                    onChange={(e) => setStaffRegName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Age *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    placeholder="e.g. 45"
                    value={staffRegAge}
                    onChange={(e) => setStaffRegAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Gender *</label>
                  <select
                    value={staffRegGender}
                    onChange={(e) => setStaffRegGender(e.target.value as Gender)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    value={staffRegPhone}
                    onChange={(e) => setStaffRegPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Department *</label>
                  <select
                    value={staffRegDeptId}
                    onChange={(e) => setStaffRegDeptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white"
                  >
                    {DEPARTMENTS_DATA.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code}) - Floor {d.floor}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Staff Priority Override</label>
                  <select
                    value={staffRegPriority}
                    onChange={(e) => setStaffRegPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white"
                  >
                    <option value="normal">Normal Walk-In</option>
                    <option value="senior">Senior Citizen (60+)</option>
                    <option value="pregnant">Maternity / Pregnant</option>
                    <option value="disabled">Physical Disability / Wheelchair</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Clinical Complaints / Staff Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Knee joint swelling and pain walking"
                  value={staffRegNotes}
                  onChange={(e) => setStaffRegNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={staffRegLoading}
                className="px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition"
              >
                <PlusCircle size={18} />
                <span>Issue & Register Patient OPD Slip</span>
              </button>
            </form>
          </div>

          {/* Section B: Verification of Paper OPD Slips */}
          <div className="bg-white rounded-3xl border-2 border-indigo-400 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-indigo-100 text-indigo-800 rounded-2xl">
                  <FileCheck size={24} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    Verification of Paper OPD Slips
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify physical slips, check QR validity, and confirm patient check-in
                  </p>
                </div>
              </div>
              <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900">
                Staff Verification Tool
              </span>
            </div>

            <form onSubmit={handleVerifySlip} className="flex gap-2.5">
              <input
                type="text"
                placeholder="Enter Token # (e.g. GM-101) or OPD # (e.g. OPD-2026-1001)..."
                value={verifySearchId}
                onChange={(e) => setVerifySearchId(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 font-mono font-bold text-sm text-slate-900"
              />
              <button
                type="submit"
                disabled={verifyLoading}
                className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
              >
                <Search size={16} />
                <span>Verify Slip</span>
              </button>
            </form>

            {verifyError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-bold">
                {verifyError}
              </div>
            )}

            {verifyResult && (
              <div className="p-5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-300 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={22} className="text-indigo-700" />
                    <span className="font-black text-base text-indigo-950">
                      Paper Slip Verified & Validated
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-black uppercase">
                    STATUS: VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-xl border border-indigo-200">
                  <div>
                    <span className="text-slate-400 block font-semibold">PATIENT</span>
                    <strong className="text-slate-900 text-sm">{verifyResult.patient.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">TOKEN NUMBER</span>
                    <strong className="text-indigo-900 text-sm font-mono">{verifyResult.token.tokenNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">DEPARTMENT</span>
                    <strong className="text-slate-900 text-sm">{verifyResult.slip.departmentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ROOM & FLOOR</span>
                    <strong className="text-slate-900 text-sm">Room {verifyResult.slip.roomNumber} (Floor {verifyResult.slip.floor})</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Verified By: <strong className="text-slate-700">{user.name}</strong></span>
                  <span className="font-mono text-[11px]">Security Signature: {verifyResult.slip.signedQrPayload?.slice(0, 32)}...</span>
                </div>
              </div>
            )}
          </div>

          {/* Section C: Assisted Help Requests */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <span>🛎️</span> Patient Assistance Requests from Kiosks & Waiting Halls
                </h3>
                <p className="text-xs text-slate-500">Live wheelchair, human escort, and interpreter requests</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-900 font-bold text-xs">
                {assistanceReqs.filter((r) => r.status === 'pending').length} Open
              </span>
            </div>

            <div className="space-y-2.5">
              {assistanceReqs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No open assistance requests</p>
              ) : (
                assistanceReqs.map((req) => (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      req.status === 'pending'
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{req.patientName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold uppercase">
                          {req.type}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(req.requestedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        📍 Location: <strong>{req.location}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <button
                          onClick={() => handleAcceptAssistance(req.id)}
                          className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition"
                        >
                          Dispatch Staff
                        </button>
                      ) : req.status === 'accepted' ? (
                        <button
                          onClick={() => handleResolveAssistance(req.id)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition"
                        >
                          Mark Completed
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700">Resolved</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DOCTOR ROOM VIEW & CLINICAL WORKFLOW (DOCTOR / ADMIN)  */}
      {/* ======================================================== */}
      {activeTab === 'doctor' && (
        <div className="space-y-6 animate-fade-in">
          {/* Doctor Switcher Dropdown */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Assigned Clinical Consultation Room:
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-sm bg-white text-slate-900"
              >
                {DOCTORS_DATA.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} • {d.roomNumber} ({d.departmentId.replace('dept-', '').toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Delay & Break Flags */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkDelay(15, 'Attending trauma case')}
                className="px-3.5 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-xs border border-orange-300 transition"
              >
                Flag 15m Delay
              </button>
              <button
                onClick={() => handleMarkDelay(0, 'Back from delay')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200"
              >
                Clear Delay
              </button>
            </div>
          </div>

          {/* Active Consultation Live Box */}
          <div className="bg-white p-6 rounded-3xl border-2 border-teal-500 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-black text-slate-900 text-lg">
                  Active Consultation in Progress
                </h3>
              </div>

              {activeConsultToken && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-teal-50 border border-teal-300 text-teal-900 font-mono text-sm font-bold">
                  <Clock size={16} />
                  <span>
                    {Math.floor(consultTimer / 60)}:{(consultTimer % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            {activeConsultToken ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase block">Token Number</span>
                    <span className="text-3xl font-black text-teal-800">{activeConsultToken.tokenNumber}</span>
                    <span className="text-xs text-slate-500 ml-3">OPD: {activeConsultToken.opdNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold uppercase">
                      Priority: {activeConsultToken.priority}
                    </span>
                  </div>
                </div>

                {/* Actions: Mark Done / Refer */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => handleMarkDone('completed')}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition"
                  >
                    Complete & Discharge
                  </button>
                  <button
                    onClick={() => handleMarkDone('lab')}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition"
                  >
                    Refer to Blood/Pathology Lab
                  </button>
                  <button
                    onClick={() => handleMarkDone('pharmacy')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition"
                  >
                    Refer to Pharmacy
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <p className="text-sm font-semibold">No patient currently in consultation room.</p>
                <button
                  onClick={handleCallNext}
                  disabled={loading || doctorQueue.length === 0}
                  className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-md transition"
                >
                  Call Next Patient into Room
                </button>
              </div>
            )}
          </div>

          {/* Room Queue Waiting List */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-extrabold text-slate-900 text-sm">
                Waiting List for This Doctor ({doctorQueue.length} Patients)
              </h4>
              <button
                onClick={handleCallNext}
                disabled={loading}
                className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-bold text-xs transition"
              >
                Call Next
              </button>
            </div>

            <div className="space-y-2">
              {doctorQueue.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No patients in queue</p>
              ) : (
                doctorQueue.map((tok, idx) => (
                  <div
                    key={tok.id}
                    className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 font-bold flex items-center justify-center text-slate-700">
                        {tok.queuePosition || idx + 1}
                      </span>
                      <strong className="text-slate-900 font-mono text-sm">{tok.tokenNumber}</strong>
                      <span className="text-slate-500">OPD: {tok.opdNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">~{tok.estimatedWaitMinutes}m wait</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold uppercase text-[10px]">
                        {tok.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. EMERGENCY TRIAGE MONITORING (NURSE / ADMIN)           */}
      {/* ======================================================== */}
      {activeTab === 'triage' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border-2 border-red-500 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-red-100 text-red-700 rounded-2xl">
                  <HeartPulse size={26} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    Emergency Triage Monitoring Console
                  </h3>
                  <p className="text-xs text-slate-500">
                    All flagged life-threatening emergencies bypass normal queues directly to this console
                  </p>
                </div>
              </div>
              <button
                onClick={playEmergencyAlertSound}
                className="px-3.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs transition"
              >
                Test Siren Sound
              </button>
            </div>

            <div className="space-y-4">
              {emergencies.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  No active emergencies flagged. Emergency triage all clear.
                </div>
              ) : (
                emergencies.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-5 rounded-3xl border-2 space-y-3 ${
                      alert.priority === 'critical'
                        ? 'border-red-500 bg-red-50/60 ring-2 ring-red-400'
                        : 'border-amber-400 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              alert.priority === 'critical'
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            PRIORITY: {alert.priority}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 mt-1">
                          {alert.patientName}
                        </h4>
                        <p className="text-xs font-bold text-red-900">
                          📍 Hospital Location: <strong>{alert.location}</strong>
                        </p>
                      </div>

                      <div className="text-xs">
                        <span className="font-bold text-slate-600">Flagged Symptoms:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.flaggedSymptoms.map((sym, sidx) => (
                            <span
                              key={sidx}
                              className="px-2 py-0.5 rounded-md bg-white border border-red-200 text-red-800 font-semibold"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {alert.status === 'flagged' && (
                      <div className="p-3 bg-white rounded-2xl border border-red-200 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">Clinical Assessment:</span>
                          <select
                            value={assessPriority}
                            onChange={(e) => setAssessPriority(e.target.value as any)}
                            className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                          >
                            <option value="critical">Critical (Immediate Resuscitation)</option>
                            <option value="urgent">Urgent (Trauma Bay Care)</option>
                            <option value="non_urgent">Non-Urgent (Stabilized)</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Add nurse triage assessment notes..."
                            value={nurseNotes}
                            onChange={(e) => setNurseNotes(e.target.value)}
                            className="flex-1 px-3 py-1 rounded-lg border border-slate-300 text-xs"
                          />
                          <button
                            onClick={() => handleAssessEmergency(alert.id)}
                            className="px-4 py-1.5 bg-teal-800 text-white rounded-lg font-bold text-xs"
                          >
                            Confirm Triage Assessment
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleResolveEmergency(alert.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
                      >
                        Resolve Emergency Case
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. QUEUE MONITORING & BROADCAST (ALL STAFF)              */}
      {/* ======================================================== */}
      {activeTab === 'queue_controls' && (
        <div className="space-y-6 animate-fade-in">
          {/* Public Broadcast Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Megaphone size={20} className="text-teal-700" />
              <span>Broadcast Public Announcement to Patient Displays & Waiting Halls</span>
            </h3>

            <div className="space-y-3">
              <textarea
                rows={2}
                placeholder="e.g. OPD Registration Counter 2 is now open. Orthopaedics room 12 delayed by 10 mins."
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-semibold"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendBroadcast}
                  className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-bold text-xs shadow-md transition"
                >
                  Send Broadcast Announcement
                </button>
                {broadcastSent && (
                  <span className="text-xs font-bold text-emerald-700">
                    ✓ Broadcast sent across patient screens and public TVs!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hospital-Wide Queue Overview */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              Hospital Department Queue Status Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {DEPARTMENTS_DATA.map((dept) => {
                const deptMetrics = metrics?.departmentLoad.find((d) => d.departmentId === dept.id);
                return (
                  <div key={dept.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">{dept.name}</span>
                      <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                        Floor {dept.floor}
                      </span>
                    </div>
                    <div className="mt-2 text-xs space-y-0.5 text-slate-600">
                      <p>Waiting: <strong>{deptMetrics?.waitingCount || 0} patients</strong></p>
                      <p>Est. Wait: <strong>~{deptMetrics?.avgWaitMinutes || 10} mins</strong></p>
                      <p>Rooms: <strong>{dept.roomRange}</strong></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. DOCTORS & DEPARTMENTS MANAGEMENT (ADMIN)              */}
      {/* ======================================================== */}
      {activeTab === 'departments' && (
        <div className="space-y-6 animate-fade-in">
          {/* Doctor Management Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Stethoscope size={20} className="text-teal-700" />
                  <span>Doctor Roster & Room Status Management</span>
                </h3>
                <p className="text-xs text-slate-500">Toggle active doctor availability, break status, and room allocations</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(allDoctors.length > 0 ? allDoctors : DOCTORS_DATA).map((doc: any) => (
                <div key={doc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{doc.name}</h4>
                      <p className="text-xs text-slate-500">
                        {doc.departmentName || doc.departmentId} • Room {doc.roomNumber} (Floor {doc.floor})
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        doc.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'on_break'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {doc.status || 'available'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-500">Waiting: <strong>{doc.waitingCount || 0}</strong></span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleDoctorStatus(doc.id, 'available')}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                      >
                        On Duty
                      </button>
                      <button
                        onClick={() => handleToggleDoctorStatus(doc.id, 'on_break')}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                      >
                        Break
                      </button>
                      <button
                        onClick={() => handleToggleDoctorStatus(doc.id, 'off_duty')}
                        className="px-2.5 py-1 rounded bg-slate-400 hover:bg-slate-500 text-white font-bold text-[11px]"
                      >
                        Off Duty
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Directory & Hospital Layout Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 size={20} className="text-teal-700" />
                  <span>Hospital Layout & Department Management</span>
                </h3>
                <p className="text-xs text-slate-500">Floors, room blocks, and capacity thresholds</p>
              </div>
            </div>

            <div className="space-y-3">
              {[0, 1, 2].map((floorNum) => (
                <div key={floorNum} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-teal-900">
                      Floor {floorNum} {floorNum === 0 ? '(Ground Floor - Main Atrium)' : floorNum === 1 ? '(First Floor)' : '(Second Floor)'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {DEPARTMENTS_DATA.filter((d) => d.floor === floorNum).length} Departments
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {DEPARTMENTS_DATA.filter((d) => d.floor === floorNum).map((d) => (
                      <div key={d.id} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                        <p className="font-bold text-slate-900">{d.name} ({d.code})</p>
                        <p className="text-[11px] text-slate-500">Rooms: {d.roomRange} • Block {d.block}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. STAFF MANAGEMENT (ADMIN)                              */}
      {/* ======================================================== */}
      {activeTab === 'staff_mgmt' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-teal-700" />
                <span>Hospital Operational Staff Roster</span>
              </h3>
              <p className="text-xs text-slate-500">Manage hospital staff accounts, roles, and assigned stations</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-900 text-xs font-bold">
              {staffRoster.length} Active Personnel
            </span>
          </div>

          <div className="space-y-3">
            {staffRoster.map((staff: any) => (
              <div
                key={staff.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{staff.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 font-extrabold text-[10px] uppercase">
                      {staff.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600 font-semibold mt-0.5">
                    Assigned: <strong>{staff.assignedLocation}</strong> • Shift: {staff.shift}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-semibold">
                    Actions Today: <strong className="text-slate-900">{staff.actionsToday}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                    On Duty
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. SYSTEM LOGS & FHIR AUDIT TRAIL (ADMIN)                */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-5 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Hospital System Activity & Audit Trail</h3>
              <p className="text-xs text-slate-500">Security audit logs, clinical overrides, and ABDM FHIR compliant store</p>
            </div>
            <a
              href="/api/reports/csv"
              download
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="/api/reports/fhir?type=Patient"
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-500 block text-left transition"
            >
              <span className="font-bold text-xs uppercase text-teal-800 block">FHIR Patients</span>
              <span className="text-xs text-slate-500 mt-1 block">Inspect FHIR R4 Patient JSON bundle</span>
            </a>

            <a
              href="/api/reports/fhir?type=Appointment"
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-500 block text-left transition"
            >
              <span className="font-bold text-xs uppercase text-teal-800 block">FHIR Appointments</span>
              <span className="text-xs text-slate-500 mt-1 block">Inspect FHIR R4 Appointment JSON</span>
            </a>

            <a
              href="/api/reports/audit"
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-500 block text-left transition"
            >
              <span className="font-bold text-xs uppercase text-teal-800 block">Security Audit Trail</span>
              <span className="text-xs text-slate-500 mt-1 block">Full audit log of role logins, overrides & verifications</span>
            </a>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. SIMULATION SANDBOX (ADMIN / DEMO EVALUATORS)          */}
      {/* ======================================================== */}
      {activeTab === 'simulation' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-teal-500 shadow-xl space-y-6 animate-fade-in">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              <Sparkles size={18} className="text-teal-600" />
              <span>Hackathon Demonstrations Sandbox (Demo Mode)</span>
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              Real-Time Simulation Sandbox
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trigger instant real-time events to witness live queue recalculations, alerts, and TV display updates
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => runSimulation('add-patients')}
              disabled={loading}
              className="p-5 rounded-2xl border-2 border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-teal-50 text-left transition space-y-1 active:scale-98"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-base">Add 10 Random Patients</span>
                <Users size={22} className="text-teal-700" />
              </div>
              <p className="text-xs text-slate-500">
                Spawns 10 realistic Indian patients across departments with varied languages and ages.
              </p>
            </button>

            <button
              onClick={() => runSimulation('rush-hour')}
              disabled={loading}
              className="p-5 rounded-2xl border-2 border-amber-300 hover:border-amber-500 bg-amber-50 text-left transition space-y-1 active:scale-98"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-950 text-base">Simulate Rush Hour Spike</span>
                <Clock size={22} className="text-amber-700" />
              </div>
              <p className="text-xs text-amber-800">
                Simulates 15 patients flood in Orthopaedics, triggering overcrowding alerts & suggested actions.
              </p>
            </button>

            <button
              onClick={() => runSimulation('trigger-emergency')}
              disabled={loading}
              className="p-5 rounded-2xl border-2 border-red-300 hover:border-red-500 bg-red-50 text-left transition space-y-1 active:scale-98"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-red-950 text-base">Trigger Emergency Alert</span>
                <AlertOctagon size={22} className="text-red-700 animate-pulse" />
              </div>
              <p className="text-xs text-red-800">
                Fires high-priority chest pain alert to triage desk with audio siren and top-of-queue placement.
              </p>
            </button>

            <button
              onClick={() => runSimulation('doctor-break')}
              disabled={loading}
              className="p-5 rounded-2xl border-2 border-purple-200 hover:border-purple-400 bg-purple-50 text-left transition space-y-1 active:scale-98"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-purple-950 text-base">Doctor Goes on Break</span>
                <Stethoscope size={22} className="text-purple-700" />
              </div>
              <p className="text-xs text-purple-800">
                Puts Dr. Priya on 15m break; watch queue wait times dynamically adjust with explanation.
              </p>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Need a fresh start?</span>
            <button
              onClick={() => runSimulation('reset')}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition"
            >
              Reset Demo Data (Clean 150 Seed)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
