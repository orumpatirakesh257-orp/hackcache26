import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Share2,
  Download,
  Volume2,
  Navigation,
  Clock,
  MapPin,
  CheckCircle2,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { DigitalSlip, LanguageCode } from '../../../shared/types';
import { speakText } from '../utils/audio';

export const SlipView: React.FC = () => {
  const { slipId } = useParams<{ slipId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const slipRef = useRef<HTMLDivElement>(null);

  const [slip, setSlip] = useState<DigitalSlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slipId) return;

    fetch(`/api/registration/slip/${slipId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.slip) {
          setSlip(data.slip);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [slipId]);

  const handleReadAloud = () => {
    if (!slip) return;
    const speech = `Government General Hospital OPD Slip. Token Number ${slip.tokenNumber}. Patient Name: ${slip.patientName}. Department: ${slip.departmentName}. Doctor: ${slip.doctorName}. Room: ${slip.roomNumber}, Floor ${slip.floor}. Estimated wait time: ${slip.estimatedWaitMinutes} minutes. Navigation: ${slip.navigationHint}.`;
    speakText(speech, (i18n.language as LanguageCode) || 'en');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!slip) return;
    const text = `*Sahai Setu - Govt Hospital OPD Slip*\nToken: *${slip.tokenNumber}*\nPatient: ${slip.patientName}\nDept: ${slip.departmentName} (${slip.roomNumber}, Floor ${slip.floor})\nOPD No: ${slip.opdNumber}\nDate: ${slip.dateStr}\nEstimated Wait: ~${slip.estimatedWaitMinutes} mins`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDownload = () => {
    if (!slip) return;
    const blob = new Blob(
      [
        `SAHAI SETU - DIGITAL OPD SLIP\n----------------------------------\nTOKEN NUMBER: ${slip.tokenNumber}\nOPD NUMBER: ${slip.opdNumber}\nPATIENT: ${slip.patientName} (${slip.age}y / ${slip.gender})\nDEPARTMENT: ${slip.departmentName}\nDOCTOR: ${slip.doctorName}\nROOM: ${slip.roomNumber} (Floor ${slip.floor})\nDATE: ${slip.dateStr} ${slip.timeStr}\nWAIT TIME: ~${slip.estimatedWaitMinutes} mins\nNAVIGATION: ${slip.navigationHint}\nVERIFICATION QR CODE: ${slip.signedQrPayload}\n`,
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OPD_SLIP_${slip.tokenNumber}.txt`;
    link.click();
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 font-bold animate-pulse">
        Loading Digital OPD Slip...
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <AlertCircle size={44} className="mx-auto text-amber-500" />
        <h3 className="text-xl font-bold text-slate-800">Slip Not Found</h3>
        <p className="text-sm text-slate-500">
          The requested OPD slip could not be found. Please check your token number or register anew.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl"
        >
          Register for OPD
        </button>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Top Banner Actions */}
      <div className="flex items-center justify-between gap-2 no-print">
        <span className="text-xs font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
          <CheckCircle2 size={16} className="text-teal-600" />
          <span>Registration Confirmed</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReadAloud}
            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center gap-1.5 border border-teal-200 transition"
            title="Read Slip Aloud"
          >
            <Volume2 size={16} />
            <span className="hidden sm:inline">Listen</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 border border-slate-300 transition"
            title="Print Thermal Receipt / A5"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* The Printable Digital OPD Slip Card */}
      <div
        ref={slipRef}
        className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 relative"
      >
        {/* Hospital Branding Header */}
        <div className="border-b-2 border-dashed border-slate-300 pb-5 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/logo.svg" alt="Sahai Setu" className="w-8 h-8" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              GOVERNMENT GENERAL HOSPITAL
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Ministry of Health & Family Welfare • ABDM Enabled
          </p>
          <div className="inline-block px-3 py-1 bg-teal-50 text-teal-900 border border-teal-200 rounded-full text-xs font-black uppercase mt-1">
            Official OPD Consultation Slip
          </div>
        </div>

        {/* Big Highlighted Token & OPD Number */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              {t('slip.tokenNo')}
            </span>
            <span className="text-4xl sm:text-5xl font-black text-teal-800 tracking-tight leading-none block mt-1">
              {slip.tokenNumber}
            </span>
            <span className="text-xs font-bold text-slate-500 block mt-1.5">
              OPD No: <strong className="font-mono text-slate-800">{slip.opdNumber}</strong>
            </span>
          </div>

          <div className="shrink-0 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center">
            <QRCodeSVG value={slip.signedQrPayload} size={96} level="M" />
            <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">Scan for Check-in</span>
          </div>
        </div>

        {/* Patient & Clinic Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 text-sm border-b border-slate-200 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Patient Name
            </span>
            <span className="font-black text-slate-900 text-base">{slip.patientName}</span>
            <span className="text-xs text-slate-500 font-semibold block mt-0.5">
              Age: {slip.age} yrs • Gender: {slip.gender}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              {t('slip.department')}
            </span>
            <span className="font-black text-teal-900 text-base">{slip.departmentName}</span>
            <span className="text-xs text-slate-600 font-medium block mt-0.5">
              Doctor: {slip.doctorName}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Room & Ward
            </span>
            <span className="font-black text-slate-900 text-base">{slip.roomNumber}</span>
            <span className="text-xs text-slate-600 font-medium block mt-0.5">
              Block {slip.block} • Floor {slip.floor === 0 ? 'Ground' : slip.floor}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Date & Time
            </span>
            <span className="font-bold text-slate-800">{slip.dateStr}</span>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">{slip.timeStr}</span>
          </div>
        </div>

        {/* Estimated Wait Time & Status */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
          <Clock size={24} className="text-amber-600 shrink-0" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
              Estimated Consultation Wait
            </span>
            <span className="font-black text-base">
              About ~{slip.estimatedWaitMinutes} minutes from registration
            </span>
          </div>
        </div>

        {/* Navigation Hint */}
        <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-950 flex items-start gap-3">
          <MapPin size={22} className="text-teal-700 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-teal-800 block">
              How to reach your room:
            </span>
            <p className="text-sm font-semibold mt-0.5">{slip.navigationHint}</p>
          </div>
        </div>

        {/* Thermal print receipt footer */}
        <div className="pt-2 text-center text-[10px] text-slate-400 font-mono">
          DIGITAL RECEIPT VERIFIED • PRESERVE THIS TOKEN UNTIL CONSULTATION IS COMPLETE
        </div>
      </div>

      {/* Main Action Buttons: Track & Navigate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
        <button
          onClick={() => navigate('/track')}
          className="py-4 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Clock size={20} />
          <span>Track My Turn (Live Queue)</span>
        </button>

        <button
          onClick={() => navigate(`/navigation?destination=${encodeURIComponent(slip.roomNumber)}`)}
          className="py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Navigation size={20} />
          <span>Navigate to {slip.roomNumber}</span>
        </button>
      </div>

      {/* Utility Share Buttons */}
      <div className="flex items-center justify-center gap-3 pt-2 no-print">
        <button
          onClick={handleShareWhatsApp}
          className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 border border-emerald-300 transition"
        >
          <Share2 size={16} />
          <span>Share WhatsApp</span>
        </button>

        <button
          onClick={handleDownload}
          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 border border-slate-300 transition"
        >
          <Download size={16} />
          <span>Save Slip Text</span>
        </button>
      </div>
    </div>
  );
};
