import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import {
  Mic,
  MicOff,
  User,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Volume2,
  Sparkles,
  QrCode,
  ShieldCheck,
  Headphones,
  HelpCircle,
  Accessibility,
  Heart,
  Baby,
  Eye,
  Bone,
  Pill,
  Smile,
  Send,
  Loader2,
} from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { DEPARTMENTS_DATA, MOCK_ABHA_PROFILES, SUPPORTED_LANGUAGES } from '../../../shared/constants';
import { speakText, stopSpeaking } from '../utils/audio';
import { Gender, LanguageCode } from '../../../shared/types';

type RegPath = 'guided' | 'voice' | 'abha' | 'assisted';

interface FormState {
  name: string;
  age: string;
  gender: Gender;
  phone: string;
  symptoms: string[];
  symptomText: string;
  departmentId: string;
  departmentName: string;
  departmentReason: string;
  wheelchair: boolean;
  escort: boolean;
  abhaId?: string;
}

const COMMON_SYMPTOM_CARDS = [
  { id: 'fever', label: 'Fever & Cold', icon: Activity, deptId: 'dept-gen-med' },
  { id: 'cough', label: 'Cough & Chest', icon: Activity, deptId: 'dept-gen-med' },
  { id: 'bone', label: 'Bone / Joint Pain', icon: Bone, deptId: 'dept-ortho' },
  { id: 'child', label: 'Child Health', icon: Baby, deptId: 'dept-paed' },
  { id: 'pregnancy', label: 'Pregnancy Care', icon: Heart, deptId: 'dept-gyn' },
  { id: 'eye', label: 'Eye / Blurry Vision', icon: Eye, deptId: 'dept-eye' },
  { id: 'dental', label: 'Tooth / Dental', icon: Smile, deptId: 'dept-dental' },
  { id: 'skin', label: 'Skin Rash / Allergy', icon: Sparkles, deptId: 'dept-derma' },
  { id: 'ear', label: 'Ear / Nose / Throat', icon: Activity, deptId: 'dept-ent' },
  { id: 'stomach', label: 'Stomach Pain / Vomiting', icon: Activity, deptId: 'dept-gen-med' },
  { id: 'heart', label: 'Heart / BP Check', icon: Heart, deptId: 'dept-cardio' },
  { id: 'wound', label: 'Injury / Minor Wound', icon: Activity, deptId: 'dept-surgery' },
];

