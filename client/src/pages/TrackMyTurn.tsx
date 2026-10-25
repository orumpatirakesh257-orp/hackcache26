import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Users,
  Navigation,
  RefreshCw,
  AlertCircle,
  Pause,
  Play,
  CheckCircle2,
  Stethoscope,
  FlaskConical,
  Pill,
  Sparkles,
  Volume2,
  Calendar,
  Building2,
  Hourglass,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { QueueToken, DigitalSlip, Patient, Doctor, Department, LanguageCode } from '../../../shared/types';
import { speakText } from '../utils/audio';

export const TrackMyTurn: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { activeToken, activeSlip, setActiveToken } = useQueueStore();

  const [tokenData, setTokenData] = useState<{
    token: QueueToken;
    patient?: Patient;
    department?: Department;
    doctor?: Doctor;
    slip?: DigitalSlip;
    nowServingToken: string;
    peopleAhead: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [stepAwayCountdown, setStepAwayCountdown] = useState<number | null>(null);

  // Fetch token details
  const fetchTokenDetails = async (tokenNumber: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/queue/token/${encodeURIComponent(tokenNumber)}`);
      const data = await res.json();
      if (data.token) {
        setTokenData(data);
        setActiveToken(data.token);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const targetToken = activeToken?.tokenNumber || 'A-012';
    fetchTokenDetails(targetToken);

    // Polling fallback every 6 seconds if socket reconnecting
    const interval = setInterval(() => {
      if (targetToken) fetchTokenDetails(targetToken);
    }, 6000);

    return () => clearInterval(interval);
  }, [activeToken?.tokenNumber]);

  // Grace timer countdown for step away
  useEffect(() => {
    if (tokenData?.token.status === 'stepped_away' && tokenData.token.graceExpiresAt) {
      const timer = setInterval(() => {
        const remainingMs = new Date(tokenData.token.graceExpiresAt!).getTime() - Date.now();
        const seconds = Math.max(0, Math.floor(remainingMs / 1000));
        setStepAwayCountdown(seconds);
        if (seconds <= 0) {
          clearInterval(timer);
        }
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setStepAwayCountdown(null);
    }
  }, [tokenData?.token.status, tokenData?.token.graceExpiresAt]);

  const handleStepAway = async () => {
    if (!tokenData) return;
    try {
      const res = await fetch('/api/queue/step-away', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: tokenData.token.id }),
      });
      const data = await res.json();
      if (data.token) {
        fetchTokenDetails(data.token.tokenNumber);
        speakText('You have paused your turn for 10 minutes. Click I am back when you return.', (i18n.language as LanguageCode) || 'en');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    if (!tokenData) return;
    try {
      const res = await fetch('/api/queue/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: tokenData.token.id }),
      });
      const data = await res.json();
      if (data.token) {
        fetchTokenDetails(data.token.tokenNumber);
        speakText('Welcome back! Your position in the queue is resumed.', (i18n.language as LanguageCode) || 'en');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReadStatus = () => {
    if (!tokenData) return;
    const speech = `Your token number is ${tokenData.token.tokenNumber}. Now serving: ${tokenData.nowServingToken}. People ahead of you: ${tokenData.peopleAhead}. Estimated wait is about ${tokenData.token.estimatedWaitMinutes} minutes. ${tokenData.token.waitReason}`;
    speakText(speech, (i18n.language as LanguageCode) || 'en');
  };

  if (!tokenData) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <Clock size={40} className="mx-auto text-teal-600 animate-spin" />
        <h3 className="text-xl font-bold text-slate-800">Looking up queue status...</h3>
        <p className="text-xs text-slate-500">Checking live hospital queue data</p>
      </div>
    );
  }

  const { token, department, doctor, slip, nowServingToken, peopleAhead } = tokenData;

  const isSteppedAway = token.status === 'stepped_away';
  const isInConsultation = token.status === 'in_consultation';
  const isAlmostTurn = token.status === 'almost_turn' || peopleAhead <= 1;

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Header with Refresh & Audio Listen */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>⏱️</span> {t('queue.title')}
          </h2>
          <p className="text-xs text-slate-500 font-medium">Real-time live queue synchronization</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReadStatus}
            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition"
            title="Read queue status aloud"
          >
            <Volume2 size={16} />
            <span className="hidden sm:inline">Listen</span>
          </button>
          <button
            onClick={() => fetchTokenDetails(token.tokenNumber)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
            title="Refresh Queue"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('queue.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Main Big Token Card */}
      <div
        className={`rounded-3xl border-3 p-6 sm:p-8 shadow-xl text-center space-y-5 transition-all ${
          isInConsultation
            ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-200'
            : isAlmostTurn
            ? 'bg-amber-50 border-amber-500 ring-4 ring-amber-200'
            : isSteppedAway
            ? 'bg-purple-50 border-purple-400'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Status Badge */}
        <div className="inline-block">
          <span
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
              isInConsultation
                ? 'bg-emerald-600 text-white animate-pulse'
                : isAlmostTurn
                ? 'bg-amber-500 text-slate-950 animate-bounce'
                : isSteppedAway
                ? 'bg-purple-600 text-white'
                : 'bg-teal-100 text-teal-900'
            }`}
          >
            {isInConsultation
              ? 'Now In Consultation!'
              : isAlmostTurn
              ? 'ALMOST YOUR TURN • BE READY'
              : isSteppedAway
              ? 'Stepped Away (10m Grace)'
              : 'Waiting in Queue'}
          </span>
        </div>

        {/* Large Token Number */}
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block">
            Your Token Number
          </span>
          <span className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight block mt-1">
            {token.tokenNumber}
          </span>
          <span className="text-xs text-slate-500 font-semibold block mt-1">
            Patient: <strong className="text-slate-800">{slip?.patientName || 'Registered Patient'}</strong> • OPD: {token.opdNumber}
          </span>
        </div>

        {/* Metrics Grid: Now Serving vs People Ahead */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('queue.nowServing')}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-teal-700 block mt-1">
              {nowServingToken || 'None'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('queue.peopleAhead')}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
              {peopleAhead}
            </span>
          </div>
        </div>

        {/* Estimated Wait Time & Explanation */}
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              <Hourglass size={16} />
              <span>Estimated Wait Time</span>
            </span>
            <span className="text-lg font-black text-teal-900">
              ~{token.estimatedWaitMinutes} {t('queue.minutes')}
            </span>
          </div>

          {/* Dynamic Progress Bar */}
          <div className="w-full h-2.5 bg-teal-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all duration-500"
              style={{
                width: `${Math.max(10, Math.min(100, 100 - (peopleAhead / 8) * 100))}%`,
              }}
            />
          </div>

          <p className="text-xs text-teal-900 font-medium text-left leading-relaxed pt-1">
            ℹ️ {token.waitReason}
          </p>
        </div>

        {/* Stepped Away Countdown Timer (if active) */}
        {isSteppedAway && stepAwayCountdown !== null && (
          <div className="p-4 rounded-2xl bg-purple-100 border-2 border-purple-400 text-purple-950 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider block">
              Grace Period Countdown
            </span>
            <span className="text-3xl font-black font-mono block">
              {Math.floor(stepAwayCountdown / 60)}m {stepAwayCountdown % 60}s
            </span>
            <p className="text-xs text-purple-800 font-medium">
              Return before the countdown ends to keep your original position in queue.
            </p>
          </div>
        )}

        {/* Step Away / Resume Buttons */}
        <div className="flex gap-3 pt-2">
          {isSteppedAway ? (
            <button
              onClick={handleResume}
              className="flex-1 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition"
            >
              <Play size={18} />
              <span>{t('queue.imBack')}</span>
            </button>
          ) : (
            <button
              onClick={handleStepAway}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center justify-center gap-2 transition"
            >
              <Pause size={17} className="text-slate-600" />
              <span>{t('queue.stepAway')}</span>
            </button>
          )}

          <button
            onClick={() =>
              navigate(`/navigation?destination=${encodeURIComponent(doctor?.roomNumber || 'Room 12')}`)
            }
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition"
          >
            <Navigation size={18} />
            <span>Navigate to Room</span>
          </button>
        </div>
      </div>

      {/* Doctor & Clinic Availability Status Card */}
      {doctor && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-100 text-teal-800 rounded-2xl">
                <Stethoscope size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">{doctor.name}</h4>
                <p className="text-xs text-slate-500">
                  {department?.name} • {doctor.roomNumber} (Floor {doctor.floor})
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                doctor.status === 'available'
                  ? 'bg-emerald-100 text-emerald-800'
                  : doctor.status === 'on_break'
                  ? 'bg-amber-100 text-amber-800'
                  : doctor.status === 'delayed'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {doctor.status === 'available'
                ? t('queue.available')
                : doctor.status === 'on_break'
                ? t('queue.onBreak')
                : doctor.status === 'delayed'
                ? t('queue.delayed')
                : 'Busy with patient'}
            </span>
          </div>

          {doctor.status === 'delayed' && doctor.delayReason && (
            <div className="p-3 bg-orange-50 rounded-xl text-xs text-orange-900 font-semibold border border-orange-200">
              Notice: {doctor.delayReason}
            </div>
          )}
        </div>
      )}

      {/* Multi-Step Journey Tracker: Registration > Doctor > Lab > Pharmacy */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
          {t('queue.journey')}
        </h4>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { step: 'registration', label: '1. Registration', icon: CheckCircle2, done: true },
            { step: 'doctor', label: '2. Doctor OPD', icon: Stethoscope, active: true },
            { step: 'lab', label: '3. Diagnostic Lab', icon: FlaskConical, upcoming: true },
            { step: 'pharmacy', label: '4. Pharmacy', icon: Pill, upcoming: true },
          ].map((j) => (
            <div
              key={j.step}
              className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 ${
                j.done
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : j.active
                  ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-400 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <j.icon size={20} />
              <span className="font-bold text-[11px] leading-tight">{j.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
