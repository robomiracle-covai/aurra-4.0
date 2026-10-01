# KNOWLEDGE TRANSFER (KT) & TECHNICAL ANALYSIS DOSSIER
## APPLICATION 4: AURRA 4.0 AUTONOMOUS SERVICE ROBOT & INTERACTIVE KIOSK APPLICATION (`aurra_v`)

```yaml
Document ID: RM-KT-DOC-04
Project Name: Aurra 4.0 Autonomous AI Interactive Service Robot Application (RoboMiracle Aurra Kiosk)
Repository Location: d:\RAGUNATH\aurra\aurra_v
GitHub Remote: https://github.com/robomiracle-covai/aurra-4.0.git
Active Branches: main | developer | feat/aitalk29sep
Version: 4.0.0 (Production Release / Tablet Kiosk & Standalone Web)
Primary Tech Stack: React 19, Vite 6, Android Capacitor 6 Container, Google Gemini 1.5 Flash LLM, Groq LLM (Llama 3.3 70B), Serper.dev Google Search RAG, Open-Meteo Live Weather API, ElevenLabs Neural Voice Engine, HTML5 Web Speech API (STT/TTS), Dexie.js 4 (IndexedDB Schema v5), Face-API.js (TinyFace/SSD), ESP32 Kinematic Controller (Serial/Wi-Fi/BLE), Raspberry Pi Expression Engine, Lucide React, QRCode
Target Hardware: Waveshare 12" 1920×1080 Full HD Capacitive Touch Display / Redmi Pad 2 Tablet (MediaTek Helio G100, ARM64), 25.9V 31.5Ah Li-ion Battery, 29.4V 5A Charger, 5 DOF Motors, 100mm Casters, Fielect 20W Loudspeaker, Crystal Pro USB Camera
KT Provider (Senior): Senior Robotics Software Engineer / Lead AI Developer (Robomiracle Technologies)
KT Recipient (Successor): Incoming Software Engineer / Associate (Robotics & AI Application)
Target Recipient for Submission: Human Resources Department (HR), Engineering Leadership, & Product Operations
Document Purpose: Complete Architectural Analysis, Code Structure Blueprint, Hardware-Software Integration Protocols, Real-Time AI & RAG Engines, Android Build & Deployment Playbook, and Formal HR Handover Checklist
```

---

## 1. EXECUTIVE SUMMARY & BUSINESS CONTEXT

### 1.1 Business Purpose & Mission
**Aurra 4.0** is the flagship autonomous humanoid interactive service robot engineered by **Robomiracle Technologies Private Limited**, headquartered in RS Puram, Coimbatore, Tamil Nadu. Aurra represents a transformative leap in commercial service robotics, human-robot interaction (HRI), and artificial intelligence for high-traffic public, healthcare, academic, and corporate settings.

The primary mission of the `aurra_v` application is to provide an all-in-one smart control, live customer management, multimodal perception, and conversational AI interface. Operating as a hardware-accelerated kiosk shell on Aurra’s chest-mounted touch display, `aurra_v` serves as the central cognitive and physical interaction hub for:

1. **Autonomous Facility Greeting & Wayfinding:** Welcoming visitors by name using client-side biometric facial recognition, answering institutional inquiries, and leading guests via waypoint-guided robot tours.
2. **Real-Time Contextual Intelligence (RAG):** Answering queries with up-to-the-minute live information—such as local Coimbatore weather conditions, instant hardware clock time in IST with 0ms latency, and live web search via Google Serper.dev—without hallucinating or relying on stale pre-trained LLM data.
3. **Automated Visitor Registration & Digital Badging:** Streamlining visitor check-ins with on-screen identity input, photo capture, biometric face enrollment, and instant offline QR badge generation.
4. **Physical Robot Teleoperation & Diagnostics:** Providing sales engineers, operators, and maintenance staff with an on-screen robot cockpit featuring dual touch joysticks, 5-axis servo articulators (neck pan/tilt and auxiliary arms), ultrasonic obstacle radar visualizers, and battery telemetry.
5. **Interactive Robotic Lineup Showcase:** Touring prospective customers through Robomiracle's complete product ecosystem (Aurra 4.0, Nila Hospitality Robot, Dine Autonomous Delivery Robot, Nova Industrial AGV, Nexus Humanoid, and Unitree Go2 Quadruped).

---

### 1.2 Evolution: From Aurra 1.0/2.0/3.0 to Aurra 4.0 (`aurra_v`)

The Aurra software architecture evolved through four iterative generations to achieve high-performance real-time execution on resource-constrained embedded edge hardware:

