import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  User,
  ClipboardList,
  Stethoscope,
  HeartPulse,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Building2,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '../../../shared/constants';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '../../../shared/types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/staff';
  const urlError = searchParams.get('error');

  const { staffLogin, setUser } = useAuthStore();

  // Filter staff accounts (excluding patient)
  const staffAccounts = DEMO_ACCOUNTS.filter((a) => a.role !== 'patient');
  const patientAccount = DEMO_ACCOUNTS.find((a) => a.role === 'patient');

  // Selected staff role state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(staffAccounts[0]?.id || 'demo-staff-1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === 'auth_required'
      ? 'Staff Authentication Required: Please sign in with password 1234 to access hospital operations.'
      : ''
  );
  const [successMsg, setSuccessMsg] = useState('');

  // Patient OTP Simulation state
  const [isPatientSectionOpen, setIsPatientSectionOpen] = useState(false);
  const [patientPhone, setPatientPhone] = useState('9876543210');
  const [patientOtp, setPatientOtp] = useState('123456');
  const [otpSent, setOtpSent] = useState(false);

  const selectedAccount = staffAccounts.find((a) => a.id === selectedAccountId) || staffAccounts[0];

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password) {
      setErrorMsg('Please enter the password to authenticate.');
      return;
    }

    setLoading(true);
    const result = await staffLogin(selectedAccountId, password);
    setLoading(false);

    if (result.success) {
      setSuccessMsg(`Welcome, ${selectedAccount.name}! Entering ${selectedAccount.label}...`);
      setTimeout(() => {
        navigate(redirectTarget);
      }, 400);
    } else {
      setErrorMsg(result.error || 'Access Denied: Invalid password.');
    }
  };

  const handlePatientContinue = () => {
    setUser({
      id: patientAccount?.id || 'guest-patient',
      name: patientAccount?.name || 'Patient (Guest)',
      role: 'patient',
      details: patientAccount?.details || 'Public Patient View',
    });
    navigate('/');
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'counter_staff':
        return ClipboardList;
      case 'doctor':
        return Stethoscope;
      case 'triage_nurse':
        return HeartPulse;
      case 'admin':
        return ShieldCheck;
      default:
        return User;
    }
  };

  const getRolePermissionsDescription = (role: UserRole) => {
    switch (role) {
      case 'counter_staff':
        return 'Authorized for: OPD Assisted Registration, Paper Slip Verification, Queue Flow Monitoring.';
      case 'doctor':
        return 'Authorized for: Assigned Doctor Room Queue, Patient Consultation Timer, Lab/Pharmacy Referrals.';
      case 'triage_nurse':
        return 'Authorized for: Emergency Triage Assessment Desk, Priority Escalations, Trauma Case Management.';
      case 'admin':
        return 'Authorized for: Full Hospital Operations, Doctor & Dept Management, Staff Roster, Crowd Analytics & System Logs.';
      default:
        return 'Public patient services.';
    }
  };

  return (
    <div className="py-8 px-4 max-w-2xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Hospital Portal Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-900 text-xs font-black uppercase tracking-wider mb-1">
          <ShieldCheck size={16} className="text-teal-700" />
          <span>Staff Operations Portal</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Hospital Staff Authentication & Role Switcher
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
          Secure, authenticated access for authorized hospital staff, clinicians, and administrators.
        </p>
      </div>

      {/* Demo Credentials Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs">
        <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm space-y-0.5">
          <p className="font-extrabold text-amber-900">
            Hackathon Demonstration Notice — Shared Staff Password:
          </p>
          <p className="font-semibold text-amber-800">
            For evaluator access across all demo staff roles, enter Password:{' '}
            <code className="px-2 py-0.5 rounded bg-amber-200/80 font-black text-amber-950 tracking-wider">
              1234
            </code>
          </p>
          <p className="text-[11px] text-amber-700 mt-1 italic">
            *In production, credentials are authenticated via ABDM / Hospital Active Directory with multi-factor authentication.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-fade-in"
        >
          <AlertCircle size={20} className="text-red-600 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-fade-in"
        >
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* STAFF AUTHENTICATION CARD */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border-2 border-teal-600 shadow-xl space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Lock size={18} className="text-teal-700" />
            <span>Select Staff Role & Authenticate</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Choose your staff role account below, then enter demo password <strong className="text-slate-800">1234</strong>.
          </p>
        </div>

        <form onSubmit={handleStaffLogin} className="space-y-4">
          {/* Step 1: Staff Role Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
              1. Choose Staff Role:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {staffAccounts.map((account) => {
                const Icon = getRoleIcon(account.role);
                const isSelected = selectedAccountId === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setErrorMsg('');
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 active:scale-98 ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50 ring-2 ring-teal-600 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/30'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSelected ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm text-slate-900 leading-snug truncate">
                        {account.label}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{account.details}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Highlight & Permissions Preview */}
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-950 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Active Staff Assignment:
              </span>
              <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-md bg-teal-200 text-teal-900">
                {selectedAccount.role.replace('_', ' ')}
              </span>
            </div>
            <p className="font-black text-sm text-slate-900">{selectedAccount.name}</p>
            <p className="text-xs text-slate-600 font-medium">{selectedAccount.details}</p>
            <p className="text-[11px] text-teal-800 font-semibold pt-1 border-t border-teal-200/60">
              {getRolePermissionsDescription(selectedAccount.role)}
            </p>
          </div>

          {/* Step 2: Password Input (Masked, Never Plaintext) */}
          <div>
            <label
              htmlFor="staff-password-input"
              className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between"
            >
              <span>2. Staff Password (Demo: 1234):</span>
              <span className="text-[11px] text-teal-700 font-bold lowercase">required</span>
            </label>
            <div className="relative">
              <input
                id="staff-password-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 py-3 rounded-2xl border-2 border-slate-300 focus:border-teal-600 focus:outline-none text-slate-900 font-mono text-base font-bold bg-white tracking-widest shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-98 text-white font-black text-sm sm:text-base shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 border border-teal-800"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <ShieldCheck size={20} />
                <span>Authenticate & Enter Staff Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* SEPARATE PUBLIC PATIENT PORTAL SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <User size={18} className="text-teal-700" />
              <span>Are You a Hospital Patient or Visitor?</span>
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Patients do not require staff credentials. Access public patient services directly.
            </p>
          </div>
          <button
            onClick={handlePatientContinue}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-teal-800 hover:text-teal-900 font-extrabold text-xs border border-slate-300 hover:border-teal-400 flex items-center gap-1.5 transition self-start sm:self-auto shrink-0"
          >
            <span>Patient Homepage</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Optional Patient Phone OTP Simulation */}
        <div>
          <button
            type="button"
            onClick={() => setIsPatientSectionOpen(!isPatientSectionOpen)}
            className="text-xs font-bold text-slate-600 hover:text-teal-800 flex items-center gap-1.5 py-1"
          >
            <Phone size={14} className="text-teal-600" />
            <span>{isPatientSectionOpen ? 'Hide Patient OTP Simulation' : 'Simulate Patient Phone OTP Sign-In (Optional)'}</span>
          </button>

          {isPatientSectionOpen && (
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
              <p className="text-xs text-slate-500">
                Demonstrates phone OTP authentication for patient portal access under ABDM guidelines.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => setOtpSent(true)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl"
                >
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>

              {otpSent && (
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 space-y-2">
                  <span className="text-[11px] font-bold text-teal-900 block">
                    Enter Demo OTP: <code className="font-mono bg-teal-200/80 px-1 rounded">123456</code>
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={patientOtp}
                      onChange={(e) => setPatientOtp(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-teal-300 font-mono font-bold text-center tracking-widest bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUser({
                          id: patientAccount?.id || 'demo-patient-1',
                          name: patientAccount?.name || 'Ramesh Patel',
                          role: 'patient',
                          phone: patientPhone,
                          details: 'Verified Patient (ABHA Profile)',
                        });
                        navigate('/track');
                      }}
                      className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl"
                    >
                      Verify & Open Slip
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
