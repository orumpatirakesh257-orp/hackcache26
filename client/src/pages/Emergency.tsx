import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  PhoneCall,
  CheckCircle2,
  Navigation,
  ShieldAlert,
  ArrowRight,
  HeartCrack,
  Wind,
  Droplets,
  Activity,
  Ambulance,
  MapPin,
  Volume2,
} from 'lucide-react';
import { speakText, playEmergencyAlertSound } from '../utils/audio';

const EMERGENCY_SYMPTOM_OPTIONS = [
  { id: 'chest_pain', key: 'chestPain', icon: HeartCrack },
  { id: 'breathing', key: 'breathing', icon: Wind },
  { id: 'bleeding', key: 'bleeding', icon: Droplets },
  { id: 'unconscious', key: 'unconscious', icon: Activity },
  { id: 'seizure', key: 'seizure', icon: Activity },
  { id: 'accident', key: 'accident', icon: Ambulance },
  { id: 'pregnancy', key: 'pregnancy', icon: HeartCrack },
  { id: 'other', key: 'other', icon: AlertTriangle },
];

export const Emergency: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [patientLocation, setPatientLocation] = useState('Hospital Atrium / Main Lobby');
  const [patientName, setPatientName] = useState('');
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handleSendEmergencyAlert = async () => {
    setLoading(true);
    playEmergencyAlertSound();

    const symptomsToSend = selectedSymptoms.length > 0 ? selectedSymptoms : ['Severe distress / Critical Walk-in'];

    try {
      const res = await fetch('/api/emergency/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patientName || 'Emergency Walk-in',
          location: patientLocation,
          flaggedSymptoms: symptomsToSend,
        }),
      });

      const data = await res.json();
      setAlertSubmitted(true);

      const alertVoice = `${t('emergency.alertSent')} ${t('emergency.stayPut')}`;
      speakText(alertVoice, (i18n.language as any) || 'en');
    } catch (err) {
      console.error(err);
      setAlertSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Prominent Red Disclaimer */}
      <div className="p-4 rounded-3xl bg-red-600 text-white shadow-xl border-3 border-red-700 space-y-2">
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={28} className="shrink-0 stroke-[2.5]" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide">
            {t('emergency.title')}
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-red-100 font-bold leading-relaxed">
          {t('emergency.disclaimer')}
        </p>

        {/* Tap to Call 108 Emergency Ambulance Button */}
        <div className="pt-2">
          <a
            href="tel:108"
            className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-red-50 text-red-700 font-extrabold text-sm sm:text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <PhoneCall size={20} className="stroke-[2.5] animate-bounce" />
            <span>{t('emergency.call108')}</span>
          </a>
        </div>
      </div>

      {alertSubmitted ? (
        /* Alert Submitted State */
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-3 border-emerald-500 shadow-2xl text-center space-y-5 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>

          <div>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-black uppercase tracking-widest">
              PRIORITY: TOP OF EMERGENCY LIST
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              EMERGENCY ALERT BROADCASTED!
            </h3>
            <p className="text-sm font-bold text-slate-600 mt-1">
              Location: <strong>{patientLocation}</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-sm font-bold text-left space-y-1">
            <p className="text-base text-red-950 font-black">🏥 Next Action:</p>
            <p>1. Go directly to the Emergency & Trauma Block on the Ground Floor (left of Main Gate).</p>
            <p>2. If you CANNOT walk, please STAY WHERE YOU ARE. An emergency stretcher attendant is en route.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => navigate('/navigation?destination=Emergency')}
              className="py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <Navigation size={18} />
              <span>Route to Emergency Block</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition"
            >
              Return to Home
            </button>
          </div>
        </div>
      ) : (
        /* Emergency Questions Flow */
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-slate-200 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>🚨</span> {t('emergency.question')}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tap all that apply (bypasses normal OPD queue entirely):
              </p>
            </div>
            <button
              onClick={() => {
                const text = `${t('emergency.title')}. ${t('emergency.question')}`;
                speakText(text, (i18n.language as any) || 'en');
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              title="Read questions aloud"
            >
              <Volume2 size={18} />
            </button>
          </div>

          {/* Big Yes/No Symptom Touch Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EMERGENCY_SYMPTOM_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedSymptoms.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSymptom(opt.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-3 min-h-[58px] ${
                    isSelected
                      ? 'border-red-600 bg-red-50 text-red-950 ring-2 ring-red-400 font-bold'
                      : 'border-slate-200 bg-slate-50/70 hover:border-red-300 text-slate-800'
                  }`}
                >
                  <Icon size={22} className={isSelected ? 'text-red-600' : 'text-slate-400'} />
                  <span className="text-xs sm:text-sm font-bold flex-1 leading-snug">
                    {t(`emergency.${opt.key}` as any)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Location Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
              <MapPin size={14} className="text-teal-600" />
              <span>Where are you in the hospital right now?</span>
            </label>
            <select
              value={patientLocation}
              onChange={(e) => setPatientLocation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value="Main Entrance Lobby / Kiosk 1">Main Entrance Lobby / Kiosk 1</option>
              <option value="Waiting Hall near Water Point">Waiting Hall near Water Point</option>
              <option value="Outside OPD Rooms (Ground Floor)">Outside OPD Rooms (Ground Floor)</option>
              <option value="1st Floor Corridor / Orthopaedics">1st Floor Corridor / Orthopaedics</option>
              <option value="2nd Floor Corridor / Cardiology">2nd Floor Corridor / Cardiology</option>
              <option value="Pharmacy Counter Waiting Area">Pharmacy Counter Waiting Area</option>
            </select>
          </div>

          {/* Patient Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Patient Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Patel"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Large Immediate Emergency Send Button */}
          <button
            onClick={handleSendEmergencyAlert}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black text-base shadow-2xl flex items-center justify-center gap-2 border-2 border-red-500 animate-pulse transition"
          >
            <AlertTriangle size={22} className="stroke-[2.5]" />
            <span>{t('emergency.sendAlert')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