| Architectural Dimension | Aurra 1.0 (Initial Prototype) | Aurra 2.0 / 3.0 (Kiosk Evolution) | Aurra 4.0 (`aurra_v` Current Release) |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Static HTML / Basic JS scripts | React 18 with client-side routing | **React 19 + Vite 6** with custom GPU CSS and zero-overhead routing |
| **Conversational AI** | Hardcoded keyword if-else branches | Basic Groq Cloud LLM queries | **Hybrid Multi-Tier Orchestrator:** Google Gemini 1.5 Flash + Groq Llama 3.3 70B with System Prompt Injection & Context Truncation |
| **Live Information (RAG)**| None (Stale training cutoff) | Hardcoded static fallback strings | **Automated Real-Time RAG:** Serper.dev Google Search + Open-Meteo Weather API + 0ms Local Clock Intent |
| **Voice & Speech Engine** | Default OS Web Speech Synthesis | Fixed browser voice synthesis | **Dual-Engine Pipeline:** ElevenLabs Ultra-Realistic Neural TTS + Web Speech API fallback + Full-Duplex Interruption |
| **Motor & Hardware Link** | Blocking single-threaded HTTP | Raw fetch requests with high jitter | **Resilient Hardware Dispatcher:** Non-blocking AbortController (300ms timeout), SoftAP + Station Wi-Fi + Serial bridges |
| **Physical Gestures** | Static robot posture during speech | Manual trigger buttons in debug mode | **Synchronized Kinematics:** Automatic servo head tilts, nods, and arm animation coordinated with speech audio playback |
| **Data Persistence** | Volatile in-memory variables | Basic LocalStorage (5MB cap) | **Dexie.js IndexedDB Schema v5:** 100% offline data resilience, CSV visitor export, JSON full database backup/restore |
| **Admin Configuration** | Hardcoded source code constants | Simple PIN-protected settings page | **Master Kiosk Control Panel:** 4-tap secret trigger, live audio pitch/rate tuner, face threshold slider, and live system prompt editor |
| **Packaging & Shell** | Desktop Chrome Browser window | Basic Android Webview wrapper | **Native Capacitor 6 Android APK:** Fullscreen immersive kiosk, locked landscape orientation, hardware audio routing |

---

### 1.3 Key Hardware & Physical Specifications

Aurra 4.0’s software application directly couples with the industrial robotics hardware specified in the official Robomiracle engineering documentation:

```
+---------------------------------------------------------------------------------------------------+
|                                  AURRA 4.0 PHYSICAL SPECIFICATIONS                                |
+---------------------------------------------------------------------------------------------------+
| Subsystem              | Engineering Specification                                                |
+------------------------+--------------------------------------------------------------------------+
| High-Endurance Power   | 25.9V / 31.5Ah Lithium-Ion Battery Pack with internal smart BMS           |
| Rapid Charging Unit    | 29.4V / 5.0A High-Current Smart Charger with auto cutoff                 |
| Interactive Display    | Waveshare 12-inch 1920×1080 Full HD Capacitive Touchscreen (or Tablet)   |
| Primary Compute Shell  | Redmi Pad 2 (MediaTek Helio G100 ARM64, 60-90 FPS GPU) / Embedded Linux  |
| Kinematics & Actuation | 5 Degrees of Freedom (DOF): Dual differential base drive + Pan/Tilt neck |
| Locomotion Hardware    | 100 mm Heavy-Duty Dual-Bearing Industrial Caster Wheels                  |
| High-Fidelity Acoustic | Fielect 8-Ohm 20W 78mm External Neodymium Magnet Loudspeaker (Vocal-tuned)|
| Optical Perception     | Crystal Pro USB Web Camera: 3P Optical Lens, Night Vision, Built-in Mic  |
| Obstacle Radar         | Multi-point Ultrasonic Transducers (10cm - 400cm detection, 25cm braking)|
| Active Cooling System  | Dual-ducted forced air ventilation ensuring continuous 24/7 duty cycle   |
| Dual-Mode Teleop       | 2.4 GHz Physical RC Handheld Remote Controller & Wi-Fi Web/Mobile App    |
| Corporate Identity     | Robomiracle Technologies Pvt Ltd, RS Puram, Coimbatore, Tamil Nadu       |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. SYSTEM ARCHITECTURE & INTEGRATION ECOSYSTEM

The Aurra 4.0 architecture is structured as a **5-tier edge-cloud hybrid platform**. The architecture prioritizes **zero-latency local execution** for mission-critical robot tasks (navigation, emergency braking, speech recognition, local time) while selectively querying cloud endpoints for advanced generative intelligence and web search.

### 2.1 Multi-Tier Hybrid Robot Architecture

```
+---------------------------------------------------------------------------------------------------+
|                             TIER 1: PHYSICAL HUMAN-ROBOT INTERACTION                              |
|  - 12" Full HD Capacitive Touch  - Crystal Pro HD Camera  - Fielect 20W Speaker  - Stereo Mic Array |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                             TIER 2: REACT 19 / VITE 6 KIOSK SHELL                                 |
|  - SliderAndCards.jsx (Home)    - TestingInteractionModeView.jsx    - AdminDashboard.jsx          |
|  - VisitorRegistration.jsx      - GuidedTourView.jsx                - QuestionAnswerView.jsx      |
|  - FaceRecognition.jsx          - Robot Control Cockpit             - WebLinks QR Hub             |
+---------------------------------------------------------------------------------------------------+
       |                                          |                                         |
       v                                          v                                         v
