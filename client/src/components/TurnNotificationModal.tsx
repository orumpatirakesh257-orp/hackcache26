import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Navigation, CheckCircle2, X } from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { speakText } from '../utils/audio';

export const TurnNotificationModal: React.FC = () => {
  const navigate = useNavigate();
  const { calledNotification, dismissNotification } = useQueueStore();
  const { currentLanguage } = useLanguageStore();

  useEffect(() => {
    if (calledNotification) {
      const announcement = `Attention please! Token number ${calledNotification.tokenNumber}, ${calledNotification.patientName}, please proceed to ${calledNotification.roomNumber}. Doctor ${calledNotification.doctorName} is waiting for you.`;
      speakText(announcement, currentLanguage);
    }
  }, [calledNotification, currentLanguage]);

  if (!calledNotification) return null;

  const handleNavigate = () => {
    dismissNotification();
    navigate(`/navigation?destination=${encodeURIComponent(calledNotification.roomNumber)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-bounce-in" role="alertdialog">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-amber-500 text-center relative overflow-hidden">
        {/* Top flashing bar */}
        <div className="absolute top-0 inset-x-0 h-3 bg-linear-to-r from-amber-400 via-orange-500 to-amber-400 animate-pulse" />

        <button
          onClick={dismissNotification}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <BellRing size={40} className="stroke-[2.5]" />
        </div>

        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-extrabold rounded-full text-xs uppercase tracking-widest">
          IT IS YOUR TURN!
        </span>

        <div className="my-4">
          <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            {calledNotification.tokenNumber}
          </span>
          <h3 className="text-lg font-bold text-slate-800 mt-1">
            {calledNotification.patientName}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 font-medium text-sm space-y-1 mb-6">
          <p className="font-bold text-base text-teal-950">
            Please proceed to: {calledNotification.roomNumber}
          </p>
          <p className="text-xs text-teal-700">
            Doctor: {calledNotification.doctorName}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleNavigate}
            className="flex-1 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
          >
            <Navigation size={18} />
            <span>Show Room Map</span>
          </button>
          <button
            onClick={dismissNotification}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 transition"
          >
            <CheckCircle2 size={18} />
            <span>I'm on my way</span>
          </button>
        </div>
      </div>
    </div>
  );
};
