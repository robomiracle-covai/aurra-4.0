import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Send,
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  Battery,
  BatteryCharging
} from 'lucide-react';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import { cancelSpeech, speakWithVoice } from '../../utils/speechSynthesis';
import { offlineVisitorService } from '../../db/offlineServices';
import { kioskConfigService } from '../../services/kioskConfigService';
import { raspberryPiService } from '../../services/raspberryPiService';
import { logger } from '../../services/logger';
import './VisitorRegistration.css';

// ── Static Pure Utility Functions ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NAME_PREFIXES = [
  /^(?:my\s+(?:full\s+|real\s+|good\s+|official\s+|first\s+)?name\s*(?:is|'s)?)\s+/i,
  /^(?:(?:full\s+|real\s+|good\s+|official\s+)?name\s+(?:is|called|would\s+be))\s+/i,
  /^(?:this\s+is|myself|it\s+is|it's|its)\s+/i,
  /^(?:i\s+am|i'm|im)\s+/i,
  /^(?:(?:you\s+can\s+)?call\s+me|they\s+call\s+me|people\s+call\s+me|known\s+as|i\s+go\s+by)\s+/i,
];

const PLACE_PREFIXES = [
  /^(?:i\s+am\s+coming\s+from|i'm\s+coming\s+from|im\s+coming\s+from|we\s+are\s+coming\s+from|we're\s+coming\s+from|coming\s+from|i\s+came\s+from|we\s+came\s+from|came\s+from|i\s+come\s+from|come\s+from)\s+/i,
  /^(?:travelled\s+from|traveled\s+from|all\s+the\s+way\s+from|arrived\s+from)\s+/i,
  /^(?:i\s+am\s+from|i'm\s+from|im\s+from|we\s+are\s+from|we're\s+from|from\s+the\s+city\s+of|from\s+place|from)\s+/i,
  /^(?:i\s+am\s+staying\s+in|i'm\s+staying\s+in|im\s+staying\s+in|staying\s+in|i\s+stay\s+in|i\s+stay\s+at|stay\s+in|stay\s+at)\s+/i,
  /^(?:i\s+am\s+living\s+in|i'm\s+living\s+in|living\s+in|i\s+live\s+in|i\s+live\s+at|live\s+in|live\s+at|i\s+reside\s+in|residing\s+in)\s+/i,
  /^(?:i\s+belong\s+to|belong\s+to)\s+/i,
  /^(?:my\s+(?:native\s+place|hometown|native|place|city|location|town|village)\s+is)\s+/i,
  /^(?:native\s+place\s+is|native\s+is|place\s+is|city\s+is|location\s+is|hometown\s+is)\s+/i,
  /^(?:basically\s+(?:from|i\s+am\s+from)|currently\s+in)\s+/i,
];

const EMAIL_PREFIXES = [
  /^(?:my\s+email\s+is|my\s+email\s+id\s+is|my\s+mail\s+is|my\s+mail\s+id\s+is|email\s+is|mail\s+is|it\s+is|it's|its)\s+/i,
];

const cleanConversationalPrefix = (text, specificPrefixes = []) => {
  if (!text) return '';
  let res = text.trim();
  res = res.replace(/^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)[,\s]+/i, '');
  res = res.replace(/^(?:actually|well|yeah|yes|ok|okay)[,\s]+/i, '');
  res = res.replace(/^(?:i\s+(?:already\s+)?(?:told|tol|said)(?:\s+(?:you|that))*[,\s]+)/i, '');
  res = res.replace(/^(?:actually|well|yeah|yes|ok|okay)[,\s]+/i, '');

  for (const prefixRegex of specificPrefixes) {
    if (prefixRegex.test(res)) {
      res = res.replace(prefixRegex, '').trim();
      break;
    }
  }

  res = res.replace(/\s+(?:is\s+(?:my\s+)?(?:full\s+)?name|this\s+side|here|speaking)$/i, '');
  res = res.replace(/\s+(?:is\s+my\s+(?:native|place|city|hometown)|is\s+where\s+i\s+come\s+from)$/i, '');
  res = res.replace(/\s+(?:please|sir|madam|thank\s+you|thanks)$/i, '');
  return res.trim();
};

const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map((w) => {
      if (!w) return '';
      if (w.length === 1) return w.toUpperCase();
      if (w.length === 2 && w.endsWith('.')) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
};

const formatField = (key, text, type = 'text') => {
  if (!text) return '';
  const clean = text.trim();
  const keyLower = (key || '').toLowerCase();

  if (keyLower === 'mobile' || keyLower === 'phone' || type === 'tel') {
    let phoneStr = clean.toLowerCase();
    phoneStr = phoneStr.replace(/\bdouble\s+(\w+)/g, '$1$1');
    phoneStr = phoneStr.replace(/\btriple\s+(\w+)/g, '$1$1$1');
    const numMap = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
    for (const [w, d] of Object.entries(numMap)) {
      phoneStr = phoneStr.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
    }
    return phoneStr.replace(/\D/g, '').slice(0, 10);
  }

  if (keyLower === 'email' || type === 'email') {
    let email = cleanConversationalPrefix(clean, EMAIL_PREFIXES).toLowerCase();
    email = email.replace(/\s+(?:at(?:\s+the)?\s+rate|at)\s+/gi, '@');
    email = email.replace(/\s+dot\s+/gi, '.');
    email = email.replace(/\s+underscore\s+/gi, '_');
    email = email.replace(/\s+(?:dash|hyphen)\s+/gi, '-');
    email = email.replace(/\s+/g, '');
    return email;
  }

  if (keyLower === 'name') {
    let name = cleanConversationalPrefix(clean, NAME_PREFIXES);
    name = name.replace(/^e(?=ragunath\b)/i, '');
    return toTitleCase(name);
  }

  if (keyLower === 'place' || keyLower === 'city' || keyLower === 'location' || keyLower === 'from') {
    let place = cleanConversationalPrefix(clean, PLACE_PREFIXES);
    if (place.toLowerCase() === 'salen') place = 'Salem';
    return toTitleCase(place);
  }

  if (keyLower === 'visit' || keyLower === 'purpose') {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  let generic = clean.replace(/^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)[,\s]+/i, '');
  return toTitleCase(generic);
};

const validateField = (field, rawVal) => {
  const val = (rawVal || '').trim();
  const isRequired = field.required !== false;

  if (isRequired && !val) {
    return { valid: false, error: `${field.label} is required` };
  }
  if (!val) {
    return { valid: true };
  }

  const keyLower = (field.key || '').toLowerCase();
  if (keyLower === 'email' || field.type === 'email') {
    if (!EMAIL_REGEX.test(val)) {
      return {
        valid: false,
        error: 'Valid email address required (e.g. name@domain.com)',
        speechError: 'Please tell me your valid email address.',
      };
    }
  } else if (keyLower === 'mobile' || keyLower === 'phone' || field.type === 'tel') {
    const digits = val.replace(/\D/g, '');
    if (digits.length !== 10) {
      if (digits.length > 0) {
        return {
          valid: false,
          error: `Incomplete: ${digits.length} digits entered. 10 digits required.`,
          speechError: 'I did not get your full 10-digit mobile number. Please tell me your 10-digit mobile number.',
          isIncompleteDigits: true,
        };
      } else {
        return {
          valid: false,
          error: '10-digit mobile number required',
          speechError: 'Please tell me your 10-digit mobile number.',
          isIncompleteDigits: false,
        };
      }
    }
  } else if (keyLower === 'name') {
    if (val.length < 2) {
      return {
        valid: false,
        error: 'Name must be at least 2 characters',
        speechError: 'Please tell me your name clearly.',
      };
    }
  } else if (keyLower === 'visit' || keyLower === 'purpose') {
    if (val.length < 2) {
      return {
        valid: false,
        error: 'Purpose of visit must be at least 2 characters',
        speechError: 'Please tell me the purpose of your visit.',
      };
    }
  } else if (keyLower === 'place') {
    if (val.length < 2) {
      return {
        valid: false,
        error: 'Place must be at least 2 characters',
        speechError: 'Please tell me where you are coming from.',
      };
    }
  }

  return { valid: true };
};

// ── Voice Intent Detectors (Field Editing / Re-entering While Submitting) ──
const detectFieldToEdit = (text, fields) => {
  if (!text) return -1;
  const t = text.toLowerCase().trim();

  // 1. Name
  if (
    t.includes('change name') ||
    t.includes('edit name') ||
    t.includes('change my name') ||
    t.includes('update name') ||
    t.includes('wrong name') ||
    t.includes('reenter name') ||
    t.includes('re-enter name') ||
    t.includes('wish to change name') ||
    t.includes('want to change name') ||
    t.includes('correct my name') ||
    t === 'name' ||
    t === 'full name'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'name');
    if (idx !== -1) return idx;
  }

  // 2. Mobile / Phone
  if (
    t.includes('change mobile') ||
    t.includes('edit mobile') ||
    t.includes('change phone') ||
    t.includes('edit phone') ||
    t.includes('change number') ||
    t.includes('edit number') ||
    t.includes('wrong mobile') ||
    t.includes('wrong phone') ||
    t.includes('wrong number') ||
    t.includes('reenter mobile') ||
    t.includes('reenter number') ||
    t.includes('change my number') ||
    t.includes('change my mobile') ||
    t === 'mobile' ||
    t === 'phone' ||
    t === 'number' ||
    t === 'phone number'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'mobile' || f.key.toLowerCase() === 'phone' || f.type === 'tel');
    if (idx !== -1) return idx;
  }

  // 3. Email
  if (
    t.includes('change email') ||
    t.includes('edit email') ||
    t.includes('change mail') ||
    t.includes('edit mail') ||
    t.includes('wrong email') ||
    t.includes('wrong mail') ||
    t.includes('reenter email') ||
    t.includes('change my email') ||
    t === 'email' ||
    t === 'mail' ||
    t === 'email address'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'email' || f.type === 'email');
    if (idx !== -1) return idx;
  }

  // 4. Visit / Purpose
  if (
    t.includes('change visit') ||
    t.includes('edit visit') ||
    t.includes('change purpose') ||
    t.includes('edit purpose') ||
    t.includes('wrong purpose') ||
    t.includes('wrong visit') ||
    t === 'visit' ||
    t === 'purpose' ||
    t === 'purpose of visit'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'visit' || f.key.toLowerCase() === 'purpose');
    if (idx !== -1) return idx;
  }

  // 5. Place / Location
  if (
    t.includes('change place') ||
    t.includes('edit place') ||
    t.includes('change city') ||
    t.includes('edit city') ||
    t.includes('change location') ||
    t.includes('wrong place') ||
    t.includes('wrong city') ||
    t === 'place' ||
    t === 'city' ||
    t === 'location' ||
    t === 'place of visit'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'place' || f.key.toLowerCase() === 'city');
    if (idx !== -1) return idx;
  }

  return -1;
};

const isSubmitCommand = (text) => {
  if (!text) return false;
  const t = text.toLowerCase().trim();

  if (
    t.includes('change') ||
    t.includes('edit') ||
    t.includes('update') ||
    t.includes('modify') ||
    t.includes('wrong') ||
    t.includes('correct') ||
    t.includes('wait') ||
    t.includes('stop') ||
    t.includes('no ') ||
    t === 'no' ||
    t.includes('cancel')
  ) {
    return false;
  }

  return (
    t.includes('submit') ||
    t === 'yes' ||
    t === 'confirm' ||
    t === 'confirm registration' ||
    t === 'submit registration' ||
    t === 'submit form' ||
    t === 'yes submit' ||
    t === 'please submit' ||
    t === 'save and submit' ||
    t === 'save registration'
  );
};

export default function VisitorRegistration({ onNavigate }) {
  const kioskConfigRef = useRef(kioskConfigService.getConfig());
  const kioskConfig = kioskConfigRef.current;
  const voiceGender = kioskConfig?.voiceGender || 'female';
  const speechRate = kioskConfig?.speechRate || 1.0;
  const speechPitch = kioskConfig?.speechPitch || 1.05;

  // Exact 5 fields matching Nexus skeleton without gender
  const formFields = useMemo(() => [
    {
      id: 'name',
      key: 'Name',
      label: 'Full Name',
      type: 'text',
      placeholder: 'Enter your full name',
      required: true,
      prompt: 'Please tell me your full name.',
      retryPrompt: "I didn't catch your name. Please speak your full name clearly.",
    },
    {
      id: 'mobile',
      key: 'Mobile',
      label: 'Phone Number',
      type: 'tel',
      placeholder: 'Enter 10-digit number',
      required: true,
      prompt: 'What is your 10 digit mobile number?',
      retryPrompt: 'Please tell me your 10 digit mobile number.',
    },
    {
      id: 'email',
      key: 'Email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'example@domain.com',
      required: true,
      prompt: 'Please tell me your email address.',
      retryPrompt: 'Please tell me your valid email address, like user at gmail dot com.',
    },
    {
      id: 'visit',
      key: 'Visit',
      label: 'Purpose of Visit',
      type: 'text',
      placeholder: 'Please enter the purpose of your visit...',
      required: true,
      prompt: 'What is the purpose of your visit?',
      retryPrompt: 'Please tell me the purpose of your visit.',
    },
    {
      id: 'place',
      key: 'Place',
      label: 'Place of Visit',
      type: 'text',
      placeholder: 'Where are you from? / Enter location',
      required: true,
      prompt: 'Where are you coming from?',
      retryPrompt: 'Please tell me where you are coming from.',
    },
  ], []);

  const [formData, setFormData] = useState({
    Name: '',
    Mobile: '',
    Email: '',
    Visit: '',
    Place: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldErrorsText, setFieldErrorsText] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceAutoPilot, setVoiceAutoPilot] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Welcome! Please provide your details.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Battery State: dynamically fetched from Android Launcher or Web Battery API
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  const isMounted = useRef(true);
  const activeStepRef = useRef(0);
  const formDataRef = useRef(formData);
  const voiceAutoPilotRef = useRef(true);
  const recognitionRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    voiceAutoPilotRef.current = voiceAutoPilot;
  }, [voiceAutoPilot]);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  // ── Real-Time Battery Query ──
  const updateBatteryStatus = useCallback(async () => {
    // 1. Android Native LauncherBridge check
    if (window.AndroidLauncher && typeof window.AndroidLauncher.getBatteryLevel === 'function') {
      try {
        const lvl = window.AndroidLauncher.getBatteryLevel();
        if (lvl > 0 && lvl <= 100) {
          setBatteryLevel(lvl);
          return;
        }
      } catch (err) {
        logger.warn('BATTERY_BRIDGE', err.message);
      }
    }

    // 2. Standard Web Battery API check
    if ('getBattery' in navigator) {
      try {
        const b = await navigator.getBattery();
        setBatteryLevel(Math.round(b.level * 100));
        setIsCharging(b.charging);
        return;
      } catch {}
    }

    // 3. Fallback to 100% if undetectable
    setBatteryLevel((prev) => (prev !== null ? prev : 100));
  }, []);

  useEffect(() => {
    updateBatteryStatus();
    const interval = setInterval(updateBatteryStatus, 15000);
    return () => clearInterval(interval);
  }, [updateBatteryStatus]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      if (isMounted.current) setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }, []);

  const stopAudio = useCallback(() => {
    cancelSpeech();
    setIsSpeaking(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const stopAudioRef = useRef(stopAudio);
  stopAudioRef.current = stopAudio;
  const submitFormDirectlyRef = useRef(null);

  // ── Conversational Step Executor with Re-entering & Voice Editing ──
  const runVoiceStep = useCallback(
    async (stepIndex, isRetry = false, isEditingMode = false, retrySpeechPrompt = '', clearOnMic = false) => {
      if (!isMounted.current || !voiceAutoPilotRef.current) return;

      // Completion stage: check if all fields satisfy compulsory requirements
      if (stepIndex >= formFields.length) {
        const firstInvalidIdx = formFields.findIndex((f) => {
          const val = formDataRef.current[f.key];
          return !validateField(f, val).valid;
        });

        if (firstInvalidIdx !== -1) {
          const missingField = formFields[firstInvalidIdx];
          const valRes = validateField(missingField, formDataRef.current[missingField.key]);
          const promptToSpeak = missingField.retryPrompt || `Please provide your ${missingField.label}.`;
          setStatusMessage(`Missing: ${missingField.label}`);
          showToast(valRes.error || `Please enter ${missingField.label}`, 'error');
          setFieldErrors((prev) => ({ ...prev, [missingField.key]: true }));

          await speakWithVoice(promptToSpeak, {
            gender: voiceGender,
            rate: speechRate,
            pitch: speechPitch,
            onEnd: () => {
              if (isMounted.current && voiceAutoPilotRef.current) {
                runVoiceStepRef.current?.(firstInvalidIdx, true, false);
              }
            },
            onError: () => {
              if (isMounted.current && voiceAutoPilotRef.current) {
                runVoiceStepRef.current?.(firstInvalidIdx, true, false);
              }
            },
          });
          return;
        }

        // All fields verified and filled: user can now say "Submit" OR say "Change Name / Change Phone" to re-enter!
        setStatusMessage('All details recorded! Say "Submit" to confirm, or say "Change Name" to edit.');

        const startSubmitMic = () => {
          if (!isMounted.current || !voiceAutoPilotRef.current || isSubmittingRef.current) return;
          setIsSpeaking(false);

          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRec) {
            setStatusMessage('Say "Submit" or tap Submit.');
            return;
          }

          try {
            const rec = new SpeechRec();
            recognitionRef.current = rec;
            rec.lang = 'en-IN';
            rec.continuous = false;
            rec.interimResults = true;

            rec.onstart = () => {
              if (!isMounted.current) return;
              setIsListening(true);
              setStatusMessage('Say "Submit" to finish, or say "Change Name" to edit...');
            };

            let lastSubmitUtterance = '';
            let isHandled = false;

            const handleDecision = (text) => {
              if (isHandled || !text) return false;

              // 1. Did the user request to re-enter/edit a specific field while submitting?
              const editIdx = detectFieldToEdit(text, formFields);
              if (editIdx !== -1) {
                isHandled = true;
                try { rec.abort(); } catch {}
                setIsListening(false);
                const targetField = formFields[editIdx];

                // Clear current value of the field for fresh re-entry
                setFormData((prev) => ({ ...prev, [targetField.key]: '' }));

                // Directly run the step in editing mode with clean prompt
                runVoiceStepRef.current?.(editIdx, false, true);
                return true;
              }

              // 2. Check explicit submit command (NEVER submits if change/edit words were present)
              if (isSubmitCommand(text)) {
                isHandled = true;
                try { rec.abort(); } catch {}
                setIsListening(false);
                submitFormDirectlyRef.current?.();
                return true;
              }

              return false;
            };

            rec.onresult = (e) => {
              if (!isMounted.current || isHandled) return;
              let heard = '';
              for (let i = 0; i < e.results.length; i++) {
                heard += e.results[i][0].transcript;
              }
              const clean = heard.toLowerCase().trim();
              lastSubmitUtterance = clean;
              const isFinal = !!e.results[e.results.length - 1]?.isFinal;

              const editIdx = detectFieldToEdit(clean, formFields);
              if (editIdx !== -1) {
                handleDecision(clean);
                return;
              }

              if (isFinal) {
                handleDecision(clean);
              }
            };

            rec.onerror = () => {
              if (isMounted.current) setIsListening(false);
            };

            rec.onend = () => {
              if (!isMounted.current) return;
              setIsListening(false);

              if (!isHandled && lastSubmitUtterance) {
                if (handleDecision(lastSubmitUtterance)) return;
              }

              setTimeout(() => {
                if (
                  isMounted.current &&
                  voiceAutoPilotRef.current &&
                  activeStepRef.current >= formFields.length &&
                  !isSubmittingRef.current &&
                  !isHandled
                ) {
                  startSubmitMic();
                }
              }, 600);
            };

            rec.start();
          } catch (err) {
            logger.warn('MIC_EXCEPTION', err.message);
          }
        };

        const visitorName = formDataRef.current?.Name
          ? formatField('Name', formDataRef.current.Name, 'text')
          : 'Visitor';

        await speakWithVoice(
          `Thank you ${visitorName}! Please say Submit to complete your registration, or say Change Name to edit any field.`,
          {
            gender: voiceGender,
            rate: speechRate,
            pitch: speechPitch,
            onEnd: startSubmitMic,
            onError: startSubmitMic,
          }
        );
        return;
      }

      const current = formFields[stepIndex];
      setActiveStep(stepIndex);
      activeStepRef.current = stepIndex;
      lastTranscriptRef.current = '';

      stopAudio();

      const isMobile = current.key.toLowerCase() === 'mobile' || current.type === 'tel';
      const isEmail = current.key.toLowerCase() === 'email' || current.type === 'email';

      let spokenPrompt = '';
      if (isRetry) {
        spokenPrompt = retrySpeechPrompt || current.retryPrompt || (isMobile ? 'Please tell me your 10-digit Mobile Number.' : `Please provide your ${current.label}.`);
      } else if (isEditingMode) {
        if (isMobile) {
          spokenPrompt = 'Sure, please tell me your 10-digit Phone Number.';
        } else if (isEmail) {
          spokenPrompt = 'Sure, please tell me your Email address.';
        } else if (current.key === 'Place') {
          spokenPrompt = 'Sure, where are you coming from?';
        } else if (current.key === 'Visit') {
          spokenPrompt = 'Sure, what is the purpose of your visit?';
        } else {
          spokenPrompt = `Sure, please tell me your new ${current.label}.`;
        }
      } else {
        spokenPrompt = current.prompt;
      }

      setStatusMessage(`Aurra: "${spokenPrompt}"`);
      setIsSpeaking(true);

      const startMic = () => {
        if (!isMounted.current || !voiceAutoPilotRef.current) return;
        setIsSpeaking(false);

        if (isRetry || isEditingMode || clearOnMic) {
          setFormData((prev) => ({ ...prev, [current.key]: '' }));
          lastTranscriptRef.current = '';
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          setStatusMessage('Microphone STT unavailable. Please type manually.');
          return;
        }

        try {
          const rec = new SpeechRec();
          recognitionRef.current = rec;
          rec.lang = 'en-IN';
          rec.continuous = false;
          rec.interimResults = true;

          rec.onstart = () => {
            if (!isMounted.current) return;
            setIsListening(true);
            setStatusMessage(`Listening for ${current.label}... speak now`);
          };

          rec.onresult = (e) => {
            if (!isMounted.current) return;
            let captured = '';
            for (let i = 0; i < e.results.length; i++) {
              captured += e.results[i][0].transcript;
            }
            if (captured.trim()) {
              const formatted = formatField(current.key, captured, current.type);
              lastTranscriptRef.current = formatted;
              setFormData((prev) => ({ ...prev, [current.key]: formatted }));
            }
          };

          rec.onerror = () => {
            if (isMounted.current) setIsListening(false);
          };

          rec.onend = () => {
            if (!isMounted.current) return;
            setIsListening(false);

            const rawVal = lastTranscriptRef.current || formDataRef.current[current.key] || '';
            const val = formatField(current.key, rawVal, current.type);
            setFormData((prev) => ({ ...prev, [current.key]: val }));

            // Check if user requested to switch or re-enter another field
            const switchIdx = detectFieldToEdit(val, formFields);
            if (switchIdx !== -1) {
              const nextField = formFields[switchIdx];
              setFormData((prev) => ({ ...prev, [nextField.key]: '' }));
              runVoiceStepRef.current?.(switchIdx, false, true);
              return;
            }

            const valRes = validateField(current, val);

            if (valRes.valid && (val || !current.required)) {
              setFieldErrors((prev) => ({ ...prev, [current.key]: false }));
              setFieldErrorsText((prev) => ({ ...prev, [current.key]: '' }));

              const allOthersValid = formFields.every((f, idx) => {
                if (idx === stepIndex) return true;
                const v = formDataRef.current[f.key];
                return validateField(f, v).valid;
              });

              if (isEditingMode || allOthersValid) {
                // Return to final review and submission step!
                speakWithVoice(`Updated your ${current.label}! Say Submit to confirm, or tell me if you want to change any other detail.`, {
                  gender: voiceGender,
                  rate: speechRate,
                  pitch: speechPitch,
                  onEnd: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      runVoiceStepRef.current?.(formFields.length);
                    }
                  },
                  onError: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      runVoiceStepRef.current?.(formFields.length);
                    }
                  },
                });
                return;
              }

              setTimeout(() => {
                if (isMounted.current && voiceAutoPilotRef.current) {
                  runVoiceStepRef.current?.(stepIndex + 1, false, false);
                }
              }, 400);
            } else {
              setFieldErrors((prev) => ({ ...prev, [current.key]: true }));
              setFieldErrorsText((prev) => ({ ...prev, [current.key]: valRes.error }));
              const speechPrompt = valRes.speechError || current.retryPrompt || valRes.error;
              setStatusMessage(`Aurra: "${speechPrompt}"`);
              showToast(valRes.error || `Please enter ${current.label}`, 'error');

              setTimeout(() => {
                if (isMounted.current && voiceAutoPilotRef.current) {
                  runVoiceStepRef.current?.(
                    stepIndex,
                    true,
                    isEditingMode,
                    valRes.speechError,
                    valRes.isIncompleteDigits
                  );
                }
              }, 400);
            }
          };

          rec.start();
        } catch (err) {
          logger.error('MIC_EXCEPTION', err.message);
          setIsListening(false);
        }
      };

      await speakWithVoice(spokenPrompt, {
        gender: voiceGender,
        rate: speechRate,
        pitch: speechPitch,
        onEnd: startMic,
        onError: startMic,
      });
    },
    [formFields, voiceGender, speechRate, speechPitch, stopAudio, showToast]
  );

  const runVoiceStepRef = useRef(runVoiceStep);
  runVoiceStepRef.current = runVoiceStep;

  useEffect(() => {
    isMounted.current = true;

    if (voiceNavigationService?.stopListening) {
      voiceNavigationService.stopListening(true);
    }

    const startTimer = setTimeout(() => {
      if (isMounted.current && voiceAutoPilotRef.current) {
        runVoiceStepRef.current?.(0);
      }
    }, 600);

    return () => {
      isMounted.current = false;
      clearTimeout(startTimer);
      stopAudioRef.current?.();
    };
  }, []);

  // User taps an input field or Edit button directly to re-enter
  const handleSelectField = (index) => {
    const targetField = formFields[index];
    if (!targetField) return;
    stopAudio();
    setFormData((prev) => ({ ...prev, [targetField.key]: '' }));
    runVoiceStep(index, false, true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: false }));
    setFieldErrorsText((prev) => ({ ...prev, [name]: '' }));
  };

  const submitFormDirectly = async () => {
    if (!isMounted.current || isSubmitting) return;

    const current = formDataRef.current;

    for (let i = 0; i < formFields.length; i++) {
      const f = formFields[i];
      const res = validateField(f, current[f.key]);
      if (!res.valid) {
        showToast(res.error, 'error');
        setStatusMessage(res.error);
        setFieldErrors((prev) => ({ ...prev, [f.key]: true }));
        runVoiceStepRef.current?.(i, true);
        return;
      }
    }

    setIsSubmitting(true);
    stopAudio();

    const record = {
      name: formatField('Name', current.Name || '', 'text'),
      phone: (current.Mobile || '').replace(/\D/g, '').slice(0, 10),
      mobile: (current.Mobile || '').replace(/\D/g, '').slice(0, 10),
      email: formatField('Email', current.Email || '', 'email'),
      purpose: current.Visit?.trim() || 'Visitor Admission',
      visit: current.Visit?.trim() || 'Visitor Admission',
      place: formatField('Place', current.Place || '', 'text'),
      host: 'Reception Desk',
      badgeType: 'Standard Visitor',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    try {
      await offlineVisitorService.registerVisitor(record);
      raspberryPiService.triggerAction('nod');

      showToast('Registration submitted successfully!', 'success');
      setStatusMessage(`Thank you ${record.name}! Registration complete.`);

      let navigated = false;
      const navigateHome = () => {
        if (navigated) return;
        navigated = true;
        if (onNavigate) onNavigate('/');
      };

      const fallbackTimer = setTimeout(navigateHome, 6000);

      speakWithVoice(`Thank you ${record.name}. Your form has been submitted successfully.`, {
        gender: voiceGender,
        rate: speechRate,
        pitch: speechPitch,
        onEnd: () => {
          clearTimeout(fallbackTimer);
          setTimeout(navigateHome, 400);
        },
        onError: () => {
          clearTimeout(fallbackTimer);
          setTimeout(navigateHome, 400);
        },
      });
    } catch (err) {
      logger.error('FORM_SUBMIT_ERROR', err);
      showToast('Failed to submit. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  submitFormDirectlyRef.current = submitFormDirectly;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    submitFormDirectly();
  };

  return (
    <div className="aurra-nexus-reg-page">
      {/* ── TOP HEADER (EXACT NEXUS ARCHITECTURE WITH REAL LIVE BATTERY PERCENTAGE) ── */}
      <header className="nexus-reg-topbar">
        {/* Left Back Arrow */}
        <button
          type="button"
          className="nexus-back-arrow-btn"
          onClick={() => {
            stopAudio();
            onNavigate?.('/');
          }}
          title="Back"
        >
          <ArrowLeft size={22} />
        </button>

        {/* Center Pill: AURRA + App-Adapted Cyan/Blue VISITOR REGISTRATION */}
        <div className="nexus-brand-title-pill">
          <span className="brand-text-aurra">AURRA</span>
          <span className="badge-reg-label">VISITOR REGISTRATION</span>
        </div>

        {/* Right Battery & Status Indicator with Real Percentage */}
        <div className="nexus-top-battery-badge" title={`Battery: ${batteryLevel ?? '--'}%`}>
          <span className={`battery-status-dot ${isCharging ? 'charging' : ''}`} />
          <span className="battery-pct-text">
            {batteryLevel !== null ? `${batteryLevel}%` : '--%'}
          </span>
          {isCharging ? (
            <BatteryCharging size={18} className="battery-icon charging" />
          ) : (
            <Battery size={18} className="battery-icon" />
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER (ROBOT SCENE BACKGROUND + FLOATING FORM CARD) ── */}
      <div className="nexus-reg-body">
        <main className="nexus-reg-card">
          {/* Conversational Status Banner with Live Indicator */}
          <div className="nexus-voice-chip-row">
            <div className={`nexus-voice-chip ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
              {isSpeaking ? (
                <>
                  <Volume2 size={14} className="pulse-icon" />
                  <span>{statusMessage}</span>
                </>
              ) : isListening ? (
                <>
                  <Mic size={14} className="pulse-icon" />
                  <span>Now you can speak now... ({formFields[activeStep]?.label || 'Answer'})</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} color="#00f0ff" />
                  <span>{statusMessage}</span>
                </>
              )}
            </div>

            <button
              type="button"
              className="nexus-mute-btn"
              onClick={stopAudio}
              title="Stop voice"
            >
              <VolumeX size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* 1. Full Name */}
            <div className={`nexus-form-group ${fieldErrors.Name ? 'has-error' : ''}`}>
              <div className="field-label-row">
                <label className="nexus-field-label">Full Name</label>
                {formData.Name && (
                  <button
                    type="button"
                    className="field-reenter-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectField(0);
                    }}
                    title="Click to re-enter Name"
                  >
                    ✎ Edit
                  </button>
                )}
              </div>
              <input
                type="text"
                name="Name"
                className="nexus-text-input"
                placeholder="Enter your full name"
                value={formData.Name}
                onChange={handleChange}
                onClick={() => handleSelectField(0)}
                autoComplete="off"
              />
              {fieldErrors.Name && (
                <span className="field-error-msg">{fieldErrorsText.Name || 'Full Name is required'}</span>
              )}
            </div>

            {/* 2. Phone Number & Email Address (2-Column Row as in Nexus) */}
            <div className="nexus-form-row-2col">
              <div className={`nexus-form-group ${fieldErrors.Mobile ? 'has-error' : ''}`}>
                <div className="field-label-row">
                  <label className="nexus-field-label">Phone Number</label>
                  {formData.Mobile && (
                    <button
                      type="button"
                      className="field-reenter-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectField(1);
                      }}
                      title="Click to re-enter Phone Number"
                    >
                      ✎ Edit
                    </button>
                  )}
                </div>
                <input
                  type="tel"
                  name="Mobile"
                  className="nexus-text-input"
                  placeholder="Enter 10-digit number"
                  maxLength={10}
                  value={formData.Mobile}
                  onChange={handleChange}
                  onClick={() => handleSelectField(1)}
                  autoComplete="off"
                />
                {fieldErrors.Mobile && (
                  <span className="field-error-msg">{fieldErrorsText.Mobile || '10-digit number required'}</span>
                )}
              </div>

              <div className={`nexus-form-group ${fieldErrors.Email ? 'has-error' : ''}`}>
                <div className="field-label-row">
                  <label className="nexus-field-label">Email Address</label>
                  {formData.Email && (
                    <button
                      type="button"
                      className="field-reenter-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectField(2);
                      }}
                      title="Click to re-enter Email"
                    >
                      ✎ Edit
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  name="Email"
                  className="nexus-text-input"
                  placeholder="example@domain.com"
                  value={formData.Email}
                  onChange={handleChange}
                  onClick={() => handleSelectField(2)}
                  autoComplete="off"
                />
                {fieldErrors.Email && (
                  <span className="field-error-msg">{fieldErrorsText.Email || 'Valid email required'}</span>
                )}
              </div>
            </div>

            {/* 3. Purpose of Visit */}
            <div className={`nexus-form-group ${fieldErrors.Visit ? 'has-error' : ''}`}>
              <div className="field-label-row">
                <label className="nexus-field-label">Purpose of Visit</label>
                {formData.Visit && (
                  <button
                    type="button"
                    className="field-reenter-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectField(3);
                    }}
                    title="Click to re-enter Purpose"
                  >
                    ✎ Edit
                  </button>
                )}
              </div>
              <input
                type="text"
                name="Visit"
                className="nexus-text-input"
                placeholder="Please enter the purpose of your visit..."
                value={formData.Visit}
                onChange={handleChange}
                onClick={() => handleSelectField(3)}
                autoComplete="off"
              />
              {fieldErrors.Visit && (
                <span className="field-error-msg">{fieldErrorsText.Visit || 'Purpose of visit is required'}</span>
              )}
            </div>

            {/* 4. Place of Visit */}
            <div className={`nexus-form-group ${fieldErrors.Place ? 'has-error' : ''}`}>
              <div className="field-label-row">
                <label className="nexus-field-label">Place of Visit</label>
                {formData.Place && (
                  <button
                    type="button"
                    className="field-reenter-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectField(4);
                    }}
                    title="Click to re-enter Place"
                  >
                    ✎ Edit
                  </button>
                )}
              </div>
              <input
                type="text"
                name="Place"
                className="nexus-text-input"
                placeholder="Where are you from? / Enter location"
                value={formData.Place}
                onChange={handleChange}
                onClick={() => handleSelectField(4)}
                autoComplete="off"
              />
              {fieldErrors.Place && (
                <span className="field-error-msg">{fieldErrorsText.Place || 'Place of visit is required'}</span>
              )}
            </div>

            {/* 5. Submit Button */}
            <div className="nexus-submit-row">
              <button
                type="submit"
                className="nexus-submit-btn"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'SUBMITTING...' : 'SUBMIT'}</span>
                <Send size={16} className="submit-icon" />
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {toast.show && (
        <div className={`nexus-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