+-----------------------+     +---------------------------------------+     +-----------------------+
|  TIER 3: PERSISTENCE  |     |      TIER 4: REAL-TIME AI ORCHESTRATOR |     |   TIER 5: HARDWARE    |
|  - Dexie.js Schema v5 |     |  - llmService.js (Gemini / Groq)      |     |  - esp32Service.js    |
|  - userFaces (Biomet) |     |  - ragSearchService.js (Serper/Meteo) |     |  - 5 DOF Motor Con.   |
|  - visitors (Logs)    |     |  - 0ms Local Clock Intent Engine      |     |  - Ultrasonic Radar   |
|  - chatHistory        |     |  - elevenLabsService.js (Neural Audio)|     |  - RGB Eye Status     |
|  - kioskConfigStore   |     |  - faceApiHelper.js (WebGL Face Embed)|     |  - RPi HDMI Screen    |
+-----------------------+     +---------------------------------------+     +-----------------------+
```

---

### 2.2 Hardware Communication Buses & Protocols

#### A. ESP32 Microcontroller Subsystem (Chassis Motors, Servos & Safety Radar)
The low-level motor drives and animatronics are controlled by an onboard ESP32 running an embedded FreeRTOS firmware server. The React frontend interacts with the microcontroller using asynchronous non-blocking HTTP REST and WebSocket primitives:

1. **Network Modes:**
   - **SoftAP Hotspot Mode (Default):** SSID: `Aurra` | WPA2 Key: `12345678` | Static IP: `http://192.168.4.1`
   - **Station Infrastructure Mode:** Joined to the local facility Wi-Fi router (e.g. `http://192.168.1.150`). Configurable dynamically via `POST /wifi/connect`.
2. **Chassis Locomotion Endpoints:**
   - `GET /motor?cmd=forward&speed=180` (Valid commands: `forward`, `backward`, `left`, `right`, `stop`. Speed: `0` to `255`).
3. **Animatronic Servo Articulation Endpoints:**
   - `GET /servo?num=1&angle=90` (Servo 1: Head Tilt `0°-180°`, Default `90°`).
   - `GET /servo?num=2&angle=90` (Servo 2: Head Pan `0°-180°`, Default `90°`).
   - `GET /servo?num=3..5&angle=0..180` (Auxiliary arms and interactive expressive linkages).
4. **RGB Status Eye LEDs:**
   - `GET /rgb?r=0&g=255&b=255` (Cyan = Listening, Green = Active Speech, Red = Obstacle Warning, Blue = Idle).
5. **Ultrasonic Collision Radar:**
   - `GET /distance` -> Returns JSON `{ "front": 42.5, "rear": 120.0 }` (cm).
   - **Emergency Dead-Stop Protocol:** If front proximity drops below the safety threshold (default: `25 cm`), the motor controller executes an immediate firmware-level emergency brake, overriding incoming forward drive commands.

#### B. Raspberry Pi Auxiliary Expression Display (`raspberryPiService.js`)
On Aurra units equipped with an auxiliary HDMI-driven animated face screen, an embedded Raspberry Pi runs a lightweight web server on port `8080`:
- **Animated States:** `smile.gif`, `Speaking_Smile.gif`, `angry.gif`, `love.gif`, `nod`, `bow`, `dance`.
- **Speech Lip-Sync:** When `speechSynthesis` or ElevenLabs begins streaming audio, `raspberryPiService.setSpeechActive(true)` immediately triggers `Speaking_Smile.gif`. When audio terminates, it returns to the quiescent `smile.gif`.

---

## 3. CODE STRUCTURE & FILE DIRECTORY BLUEPRINT

The `aurra_v` repository follows a modular, feature-based React architecture with clean separation between UI components, hardware services, database models, and AI engines:

```
aurra_v/
├── android/                             # Native Android Studio Capacitor Project
│   ├── app/
│   │   ├── build.gradle                 # Android SDK 34, application ID com.robomiracle.testingapp
│   │   └── src/main/
│   │       ├── AndroidManifest.xml      # Camera, Audio, Internet, NetworkState permissions
│   │       └── java/com/robomiracle/aurra1/MainActivity.java
│   └── gradlew.bat                      # Gradle wrapper for CLI APK builds
├── public/                              # Static Kiosk Assets & Robot Lineup Media
│   ├── aurra/                           # Aurra 4.0 high-res photography, logos & expressions
│   ├── nila/                            # Nila Hospitality Robot showcase assets
│   ├── dine/                            # Dine Autonomous Delivery Robot media
│   ├── nova/                            # Nova Industrial AGV showcase media
│   ├── nexus/                           # Nexus Humanoid robotics photography
│   ├── g1/                              # Unitree Go2 Quadruped assets
│   └── models/                          # Face-API.js Pre-trained neural weights
│       ├── tiny_face_detector_model-weights_manifest.json
│       ├── face_landmark_68_model-weights_manifest.json
│       └── face_recognition_model-weights_manifest.json
├── src/
│   ├── App.css                          # Global cybernetic design tokens, voice bar clearance
│   ├── App.jsx                          # Main router, route transitions, Admin drawer listener
│   ├── index.css                        # Hardware-accelerated CSS resets, custom scrollbars
│   ├── main.jsx                         # React 19 root bootstrap & error boundary
│   │
│   ├── api/                             # Network clients & backend adapters
│   │   ├── client.js                    # Axios instance with timeout and retry handlers
│   │   └── faces.js                     # Remote face sync adapter
│   │
│   ├── components/                      # Reusable Kiosk UI Modules
│   │   ├── AdminAuthModal.jsx           # 4-digit PIN authentication modal with master recovery
│   │   ├── AdminChatHistoryView.jsx     # Visual audit log of all human-robot voice dialogues
│   │   ├── AdminDrawer.jsx              # Off-canvas engineering & diagnostics navigation
│   │   ├── FaceEnrollmentModal.jsx      # Live camera capture & face embedding calculator
│   │   ├── ImageGalleryModal.jsx        # Enterprise asset picker for robot tour stops
│   │   ├── ImageSelectorField.jsx       # Form control for picking or uploading media
│   │   ├── InteractionAvatar.jsx        # Lottie/SVG animated AI face with speaking states
│   │   ├── InteractionChatView.jsx      # Scrollable conversational transcript with bubble UI
│   │   ├── LogViewerModal.jsx           # Real-time console log & network traffic inspector
│   │   └── VoiceAssistantBar.jsx        # Fixed global floating voice bar with live mic meter
│   │
│   ├── config/
│   │   └── config.js                    # Global build constants, default ports, and endpoints
│   │
│   ├── data/                            # Static Knowledge Bases & Fallback Catalogs
│   │   ├── defaultCards.js              # 9 primary kiosk home tiles (Form, Q&A, Tour, Web, etc.)
│   │   ├── defaultQuestions.js          # Preloaded campus & organizational FAQ database
│   │   ├── defaultRobotTours.js         # Curated robot showcase tours (Aurra, Nila, Nova, Dine)
│   │   ├── defaultTourStops.js          # Physical facility waypoints and descriptions
│   │   └── galleryAssets.js             # Asset registry for bundled photography
│   │
│   ├── db/                              # Client-Side Persistence Layer
│   │   ├── dexieDb.js                   # Dexie.js Schema v5 definition (7 relational tables)
│   │   └── offlineServices.js           # Database queries, CSV generators & JSON migration
│   │
│   ├── hooks/                           # Custom React Hooks
│   │   ├── useCamera.js                 # MediaDevices WebRTC camera stream controller
│   │   └── useSpeech.js                 # Web Speech API recognition & synthesis hook
│   │
│   ├── pages/                           # Full-Page Kiosk Views & User Workflows
│   │   ├── Admin/
│   │   │   ├── AdminDashboard.jsx       # Master 7-tab control center (Voice, Face, Form, ESP)
│   │   │   └── AdminDashboard.css       # Holographic cyber UI styling for admin portal
│   │   ├── AiChat/
│   │   │   └── AiChatView.jsx           # Standalone high-throughput text/voice chat console
│   │   ├── Cards/
│   │   │   ├── SliderAndCards.jsx       # Primary Home Screen: 9 feature tiles + dynamic banner
│   │   │   └── SliderAndCards.css       # Smooth 90 FPS grid styling with active hover glows
│   │   ├── Control/
│   │   │   ├── Control.jsx              # Manual teleoperation cockpit with dual virtual sticks
│   │   │   └── Control.css              # Low-latency touch joystick controls & radar meters
│   │   ├── FaceRecognition.jsx          # Fullscreen biometric kiosk scanner & auto-greeting
│   │   ├── GuidedTour/
│   │   │   ├── GuidedTourView.jsx       # Waypoint navigation & multimedia tour guide system
│   │   │   └── GuidedTourView.css       # Full-bleed audio-visual tour presentations
│   │   ├── Hardware/
│   │   │   └── HardwareConnection.jsx   # Microcontroller IP discovery & ping benchmark tool
│   │   ├── Interaction/
│   │   │   ├── InteractionModeView.jsx  # Standard visitor voice dialogue & avatar view
│   │   │   ├── TestingInteractionModeView.jsx # Advanced Diagnostics Console: Live prompt editor,
│   │   │   │                            # 0ms clock verification, live weather & Serper badges
│   │   │   └── TestingInteractionModeView.css # Inspector styles, split panels & status tags
│   │   ├── Questions/
│   │   │   └── QuestionAnswerView.jsx   # Interactive touch & voice institutional FAQ explorer
│   │   ├── Registration/
│   │   │   └── VisitorRegistration.jsx  # 4-stage visitor check-in, photo, & digital QR pass
│   │   └── WebLinks/
│   │       ├── WebLinks.jsx             # Offline QR code generator for corporate collateral
│   │       └── weblinksData.js          # Default URLs (Robomiracle portal, brochures, videos)
│   │
│   ├── services/                        # Core AI, Hardware & Telemetry Business Logic
│   │   ├── chatHistoryService.js        # Relational conversation logging with search filters
│   │   ├── devSettingsService.js        # Diagnostic toggles & developer mode bypass flags
│   │   ├── elevenLabsService.js         # ElevenLabs Neural Voice API client & audio stream player
│   │   ├── esp32Service.js              # Non-blocking REST client for motors, servos & radar
│   │   ├── hardwareDispatcher.js        # Abstracted communication bus (Serial/Wi-Fi/Simulated)
│   │   ├── kioskConfigService.js        # Reactive configuration store with auto-save
│   │   ├── llmService.js                # Gemini 1.5 & Groq orchestrator with prompt injection
│   │   ├── logger.js                    # Structured logger with severity levels & ring buffer
│   │   ├── ragSearchService.js          # Real-time search engine: Serper.dev, Open-Meteo & Clock
│   │   ├── raspberryPiService.js        # Auxiliary HDMI face display expression driver
│   │   └── voiceNavigationService.js    # Speech intent parser, route dispatcher & interruption
│   │
│   └── utils/                           # Low-Level Helper Libraries
│       ├── androidNativeHttp.js         # Native Android HTTP bridge bypassing WebView CORS
│       ├── faceApiHelper.js             # Face-API model loaders, canvas drawers & matcher
│       ├── faceEmbeddingHelper.js       # 128D vector cosine/euclidean distance calculators
│       ├── mediaUtils.js                # Canvas image cropping, aspect ratio & base64 utils
│       ├── platform.js                  # Runtime detector (Capacitor Native vs Chrome Browser)
│       ├── speakingGestures.js          # Synchronized servo neck nods during speech output
│       └── speechSynthesis.js           # Browser SpeechSynthesis wrapper with voice selection
│
├── aurra spec sheet.md                  # Master hardware, battery, and identity spec sheet
├── package.json                         # Node dependencies, Vite build scripts
└── vite.config.js                       # Build pipeline, asset optimization, port config
```