export const Register: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setActiveToken, setActiveSlip, setActivePatient } = useQueueStore();

  const [activePath, setActivePath] = useState<RegPath>('guided');
  const [currentStep, setCurrentStep] = useState<number>(1); // 1 to 4
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State with localStorage auto-save
  const [formData, setFormData] = useState<FormState>(() => {
    const saved = localStorage.getItem('sahai_draft_reg');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: '',
      age: '',
      gender: 'male',
      phone: '',
      symptoms: [],
      symptomText: '',
      departmentId: 'dept-gen-med',
      departmentName: 'General Medicine',
      departmentReason: 'Recommended for initial medical examination and general checkup.',
      wheelchair: false,
      escort: false,
    };
  });

  // Auto-save form progress
  useEffect(() => {
    localStorage.setItem('sahai_draft_reg', JSON.stringify(formData));
  }, [formData]);

  // Voice Agent State (Path C)
  const [voiceMessages, setVoiceMessages] = useState<
    { sender: 'agent' | 'user'; text: string; time: string }[]
  >([
    {
      sender: 'agent',
      text: t('voiceWelcome'),
      time: 'Just now',
    },
  ]);

  useEffect(() => {
    setVoiceMessages([
      {
        sender: 'agent',
        text: t('voiceWelcome'),
        time: 'Just now',
      },
    ]);
  }, [i18n.language, t]);
  const [voiceInput, setVoiceInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);

  // ABHA State (Path B)
  const [abhaQuery, setAbhaQuery] = useState('');
  const [abhaOtp, setAbhaOtp] = useState('123456');
  const [abhaOtpSent, setAbhaOtpSent] = useState(false);
  const [abhaLoading, setAbhaLoading] = useState(false);

  // Step 2 -> 3: Get AI Department Suggestion
  const handleProceedToStep3 = async () => {
    if (formData.symptoms.length === 0 && !formData.symptomText) {
      setErrorMsg('Please select at least one problem or enter symptoms.');
      return;
    }
    setErrorMsg('');

    try {
      const combinedSymptoms = [...formData.symptoms];
      if (formData.symptomText) combinedSymptoms.push(formData.symptomText);

      const res = await fetch('/api/registration/suggest-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: combinedSymptoms,
          language: i18n.language,
        }),
      });
      const data = await res.json();
      if (data.departmentId) {
        setFormData((prev) => ({
          ...prev,
          departmentId: data.departmentId,
          departmentName: data.departmentName,
          departmentReason: data.reason,
        }));
      }
    } catch (e) {
      console.warn('Department suggestion fallback');
    }

    setCurrentStep(3);
  };

  // Submit Final Registration (Step 4)
  const handleFinalSubmit = async (overrideData?: Partial<FormState>) => {
    const final = { ...formData, ...overrideData };

    if (!final.name || !final.age || !final.phone) {
      setErrorMsg('Please fill in your name, age, and phone number.');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/registration/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: final.name,
          age: Number(final.age),
          gender: final.gender,
          phone: final.phone,
          language: i18n.language,
          symptoms: final.symptoms.length > 0 ? final.symptoms : [final.symptomText || 'General checkup'],
          departmentId: final.departmentId,
          registrationMethod: activePath === 'voice' ? 'self_voice' : activePath === 'abha' ? 'abha' : 'self_guided',
          accessibilityNeeds: {
            wheelchair: final.wheelchair,
            escort: final.escort,
          },
          abhaId: final.abhaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Celebrate success
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

      // Save state to store
      setActiveToken(data.token);
      setActiveSlip(data.slip);
      setActivePatient(data.patient);

      // Clear draft
      localStorage.removeItem('sahai_draft_reg');

      // Voice read out token
      const speech = `Registration complete! Your token number is ${data.token.tokenNumber}. Department: ${data.slip.departmentName}, ${data.slip.roomNumber}.`;
      speakText(speech, (i18n.language as LanguageCode) || 'en');

      // Navigate to slip view
      navigate(`/slip/${data.slip.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Symptom Card
  const toggleSymptom = (label: string, defaultDeptId: string) => {
    setFormData((prev) => {
      const exists = prev.symptoms.includes(label);
      const updated = exists ? prev.symptoms.filter((s) => s !== label) : [...prev.symptoms, label];
      return {
        ...prev,
        symptoms: updated,
        departmentId: !exists ? defaultDeptId : prev.departmentId,
      };
    });
  };

  // Voice Registration Turn Handler
  const handleSendVoiceMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userText = textToSend.trim();
    const newHistory = [...voiceMessages, { sender: 'user' as const, text: userText, time: 'Just now' }];
    setVoiceMessages(newHistory);
    setVoiceInput('');
    setAgentLoading(true);

    try {
      const res = await fetch('/api/registration/voice-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: newHistory.map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text })),
          currentExtracted: {
            name: formData.name,
            age: formData.age ? Number(formData.age) : undefined,
            gender: formData.gender,
            phone: formData.phone,
            symptoms: formData.symptoms,
            departmentId: formData.departmentId,
          },
          language: i18n.language,
        }),
      });

      const data = await res.json();

      // Check if emergency triggered
      if (data.emergencyTriggered) {
        speakText(data.nextQuestion, (i18n.language as LanguageCode) || 'en');
        navigate('/emergency');
        return;
      }

      // Update extracted form data
      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        age: data.age ? String(data.age) : prev.age,
        gender: data.gender || prev.gender,
        phone: data.phone || prev.phone,
        symptoms: data.symptoms || prev.symptoms,
        departmentId: data.departmentId || prev.departmentId,
        departmentName: data.departmentName || prev.departmentName,
      }));

      const reply = data.nextQuestion || 'Thank you! Details received.';
      setVoiceMessages((prev) => [
        ...prev,
        { sender: 'agent', text: reply, time: 'Just now' },
      ]);

      // Speak agent reply aloud
      speakText(reply, (i18n.language as LanguageCode) || 'en');

      if (data.isComplete) {
        confetti({ particleCount: 40 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAgentLoading(false);
    }
  };

  // Simulated Mic speech recognition
  const toggleMic = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Simulation for browsers without Web Speech
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        const samplePhrases = [
          'My name is Ramesh Patel, age 48, severe knee pain for 2 days',
          'என் பெயர் குமார், வயது 45, காய்ச்சல் மற்றும் இருமல்',
          'मेरा नाम सुरेश है, उम्र 52 वर्ष, घुटने में तेज दर्द है',
        ];
        const phrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
        setVoiceInput(phrase);
      }, 1500);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
      recognition.lang = langConfig?.speechLang || 'en-IN';
      recognition.interimResults = false;

      setIsRecording(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceInput(transcript);
        handleSendVoiceMessage(transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (e) {
      setIsRecording(false);
    }
  };

  // ABHA Lookup handler (Path B)
  const handleAbhaLookup = async () => {
    if (!abhaQuery) return;
    setAbhaLoading(true);
    try {
      const res = await fetch('/api/registration/abha/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: abhaQuery }),
      });
      const data = await res.json();
      if (data.found) {
        setAbhaOtpSent(true);
        speakText('OTP sent to registered mobile. Demo OTP is 123456.', (i18n.language as LanguageCode) || 'en');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAbhaLoading(false);
    }
  };

  // ABHA Verify handler
  const handleAbhaVerify = async () => {
    setAbhaLoading(true);
    try {
      const res = await fetch('/api/registration/abha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnId: 'demo-txn',
          otp: abhaOtp,
          abhaNumber: abhaQuery,
        }),
      });
      const data = await res.json();
      if (data.verified && data.profile) {
        const p = data.profile;
        const birthYear = p.dateOfBirth ? parseInt(p.dateOfBirth.slice(0, 4), 10) : 1978;
        const calculatedAge = new Date().getFullYear() - birthYear;

        setFormData((prev) => ({
          ...prev,
          name: p.name,
          age: String(calculatedAge),
          gender: p.gender as Gender,
          phone: p.mobile,
          abhaId: p.abhaNumber,
        }));

        speakText(`Welcome ${p.name}! ABHA profile verified. Please choose your problem.`, (i18n.language as LanguageCode) || 'en');
        setActivePath('guided');
        setCurrentStep(2);
      } else {
        setErrorMsg('Invalid OTP. Please enter demo OTP: 123456');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAbhaLoading(false);
    }
  };

  return (
    <div className="py-6 px-4 max-w-3xl mx-auto space-y-6 pb-28" id="main-content">
      {/* Page Title & Mode Switcher */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <span>📝</span> {t('reg.title')}
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Choose how you would like to register today
        </p>

        {/* 4 Paths Switcher Tabs */}
        <div className="flex p-1 bg-slate-200/80 rounded-2xl max-w-xl mx-auto gap-1 text-xs font-bold">
          <button
            onClick={() => setActivePath('guided')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activePath === 'guided'
                ? 'bg-white text-teal-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={15} />
            <span>Guided Form</span>
          </button>
          <button
            onClick={() => setActivePath('voice')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activePath === 'voice'
                ? 'bg-white text-teal-900 shadow-sm ring-1 ring-teal-400'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic size={15} className="text-teal-600 animate-pulse" />
            <span>Voice Agent</span>
          </button>
          <button
            onClick={() => setActivePath('abha')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activePath === 'abha'
                ? 'bg-white text-teal-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode size={15} />
            <span>ABHA ID</span>
          </button>
          <button
            onClick={() => {
              setActivePath('guided');
              setFormData((prev) => ({ ...prev, escort: true }));
              setCurrentStep(1);
            }}
            className="flex-1 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5"
          >
            <Headphones size={15} />
            <span>Assisted</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-300 text-red-800 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* PATH C: AI-ASSISTED VOICE & CHAT REGISTRATION AGENT      */}
      {/* ======================================================== */}
      {activePath === 'voice' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border-2 border-teal-500 shadow-xl overflow-hidden">
            {/* Agent Header */}
            <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Sahai Setu Voice Agent</h3>
                  <p className="text-xs text-teal-200">Speaks 10 Indian Languages • Powered by Gemini</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const speech = voiceMessages[voiceMessages.length - 1]?.text;
                  if (speech) speakText(speech, (i18n.language as LanguageCode) || 'en');
                }}
                className="p-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white flex items-center gap-1 text-xs font-bold"
              >
                <Volume2 size={16} />
                <span>Repeat</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="p-4 h-[280px] overflow-y-auto space-y-3 bg-slate-50/60">
              {voiceMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-xs'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-tl-xs'
                    }`}
                  >
                    <p className="font-medium">{msg.text}</p>
                    <span
                      className={`text-[10px] block mt-1 ${
                        msg.sender === 'user' ? 'text-teal-100' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              {agentLoading && (
                <div className="flex items-center gap-2 text-teal-700 text-xs font-bold p-2 bg-teal-50 rounded-xl w-fit">
                  <Loader2 size={15} className="animate-spin" />
                  <span>Sahai Setu is thinking...</span>
                </div>
              )}
            </div>

            {/* Quick Reply Chips */}
            <div className="px-4 py-2 border-t border-slate-200 bg-white flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Suggestions:
              </span>
              {[
                'Severe Knee Joint Pain',
                'Fever for 3 Days',
                'Child Vaccination',
                'Eye Cataract Check',
                'Yes, details are correct!',
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSendVoiceMessage(chip)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-800 border border-slate-200 whitespace-nowrap font-medium transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Voice Wave & Input Controls */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shrink-0 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200'
                    : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                }`}
                aria-label={isRecording ? 'Listening...' : 'Tap to speak'}
                title={isRecording ? 'Listening...' : 'Tap to speak'}
              >
                {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <input
                type="text"
                placeholder={isRecording ? 'Listening to your voice...' : 'Type or speak your answer...'}
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendVoiceMessage(voiceInput);
                }}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500"
              />

              <button
                type="button"
                onClick={() => handleSendVoiceMessage(voiceInput)}
                className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl transition"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Live Extracted Summary Card */}
          <div className="p-4 rounded-3xl bg-teal-50/80 border-2 border-teal-300">
            <h4 className="text-xs font-black uppercase tracking-wider text-teal-800 mb-2 flex items-center justify-between">
              <span>Live Extracted Details</span>
              <span className="text-[11px] font-normal text-teal-600">Updated automatically</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium">
              <div className="p-2 bg-white rounded-xl border border-teal-200">
                <span className="text-slate-400 block text-[10px] uppercase">Name</span>
                <span className="font-bold text-slate-900">{formData.name || '—'}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-teal-200">
                <span className="text-slate-400 block text-[10px] uppercase">Age / Gender</span>
                <span className="font-bold text-slate-900">
                  {formData.age ? `${formData.age} yrs` : '—'} / {formData.gender}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-teal-200">
                <span className="text-slate-400 block text-[10px] uppercase">Mobile</span>
                <span className="font-bold text-slate-900">{formData.phone || '—'}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-teal-200">
                <span className="text-slate-400 block text-[10px] uppercase">Department</span>
                <span className="font-bold text-teal-800">{formData.departmentName}</span>
              </div>
            </div>

            {formData.name && formData.age && formData.phone && (
              <button
                onClick={() => handleFinalSubmit()}
                disabled={submitting}
                className="mt-3 w-full py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>Confirm Details & Generate OPD Slip</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PATH B: ABHA ID LOOKUP & PREFILL                         */}
      {/* ======================================================== */}
      {activePath === 'abha' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-slate-200 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl">
              <QrCode size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Ayushman Bharat Health Account (ABHA)</h3>
              <p className="text-xs text-slate-500">Instant lookup via 14-digit ABHA ID or mobile number</p>
            </div>
          </div>

          {/* Quick Demo ABHA Cards for judges */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              1-Click Demo ABHA Profiles (Click to test):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOCK_ABHA_PROFILES.slice(0, 4).map((mock) => (
                <button
                  key={mock.abhaNumber}
                  type="button"
                  onClick={() => {
                    setAbhaQuery(mock.abhaNumber);
                    setAbhaOtpSent(true);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 text-left transition"
                >
                  <p className="font-bold text-slate-900 text-xs">{mock.name} ({mock.gender}, Age 48)</p>
                  <p className="text-[11px] font-mono text-blue-700">{mock.abhaNumber}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Enter 14-digit ABHA Number or Mobile
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 14-8765-4321-9876 or 9876543210"
                  value={abhaQuery}
                  onChange={(e) => setAbhaQuery(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAbhaLookup}
                  disabled={abhaLoading || !abhaQuery}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition"
                >
                  {abhaLoading ? 'Sending OTP...' : 'Lookup & Send OTP'}
                </button>
              </div>
            </div>

            {abhaOtpSent && (
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-blue-900">
                  <span className="font-bold">Enter Verification OTP</span>
                  <span className="bg-blue-200/80 px-2 py-0.5 rounded-md font-mono font-bold">
                    Demo OTP: 123456
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={abhaOtp}
                    onChange={(e) => setAbhaOtp(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-blue-300 font-mono tracking-widest text-center text-lg font-bold bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAbhaVerify}
                    disabled={abhaLoading}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md transition"
                  >
                    {abhaLoading ? 'Verifying...' : 'Verify & Prefill'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PATH A: GUIDED 4-STEP WIZARD FORM                        */}
      {/* ======================================================== */}
      {activePath === 'guided' && (
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden">
          {/* Progress Bar (Step 2 of 4) */}
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-800">
                {t('reg.step')} {currentStep} {t('reg.of')} 4
              </span>
              <span className="text-xs font-bold text-slate-500">
                {currentStep === 1
                  ? t('reg.personalDetails')
                  : currentStep === 2
                  ? t('reg.problem')
                  : currentStep === 3
                  ? t('reg.suggestedDept')
                  : t('reg.review')}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* STEP 1: Name, Age, Gender, Phone */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {t('reg.name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('reg.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      {t('reg.age')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      placeholder="e.g. 48"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      {t('reg.gender')} <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['male', 'female', 'other'] as Gender[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setFormData({ ...formData, gender: g })}
                          className={`py-3 rounded-xl font-bold text-xs capitalize transition ${
                            formData.gender === g
                              ? 'bg-teal-700 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {t(`reg.${g}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {t('reg.phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number for SMS token updates"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 text-base"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    You will receive queue updates and turn notifications on this number.
                  </span>
                </div>

                {/* Accessibility Toggle */}
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Accessibility size={20} className="text-teal-700" />
                    <div>
                      <span className="text-xs font-bold text-teal-900 block">{t('reg.wheelchairNeeded')}</span>
                      <span className="text-[11px] text-teal-700">Routes will avoid stairs automatically</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.wheelchair}
                    onChange={(e) => setFormData({ ...formData, wheelchair: e.target.checked })}
                    className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Problem Icon Cards + Free text/voice */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Select your symptoms / complaints:
                  </span>
                  <button
                    type="button"
                    onClick={toggleMic}
                    className="flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200"
                  >
                    <Mic size={14} className={isRecording ? 'animate-pulse text-red-500' : ''} />
                    <span>{isRecording ? 'Listening...' : 'Speak Problem'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COMMON_SYMPTOM_CARDS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = formData.symptoms.includes(item.label);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSymptom(item.label, item.deptId)}
                        className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col items-start min-h-[76px] justify-between ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500'
                            : 'border-slate-200 bg-slate-50/70 hover:border-teal-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon size={20} className={isSelected ? 'text-teal-700' : 'text-slate-500'} />
                          {isSelected && <CheckCircle2 size={16} className="text-teal-600" />}
                        </div>
                        <span className="font-bold text-xs mt-2 leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Or Describe in your own words / voice
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Sharp pain in lower back after lifting heavy bucket this morning..."
                    value={formData.symptomText}
                    onChange={(e) => setFormData({ ...formData, symptomText: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Suggested Department with Plain Language Reason */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div className="p-5 rounded-3xl bg-teal-50 border-2 border-teal-400 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-800">
                    <Sparkles size={18} className="text-teal-600" />
                    <span>AI Suggested OPD Department</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {formData.departmentName}
                    </h3>
                    <p className="text-sm text-teal-900 mt-1 font-medium leading-relaxed">
                      {formData.departmentReason}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-teal-200 text-xs text-teal-700 font-semibold flex items-center gap-1.5">
                    <ShieldCheck size={16} />
                    <span>{t('reg.doctorCheckNotice')}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Want to consult a different department? Change here:
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => {
                      const selected = DEPARTMENTS_DATA.find((d) => d.id === e.target.value);
                      if (selected) {
                        setFormData({
                          ...formData,
                          departmentId: selected.id,
                          departmentName: selected.name,
                          departmentReason: selected.description,
                        });
                      }
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white font-bold text-slate-900 text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    {DEPARTMENTS_DATA.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.roomRange}, Floor {dept.floor})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 4: Review and Confirm */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-5 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                    Review Patient Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block uppercase">Name</span>
                      <span className="font-extrabold text-slate-900 text-base">{formData.name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block uppercase">Age / Gender</span>
                      <span className="font-extrabold text-slate-900 text-base">
                        {formData.age} years • {formData.gender}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block uppercase">Phone Number</span>
                      <span className="font-extrabold text-slate-900">{formData.phone}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block uppercase">OPD Department</span>
                      <span className="font-extrabold text-teal-800">{formData.departmentName}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase">Symptoms</span>
                    <span className="font-medium text-slate-800 text-xs">
                      {formData.symptoms.join(', ') || formData.symptomText || 'General medical examination'}
                    </span>
                  </div>

                  {formData.wheelchair && (
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-bold flex items-center gap-2">
                      <Accessibility size={16} />
                      <span>Wheelchair assistance requested. Ramp & elevator route will be provided.</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600 shrink-0" />
                  <span>
                    Your details will be stored securely under ABDM / FHIR digital health guidelines.
                  </span>
                </div>
              </div>
            )}

            {/* Stepper Footer Controls */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 flex items-center gap-1.5 transition"
                >
                  <ArrowLeft size={16} />
                  <span>{t('reg.back')}</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1) {
                      if (!formData.name || !formData.age || !formData.phone) {
                        setErrorMsg('Please enter your name, age, and phone number.');
                        return;
                      }
                      setErrorMsg('');
                      setCurrentStep(2);
                    } else if (currentStep === 2) {
                      handleProceedToStep3();
                    } else if (currentStep === 3) {
                      setCurrentStep(4);
                    }
                  }}
                  className="px-7 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md flex items-center gap-2 transition active:scale-95 ml-auto"
                >
                  <span>{t('reg.next')}</span>
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleFinalSubmit()}
                  disabled={submitting}
                  className="px-8 py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm shadow-xl flex items-center gap-2 transition active:scale-95 ml-auto"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  <span>{t('reg.confirmSlip')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
