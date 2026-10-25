import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Accessibility, UserCheck, Languages, BookOpen, MapPin, CheckCircle } from 'lucide-react';
import { LanguageCode } from '../../../shared/types';
import { useLanguageStore } from '../store/useLanguageStore';

interface AssistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssistanceModal: React.FC<AssistanceModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguageStore();
  const [selectedType, setSelectedType] = useState<'wheelchair' | 'escort' | 'interpreter' | 'reading_help'>('wheelchair');
  const [patientName, setPatientName] = useState('');
  const [location, setLocation] = useState('Kiosk 1 (Main Entrance)');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/assistance/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patientName || 'Patient',
          location,
          type: selectedType,
          language: currentLanguage,
        }),
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-teal-500">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <Accessibility size={24} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t('floating.needHelp')}</h2>
              <p className="text-xs text-slate-500">Staff support and physical assistance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <X size={22} />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Assistance Requested!</h3>
            <p className="text-sm text-slate-600 px-4">
              A hospital attendant has been dispatched with a <strong>{selectedType}</strong> to <strong>{location}</strong>. Please stay near this spot.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 px-8 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                What type of assistance do you need?
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'wheelchair', label: 'Wheelchair', icon: Accessibility, desc: 'Mobility support' },
                  { id: 'escort', label: 'Human Escort', icon: UserCheck, desc: 'Guide to ward / room' },
                  { id: 'interpreter', label: 'Language Interpreter', icon: Languages, desc: 'Native speaker support' },
                  { id: 'reading_help', label: 'Reading Help', icon: BookOpen, desc: 'Help filling forms / slips' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSel = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedType(item.id as any)}
                      className={`p-3 rounded-2xl border-2 text-left transition flex flex-col items-start ${
                        isSel
                          ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-500 text-teal-900'
                          : 'border-slate-200 bg-slate-50 hover:border-teal-300'
                      }`}
                    >
                      <Icon size={20} className={isSel ? 'text-teal-700' : 'text-slate-500'} />
                      <span className="font-bold text-sm mt-1">{item.label}</span>
                      <span className="text-[11px] text-slate-500">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Your Current Location
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-3 text-teal-600" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Kiosk 1 (Main Entrance)">Kiosk 1 (Main Entrance Lobby)</option>
                  <option value="OPD Counter 2 (Ground Floor)">OPD Counter 2 (Ground Floor)</option>
                  <option value="Waiting Hall near Water Point">Waiting Hall near Water Point</option>
                  <option value="1st Floor Elevator Area">1st Floor Elevator Area</option>
                  <option value="Ward 4 Corridor (Floor 1)">Ward 4 Corridor (Floor 1)</option>
                  <option value="Pharmacy Counter">Pharmacy Counter (Ground Floor)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-md transition"
              >
                {loading ? 'Requesting...' : 'Request Attendant'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