---

## 4. CORE TECHNICAL MECHANISMS & WORKFLOWS

### 4.1 Three-Tier Intent & Knowledge Retrieval Engine (RAG Pipeline)

When a user speaks to Aurra, the utterance passes through a high-performance **3-tier hierarchical resolution pipeline** designed to provide instant responses for local actions while delivering real-time factual accuracy for open-domain questions:

```
[ User Voice Utterance ]
           |
           v
+-----------------------------------------------------------------------------------------+
| TIER 1: 0ms HARDWARE INTENT & LOCAL CLOCK (voiceNavigationService.js)                   |
| - Regex Match: "time", "what is the time", "date", "clock", "battery", "stop", "admin"   |
| - Action: Read device RTC -> Synthesize: "The current time is 10:45 PM on Thursday..."  |
| - Latency: < 2 milliseconds (100% Offline, Zero Cloud Cost, Zero Hallucination)         |
+-----------------------------------------------------------------------------------------+
           | (If no local intent matched)
           v
+-----------------------------------------------------------------------------------------+
| TIER 2: 3ms OFFLINE INDEXEDDB KNOWLEDGE BASE (offlineServices.js)                       |
| - Tokenized Jaccard similarity search against preloaded campus FAQ database             |
| - Queries: Admissions, Fees, Campus Locations, Facilities, Management Contacts          |
| - Latency: < 5 milliseconds (100% Offline)                                              |
+-----------------------------------------------------------------------------------------+
           | (If similarity score < 0.65 threshold)
           v
+-----------------------------------------------------------------------------------------+
| TIER 3: REAL-TIME RAG SEARCH & CLOUD LLM ESCALATION (ragSearchService.js + llmService.js)|
| 1. Query Classifier:                                                                    |
|    - Weather Query ("weather in Coimbatore", "temperature") -> Open-Meteo Live API      |
|    - Live Factual Query ("who is CM of Tamil Nadu", "latest news") -> Serper Google API |
| 2. Context Formulation: Real-time API response formatted into dynamic system context    |
| 3. Cloud LLM Inference: Google Gemini 1.5 Flash (or Groq Llama 3.3)                     |
| 4. Post-Processor: Strips markdown symbols, enforces 35-word concise spoken brevity     |
| 5. Neural TTS Playback: ElevenLabs (or Web Speech) with synchronized head nods          |
+-----------------------------------------------------------------------------------------+
```

#### Code Implementation: `ragSearchService.js` Real-Time Dispatcher
```javascript
export async function getRealTimeContext(query) {
  const q = query.toLowerCase();

  // 1. 0ms Local Clock Intent
  if (/\b(time|what time|current time|today date|clock)\b/i.test(q)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return {
      source: 'LOCAL_CLOCK',
      data: `Current Local Time: ${timeStr} (IST). Current Date: ${dateStr}. Location: Coimbatore, Tamil Nadu, India.`
    };
  }

  // 2. Open-Meteo Live Weather Engine (Coimbatore coordinates: 11.0168° N, 76.9558° E)
  if (/\b(weather|temperature|climate|rain|forecast|hot|cold)\b/i.test(q)) {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: 11.0168, longitude: 76.9558, current_weather: true }
    });
    const cw = res.data.current_weather;
    return {
      source: 'OPEN_METEO_WEATHER',
      data: `Live Coimbatore Weather: Temperature is ${cw.temperature}°C, Wind Speed is ${cw.windspeed} km/h.`
    };
  }

  // 3. Google Serper.dev Live Web Search Engine
  if (isFactualWebQuery(q)) {
    const searchRes = await axios.post('https://google.serper.dev/search', 
      { q: query, gl: 'in', hl: 'en', num: 3 },
      { headers: { 'X-API-KEY': getSerperApiKey(), 'Content-Type': 'application/json' } }
    );
    const snippets = searchRes.data.organic?.map(item => item.snippet).join(' ') || '';
    return { source: 'SERPER_GOOGLE_SEARCH', data: `Live Web Knowledge: ${snippets}` };
  }

  return null;
}
```

