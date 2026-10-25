# 🏥 Sahai Setu (सहाय सेतु)
### *Smart Queue Management & Accessible Navigation for Government Hospitals*
**HackCache'26 — Problem Statement 2: Smart Hospital Queue & Navigation**

---

## 🌟 Executive Summary

Indian government hospitals (AIIMS, District Civil Hospitals, and Medical Colleges) serve thousands of OPD patients daily. The environment is frequently characterised by:
- Severe physical overcrowding and opaque, static paper-token queues.
- Inability to estimate wait times, causing patients to miss their turn when stepping away for drinking water or pharmacy runs.
- Language barriers across diverse patient demographics speaking regional languages.
- Complex multi-floor hospital layouts with no indoor GPS, disorienting elderly and illiterate patients.
- Fragmented records and lack of triage escalation for deteriorating patients.

**Sahai Setu ("Bridge of Help")** is an end-to-end, production-grade, accessible web platform built specifically to solve these challenges with dignity, empathy, and high reliability.

---

## 🚀 Key Features & Highlights

### 1. ♿ Radical Accessibility (WCAG 2.2 AA Target)
- **Persistent Floating Toolbar**: One-tap access from any page for:
  - 🚨 **Emergency**: Instant triage assessment & nurse station siren.
  - 🙋 **Need Help?**: Instant physical escort / wheelchair request.
  - 🔊 **Listen / Audio**: ElevenLabs AI TTS & Web Speech API fallback.
  - 🌐 **10 Indic Languages**: English, हिन्दी (Hindi), தமிழ் (Tamil), తెలుగు (Telugu), ಕನ್ನಡ (Kannada), മലയാളം (Malayalam), বাংলা (Bengali), मराठी (Marathi), ગુજરાતી (Gujarati), ਪੰਜਾਬੀ (Punjabi).
  - 🔠 **Font Size Scaling**: 3 distinct visual sizes (`Default`, `Large`, `Extra Large`).
  - 🪄 **Simple Mode**: Giant icons, high tap targets, minimal clutter for elderly and first-time smartphone users.

### 2. 📋 Frictionless Multimodal Registration
- **Guided 4-Step Form**: Visual icons, clear feedback, and automatic triage classification.
- **Conversational Voice Agent**: Speak symptoms naturally; Gemini AI parses age, gender, symptoms, recommends the exact department, and flags danger words.
- **ABHA 14-Digit Lookup**: Instant prefill via Ayushman Bharat Digital Mission (ABDM) integration (test OTP: `123456`).
- **Physical Paper Slip OCR**: Multimodal vision scan extracts OPD number, department, and doctor from legacy paper slips. Includes a 1-click **Sample OPD Slip** preset for evaluators.

### 3. ⏱️ Intelligent Queue Tracker & Grace Period
- **Dynamic Wait-Time Engine**: Considers rolling doctor consultation speeds and delay penalties instead of naive static counts.
- **10-Minute Step-Away Grace**: Patients can tap "Step away for 10 min" to visit the pharmacy, restroom, or canteen without forfeiting their spot in line.
- **End-to-End Journey Stepper**: Tracks the patient journey across Registration ➔ Doctor ➔ Lab ➔ Pharmacy ➔ Done.
- **Simulated SMS / WhatsApp Notifications**: Realistic mock delivery drawer showing SMS & WhatsApp alerts sent to the patient's phone.

### 4. 🗺️ Indoor Hospital Navigation & Landmark Finder
- **3-Floor Dijkstra Routing**: Full 3D topological graph across Floor 0 (Ground), Floor 1, and Floor 2 with Blocks A, B, and Central.
- **Accessible Routing Toggle**: Dynamically restricts pathfinding to elevators and ramps, completely avoiding stairs for wheelchair users.
- **Landmark-Based Directions**: Visual reference cues with pre-generated hospital landmark photography (`Water Cooler Point`, `Ficus Plant`, `Blue & Green Doors`, `Central Lifts`).
- **"I'm Lost" Visual Landmark Matcher**: One-tap visual selector allowing confused patients to re-localize themselves in seconds.

