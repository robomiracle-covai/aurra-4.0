# AURRA 2.0 KIOSK - MASTER SESSION HANDOFF & SYSTEM ARCHITECTURE
**Document Purpose:** Complete architectural context, hardware specs, completed features, and remaining roadmap for the Aurra Autonomous Receptionist Kiosk project. Use this document to resume development seamlessly in a new session.

---

## 1. PROJECT OVERVIEW & TARGET ENVIRONMENT

- **Project Root Directory:** `d:\RAGUNATH\aurra\aurra_v`
- **Target Hardware Device:** Redmi Pad 2 Tablet Kiosk (Device Serial: `8tt4mb65zp5ln7nz`)
  - **SoC:** MediaTek Helio G100 (ARM64)
  - **Display:** 10.6" / 11" 2560x1600 (Landscape WQXGA), locked 60–90 FPS refresh rate
  - **Android Shell:** Native Android WebView container (`com.robomiracle.testingapp/com.robomiracle.aurra1.MainActivity`)
- **Core Technology Stack:**
  - **Frontend:** React 18, Vite 6, Vanilla Hardware-Accelerated CSS (No Tailwind)
  - **Database:** Dexie.js (IndexedDB Schema Version 4) for **100% offline kiosk persistence**
  - **Icons:** `lucide-react`
  - **Audio & TTS:** HTML5 Web Speech API (`speechSynthesis` with fallback gender voice mappings)
  - **Camera & Vision:** `useCamera` custom hook, Face-API models (`models/` in assets)

---

## 2. HARDWARE BRIDGES & COMMUNICATIONS ARCHITECTURE

### A. ESP32 Microcontroller (Motors, Servos, RGB Eyes & Ultrasonic Radar)
- **SoftAP Hotspot Mode (Default):**
  - SSID: `Aurra` | Password: `12345678`
  - IP Address: `http://192.168.4.1`
  - Native Android Wi-Fi binding via `window.AndroidLauncher.connectToWifi("Aurra", "12345678")`
- **Station Wi-Fi Pairing Mode:**
  - Endpoint: `POST /wifi/connect` (Payload keys: `ssid` and `password`)
  - Forget Flash Wi-Fi: `GET /wifi/forget`
- **Command Endpoints:**
  - Motors: `GET /motor?cmd=forward|backward|left|right|stop&speed=0..255`
  - Servos: `GET /servo?num=1..5&angle=0..180`
    - Servo 1: Head Tilt (0°-180°, Default: 90°)
    - Servo 2: Head Pan (0°-180°, Default: 90°)
    - Servos 3–5: Auxiliary Animatronic / Arm / Hand Servos
  - RGB Eye LEDs: `GET /rgb?r=0..255&g=0..255&b=0..255` or Hex `#00FFFF`
  - Ultrasonic Distance: `GET /distance` returning `{ front: cm, rear: cm }`
- **Safety / Performance Rule:** All calls in `src/services/esp32Service.js` use safe non-blocking timeouts (300–500ms) with background dispatch. Even when ESP32 is powered off, the UI never stutters or drops frames.

### B. Raspberry Pi Expression Engine (HDMI Face Display)
- **Service File:** `src/services/raspberryPiService.js`
- **Port:** `http://<pi_ip>:8080` (or `http://192.168.4.2:8080`)
- **Animated Expressions:** `smile.gif`, `Speaking_Smile.gif`, `angry.gif`, `love.gif`, `nod`, `bow`, `dance`
- **Voice Sync:** `setSpeechActive(isSpeaking)` automatically switches the Pi HDMI display between `Speaking_Smile.gif` and idle `smile.gif`.

---

## 3. DEVELOPMENT & ANDROID BUILD PROCEDURES

Always use these exact paths and commands on this Windows workstation:
```powershell
# 1. Build Web Assets into Android Assets directory
cd d:\RAGUNATH\aurra\aurra_v
npm.cmd run build:android

# 2. Compile & Assemble Android Debug APK (Uses JDK 17 Hotspot)
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
cd d:\RAGUNATH\aurra\aurra_v\android
.\gradlew.bat assembleDebug

# 3. Deploy APK to Connected Redmi Pad 2 Tablet
& "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s 8tt4mb65zp5ln7nz install -r "d:\RAGUNATH\aurra\aurra_v\android\app\build\outputs\apk\debug\app-debug.apk"

# 4. Launch Kiosk App
& "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s 8tt4mb65zp5ln7nz shell am start -n com.robomiracle.testingapp/com.robomiracle.aurra1.MainActivity
```

---

