import { AIService } from '../services/ai.service';
import { TTSService } from '../services/tts.service';
import { QueueService } from '../services/queue.service';
import { db } from '../db';
import { Patient } from '../../../shared/types';

export async function testVoiceRegistrationLogic() {
  console.log('--- RUNNING TEST: Multilingual Voice & Conversational Registration ---');

  // 1. Test Neural Speech Synthesis across Indic languages
  const testLangs = ['en', 'hi', 'te', 'ta', 'gu'] as const;
  for (const lang of testLangs) {
    const res = await TTSService.synthesizeSpeech('Hello from Sahai Setu', lang);
    if (!res.audioBase64 || res.audioBase64.length < 500) {
      throw new Error(`TTS synthesis failed or returned empty audio for language: ${lang}`);
    }
  }
  console.log('✓ High-fidelity neural voice synthesis verified across English, Hindi, Telugu, Tamil, and Gujarati.');

  // 2. Test Conversational Extraction in Telugu
  const teluguTurn = await AIService.processRegistrationConversation(
    [
      {
        role: 'user',
        text: 'నా పేరు రమేష్ రావు, వయస్సు 48, మోకాలి నొప్పి, AIIMS ఆసుపత్రి, ఫోన్ 9876543210',
      },
    ],
    {},
    'te'
  );

  if (!teluguTurn.hospitalName) {
    throw new Error('Failed to extract hospital name from conversation turn');
  }
  if (!teluguTurn.nextQuestion || teluguTurn.nextQuestion.length < 5) {
    throw new Error('Failed to return localized question in Telugu');
  }
  console.log(`✓ Telugu conversational extraction and prompt verified: "${teluguTurn.nextQuestion.slice(0, 40)}..."`);

  // 3. Test Verbal Confirmation Detection
  const completeState = {
    name: 'Suresh Kumar',
    age: 50,
    gender: 'male' as const,
    phone: '9876543210',
    hospitalId: 'hosp-ggh-hyd',
    hospitalName: 'Government General Hospital (GGH)',
    departmentId: 'dept-ortho',
    departmentName: 'Orthopaedics',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentSlot: '10:00 AM - 11:00 AM',
    isComplete: true,
  };

  const confirmTurn = await AIService.processRegistrationConversation(
    [{ role: 'user', text: 'Yes, please confirm and register my appointment' }],
    completeState,
    'en'
  );

  if (!confirmTurn.confirmed) {
    throw new Error('Verbal confirmation failed to detect affirmative booking phrase');
  }
  console.log('✓ Verbal confirmation phrase "Yes, please confirm and register" successfully detected.');

  // 4. Test OPD Registration & Digital Slip Creation
  const patient: Patient = {
    id: `pat-test-${Date.now()}`,
    name: completeState.name,
    age: completeState.age,
    gender: completeState.gender,
    phone: completeState.phone,
    language: 'en',
    departmentId: completeState.departmentId,
    hospitalId: completeState.hospitalId,
    hospitalName: completeState.hospitalName,
    appointmentDate: completeState.appointmentDate,
    appointmentSlot: completeState.appointmentSlot,
    registrationMethod: 'self_voice',
    symptoms: ['Knee joint pain'],
    accessibilityNeeds: {},
    journeyStep: 'registration',
    registeredAt: new Date().toISOString(),
    opdNumber: `OPD-${new Date().getFullYear()}-9999`,
  };

  const { token, slip } = QueueService.enqueuePatient(patient, 'normal');
  if (!token.tokenNumber || !slip.id || !slip.hospitalName || !slip.appointmentSlot) {
    throw new Error('Failed to generate valid token and digital OPD slip');
  }
  console.log(`✓ Digital OPD slip generated successfully: Token ${token.tokenNumber}, Slip ID ${slip.id}`);
}