### 5. 🧑‍⚕️ Comprehensive Hospital Staff Dashboard (`/staff`)
- **Overview KPIs**: Total OPD footfall, average queue wait, active emergencies, and real-time department load with overcrowding alerts.
- **Counter Desk**: Register walk-in patients, print thermal OPD slips, and dispatch assistance escorts.
- **Doctor Room Console**: Single-click "Call Next" with Web Audio hospital chime, consultation stopwatch, and referral to Lab / Pharmacy.
- **Emergency Triage Panel**: Pulsing red alert banners with audible siren, Glasgow Coma / vitals assessment, and priority override.
- **Simulation Sandbox**: 1-click test scenarios for hackathon judges:
  - ⚡ *Add 10 Patients*
  - 🚦 *Simulate Rush Hour*
  - 🚨 *Trigger Emergency Alert*
  - ☕ *Doctor Takes a Break (Adds Delay)*
  - 🔄 *Reset Demo State*
- **ABDM & FHIR Compliance**: Google Cloud Healthcare FHIR R4 schema-compliant Patient, Appointment, and Encounter export.

### 6. 📺 Public Hospital TV Display Board (`/display`)
- High-resolution, full-screen display designed for hospital waiting-area TVs.
- Shows real-time "Now Serving" tokens, upcoming numbers by doctor room, and a multilingual emergency announcement ticker.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router v6, Lucide React, Canvas Confetti |
| **State & i18n** | Zustand, i18next (10 Indic Languages), `react-i18next` |
| **Backend** | Node.js, Express, TypeScript, Socket.IO (Real-time WebSockets), Zod, Multer |
| **Database** | High-performance in-memory database with automatic JSON disk persistence (`data/hospital_store.json`) seeded with 150+ realistic Indian patients |
| **AI & Vision** | Google Gemini API (`@google/genai`) for conversational registration & paper slip vision OCR; resilient rule-based engine fallback |
| **Audio & Speech** | ElevenLabs AI Text-to-Speech API, Web Speech API fallback, Web Audio API synthesis (hospital chime & emergency siren) |
| **Interoperability** | ABDM adapter (Ayushman Bharat Digital Mission), Google Cloud Healthcare FHIR R4 compliant schemas |

---

## ⚡ Quick Start & Run Instructions

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 2. Installation
Clone the repository and install all dependencies in one command:
```bash
npm run install:all
```
*(This installs root, `server/`, and `client/` packages).*

### 3. Environment Configuration (Optional)
The project works **out-of-the-box with zero required API keys** due to built-in fallback modes. To enable live Gemini API or ElevenLabs AI TTS, configure `.env` in the root:
```bash
cp .env.example .env
```
Key parameters:
- `GEMINI_API_KEY`: Google Gemini API key.
- `ELEVENLABS_API_KEY`: ElevenLabs TTS key.
- `ABDM_MOCK_MODE`: `true` (simulates ABDM profile lookup with OTP `123456`).
- `FHIR_MOCK_MODE`: `true` (generates standard FHIR R4 JSON bundles).

### 4. Seed the Database
Populate the database with 1 hospital, 12 departments, 20 doctors, and 150 realistic Indian patients:
```bash
npm run seed
```

### 5. Start the Application
Start both the backend server and the frontend client concurrently:
```bash
npm run dev
```
- **Frontend Web App**: `http://localhost:3000`
- **Backend API & WebSockets**: `http://localhost:5000`

### 6. Run Automated Test Suite
Run the unit test suite verifying wait-time calculations, Dijkstra pathfinding, wheelchair routing, and emergency escalation:
```bash
npm test
```
*(All tests pass 100%).*

---

## 🔑 1-Click Demo Accounts for Judges

The `/login` screen contains **1-click evaluator quick-fill buttons** for all roles:

| Role | Username | Password | Purpose |
|---|---|---|---|
| **Hospital Receptionist** | `receptionist` | `demo123` | Counter registration, slip printing, assistance dispatch |
| **OPD Doctor (Cardiology)** | `doctor_cardio` | `demo123` | Doctor console, calling next patient, lab/pharmacy referral |
| **Triage / ER Nurse** | `nurse_er` | `demo123` | Emergency triage desk, siren controls, priority assessment |
| **Hospital Administrator** | `admin` | `demo123` | Full dashboard KPIs, broadcasts, and simulation sandbox |
| **General Patient** | *(No login required)* | — | Direct self-service patient portal |

---

## 🎬 5-Step Demo Script for Judges

### Flow 1: High Accessibility & Multilingual Registration
1. Open `http://localhost:3000`.
2. Notice the **Floating Accessibility Bar** at the bottom.
   - Click the **Language Switcher** and select **हिन्दी (Hindi)** or **தமிழ் (Tamil)** to see instant multilingual rendering.
   - Click the **Font** icon (`A+`) to cycle through enlarged text modes.
   - Click **Simple Mode** to experience the simplified elderly interface.
3. Click **"New Registration / नया पंजीकरण"**.
4. Click the **"ABHA Lookup"** button (or enter `14-1234-5678-9012` and click *Fetch ABHA Profile*).
   - Notice the instant autofill of *Ramesh Kumar, 58, Male*, and phone number.
5. Alternatively, click **"AI Voice Agent"** and speak symptoms (or click a sample prompt like *"Severe chest pain and dizziness"*). Notice the automatic department suggestion and danger-word alert.
6. Submit the form to generate a **Digital OPD Slip** complete with QR code, assigned doctor, and room location.

### Flow 2: Physical Paper OPD Slip Vision OCR Scan
1. Navigate to `http://localhost:3000/scan`.
2. Click **"Use Sample Paper Slip (1-Click Preset)"**.
3. Click **"Process Slip with Vision AI"**.
4. Watch the OCR engine extract the OPD number, patient name, department, doctor, and room with confidence scores.
5. Click **"Import & Track Queue"** to jump straight into the live queue tracker!

### Flow 3: Live Queue Tracking & 10-Minute Step-Away Grace
1. Go to `http://localhost:3000/track/CARDIO-014` (or any active token from the registration step).
2. Review the live queue status:
   - Current serving token vs. your position.
   - Calculated estimated wait time with rolling explanation.
   - Visual multi-step journey (Registration ➔ Doctor ➔ Lab ➔ Pharmacy).
3. Click **"Step away for 10 min (Water / Restroom)"**:
   - Notice the status switches to `Stepped Away` with an active 10:00 countdown timer, preserving the patient's queue position without skipping them.
4. Open the **"Simulated SMS & WhatsApp"** drawer in the header to view live notifications sent to the patient.

### Flow 4: Interactive Indoor Navigation & "I'm Lost" Finder
1. Navigate to `http://localhost:3000/navigate`.
2. Select an origin (e.g. *Main Entrance*) and destination (e.g. *Cardiology - Room 19*), then click **"Find Route"**.
3. Watch the animated green path trace through the hospital floor plan.
4. Toggle the **"Accessible Route (Wheelchair/Elevator only)"** switch:
   - Notice the path dynamically re-routes away from stairs to the central elevator bank.
5. Switch floor tabs (**Floor 0, Floor 1, Floor 2**) to see multi-floor navigation.
6. Click **"I'm Lost! Find Landmark"**:
   - Choose a nearby visual marker (e.g. *Water Cooler* or *Ficus Plant*). The app immediately identifies your location and provides step-by-step guidance.

### Flow 5: Staff Operations, Triage Siren, & Simulation Sandbox
1. Navigate to `http://localhost:3000/login` and click **"Doctor (Cardiology)"** to log in.
2. In the **Doctor Room Console**:
   - Click **"Call Next Patient"**: Listen to the realistic two-tone hospital audio chime sound and watch the current token update.
   - Complete the consultation and select **"Refer to Lab"** or **"Refer to Pharmacy"**.