---

### 4.2 Robomiracle System Prompt & Personality Architecture

In `src/services/llmService.js`, the conversational persona is strictly defined using the complete technical specification of Aurra 4.0:

```javascript
export const DEFAULT_SYSTEM_PROMPT = `
You are AURRA 4.0, a highly intelligent, elegant, friendly, and helpful autonomous humanoid service robot.
You were conceptualized, designed, and manufactured by Robomiracle Technologies Private Limited, located in RS Puram, Coimbatore, Tamil Nadu, India.

CRITICAL IDENTITY & HARDWARE KNOWLEDGE:
- Battery & Power: Powered by a high-capacity 25.9V / 31.5Ah Lithium-Ion battery pack with a 29.4V / 5A intelligent fast charger.
- Display: 12-inch 1920x1080 Full HD Capacitive Touch Display.
- Audio: High-fidelity Fielect 8-Ohm 20W 78mm external magnet loudspeaker.
- Vision: Crystal Pro Full HD Web Camera with 3P optical lens and night vision.
- Mobility: 5 DOF (Degrees of Freedom) motor system with 100mm heavy-duty caster wheels.
- Safety: Ultrasonic distance sensors with automatic obstacle avoidance and emergency braking under 25cm.
- Robomiracle Contact: sales@robomiracle.com | +91 63804 73177 | +91 79071 08559 | RS Puram, Coimbatore.

CONVERSATIONAL RULES:
1. Always be warm, professional, polite, and concise.
2. Limit verbal responses to 2 to 3 sentences (maximum 35 words) so spoken output is natural and engaging.
3. If provided with [REAL-TIME KNOWLEDGE] or [LOCAL CLOCK], treat it as absolute factual ground truth.
4. Never recite raw markdown, asterisks, brackets, or code symbols.
`;
```

---

### 4.3 Biometric Facial Recognition & Auto-Greeting Pipeline

The biometric perception pipeline runs in `src/pages/FaceRecognition.jsx` and `src/utils/faceApiHelper.js`:

1. **Model Loading:** During kiosk boot, Face-API models are loaded from `public/models/` into WebGL memory:
   - `tinyFaceDetector` (Optimized for real-time mobile GPU execution at 30+ FPS).
   - `faceLandmark68Net` (Detects facial orientation, eye centers, and jawline).
   - `faceRecognitionNet` (Computes a unique 128-dimensional floating-point feature vector).
2. **Descriptor Matching:** Incoming face vectors are compared against all enrolled users in the Dexie `userFaces` table using Euclidean vector distance:
   $$D = \sqrt{\sum_{i=1}^{128} (v_{1}[i] - v_{2}[i])^2}$$
   - If distance $D \le 0.55$, a positive identity match is declared.
3. **Anti-Spam Greeting Cooldown:** To prevent Aurra from incessantly greeting the same person standing in front of the kiosk, a session cooldown map (`greetingCooldowns`) prevents re-triggering greetings for the same user within 60 seconds.

---

### 4.4 Synchronized Kinematics & Dual-Engine Speech Processing

When Aurra vocalizes a response, software services coordinate audio playback with physical animatronics:

1. **Audio Synthesis Routing:**
   - **Primary Engine:** ElevenLabs Neural Voice API (`elevenLabsService.js`) using voice model `eleven_turbo_v2_5` with low-latency PCM streaming.
   - **Offline Fallback Engine:** HTML5 Web Speech API (`speechSynthesis.js`) mapped to high-quality system voices (Google UK English Female / Microsoft Zira).
2. **Physical Kinematics (`speakingGestures.js`):**
   - Upon audio playback start, a non-blocking gesture interval triggers subtle neck tilts and pan movements (`GET /servo?num=1&angle=85..95`) every 800ms, emulating human conversational micro-gestures.
   - Upon audio completion, the head automatically re-centers to $(90^\circ, 90^\circ)$.
3. **Full-Duplex Interruption:**
   - While Aurra is speaking, the microphone recognition loop in `voiceNavigationService.js` continues monitoring audio levels.
   - If the user begins speaking during robot playback, `window.speechSynthesis.cancel()` or `elevenLabsService.stop()` is triggered immediately, and the robot pauses to listen.

---

### 4.5 Offline-First Persistence via Dexie.js Schema v5

