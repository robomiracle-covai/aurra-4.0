/**
 * Master Kiosk Configuration Service
 * Provides centralized, 100% offline customizable settings across all Aurra 2.0 features:
 * - Universal Voice Assistant & TTS (Gender, Rate, Pitch, Auto-Listen)
 * - Face Recognition & Greetings (Templates, Stranger Greeting, Cooldown, Models)
 * - Visitor Registration (Badge Titles, Requirements, Welcome Spoken Text)
 * - Robot Hardware (ESP32 IP, RPi IP, Motor Speed, Radar Threshold, Eyes, Servos)
 * - Security & Access (Custom Admin PIN, Single-Tap Trigger, PIN Bypass, FPS Badge)
 */

const STORAGE_KEY = 'aurra_kiosk_master_config_v2';

export const DEFAULT_FORM_FIELDS = [
  {
    id: 'name',
    key: 'Name',
    label: 'Full Name',
    prompt: 'Please tell me your full name.',
    retryPrompt: "I didn't catch your name. Please speak your full name again.",
    required: true,
    enabled: true,
    type: 'text',
    placeholder: 'e.g. Rahul Sharma',
  },
  {
    id: 'mobile',
    key: 'Mobile',
    label: 'Mobile Number',
    prompt: 'What is your 10 digit mobile number?',
    retryPrompt: 'Please tell me your 10 digit mobile number.',
    required: true,
    enabled: true,
    type: 'tel',
    placeholder: '10 digit mobile number',
  },
  {
    id: 'email',
    key: 'Email',
    label: 'Email Address',
    prompt: 'Please tell me your email address.',
    retryPrompt: 'Please tell me your email address, like user at gmail dot com.',
    required: true,
    enabled: true,
    type: 'email',
    placeholder: 'e.g. user@example.com',
  },
  {
    id: 'visit',
    key: 'Visit',
    label: 'Purpose of Visit',
    prompt: 'What is the purpose of your visit?',
    retryPrompt: 'Please tell me the purpose of your visit.',
    required: true,
    enabled: true,
    type: 'text',
    placeholder: 'e.g. Client Meeting, Interview',
  },
  {
    id: 'place',
    key: 'Place',
    label: 'Where are you coming from?',
    prompt: 'Where are you coming from?',
    retryPrompt: 'Please tell me where you are coming from or your company name.',
    required: true,
    enabled: true,
    type: 'text',
    placeholder: 'e.g. Salem, Chennai, or Company',
  },
];

export const DEFAULT_KIOSK_CONFIG = {
  // 1. Universal Voice & Audio
  voiceGender: 'female', // 'female' | 'male'
  speechRate: 1.0,       // 0.8 to 1.3
  speechPitch: 1.05,     // 0.8 to 1.3
  autoListenOnBoot: true,
  voiceInteractionStyle: 'walkie-talkie', // 'walkie-talkie' | 'phone-call'

  // 2. Face Recognition & Vision
  faceGreetingTemplate: 'Hello {name}! Welcome to Robomiracle Technologies.',
  strangerGreetingEnabled: true,
  strangerGreetingText: 'Hello guest! Welcome to Robomiracle Technologies. Please feel free to register at the kiosk.',
  faceGreetingCooldownSec: 15, // seconds between repeat greetings per face
  faceDetectorModel: 'tinyFace', // 'tinyFace' | 'ssdMobilenetv1'
  faceDetectionIntervalMs: 250,

  // 3. Visitor Registration & Check-In
  badgeOrgTitle: 'Robomiracle Technologies',
  badgeIdPrefix: 'AUR-VIS-2026',
  requireVisitorPhoto: true,
  requireVisitorHost: true,
  requireVisitorPhone: false,
  registrationWelcomeSpeech: 'Welcome to Robomiracle Technologies, {name}! Your visitor badge has been generated.',
  formFields: DEFAULT_FORM_FIELDS,

  // 4. Robot Hardware & Control
  esp32Ip: '192.168.4.1',
  raspberryPiIp: '192.168.0.10:8080',
  defaultMotorSpeed: 180, // 0 - 255
  radarObstacleThresholdCm: 25,
  defaultEyeColorHex: '#00FFFF',
  defaultHeadTiltAngle: 90,
  defaultHeadPanAngle: 90,

  // 5. Autonomous Guided Robot Tour
  tourSpeed: 160,                      // 100 - 255 motor PWM
  tourObstacleDistanceCm: 30,          // Distance in cm to auto-brake
  tourAutoAnnounce: true,              // Speak narration automatically upon waypoint arrival
  tourArrivalChime: true,              // Play chime / beep on stop arrival
  tourLoopEnabled: false,              // Loop back to stop 1 upon completion
  tourVoiceNavEnabled: true,           // Allow voice commands ("next stop", "pause tour")

  // 6. Security & Admin
  adminPin: '1234',
  singleTapAdmin: false,
  bypassAdminPin: false,
  showFpsBadge: false,
};

class KioskConfigService {
  constructor() {
    this.config = this.loadConfig();
    this.subscribers = new Set();
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.formFields || !Array.isArray(parsed.formFields) || parsed.formFields.length === 0) {
          parsed.formFields = [...DEFAULT_FORM_FIELDS];
        } else {
          // If email is missing from older stored config, inject it!
          const hasEmail = parsed.formFields.some((f) => f.key.toLowerCase() === 'email');
          if (!hasEmail) {
            const emailField = DEFAULT_FORM_FIELDS.find((f) => f.key === 'Email');
            if (emailField) {
              const mobIdx = parsed.formFields.findIndex((f) => f.key.toLowerCase() === 'mobile');
              if (mobIdx !== -1) {
                parsed.formFields.splice(mobIdx + 1, 0, emailField);
              } else {
                parsed.formFields.push(emailField);
              }
            }
          }
        }
        return { ...DEFAULT_KIOSK_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed loading kiosk master config from storage:', e);
    }
    return { ...DEFAULT_KIOSK_CONFIG, formFields: [...DEFAULT_FORM_FIELDS] };
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(partialConfig) {
    this.config = { ...this.config, ...partialConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed saving kiosk master config to storage:', e);
    }
    this.notify();
    return this.config;
  }

  resetToDefaults() {
    this.config = { ...DEFAULT_KIOSK_CONFIG };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed resetting kiosk master config:', e);
    }
    this.notify();
    return this.config;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getConfig());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const current = this.getConfig();
    this.subscribers.forEach((cb) => {
      try {
        cb(current);
      } catch (err) {
        console.error('Kiosk config subscriber error:', err);
      }
    });
  }
}

export const kioskConfigService = new KioskConfigService();