3. Log out and click **"Admin"** to open the Staff Dashboard.
4. Scroll to the **Simulation Sandbox** at the bottom:
   - Click **"Add 10 Patients"** to see queue counts surge in real-time.
   - Click **"Simulate Rush Hour"** to watch wait times recalculate dynamically.
   - Click **"Trigger Emergency Alert"**: Notice the flashing red banner across staff screens and the audio alert siren sounding.
5. Open `http://localhost:3000/display` in a new window to view the **Public Waiting Area TV Display Board** updating in real time via WebSockets!

---

## 🧪 Verification & Test Results

```
===============================================
  🏥 SAHAI SETU TEST SUITE
===============================================
--- RUNNING TEST: Queue Wait-Time Logic ---
Wait time adjusted with delay: initial=6m, delayed=32m
✓ Queue wait-time, doctor delay, and step-away grace logic passed.

--- RUNNING TEST: Dijkstra Pathfinding & Accessible Routing ---
Standard route to Ward 4 has 7 steps, distance: 72m
✓ Accessible routing successfully avoided stairs and used elevator.
✓ Fuzzy search matched Ward 4 and Room 12 accurately.

--- RUNNING TEST: Emergency Escalation & Danger Word Detection ---
✓ Multilingual danger keywords accurately detected in English, Hindi, and Tamil.
✓ Emergency escalation moved token to top priority with 0 wait time and notified triage desk.
===============================================
  ✅ ALL TESTS PASSED SUCCESSFULLY!
===============================================
```

---

## 🏛️ Architecture & Folder Structure

```
HackCache'26/
├── client/                      # React 18 + Vite + TypeScript Frontend
│   ├── public/
│   │   ├── landmarks/           # Pre-generated hospital AI landmark photography
│   │   ├── sample_slips/        # Sample OPD thermal paper slips for OCR testing
│   │   ├── logo.svg
│   │   └── manifest.json        # PWA configuration
│   ├── src/
│   │   ├── components/          # FloatingAccessibilityBar, Header, Modals, Drawers
│   │   ├── i18n/                # 10 Indic languages translation bundles
│   │   ├── pages/               # Landing, Register, SlipView, ScanSlip, TrackMyTurn,
│   │   │                        # Navigation, Emergency, StaffDashboard, DisplayBoard, Login
│   │   ├── store/               # Zustand stores (useAccessibilityStore, useQueueStore, useAuthStore)
│   │   └── utils/               # Web Audio API synthesizers, ElevenLabs TTS, Socket.IO
│   ├── tailwind.config.js
│   └── vite.config.ts
├── server/                      # Express + TypeScript + Socket.IO Backend
│   ├── data/                    # JSON snapshot persistent store
│   ├── src/
│   │   ├── routes/              # queue, navigation, registration, emergency, admin, reports, tts
│   │   ├── services/            # queue, navigation, ai, tts, abdm, fhir, notifications
│   │   ├── tests/               # Automated unit test suites
│   │   ├── db.ts                # In-memory database with disk snapshot persistence
│   │   ├── seed.ts              # 150-patient realistic data seeder
│   │   └── index.ts             # Express & Socket.IO server entry point
├── shared/                      # Shared types, constants, and hospital topology
│   ├── types.ts                 # Full TypeScript domain models
│   ├── constants.ts             # Departments, doctors, languages, mock ABHA records
│   └── hospitalData.ts          # 3-Floor graph nodes, edges, rooms, and landmarks
├── .env.example
├── package.json
└── README.md
```

---

## 🤝 Social Impact & Alignment with National Health Mission

Sahai Setu directly advances the vision of the **Ayushman Bharat Digital Mission (ABDM)** and the **National Digital Health Blueprint (NDHB)**:
1. **Reduces physical overcrowding**: Real-time wait estimates and step-away grace prevent corridor choke points.
2. **Promotes health equity**: Zero-literacy visual cues, 10 Indic languages, and voice assistance ensure no citizen is left behind.
3. **Optimizes hospital throughput**: Doctor consoles and automated triage dispatch resources to where they are needed most.

---

*Crafted with ❤️ for HackCache'26.*