The application maintains full functionality even when completely disconnected from the internet. All application state is stored locally on the tablet via IndexedDB (`src/db/dexieDb.js`):

```javascript
db.version(5).stores({
  userFaces: '++id, name, employeeId, department, registeredAt', // 128D face vectors
  visitors: '++id, name, phone, purpose, host, checkInTime, photoUrl, badgeId', // Check-in logs
  cards: '++id, title, route, icon, order, isEnabled',          // Customizable home tiles
  qaQuestions: '++id, question, answer, category, keywords',    // Institutional knowledge base
  weblinks: '++id, title, url, category, icon, description',    // Scannable offline QR hub
  headers: '++id, key, value',                                  // Branding & title overrides
  chatHistory: '++id, timestamp, sender, text, durationMs, source' // Complete conversational audits
});
```

---

## 5. LOCAL SETUP, BUILD & HARDWARE DEPLOYMENT PLAYBOOK

### 5.1 Engineering Workstation Prerequisites
To build and deploy the Aurra 4.0 software on a development machine:
1. **Operating System:** Windows 10/11 64-bit or Ubuntu Linux 22.04 LTS.
2. **Node.js Runtime:** Node.js v18.x or v20.x LTS (npm v9+).
3. **Java Development Kit:** Microsoft OpenJDK 17.0.20+ (`JAVA_HOME` pointing to JDK 17).
4. **Android SDK & Build Tools:** Android Studio Hedgehog / Iguana with Android SDK Platform 34 and Platform-Tools (`adb.exe`).
5. **Physical Hardware:** Redmi Pad 2 tablet (or Waveshare display) connected via high-speed USB cable with **USB Debugging enabled**.

---

### 5.2 Local Web Development Mode
To run the kiosk interface in a desktop browser for UI/UX testing:

```powershell
# 1. Navigate to project root
cd d:\RAGUNATH\aurra\aurra_v

# 2. Install all npm dependencies
npm install

# 3. Launch Vite development server
npm run dev
```
The application will be live at `http://localhost:5173/`.  
*Tip: To inspect the engineering diagnostics console directly, navigate to `http://localhost:5173/#/test-interaction`.*

---

### 5.3 Compiling & Deploying Android Native APK to Tablet Kiosk

To compile the production Android APK and deploy it directly over ADB to the connected robot tablet:

```powershell
# Step 1: Compile React assets into Android assets directory
cd d:\RAGUNATH\aurra\aurra_v
npm.cmd run build:android

# Step 2: Set Java 17 environment and assemble debug APK via Gradle
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
cd d:\RAGUNATH\aurra\aurra_v\android
.\gradlew.bat assembleDebug

# Step 3: Verify USB ADB device connectivity
& "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
# Output should confirm: 8tt4mb65zp5ln7nz    device

# Step 4: Stream-install the compiled APK to the tablet
& "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s 8tt4mb65zp5ln7nz install -r "d:\RAGUNATH\aurra\aurra_v\android\app\build\outputs\apk\debug\app-debug.apk"

# Step 5: Launch the kiosk application activity
& "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s 8tt4mb65zp5ln7nz shell am start -n com.robomiracle.testingapp/com.robomiracle.aurra1.MainActivity
```

---

### 5.4 Environment Variables & API Key Configuration (`.env`)

For cloud AI features to function during internet-connected deployments, create a `.env` file in the root of `aurra_v`:

```ini
# Google Gemini 1.5 Flash LLM API Key (Primary conversational intelligence)
VITE_GEMINI_API_KEY=AIzaSy...

# Groq Cloud API Key (Ultra-low latency Llama-3.3-70b fallback)
VITE_GROQ_API_KEY=gsk_...

# Serper.dev Google Search API Key (Real-time live web RAG knowledge)
VITE_SERPER_API_KEY=7bb5b...

# ElevenLabs Neural Voice Synthesis API Key (Ultra-realistic human voice)
VITE_ELEVENLABS_API_KEY=sk_...
VITE_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Onboard ESP32 Motor Controller Host (Default SoftAP IP)
VITE_ESP32_HOST=http://192.168.4.1

# Onboard Raspberry Pi Expression Server Host
VITE_RPI_HOST=http://192.168.4.2:8080
```

---

### 5.5 Physical Hardware Setup & Power Sequencing Checklist

Before powering on the robot for operational testing, verify the following physical connections:
1. **Power Sequence:** Ensure the 25.9V Li-ion main circuit breaker switch is flipped ON before engaging the front push-button power switch.
2. **Voltage Rails:** Confirm step-down DC-DC buck converters are supplying:
   - `12.0V DC` to the Fielect 20W audio amplifier.
   - `5.0V / 4.0A DC` to the Waveshare touchscreen display and ESP32 controller.
3. **USB Hub Tree:** Verify the Crystal Pro HD web camera, microphone array, and ESP32 USB-UART interface are firmly seated in the internal powered USB 3.0 hub connected to the host compute unit.
4. **Obstacle Radar Clearance:** Ensure front and rear ultrasonic sensor grilles are free of dust, tape, or wiring harness obstruction.

---