## 4. CURRENT ARCHITECTURE & COMPLETED FEATURES

| Feature / Route | Implementation File(s) | Status | Highlights |
| :--- | :--- | :---: | :--- |
| **Home Screen & Cards Matrix** (`/`) | `src/pages/Cards/SliderAndCards.jsx` | ✅ Completed | Holographic cyber title, live FPS counter, 9 feature action cards, slideshow banner fallback. |
| **Universal Voice Bar** (Global) | `src/components/VoiceAssistantBar.jsx` | ✅ Completed | Fixed floating bottom bar with Speech Recognition, "Pause AI" toggle, keyboard mode, and feedback pills. |
| **Admin Portal & Security** (`/admin`) | `src/pages/Admin/AdminDashboard.jsx` | ✅ Completed | **Secret 4-tap header trigger**, PIN `2020`, Developer 1-tap rapid toggle, branding, cards matrix, Q&A, and **Visitor Directory** with CSV export, checkout, and live Overview metric counter. |
| **Voice Q&A Knowledge Base** (`/qa`) | `src/pages/Questions/QuestionAnswerView.jsx` | ✅ Completed | Dedicated search/query input, instant TTS response, keyword matcher against IndexedDB `qaQuestions`. |
| **Face Recognition** (`/face-recognition`) | `src/pages/FaceRecognition.jsx` | ✅ Completed | Live camera face scanner, Face-API models, greeting cooldown map, user face enrollment. |
| **Robot Cockpit** (`/control` & `/hardware`) | `src/pages/Control/Control.jsx`, `src/pages/Hardware/HardwareConnection.jsx` | ✅ Completed | 90 FPS touch joystick/D-pad driving, speed slider, 5-axis servos with quick presets (Center, Look Up/Down/Left/Right), RGB eye hue wheel, ultrasonic proximity warnings (<25cm), LAN bridge modal. |
| **Visitor Registration & Kiosk Check-In** (`/form`) | `src/pages/Registration/VisitorRegistration.jsx` | ✅ Completed | 4-step flow: Identity (with on-screen numpad), Purpose & Host, Biometric Camera portrait capture + face auto-enrollment, holographic digital QR badge, spoken TTS welcome. |
| **Website & Official Links** (`/weblinks`) | `src/pages/WebLinks/WebLinks.jsx`, `src/pages/WebLinks/WebLinks.css` | ✅ Completed | 100% offline scannable QR code generator with live QR rendering for official website, brochures, video demos, LinkedIn, and WhatsApp reception desk. Features high-contrast inverted scan mode, laser sweep animation, in-kiosk interactive brochure reader, and custom QR generator. |
| **Real AI Groq LLM Orchestrator** (Global) | `src/services/llmService.js`, `src/services/voiceNavigationService.js` | ✅ Completed | Exact Groq Cloud API from Aurra 1.0 (`llama-3.3-70b-versatile` / `openai/gpt-oss-20b`) with 3-tier non-blocking filter (0ms Navigation -> 3ms Offline IndexedDB Q&A -> Cloud LLM Escalation). Features 35-word concise cleaner, 4.5s AbortController timeout, visual `AURRA THINKING (AI)...` badge, and Admin panel toggle & key manager. |
| **Master Kiosk Customization System** (Admin & All Features) | `src/services/kioskConfigService.js`, `src/pages/Admin/AdminDashboard.jsx` | ✅ Completed | **100% customizable across all features in Admin**: (1) Universal Voice & Audio (Gender, Rate 0.8-1.3x, Pitch 0.8-1.3x, Boot Auto-Listen, Live Audition); (2) Face Recognition & Vision (Greeting template `{name}`, stranger greeting toggle & text, cooldown slider, TinyFace/SSD model selector); (3) Visitor Registration (Facility org title, badge ID prefix with live preview, mandatory toggles for photo/host/phone, spoken welcome template with live test); (4) Robot Hardware (ESP32/RPi hosts, cruise speed 100-255, radar brake distance 10-100cm, eye color picker, resting servo pan/tilt); (5) Security (Custom 4-digit PIN changer with master recovery fallback, single-tap admin, bypass PIN, FPS badge, master reset). |
| **Public Facilities & Room Directory** (`/facilities`) | `src/pages/Facilities/PublicFacilitiesView.jsx`, `src/pages/Facilities/PublicFacilitiesView.css` | ✅ Completed | Floor-by-floor campus directory (Ground, L1, L2), interactive holographic SVG blueprint map with glowing walking path trails & radar kiosk pin, instant search & category filters, spoken audio navigation guides via TTS, on-device QR generator for mobile walking directions, and complete Admin CRUD. |
| **Offline IndexedDB** | `src/db/dexieDb.js`, `src/db/offlineServices.js` | ✅ Completed | Schema v9: `userFaces`, `cards`, `images`, `headers`, `qaQuestions`, `visitors`, `weblinks`, `tourStops`, `robotTours`, `chatSessions`, `chatMessages`, `facilities`. Includes full CSV and JSON backup/restore. |

