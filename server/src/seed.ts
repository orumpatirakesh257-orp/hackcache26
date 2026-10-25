import { db } from './db';
import { QueueService } from './services/queue.service';
import { FHIRService } from './services/fhir.service';
import { DEPARTMENTS_DATA, DOCTORS_DATA } from '../../shared/constants';
import {
  Patient,
  LanguageCode,
  Gender,
  RegistrationMethod,
  PriorityLevel,
} from '../../shared/types';

const INDIAN_FIRST_NAMES_MALE = [
  'Aarav', 'Ramesh', 'Suresh', 'Amit', 'Rajesh', 'Manoj', 'Vikram', 'Prakash', 'Sunil', 'Anil',
  'Deepak', 'Vijay', 'Karthik', 'Sanjay', 'Santosh', 'Mahesh', 'Ganesh', 'Raghav', 'Arun', 'Mohan',
  'Pradeep', 'Ashok', 'Kishore', 'Naveen', 'Harish', 'Gopal', 'Shyam', 'Mukesh', 'Hemant', 'Vinod',
];

const INDIAN_FIRST_NAMES_FEMALE = [
  'Priya', 'Sunita', 'Lakshmi', 'Anjali', 'Meena', 'Pooja', 'Kavita', 'Geeta', 'Rekha', 'Sarita',
  'Sangeeta', 'Shobha', 'Anita', 'Asha', 'Deepa', 'Radha', 'Sneha', 'Swati', 'Preeti', 'Jyoti',
  'Sudha', 'Usha', 'Lata', 'Shashi', 'Manju', 'Mamta', 'Suman', 'Bhavna', 'Ritu', 'Kiran',
];

const INDIAN_LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Yadav', 'Rao', 'Reddy', 'Nair',
  'Iyer', 'Sengupta', 'Chatterjee', 'Deshmukh', 'Kulkarni', 'Joshi', 'Chauhan', 'Mishra', 'Pandey', 'Balan',
  'Das', 'Bose', 'Menon', 'Pillai', 'Gowda', 'Hegde', 'Mehta', 'Shah', 'Agarwal', 'Bhatia',
];

const COMMON_SYMPTOMS_BY_DEPT: Record<string, string[][]> = {
  'dept-gen-med': [
    ['Fever and chills for 3 days', 'Severe headache'],
    ['Chronic dry cough', 'Throat irritation'],
    ['General body weakness', 'Loss of appetite'],
    ['Stomach ache after meals', 'Acidity'],
  ],
  'dept-ortho': [
    ['Right knee joint swelling and severe walking pain'],
    ['Lower back pain radiating to left leg'],
    ['Shoulder stiffness after lifting heavy object'],
    ['Twisted ankle with bruising'],
  ],
  'dept-paed': [
    ['High grade fever in 4-year-old child', 'Vomiting'],
    ['Routine 18-month vaccination checkup', 'Mild cough'],
    ['Infant stomach colic and restlessness'],
  ],
  'dept-gyn': [
    ['Second trimester routine antenatal checkup', 'Ultrasound review'],
    ['Irregular menstrual bleeding and lower abdominal cramps'],
    ['Pelvic heaviness and backache in 28-week pregnancy'],
  ],
  'dept-ent': [
    ['Right ear acute pain and yellowish discharge'],
    ['Nasal blockage, sinus pressure, and morning sneezing'],
    ['Severe throat soreness and pain when swallowing'],
  ],
  'dept-eye': [
    ['Gradual blurring of distant vision in left eye'],
    ['Redness, itching, and watering in both eyes'],
    ['Foreign body sensation after dust entered eye'],
  ],
  'dept-derma': [
    ['Itchy red ring-shaped rash on neck and forearms'],
    ['Fungal infection between toes with peeling skin'],
    ['Dry scaly eczema flare-up on hands'],
  ],
  'dept-dental': [
    ['Throbbing toothache in lower right molar'],
    ['Bleeding gums while brushing and bad breath'],
    ['Loose premolar tooth with mild gum swelling'],
  ],
  'dept-cardio': [
    ['High blood pressure follow-up (BP 150/95)', 'Mild dizziness'],
    ['Occasional palpitations and chest heaviness after climbing stairs'],
  ],
  'dept-surgery': [
    ['Painful groin bulge when standing (suspected hernia)'],
    ['Post-drainage wound dressing change'],
  ],
  'dept-lab': [
    ['Routine fasting blood sugar and lipid profile'],
    ['CBC and dengue platelet count check'],
  ],
  'dept-pharmacy': [
    ['Collecting monthly government hypertension medication'],
    ['Prescription medicine collection for fever and antibiotics'],
  ],
};

const LANGUAGES: LanguageCode[] = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu', 'pa'];