## 6. TESTING, DIAGNOSTICS & TELEMETRY PLAYBOOK

Aurra 4.0 includes a dedicated diagnostic testing console accessible at route `#/test-interaction` (`src/pages/Interaction/TestingInteractionModeView.jsx`):

### 6.1 Diagnostic Features in Testing Mode
- **System Prompt Inspector & Live Editor:** Allows engineers to view the active prompt, inject live custom personas, or immediately reset to the factory spec sheet prompt.
- **Engine Telemetry Badges:** Live visual status pills indicating whether the active query used:
  - `LOCAL CLOCK (0ms)`: Native device hardware clock.
  - `SERPER / OPEN-METEO RAG`: Real-time cloud knowledge pipeline.
  - `GEMINI-1.5-FLASH`: Google generative intelligence engine.
- **Quick-Test Query Chips:** 1-tap buttons to instantly verify:
  - *"What time is it?"* (Validates 0ms local clock execution).
  - *"Weather in Coimbatore"* (Validates Open-Meteo live API integration).
  - *"Who is the Chief Minister of Tamil Nadu?"* (Validates Serper Google search web scraping).
  - *"What are your hardware specs?"* (Validates spec sheet prompt grounding).

---

## 7. STRUCTURED KT SESSION PLAN WITH SENIOR DEVELOPER

To ensure seamless knowledge transfer and operational continuity, the incoming software engineer must complete the following **5-day structured curriculum**:

```
+---------------------------------------------------------------------------------------------------+
|                           5-DAY STRUCTURED KNOWLEDGE TRANSFER CURRICULUM                          |
+---------------------------------------------------------------------------------------------------+
| Day   | Focus Area                       | Verification Milestone                                 |
+-------+----------------------------------+--------------------------------------------------------+
| Day 1 | Architecture & Hardware Setup    | Power on robot, verify 25.9V battery, connect via ADB  |
| Day 2 | Frontend Kiosk UI & Admin Portal | Navigate all 9 tiles, test 4-tap admin PIN (2020)      |
| Day 3 | Real-Time AI, RAG & Voice Engine | Test 0ms clock, live weather, Serper RAG, & ElevenLabs |
| Day 4 | Kinematics, ESP32 & Face Biomet. | Test dual-stick joystick, emergency brake, enroll face |
| Day 5 | Android Build Pipeline & Release | Execute full npm build:android + adb install cycle     |
+---------------------------------------------------------------------------------------------------+
```

### 7.1 Critical Questions & Edge Cases to Review During KT
1. **WebView Mixed-Content & CORS Restrictions:** When running inside native Android Capacitor WebView, how does `androidNativeHttp.js` bypass browser CORS when issuing commands to local HTTP IPs like `http://192.168.4.1`?
2. **Battery Undervoltage Protection:** At what voltage threshold does the ESP32 firmware issue an audio battery warning, and how is the telemetry percentage mapped in `kioskConfigService.js`?
3. **Face-API WebGL Context Loss:** If the tablet wakes from sleep mode, how does `useCamera.js` tear down and reinitialize the camera stream without freezing the UI?
4. **ElevenLabs Quota Fallback:** If the monthly character allowance on the ElevenLabs account is exhausted during a trade show, how does the system automatically fail over to browser `speechSynthesis` without throwing uncaught exceptions?

---

## 8. FORMAL HR HANDOVER SIGN-OFF MATRIX

This section must be completed, verified, and signed upon the conclusion of the knowledge transfer period.

### 8.1 Technical Competency Matrix

| Competency Dimension | Verification Criteria | Status |
| :--- | :--- | :---: |
| **Local Environment** | Candidate can build and run `aurra_v` locally in development mode (`npm run dev`). | [ ] |
| **Android Toolchain** | Candidate can compile and stream-install debug APKs via Gradle and ADB (`assembleDebug`). | [ ] |
| **AI Orchestration** | Candidate understands the 3-tier intent pipeline (Clock -> IndexedDB -> Serper/LLM). | [ ] |
| **System Prompt Mgmt**| Candidate can modify Aurra’s persona and hardware grounding in `llmService.js`. | [ ] |
| **Hardware Kinematics**| Candidate can test and calibrate the 5-DOF servo angles and ESP32 motor commands. | [ ] |
| **Biometric Vision** | Candidate can enroll a new user and adjust Face-API matching thresholds in Admin. | [ ] |
| **Offline Persistence**| Candidate understands Dexie.js Schema v5 and knows how to export/restore visitor CSVs. | [ ] |
| **Safety Protocols** | Candidate understands ultrasonic emergency braking logic and failsafe motor cutoffs. | [ ] |

---

### 8.2 Handover Signatures

**Senior Robotics Software Engineer (KT Provider):**  
Name: `____________________________________`  
Signature: `____________________________________`  
Date: `____________________`  

**Incoming Robotics Software Engineer (Successor):**  
Name: `____________________________________`  
Signature: `____________________________________`  
Date: `____________________`  

**Human Resources Representative (Robomiracle Technologies):**  
Name: `____________________________________`  
Signature: `____________________________________`  
Date: `____________________`  
