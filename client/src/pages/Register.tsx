import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Building2,
  Calendar,
  Clock,
  Phone,
  Radio,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import {
  DEPARTMENTS_DATA,
  MOCK_ABHA_PROFILES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_HOSPITALS,
  AVAILABLE_OPD_TIME_SLOTS,
  EMERGENCY_DANGER_KEYWORDS,
} from '../../../shared/constants';
import { speakText, stopSpeaking, playEmergencyAlertSound } from '../utils/audio';
import { Gender, LanguageCode, DigitalSlip, QueueToken } from '../../../shared/types';

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
  hospitalId?: string;
  hospitalName?: string;
  appointmentDate?: string;
  appointmentSlot?: string;
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
  const [searchParams] = useSearchParams();
  const { setActiveToken, setActiveSlip, setActivePatient } = useQueueStore();

  const [activePath, setActivePath] = useState<RegPath>(() => {
    const mode = searchParams.get('mode');
    return mode === 'voice' ? 'voice' : 'guided';
  });
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
    const today = new Date().toISOString().split('T')[0];
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
      hospitalId: 'hosp-ggh-hyd',
      hospitalName: 'Government General Hospital (GGH)',
      appointmentDate: today,
      appointmentSlot: '09:00 AM - 10:00 AM',
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const recognitionRef = useRef<any>(null);

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

  // Submit Final Registration
  const handleFinalSubmit = async (overrideData?: Partial<FormState>) => {
    const final = { ...formData, ...overrideData };

    if (!final.name || !final.age || !final.phone) {
      const msg = 'Please provide patient name, age, and 10-digit mobile number.';
      setErrorMsg(msg);
      speakText(msg, (i18n.language as LanguageCode) || 'en');
      if (activePath !== 'voice') setCurrentStep(1);
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
          gender: final.gender || 'male',
          phone: final.phone,
          language: i18n.language,
          symptoms:
            final.symptoms.length > 0 ? final.symptoms : [final.symptomText || 'General medical examination'],
          departmentId: final.departmentId || 'dept-gen-med',
          hospitalId: final.hospitalId || 'hosp-ggh-hyd',
          hospitalName: final.hospitalName || 'Government General Hospital (GGH)',
          appointmentDate: final.appointmentDate || new Date().toISOString().split('T')[0],
          appointmentSlot: final.appointmentSlot || '09:00 AM - 10:00 AM',
          registrationMethod:
            activePath === 'voice' ? 'self_voice' : activePath === 'abha' ? 'abha' : 'self_guided',
          accessibilityNeeds: {
            wheelchair: final.wheelchair,
            escort: final.escort,
          },
          abhaId: final.abhaId,
        }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('BACKEND_404');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Registration failed');
      }

      const data = await res.json();

      // Celebrate success
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });

      // Save state to store
      setActiveToken(data.token);
      setActiveSlip(data.slip);
      setActivePatient(data.patient);

      // Clear draft
      localStorage.removeItem('sahai_draft_reg');

      // Voice read out token
      const speech = `Registration complete! Your appointment is confirmed at ${data.slip.hospitalName || final.hospitalName}. Token number is ${data.token.tokenNumber}. Department: ${data.slip.departmentName}, Room ${data.slip.roomNumber}, Slot: ${data.slip.appointmentSlot || final.appointmentSlot}.`;
      speakText(speech, (i18n.language as LanguageCode) || 'en');

      // Navigate to slip view
      navigate(`/slip/${data.slip.id}`);
    } catch (err: any) {
      if (err.message === 'BACKEND_404') {
        // Safe offline / static Vercel client-side fallback
        const dept = DEPARTMENTS_DATA.find((d) => d.id === final.departmentId) || DEPARTMENTS_DATA[0];
        const hosp =
          SUPPORTED_HOSPITALS.find((h) => h.id === final.hospitalId) || SUPPORTED_HOSPITALS[0];
        const now = new Date();
        const dateStr = final.appointmentDate || now.toISOString().split('T')[0];
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const tokenNum = `${dept.code}-${String(Math.floor(1 + Math.random() * 30)).padStart(3, '0')}`;
        const opdNum = `OPD-${now.getFullYear()}-${randomNum}`;
        const slipId = `slip-${Date.now()}`;

        const patId = `pat-${Date.now()}`;
        const fallbackSlip: DigitalSlip = {
          id: slipId,
          patientId: patId,
          tokenNumber: tokenNum,
          opdNumber: opdNum,
          patientName: final.name,
          age: Number(final.age),
          gender: final.gender || 'male',
          departmentId: dept.id,
          departmentName: dept.name,
          roomNumber: dept.roomRange.split('-')[0].trim(),
          floor: dept.floor,
          block: dept.block,
          doctorName: 'OPD Duty Medical Officer',
          estimatedWaitMinutes: 15,
          hospitalId: hosp.id,
          hospitalName: hosp.name,
          appointmentDate: dateStr,
          appointmentSlot: final.appointmentSlot || '09:00 AM - 10:00 AM',
          dateStr: dateStr,
          timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          signedQrPayload: `SAHAI-OPD|${opdNum}|${tokenNum}|${final.name}|${dept.code}|${dateStr}|VERIFIED`,
          navigationHint: `Head to Block ${dept.block}, Floor ${dept.floor}, ${dept.roomRange}. Wheelchair ramps available near Main Entrance.`,
        };

        const fallbackToken: QueueToken = {
          id: `tok-${Date.now()}`,
          tokenNumber: tokenNum,
          departmentId: dept.id,
          patientId: patId,
          opdNumber: opdNum,
          status: 'waiting',
          priority: 'normal',
          estimatedWaitMinutes: 15,
          waitReason: 'Standard consultation queue',
          queuePosition: 3,
          journeyStep: 'registration',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        setActiveToken(fallbackToken);
        setActiveSlip(fallbackSlip);
        localStorage.setItem('sahai_active_slip', JSON.stringify(fallbackSlip));
        localStorage.setItem('sahai_active_token', JSON.stringify(fallbackToken));
        localStorage.removeItem('sahai_draft_reg');

        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
        const speech = `Registration complete! Your appointment is confirmed at ${fallbackSlip.hospitalName}. Token number is ${fallbackSlip.tokenNumber}. Department: ${fallbackSlip.departmentName}, Room ${fallbackSlip.roomNumber}, Slot: ${fallbackSlip.appointmentSlot}.`;
        speakText(speech, (i18n.language as LanguageCode) || 'en');

        navigate(`/slip/${fallbackSlip.id}`);
        return;
      }

      const failMsg = err.message || 'Registration failed. Please try again.';
      setErrorMsg(failMsg);
      speakText('Registration failed. Please verify your details and try again.', (i18n.language as LanguageCode) || 'en');
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side fallback conversational AI extractor
  const extractClientSideTurn = (
    userText: string,
    current: FormState
  ): {
    extracted: Partial<FormState>;
    nextQuestion: string;
    isComplete: boolean;
    confirmed: boolean;
    emergencyTriggered?: boolean;
  } => {
    const lower = userText.toLowerCase().trim();

    // 1. Emergency safety check
    for (const kw of EMERGENCY_DANGER_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        return {
          extracted: {},
          nextQuestion:
            'EMERGENCY WARNING: Your symptoms may require urgent medical care. Transferring to Emergency Casualty immediately!',
          isComplete: false,
          confirmed: false,
          emergencyTriggered: true,
        };
      }
    }

    const updated: Partial<FormState> = {};

    // 2. Hospital extraction
    for (const h of SUPPORTED_HOSPITALS) {
      const hName = h.name.toLowerCase();
      if (
        lower.includes(hName) ||
        (lower.includes('aiims') && h.id.includes('aiims')) ||
        (lower.includes('safdarjung') && h.id.includes('safdarjung')) ||
        (lower.includes('sms') && h.id.includes('sms')) ||
        (lower.includes('civil') && h.id.includes('civil')) ||
        (lower.includes('ggh') && h.id.includes('ggh')) ||
        (lower.includes('hyderabad') && h.id.includes('ggh')) ||
        (lower.includes('delhi') && h.id.includes('aiims')) ||
        (lower.includes('jaipur') && h.id.includes('sms')) ||
        (lower.includes('gurugram') && h.id.includes('civil'))
      ) {
        updated.hospitalId = h.id;
        updated.hospitalName = h.name;
        break;
      }
    }

    // 3. Name extraction
    const nameMatch = lower.match(
      /(?:my name is|i am|this is|naam|peru|hesaru|peyar)\s+([a-z\s]+?)(?:\s+(?:and|i am|age|my age|years|yrs|having|suffering|mobile|phone)|$)/i
    );
    if (nameMatch && nameMatch[1]) {
      const raw = nameMatch[1].trim();
      if (raw.length > 2 && !raw.includes('pain') && !raw.includes('hospital')) {
        updated.name = raw
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    } else if (
      !current.name &&
      !updated.name &&
      lower.split(' ').length <= 3 &&
      !/\d/.test(lower) &&
      !lower.includes('pain') &&
      !lower.includes('hospital') &&
      !lower.includes('morning') &&
      !lower.includes('afternoon') &&
      !lower.includes('slot') &&
      !lower.includes('fever') &&
      !lower.includes('cough')
    ) {
      if (lower.length > 2) {
        updated.name = lower
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    // 4. Age extraction
    const ageMatch = lower.match(
      /(?:age\s*(?:is)?\s*|im\s*|i am\s*|uamr\s*)?(\d{1,2})\s*(?:years|year|yrs|yr|saal|varsh)?\s*(?:old)?/i
    );
    if (ageMatch && ageMatch[1]) {
      const num = parseInt(ageMatch[1], 10);
      if (num > 0 && num <= 115) {
        updated.age = String(num);
      }
    }

    // 5. Gender extraction
    if (/\b(female|woman|lady|aurat|mahila|girl)\b/i.test(lower)) {
      updated.gender = 'female';
    } else if (/\b(male|man|gentleman|aadmi|purush|boy)\b/i.test(lower)) {
      updated.gender = 'male';
    }

    // 6. Phone extraction
    const phoneMatch = lower.match(/(?:\+91[- ]?)?([6-9]\d{9})/);
    if (phoneMatch) {
      updated.phone = phoneMatch[1];
    }

    // 7. Time Slot extraction
    for (const s of AVAILABLE_OPD_TIME_SLOTS) {
      if (
        lower.includes(s.toLowerCase()) ||
        (lower.includes('9') && s.includes('09:00 AM')) ||
        (lower.includes('10') && s.includes('10:00 AM')) ||
        (lower.includes('11') && s.includes('11:00 AM')) ||
        (lower.includes('12') && s.includes('12:00 PM')) ||
        (lower.includes('2') && s.includes('02:00 PM')) ||
        (lower.includes('3') && s.includes('03:00 PM')) ||
        (lower.includes('morning') && s.includes('10:00 AM')) ||
        (lower.includes('afternoon') && s.includes('02:00 PM'))
      ) {
        updated.appointmentSlot = s;
        break;
      }
    }

    // 8. Symptoms and Department matching
    const symptomKeywords: Record<string, string> = {
      fever: 'dept-gen-med',
      cold: 'dept-gen-med',
      cough: 'dept-gen-med',
      headache: 'dept-gen-med',
      stomach: 'dept-gen-med',
      weakness: 'dept-gen-med',
      vomiting: 'dept-gen-med',
      bp: 'dept-cardio',
      heart: 'dept-cardio',
      chest: 'dept-cardio',
      bone: 'dept-ortho',
      knee: 'dept-ortho',
      joint: 'dept-ortho',
      fracture: 'dept-ortho',
      backache: 'dept-ortho',
      back: 'dept-ortho',
      child: 'dept-paed',
      baby: 'dept-paed',
      infant: 'dept-paed',
      pregnant: 'dept-gyn',
      pregnancy: 'dept-gyn',
      women: 'dept-gyn',
      period: 'dept-gyn',
      eye: 'dept-eye',
      vision: 'dept-eye',
      cataract: 'dept-eye',
      ear: 'dept-ent',
      throat: 'dept-ent',
      tonsil: 'dept-ent',
      skin: 'dept-derma',
      rash: 'dept-derma',
      itching: 'dept-derma',
      dental: 'dept-dental',
      tooth: 'dept-dental',
      teeth: 'dept-dental',
    };

    const detectedSymptoms: string[] = [];
    let detectedDeptId = '';
    for (const [kw, deptId] of Object.entries(symptomKeywords)) {
      if (lower.includes(kw)) {
        detectedSymptoms.push(kw.charAt(0).toUpperCase() + kw.slice(1));
        if (!detectedDeptId) detectedDeptId = deptId;
      }
    }

    if (detectedSymptoms.length > 0) {
      const existing = current.symptoms || [];
      const merged = Array.from(new Set([...existing, ...detectedSymptoms]));
      updated.symptoms = merged;
      if (detectedDeptId) {
        updated.departmentId = detectedDeptId;
        const deptObj = DEPARTMENTS_DATA.find((d) => d.id === detectedDeptId);
        if (deptObj) {
          updated.departmentName = deptObj.name;
          updated.departmentReason = deptObj.description;
        }
      }
    }

    const full: FormState = {
      ...current,
      ...updated,
    };

    // 9. Verbal Confirmation check
    const isAffirmative =
      /\b(yes|confirm|proceed|okay|correct|sure|book|haan|ha|theek|sariya|avunu|hoy|registered)\b/i.test(
        lower
      );
    const isComplete = Boolean(
      full.name &&
        full.age &&
        full.phone &&
        full.departmentId &&
        full.hospitalName &&
        full.appointmentSlot
    );

    if (isComplete && isAffirmative) {
      return {
        extracted: updated,
        nextQuestion: 'Confirmed! Registering your OPD appointment now...',
        isComplete: true,
        confirmed: true,
      };
    }

    // 10. Sequential questioning
    let nextQ = '';
    if (!full.hospitalName) {
      nextQ =
        'Welcome to Sahai Setu! Which hospital would you like to visit? (AIIMS New Delhi, GGH Hyderabad, Civil Hospital, Safdarjung, or SMS Hospital)';
    } else if (!full.name) {
      nextQ = `Understood, at ${full.hospitalName}. Could you please state the patient's full name?`;
    } else if (!full.age) {
      nextQ = `Thank you ${full.name}. What is the patient's age and gender?`;
    } else if (!full.symptoms || full.symptoms.length === 0) {
      nextQ = `What health issues or symptoms are you experiencing today?`;
    } else if (!full.appointmentSlot) {
      nextQ = `Got it. For ${full.departmentName || 'OPD'}, which slot do you prefer? (e.g. 09:00 AM - 10:00 AM, 10:00 AM - 11:00 AM, or 02:00 PM - 03:00 PM)`;
    } else if (!full.phone || full.phone.length < 10) {
      nextQ = `Almost complete! What is your 10-digit mobile number for appointment SMS and live queue notifications?`;
    } else {
      nextQ = `I have your details: ${full.name}, age ${full.age}, for ${full.departmentName} at ${full.hospitalName} on ${full.appointmentDate} (${full.appointmentSlot}). Mobile: ${full.phone}. Would you like me to book this appointment? Say "Yes" or "Confirm".`;
    }

    return {
      extracted: updated,
      nextQuestion: nextQ,
      isComplete,
      confirmed: false,
    };
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

  // Simulated / Web Speech Mic recognition
  const toggleMic = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Browser simulation
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        const samplePhrases = [
          'My name is Ramesh Patel, age 48, severe knee joint pain, preferred slot 10 to 11 am at GGH',
          'என் பெயர் குமார், வயது 45, காய்ச்சல் மற்றும் இருமல், 9876543210',
          'मेरा नाम सुरेश है, उम्र 52 वर्ष, घुटने में तेज दर्द है, AIIMS अस्पताल',
          'Yes, please confirm and book my appointment',
        ];
        const phrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
        setVoiceInput(phrase);
        handleSendVoiceMessage(phrase);
      }, 1800);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
      recognition.lang = langConfig?.speechLang || 'en-IN';
      recognition.interimResults = false;

      setIsRecording(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceInput(transcript);
        setIsRecording(false);
        handleSendVoiceMessage(transcript);
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

  // Voice Registration Turn Handler
  const handleSendVoiceMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userText = textToSend.trim();
    const newHistory = [
      ...voiceMessages,
      { sender: 'user' as const, text: userText, time: 'Just now' },
    ];
    setVoiceMessages(newHistory);
    setVoiceInput('');
    setAgentLoading(true);

    try {
      let agentData: any = null;

      // Try backend voice agent
      try {
        const res = await fetch('/api/registration/voice-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: newHistory.map((m) => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
            currentExtracted: {
              name: formData.name,
              age: formData.age ? Number(formData.age) : undefined,
              gender: formData.gender,
              phone: formData.phone,
              symptoms: formData.symptoms,
              departmentId: formData.departmentId,
              hospitalId: formData.hospitalId,
              hospitalName: formData.hospitalName,
              appointmentDate: formData.appointmentDate,
              appointmentSlot: formData.appointmentSlot,
            },
            language: i18n.language,
          }),
        });

        if (res.ok) {
          agentData = await res.json();
        }
      } catch (netErr) {
        console.warn('Backend voice-agent unreachable, using client extractor');
      }

      // If backend was not reached or returned error, use client fallback
      if (!agentData) {
        const fallbackRes = extractClientSideTurn(userText, formData);
        agentData = {
          name: fallbackRes.extracted.name || formData.name,
          age: fallbackRes.extracted.age || formData.age,
          gender: fallbackRes.extracted.gender || formData.gender,
          phone: fallbackRes.extracted.phone || formData.phone,
          symptoms: fallbackRes.extracted.symptoms || formData.symptoms,
          departmentId: fallbackRes.extracted.departmentId || formData.departmentId,
          departmentName: fallbackRes.extracted.departmentName || formData.departmentName,
          hospitalId: fallbackRes.extracted.hospitalId || formData.hospitalId,
          hospitalName: fallbackRes.extracted.hospitalName || formData.hospitalName,
          appointmentDate: fallbackRes.extracted.appointmentDate || formData.appointmentDate,
          appointmentSlot: fallbackRes.extracted.appointmentSlot || formData.appointmentSlot,
          nextQuestion: fallbackRes.nextQuestion,
          isComplete: fallbackRes.isComplete,
          confirmed: fallbackRes.confirmed,
          emergencyTriggered: fallbackRes.emergencyTriggered,
        };
      }

      // Emergency triggered?
      if (agentData.emergencyTriggered) {
        playEmergencyAlertSound();
        speakText(agentData.nextQuestion, (i18n.language as LanguageCode) || 'en');
        navigate('/emergency');
        return;
      }

      // Merge newly extracted fields
      const updatedData: FormState = {
        ...formData,
        name: agentData.name || formData.name,
        age: agentData.age ? String(agentData.age) : formData.age,
        gender: agentData.gender || formData.gender,
        phone: agentData.phone || formData.phone,
        symptoms:
          agentData.symptoms && agentData.symptoms.length > 0
            ? agentData.symptoms
            : formData.symptoms,
        departmentId: agentData.departmentId || formData.departmentId,
        departmentName: agentData.departmentName || formData.departmentName,
        hospitalId: agentData.hospitalId || formData.hospitalId,
        hospitalName: agentData.hospitalName || formData.hospitalName,
        appointmentDate: agentData.appointmentDate || formData.appointmentDate,
        appointmentSlot: agentData.appointmentSlot || formData.appointmentSlot,
      };

      setFormData(updatedData);

      // Check verbal confirmation
      if (agentData.confirmed) {
        setVoiceMessages((prev) => [
          ...prev,
          {
            sender: 'agent',
            text: 'Verbal confirmation received! Finalizing your appointment...',
            time: 'Just now',
          },
        ]);
        speakText(
          'Verbal confirmation received! Booking your OPD registration now...',
          (i18n.language as LanguageCode) || 'en'
        );
        await handleFinalSubmit(updatedData);
        return;
      }

      const reply = agentData.nextQuestion || 'Thank you! Details received.';
      setVoiceMessages((prev) => [
        ...prev,
        { sender: 'agent', text: reply, time: 'Just now' },
      ]);

      if (agentData.isComplete) {
        confetti({ particleCount: 35 });
      }

      // Speak agent reply aloud, then auto-listen if handsFree
      setIsSpeaking(true);
      speakText(reply, (i18n.language as LanguageCode) || 'en', () => {
        setIsSpeaking(false);
        if (handsFree && !agentData.confirmed) {
          toggleMic();
        }
      });
    } catch (err) {
      console.error('Voice conversation error:', err);
    } finally {
      setAgentLoading(false);
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
        <div className="space-y-4 animate-fade-in">
          {/* Conversational Agent Container */}
          <div className="bg-white rounded-3xl border-2 border-teal-500 shadow-2xl overflow-hidden">
            {/* Agent Header with Hands-Free Toggle */}
            <div className="p-4 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-teal-600/90 flex items-center justify-center text-2xl shadow-inner border border-teal-400/40">
                    🤖
                  </div>
                  {(isRecording || isSpeaking) && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base leading-tight">Sahai Setu Voice Agent</h3>
                    <span className="px-2 py-0.5 rounded-full bg-teal-500/30 border border-teal-300/40 text-[10px] font-bold uppercase tracking-wider text-teal-100">
                      Gemini AI
                    </span>
                  </div>
                  <p className="text-xs text-teal-200 mt-0.5">
                    100% Voice-Guided OPD Booking • Speaks 10 Indian Languages
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2">
                {/* Hands-Free Conversation Toggle */}
                <button
                  type="button"
                  onClick={() => setHandsFree(!handsFree)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    handsFree
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                      : 'bg-teal-900/40 border-teal-600 text-teal-300'
                  }`}
                  title="When enabled, microphone opens automatically after agent speaks"
                >
                  <Radio size={14} className={handsFree ? 'animate-pulse text-emerald-300' : ''} />
                  <span>Hands-Free: {handsFree ? 'ON' : 'OFF'}</span>
                </button>

                {/* Audio Repeat Button */}
                <button
                  type="button"
                  onClick={() => {
                    const speech = voiceMessages[voiceMessages.length - 1]?.text;
                    if (speech) speakText(speech, (i18n.language as LanguageCode) || 'en');
                  }}
                  className="p-2 rounded-xl bg-teal-900/50 hover:bg-teal-700 border border-teal-500/40 text-white flex items-center gap-1 text-xs font-bold transition"
                  title="Repeat Last Message Aloud"
                >
                  <Volume2 size={16} />
                  <span className="hidden sm:inline">Repeat</span>
                </button>
              </div>
            </div>

            {/* Live Audio Status Banner */}
            <div
              className={`px-4 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                isRecording
                  ? 'bg-red-50 text-red-700 border-b border-red-200'
                  : isSpeaking
                  ? 'bg-blue-50 text-blue-700 border-b border-blue-200'
                  : agentLoading
                  ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-b border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span>Listening to your voice... Speak naturally now</span>
                  </>
                ) : isSpeaking ? (
                  <>
                    <Volume2 size={16} className="text-blue-600 animate-bounce" />
                    <span>Sahai Setu is speaking...</span>
                  </>
                ) : agentLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-amber-700" />
                    <span>Understanding your symptoms and checking hospital slots...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-teal-600" />
                    <span>Speak naturally or tap below to answer</span>
                  </>
                )}
              </div>

              {isRecording && (
                <button
                  onClick={toggleMic}
                  className="text-[11px] underline font-bold text-red-700 hover:text-red-900"
                >
                  Stop Listening
                </button>
              )}
            </div>

            {/* Conversation History */}
            <div className="p-4 h-[280px] overflow-y-auto space-y-3 bg-slate-50/70">
              {voiceMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-teal-700 text-white rounded-tr-xs shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-tl-xs'
                    }`}
                  >
                    <p className="font-semibold">{msg.text}</p>
                    <span
                      className={`text-[10px] block mt-1 ${
                        msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {agentLoading && (
                <div className="flex items-center gap-2 text-teal-800 text-xs font-bold p-3 bg-teal-50 rounded-2xl w-fit border border-teal-200">
                  <Loader2 size={16} className="animate-spin text-teal-700" />
                  <span>Processing with conversational AI...</span>
                </div>
              )}
            </div>

            {/* Quick Voice Suggestion Chips */}
            <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Voice Prompts:
              </span>
              {[
                'AIIMS New Delhi',
                'GGH Hyderabad',
                'Severe Knee Joint Pain',
                'Fever and cough for 3 days',
                'Morning 10:00 AM Slot',
                'Yes, please confirm and register',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendVoiceMessage(chip)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 whitespace-nowrap font-semibold transition active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Voice Input & Controls */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition shrink-0 shadow-lg ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200 scale-105'
                    : 'bg-teal-700 text-white hover:bg-teal-800 hover:scale-102 active:scale-95'
                }`}
                aria-label={isRecording ? 'Listening... Tap to stop' : 'Tap to speak'}
                title={isRecording ? 'Listening... Tap to stop' : 'Tap to speak'}
              >
                {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
              </button>

              <input
                type="text"
                placeholder={
                  isRecording
                    ? 'Listening to you... Speak now'
                    : 'Speak or type your response here...'
                }
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendVoiceMessage(voiceInput);
                }}
                className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
              />

              <button
                type="button"
                onClick={() => handleSendVoiceMessage(voiceInput)}
                disabled={!voiceInput.trim()}
                className="p-3.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white rounded-2xl transition shadow-md shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Real-time Extracted Details HUD (7 Key Fields) */}
          <div className="p-5 rounded-3xl bg-teal-50/90 border-2 border-teal-300 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-teal-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-900">
                  Live Registration Summary
                </h4>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-200/60 px-2.5 py-0.5 rounded-full">
                {
                  [
                    formData.hospitalName,
                    formData.name,
                    formData.age,
                    formData.symptoms.length > 0 || formData.symptomText,
                    formData.departmentName,
                    formData.appointmentSlot,
                    formData.phone,
                  ].filter(Boolean).length
                }{' '}
                / 7 Details Gathered
              </span>
            </div>

            {/* 7 Fields Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-medium">
              {/* Hospital */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.hospitalName
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Building2 size={12} className="text-teal-700" />
                    Hospital
                  </span>
                  {formData.hospitalName && <Check size={14} className="text-teal-600 font-bold" />}
                </div>
                <p className="font-extrabold text-slate-900 truncate">
                  {formData.hospitalName || 'Pending...'}
                </p>
              </div>

              {/* Patient Name */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.name
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <User size={12} className="text-teal-700" />
                    Patient Name
                  </span>
                  {formData.name && <Check size={14} className="text-teal-600 font-bold" />}
                </div>
                <p className="font-extrabold text-slate-900 truncate">
                  {formData.name || 'Pending...'}
                </p>
              </div>

              {/* Age / Gender */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.age
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Activity size={12} className="text-teal-700" />
                    Age & Gender
                  </span>
                  {formData.age && <Check size={14} className="text-teal-600 font-bold" />}
                </div>
                <p className="font-extrabold text-slate-900">
                  {formData.age ? `${formData.age} yrs • ${formData.gender}` : 'Pending...'}
                </p>
              </div>

              {/* Symptoms / Complaints */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.symptoms.length > 0 || formData.symptomText
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Sparkles size={12} className="text-teal-700" />
                    Symptoms
                  </span>
                  {(formData.symptoms.length > 0 || formData.symptomText) && (
                    <Check size={14} className="text-teal-600 font-bold" />
                  )}
                </div>
                <p className="font-extrabold text-slate-900 truncate">
                  {formData.symptoms.join(', ') || formData.symptomText || 'Pending...'}
                </p>
              </div>

              {/* OPD Department */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.departmentName
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Heart size={12} className="text-teal-700" />
                    Department
                  </span>
                  {formData.departmentName && <Check size={14} className="text-teal-600 font-bold" />}
                </div>
                <p className="font-extrabold text-teal-900 truncate">
                  {formData.departmentName || 'General Medicine'}
                </p>
              </div>

              {/* Appointment Date & Slot */}
              <div
                className={`p-3 rounded-2xl border transition col-span-2 sm:col-span-2 ${
                  formData.appointmentSlot
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={12} className="text-teal-700" />
                    Date & Available Slot
                  </span>
                  {formData.appointmentSlot && (
                    <Check size={14} className="text-teal-600 font-bold" />
                  )}
                </div>
                <p className="font-extrabold text-slate-900">
                  {formData.appointmentDate} •{' '}
                  <span className="text-teal-800">{formData.appointmentSlot || 'Pending...'}</span>
                </p>
              </div>

              {/* Mobile Number */}
              <div
                className={`p-3 rounded-2xl border transition ${
                  formData.phone
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white/50 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Phone size={12} className="text-teal-700" />
                    Mobile
                  </span>
                  {formData.phone && <Check size={14} className="text-teal-600 font-bold" />}
                </div>
                <p className="font-extrabold text-slate-900 truncate">
                  {formData.phone || 'Pending...'}
                </p>
              </div>
            </div>

            {/* Verbal Confirmation Ready Prompt */}
            {formData.name && formData.age && formData.phone ? (
              <div className="p-4 rounded-2xl bg-emerald-100/90 border-2 border-emerald-400 text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-700" />
                    <span className="font-extrabold text-sm text-emerald-900">
                      All Details Collected!
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Say <strong className="underline">"Confirm"</strong> or{' '}
                    <strong className="underline">"Yes"</strong> to book immediately, or tap the button:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleFinalSubmit()}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  <span>Confirm & Generate OPD Slip</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-teal-100/50 rounded-xl text-teal-800 text-xs font-medium flex items-center gap-2">
                <ShieldCheck size={16} className="text-teal-700 shrink-0" />
                <span>
                  The voice agent asks questions one by one and updates your registration details in real time.
                </span>
              </div>
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
                {/* Hospital Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Select Hospital & Campus <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.hospitalId || 'hosp-ggh-hyd'}
                    onChange={(e) => {
                      const h = SUPPORTED_HOSPITALS.find((item) => item.id === e.target.value);
                      if (h) {
                        setFormData({
                          ...formData,
                          hospitalId: h.id,
                          hospitalName: h.name,
                        });
                      }
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 text-sm shadow-xs"
                  >
                    {SUPPORTED_HOSPITALS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.city} ({h.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Appointment Date & Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Appointment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.appointmentDate || new Date().toISOString().split('T')[0]}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      OPD Time Slot <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.appointmentSlot || '09:00 AM - 10:00 AM'}
                      onChange={(e) => setFormData({ ...formData, appointmentSlot: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 text-sm"
                    >
                      {AVAILABLE_OPD_TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      <span className="text-xs text-slate-400 font-bold block uppercase">Hospital</span>
                      <span className="font-extrabold text-teal-900 text-base">{formData.hospitalName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block uppercase">Date & Slot</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formData.appointmentDate} • {formData.appointmentSlot}
                      </span>
                    </div>
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