---

## 5. CRITICAL UI & PERFORMANCE RULES (MANDATORY)

1. **Floating Voice Bar Clearance:**
   - The global floating voice bar (`.global-floating-voice-bar`) is fixed at `bottom: 8px` (`z-index: 1000`).
   - In `App.css`, `.global-floating-voice-bar` is set to `pointer-events: none` and its children to `pointer-events: auto`.
   - **All pages must include `padding-bottom: 140px`** in their root containers so bottom action buttons sit cleanly above the voice bar and never get covered or blocked.
2. **Kiosk Smoothness & Zero Frame Drops:**
   - Use CSS transforms (`translate3d`, `scale`) and GPU-accelerated styling.
   - Avoid heavy re-renders on touch/joystick loops (use `requestAnimationFrame`).
3. **User Testing Protocol:**
   - **Do NOT automatically tap or interact with the app via ADB during user testing.** The user tests directly on the physical tablet. Only use ADB for compiling, installing the APK, and launching the activity.

---

## 6. PRIMARY KIOSK FEATURE STATUS

All 10 primary Action Cards on the kiosk home screen are now **100% complete and fully functional**:
1. **Visitor Registration & Admission Pass** (`/form`) - ✅ Completed
2. **Interactive Voice Q&A Knowledge Base** (`/qa`) - ✅ Completed
3. **Autonomous Guided Robot Tour & Presentation** (`/guided-tour`) - ✅ Completed
4. **Public Facilities & Room Directory** (`/facilities`) - ✅ Completed
5. **Face Recognition & Greeting Scanner** (`/face-recognition`) - ✅ Completed
6. **Robot Cockpit (Motors, Servos & Lights)** (`/control`) - ✅ Completed
7. **Full-Screen Interaction Mode** (`/interaction`) - ✅ Completed
8. **Website, Social & Digital Portals** (`/weblinks`) - ✅ Completed
9. **Hardware Status & Subsystem Telemetry** (`/hardware`) - ✅ Completed
10. **Testing Interactive Diagnostic Lab** (`/testing-interaction`) - ✅ Completed

---

### LLM Knowledge & Prompt Synchronization
* **Knowledge Engine:** [`src/services/facilityTourKnowledgeService.js`](file:///d:/RAGUNATH/aurra/aurra_v/src/services/facilityTourKnowledgeService.js)
  * Dynamically extracts enabled campus facilities and robot tours from IndexedDB.
  * In-memory zero-latency cache (<0.1ms read time) so Groq Cloud inference is never delayed.
  * Automatically invalidates and pre-warms on IndexedDB mutations via `aurra:knowledge-updated` event.
* **System Persona Prompt Integration:** [`src/services/llmService.js`](file:///d:/RAGUNATH/aurra/aurra_v/src/services/llmService.js)
  * `DEFAULT_SYSTEM_PROMPT` enriched with authoritative robot lineup (Aurra, Nexus, Nova, Dine, GI) and 3-floor campus directory with walking directions.
  * In `generateResponse()`, if a customized prompt does not contain room codes, the live knowledge block is injected dynamically into `dynamicSystemPrompt`.
* **Admin UI Controls:**
  * In **Admin Dashboard &rarr; Real AI Grok LLM & API tab**, added **"Sync Facilities & Tours into Prompt"** button allowing administrators to merge the latest campus rooms and robots into their editable prompt with one click.
  * Same sync button added in **Testing Interactive Mode (`/testing-interaction`)**.

---

## 7. QUICK-START GUIDE FOR THE NEXT AGENT
When starting the new session:
1. Read this file `AURRA_SESSION_HANDOFF.md` to immediately obtain 100% project context.
2. All 10 features are operational with offline IndexedDB storage (Schema v9) and Admin dashboard management.
3. LLM system prompt and dynamic inference context automatically synchronize with all campus facilities and robot tours.
4. Android web assets are compiled via `npm.cmd run build:android`.
5. Maintain the established design system (`#00FFFF`, `#00D5FF`, `#0A1128`, dark cyber glassmorphism) and locked 90 FPS performance standards.