export function generateSeedData(count: number = 150) {
  console.log(`Seeding database with 1 hospital, 12 departments, 20 doctors, and ${count} realistic patients...`);

  db.resetStore();
  const store = db.getStore();

  const registrationMethods: RegistrationMethod[] = [
    'self_guided',
    'self_voice',
    'abha',
    'assisted',
    'paper_scan',
  ];

  for (let i = 1; i <= count; i++) {
    const isMale = Math.random() > 0.48;
    const firstName = isMale
      ? INDIAN_FIRST_NAMES_MALE[Math.floor(Math.random() * INDIAN_FIRST_NAMES_MALE.length)]
      : INDIAN_FIRST_NAMES_FEMALE[Math.floor(Math.random() * INDIAN_FIRST_NAMES_FEMALE.length)];
    const lastName = INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;

    const age = Math.floor(Math.random() * 68) + 4; // 4 to 72
    const gender: Gender = isMale ? 'male' : 'female';
    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const opdNumber = `OPD-2026-${(1000 + i).toString()}`;
    const language = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
    const regMethod = registrationMethods[Math.floor(Math.random() * registrationMethods.length)];

    // Assign department
    const dept = DEPARTMENTS_DATA[Math.floor(Math.random() * DEPARTMENTS_DATA.length)];
    const symptomList = COMMON_SYMPTOMS_BY_DEPT[dept.id] || [['General health consultation']];
    const symptoms = symptomList[Math.floor(Math.random() * symptomList.length)];

    // Priority
    let priority: PriorityLevel = 'normal';
    if (age >= 60) priority = 'senior';
    else if (!isMale && age >= 20 && age <= 38 && dept.id === 'dept-gyn') priority = 'pregnant';
    else if (Math.random() < 0.05) priority = 'disabled';

    const patient: Patient = {
      id: `pat-${i}`,
      opdNumber,
      name,
      age,
      gender,
      phone,
      language,
      symptoms,
      departmentId: dept.id,
      registeredAt: new Date(Date.now() - Math.floor(Math.random() * 6 * 3600 * 1000)).toISOString(),
      registrationMethod: regMethod,
      accessibilityNeeds: {
        wheelchair: priority === 'disabled' || (age > 65 && Math.random() < 0.3),
        escort: age > 70,
        readingHelp: Math.random() < 0.1,
      },
      journeyStep: 'doctor',
    };

    store.patients.push(patient);

    // Enqueue patient
    const { token, slip } = QueueService.enqueuePatient(patient, priority);

    // Register FHIR resources
    FHIRService.createFHIRPatient(patient);
    FHIRService.createFHIRAppointment(token, slip);
    FHIRService.createFHIREncounter(token, slip);

    // Simulate completion for first ~40% of patients
    if (i <= Math.floor(count * 0.4)) {
      token.status = 'done';
      token.completedAt = new Date(Date.now() - (count - i) * 120 * 1000).toISOString();
      patient.journeyStep = 'completed';
    }
  }

  // Seed sample Emergency Alert in triage desk
  store.emergencyAlerts.push({
    id: 'emerg-seed-1',
    patientName: 'Kishore Kumar',
    location: 'Waiting Hall near Water Point',
    flaggedSymptoms: ['Severe acute chest pain', 'Profuse sweating', 'Shortness of breath'],
    priority: 'critical',
    status: 'flagged',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    nurseNotes: 'Red alert received from kiosk sensor; emergency team alerted',
  });

  store.emergencyAlerts.push({
    id: 'emerg-seed-2',
    patientName: 'Geeta Devi',
    location: 'OPD Counter 2',
    flaggedSymptoms: ['Deep bleeding laceration on forearm from fall'],
    priority: 'urgent',
    status: 'acknowledged',
    timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    nurseNotes: 'Triage nurse acknowledged; dressing team assigned',
  });

  // Seed sample Assistance Requests
  store.assistanceRequests.push({
    id: 'asst-seed-1',
    patientName: 'Santosh Rao (74 yrs)',
    location: 'Kiosk 1 (Main Entrance)',
    type: 'wheelchair',
    language: 'kn',
    status: 'pending',
    requestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  });

  store.assistanceRequests.push({
    id: 'asst-seed-2',
    patientName: 'Meena Sharma',
    location: 'Corridor B (Floor 1)',
    type: 'reading_help',
    language: 'hi',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    acceptedBy: 'Suresh Verma (Counter 2)',
  });

  // Recalculate all queues
  DEPARTMENTS_DATA.forEach((d) => {
    QueueService.recalculateDepartmentQueue(d.id);
  });

  db.persist();
  console.log(`Seeding complete! ${store.patients.length} patients and ${store.tokens.length} queue tokens generated.`);
}

if (require.main === module) {
  generateSeedData(150);
}
