import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import { cancelSpeech, speakWithVoice } from '../../utils/speechSynthesis';
import { offlineVisitorService } from '../../db/offlineServices';
import { kioskConfigService, DEFAULT_FORM_FIELDS } from '../../services/kioskConfigService';
import { raspberryPiService } from '../../services/raspberryPiService';
import { logger } from '../../services/logger';
import './VisitorRegistration.css';

// ── Static Pure Utility Functions (Zero-Allocation on Re-renders) ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Conversational sentence prefixes for speech extraction
const NAME_PREFIXES = [
  // "my full name is", "my name is", "my good name is", "my real name is", "my official name is", "my first name is", "my name's", "my name"
  /^(?:my\s+(?:full\s+|real\s+|good\s+|official\s+|first\s+)?name\s*(?:is|'s)?)\s+/i,
  // "full name is", "real name is", "good name is", "official name is", "name is", "name called", "name would be"
  /^(?:(?:full\s+|real\s+|good\s+|official\s+)?name\s+(?:is|called|would\s+be))\s+/i,
  // "this is", "myself", "it is", "it's", "its"
  /^(?:this\s+is|myself|it\s+is|it's|its)\s+/i,
  // "i am", "i'm", "im"
  /^(?:i\s+am|i'm|im)\s+/i,
  // "you can call me", "they call me", "people call me", "call me", "known as", "i go by"
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

  // Strip greetings: "hello", "hi", "hey", "good morning", etc.
  res = res.replace(/^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)[,\s]+/i, '');

  // Strip conversational preamble like "actually", "well", "i told you", "i said that"
  res = res.replace(/^(?:actually|well|yeah|yes|ok|okay)[,\s]+/i, '');
  res = res.replace(/^(?:i\s+(?:already\s+)?(?:told|tol|said)(?:\s+(?:you|that))*[,\s]+)/i, '');
  res = res.replace(/^(?:actually|well|yeah|yes|ok|okay)[,\s]+/i, '');

  // Strip field-specific conversational prefix
  for (const prefixRegex of specificPrefixes) {
    if (prefixRegex.test(res)) {
      res = res.replace(prefixRegex, '').trim();
      break;
    }
  }

  // Strip trailing name or place declarations
  res = res.replace(/\s+(?:is\s+(?:my\s+)?(?:full\s+)?name|this\s+side|here|speaking)$/i, '');
  res = res.replace(/\s+(?:is\s+my\s+(?:native|place|city|hometown)|is\s+where\s+i\s+come\s+from)$/i, '');

  // Strip trailing polite filler: "please", "sir", "madam", "thank you", "thanks"
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

  // 1. Mobile / Phone
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

  // 2. Email
  if (keyLower === 'email' || type === 'email') {
    let email = cleanConversationalPrefix(clean, EMAIL_PREFIXES).toLowerCase();
    email = email.replace(/\s+(?:at(?:\s+the)?\s+rate|at)\s+/gi, '@');
    email = email.replace(/\s+dot\s+/gi, '.');
    email = email.replace(/\s+underscore\s+/gi, '_');
    email = email.replace(/\s+(?:dash|hyphen)\s+/gi, '-');
    email = email.replace(/\s+/g, '');
    return email;
  }

  // 3. Name (strips "my full name is", "my name is", "i am", "myself", phonetic "eragunath" -> "ragunath")
  if (keyLower === 'name') {
    let name = cleanConversationalPrefix(clean, NAME_PREFIXES);
    name = name.replace(/^e(?=ragunath\b)/i, '');
    return toTitleCase(name);
  }

  // 4. Place / Location / City (strips "i am coming from", "from", normalizes "salen" -> "Salem")
  if (keyLower === 'place' || keyLower === 'city' || keyLower === 'location' || keyLower === 'from') {
    let place = cleanConversationalPrefix(clean, PLACE_PREFIXES);
    if (place.toLowerCase() === 'salen') {
      place = 'Salem';
    }
    return toTitleCase(place);
  }

  // 5. Purpose of Visit / Visit - Completely take all without changing words as requested!
  if (keyLower === 'visit' || keyLower === 'purpose') {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Generic fallback
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
  } else if (keyLower === 'visit') {
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
  } else if (isRequired && val.length < 1) {
    return {
      valid: false,
      error: `${field.label} is compulsory`,
      speechError: `Please tell me your ${field.label}.`,
    };
  }

  return { valid: true };
};

// ── Voice Intent Detectors (Field Editing & Submission) ──
const detectFieldToEdit = (text, fields) => {
  if (!text) return -1;
  const t = text.toLowerCase().trim();

  const changeIndicators = [
    'change', 'edit', 'update', 'modify', 'correct', 'wrong', 'fix',
    'reenter', 're-enter', 'redo', 'replace', 'new', 'different', 'switch'
  ];

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
    t.includes('change the name') ||
    t.includes('correct my name') ||
    t.includes('enter name again') ||
    t === 'name' ||
    t === 'full name' ||
    t === 'my name'
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
    t.includes('wish to change mobile') ||
    t.includes('want to change mobile') ||
    t.includes('want to change number') ||
    t.includes('change my number') ||
    t.includes('change my mobile') ||
    t === 'mobile' ||
    t === 'phone' ||
    t === 'number' ||
    t === 'mobile number'
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
    t.includes('wish to change email') ||
    t.includes('want to change email') ||
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
    t.includes('change reason') ||
    t.includes('wrong purpose') ||
    t.includes('wrong visit') ||
    t.includes('wish to change visit') ||
    t.includes('want to change purpose') ||
    t.includes('want to change visit') ||
    t === 'visit' ||
    t === 'purpose' ||
    t === 'purpose of visit'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'visit' || f.key.toLowerCase() === 'purpose');
    if (idx !== -1) return idx;
  }

  // 5. Place / Location / Origin
  if (
    t.includes('change place') ||
    t.includes('edit place') ||
    t.includes('change city') ||
    t.includes('edit city') ||
    t.includes('change location') ||
    t.includes('wrong place') ||
    t.includes('wrong city') ||
    t.includes('wish to change place') ||
    t.includes('want to change place') ||
    t.includes('change where i came from') ||
    t === 'place' ||
    t === 'city' ||
    t === 'location'
  ) {
    const idx = fields.findIndex((f) => f.key.toLowerCase() === 'place' || f.key.toLowerCase() === 'city');
    if (idx !== -1) return idx;
  }

  // 6. Custom dynamic fields
  const hasChangeWord = changeIndicators.some((ind) => t.includes(ind));
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const keyL = (f.key || '').toLowerCase();
    const lblL = (f.label || '').toLowerCase();
    if (
      t === keyL ||
      t === lblL ||
      t.includes(`change ${lblL}`) ||
      t.includes(`edit ${lblL}`) ||
      t.includes(`change ${keyL}`) ||
      t.includes(`edit ${keyL}`) ||
      (hasChangeWord && (t.includes(lblL) || t.includes(keyL)))
    ) {
      return i;
    }
  }

  return -1;
};

const isSubmitCommand = (text) => {
  if (!text) return false;
  const t = text.toLowerCase().trim();

  // If user mentions changing, editing, waiting, or negation, NEVER submit!
  if (
    t.includes('change') ||
    t.includes('edit') ||
    t.includes('update') ||
    t.includes('modify') ||
    t.includes('wrong') ||
    t.includes('correct') ||
    t.includes('wait') ||
    t.includes('stop') ||
    t.includes('hold on') ||
    t.includes('no ') ||
    t === 'no' ||
    t.includes('cancel')
  ) {
    return false;
  }

  // Explicit submit phrases only
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
    t === 'save registration' ||
    t === 'proceed to submit'
  );
};

export default function VisitorRegistration({ onNavigate }) {
  // Master kiosk settings cached safely in ref to prevent re-render invalidation
  const kioskConfigRef = useRef(kioskConfigService.getConfig());
  const kioskConfig = kioskConfigRef.current;
  const voiceGender = kioskConfig?.voiceGender || 'female';
  const speechRate = kioskConfig?.speechRate || 1.0;
  const speechPitch = kioskConfig?.speechPitch || 1.05;

  // Active form fields memoized once on mount for absolute 60 FPS stability
  const activeFields = useMemo(() => {
    return (kioskConfig?.formFields && Array.isArray(kioskConfig.formFields) && kioskConfig.formFields.length > 0)
      ? kioskConfig.formFields.filter((f) => f.enabled !== false)
      : DEFAULT_FORM_FIELDS;
  }, [kioskConfig]);

  const [formData, setFormData] = useState(() => {
    const init = {};
    activeFields.forEach((f) => {
      init[f.key] = '';
    });
    return init;
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldErrorsText, setFieldErrorsText] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceAutoPilot, setVoiceAutoPilot] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Initializing voice registration...');
  const [fps, setFps] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [logs, setLogs] = useState([]);

  // Refs for safe async state
  const isMounted = useRef(true);
  const activeStepRef = useRef(0);
  const formDataRef = useRef(formData);
  const voiceAutoPilotRef = useRef(true);
  const recognitionRef = useRef(null);
  const lastTranscriptRef = useRef('');

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

  const showToast = useCallback((message, type = 'success') => {
    logger.info('FORM_UI', `Toast: [${type}] ${message}`);
    setToast({ show: true, message, type });
    setTimeout(() => {
      if (isMounted.current) setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }, []);

  // ── Lightweight Real FPS Counter Loop ──
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const measure = (now) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        const calculatedFps = Math.round((frameCount * 1000) / (now - lastTime));
        setFps(calculatedFps);
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measure);
    };

    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Safely stop speech and recognition
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

  // ── Conversational Step Executor with Voice Editing & Compulsory Retry Loop ──
  const runVoiceStep = useCallback(
    async (stepIndex, isRetry = false, isEditingMode = false, retrySpeechPrompt = '', clearOnMic = false) => {
      if (!isMounted.current || !voiceAutoPilotRef.current) return;

      // Completion stage: check if all fields satisfy compulsory requirements
      if (stepIndex >= activeFields.length) {
        const firstInvalidIdx = activeFields.findIndex((f) => {
          const val = formDataRef.current[f.key];
          return !validateField(f, val).valid;
        });

        if (firstInvalidIdx !== -1) {
          const missingField = activeFields[firstInvalidIdx];
          const valRes = validateField(missingField, formDataRef.current[missingField.key]);
          const promptToSpeak = missingField.retryPrompt || `Please provide your ${missingField.label}.`;
          setStatusMessage(`Missing: ${missingField.label}`);
          showToast(valRes.error || `Please enter ${missingField.label}`, 'error');
          setFieldErrors((prev) => ({ ...prev, [missingField.key]: true }));
          logger.speech('VALIDATION_MISSING', `Step check failed for ${missingField.key}`);

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

        // All fields verified and filled
        setStatusMessage('All details recorded! Say "Submit" to confirm, or say "Change Name" to edit.');
        logger.info('VOICE_FLOW', 'Completed all form fields. Listening for voice submit confirmation or edit commands.');

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
              logger.speech('MIC_START', 'Listening for submit confirmation or edit command');
            };

            let lastSubmitUtterance = '';
            let isHandled = false;

            const handleDecision = (text) => {
              if (isHandled || !text) return false;

              // 1. Did the user request to edit a specific field? (e.g. "change name", "i want to change name", "wrong email")
              const editIdx = detectFieldToEdit(text, activeFields);
              if (editIdx !== -1) {
                isHandled = true;
                try { rec.abort(); } catch {}
                setIsListening(false);
                const targetField = activeFields[editIdx];
                logger.speech('VOICE_EDIT_REQUEST', `User requested to edit field: ${targetField.key}`);

                // Clear current value of the field for fresh input
                setFormData((prev) => ({ ...prev, [targetField.key]: '' }));

                // Directly run the step in editing mode with single clean prompt
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

              // 3. Did user say a general change request ("i want to change", "edit") without naming the field?
              if (text.includes('change') || text.includes('edit') || text.includes('modify')) {
                isHandled = true;
                try { rec.abort(); } catch {}
                setIsListening(false);
                speakWithVoice('Which detail would you like to change? You can say Name, Mobile, Email, Purpose of Visit, or Place.', {
                  gender: voiceGender,
                  rate: speechRate,
                  pitch: speechPitch,
                  onEnd: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      startSubmitMic();
                    }
                  },
                  onError: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      startSubmitMic();
                    }
                  },
                });
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
              logger.speech('MIC_CONFIRM', `Heard input at submit stage: "${clean}" (isFinal: ${isFinal})`);

              // If a specific field was mentioned, handle immediately even mid-speech
              const editIdx = detectFieldToEdit(clean, activeFields);
              if (editIdx !== -1) {
                handleDecision(clean);
                return;
              }

              // Only process submit or general fallback when utterance is finalized
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

              // Check unprocessed final speech if present
              if (!isHandled && lastSubmitUtterance) {
                if (handleDecision(lastSubmitUtterance)) {
                  return;
                }
              }

              // Patiently restart listening if still on submit review screen and not submitting
              setTimeout(() => {
                if (
                  isMounted.current &&
                  voiceAutoPilotRef.current &&
                  activeStepRef.current >= activeFields.length &&
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

      const current = activeFields[stepIndex];
      setActiveStep(stepIndex);
      activeStepRef.current = stepIndex;
      lastTranscriptRef.current = '';

      stopAudio();

      const isMobile = current.key.toLowerCase() === 'mobile' || current.type === 'tel';
      const isEmail = current.key.toLowerCase() === 'email' || current.type === 'email';

      let spokenPrompt = '';
      if (isRetry) {
        spokenPrompt = retrySpeechPrompt || current.retryPrompt || (isMobile ? 'Please tell me your 10-digit Mobile Number.' : `Please tell me your ${current.label}.`);
      } else if (isEditingMode) {
        if (isMobile) {
          spokenPrompt = 'Sure, please tell me your 10-digit Mobile Number.';
        } else if (isEmail) {
          spokenPrompt = 'Sure, please tell me your Email address.';
        } else if (current.key.toLowerCase() === 'place') {
          spokenPrompt = 'Sure, where are you coming from?';
        } else if (current.key.toLowerCase() === 'visit') {
          spokenPrompt = 'Sure, what is the purpose of your visit?';
        } else {
          spokenPrompt = `Sure, please tell me your new ${current.label}.`;
        }
      } else {
        spokenPrompt = current.prompt;
      }

      setStatusMessage(`Aurra: "${spokenPrompt}"`);
      setIsSpeaking(true);
      logger.speech(
        'VOICE_PROMPT',
        `Step ${stepIndex + 1}/${activeFields.length} (${current.key}): "${spokenPrompt}"`
      );

      const startMic = () => {
        if (!isMounted.current || !voiceAutoPilotRef.current) return;
        setIsSpeaking(false);

        // When mic starts on retry (e.g. incomplete number) or editing mode,
        // clear the field so that the old wrong/incomplete value is cleared for new speech!
        if (isRetry || isEditingMode || clearOnMic) {
          setFormData((prev) => ({ ...prev, [current.key]: '' }));
          lastTranscriptRef.current = '';
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          setStatusMessage('Microphone STT unavailable. Please type manually.');
          logger.warn('VOICE_STT', 'SpeechRecognition API not available in WebView');
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
            logger.speech('MIC_START', `Listening for field: ${current.key}`);
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

          rec.onerror = (err) => {
            logger.warn('MIC_ERROR', `STT Error on ${current.key}: ${err?.error || 'unknown'}`);
            if (isMounted.current) {
              setIsListening(false);
            }
          };

          rec.onend = () => {
            if (!isMounted.current) return;
            setIsListening(false);

            const rawVal = lastTranscriptRef.current || formDataRef.current[current.key] || '';
            const val = formatField(current.key, rawVal, current.type);
            setFormData((prev) => ({ ...prev, [current.key]: val }));
            logger.speech('MIC_END', `Field ${current.key} value: "${val}"`);

            // Check if user spoke a command to switch/edit any field
            const switchIdx = detectFieldToEdit(val, activeFields);
            if (switchIdx !== -1) {
              const nextField = activeFields[switchIdx];
              setFormData((prev) => ({ ...prev, [nextField.key]: '' }));
              runVoiceStepRef.current?.(switchIdx, false, true);
              return;
            }

            const valRes = validateField(current, val);

            if (valRes.valid && (val || !current.required)) {
              // Valid entry! Clear error
              setFieldErrors((prev) => ({ ...prev, [current.key]: false }));
              setFieldErrorsText((prev) => ({ ...prev, [current.key]: '' }));

              // Check if all other fields are already valid
              const allOthersValid = activeFields.every((f, idx) => {
                if (idx === stepIndex) return true;
                const v = formDataRef.current[f.key];
                return validateField(f, v).valid;
              });

              if (isEditingMode || allOthersValid) {
                // Return to final review & submission step!
                speakWithVoice(`Updated your ${current.label}! Say Submit to confirm, or tell me if you want to change any other detail.`, {
                  gender: voiceGender,
                  rate: speechRate,
                  pitch: speechPitch,
                  onEnd: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      runVoiceStepRef.current?.(activeFields.length);
                    }
                  },
                  onError: () => {
                    if (isMounted.current && voiceAutoPilotRef.current) {
                      runVoiceStepRef.current?.(activeFields.length);
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
              // Compulsory field is empty or failed validation
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
          logger.error('MIC_EXCEPTION', `Failed to start STT: ${err.message}`);
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
    [activeFields, voiceGender, speechRate, speechPitch, stopAudio]
  );

  const runVoiceStepRef = useRef(runVoiceStep);
  runVoiceStepRef.current = runVoiceStep;

  // ── Lifecycle on Mount ──
  useEffect(() => {
    isMounted.current = true;
    logger.info('FORM_LIFECYCLE', 'VisitorRegistration mounted (No camera, pure lightweight UI)');

    // Pause global voice navigation to prevent background dual-mic audio conflicts
    if (voiceNavigationService?.stopListening) {
      voiceNavigationService.stopListening(true);
      logger.info('VOICE_NAV', 'Paused background voiceNavigationService for form');
    }

    // Start auto voice conversation after small delay
    const startTimer = setTimeout(() => {
      if (isMounted.current && voiceAutoPilotRef.current) {
        runVoiceStepRef.current?.(0);
      }
    }, 500);

    return () => {
      isMounted.current = false;
      clearTimeout(startTimer);
      stopAudioRef.current?.();
      logger.info('FORM_LIFECYCLE', 'VisitorRegistration unmounted cleanly');
    };
  }, []); // Run strictly ONCE on component mount!

  // User taps an input field or Edit button directly to edit
  const handleSelectField = (index) => {
    const targetField = activeFields[index];
    if (!targetField) return;
    logger.info('USER_TAP', `User tapped to edit field: ${targetField.key}`);
    stopAudio();
    setFormData((prev) => ({ ...prev, [targetField.key]: '' }));
    runVoiceStep(index, false, true);
  };

  // Manual input edit
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: false }));
    setFieldErrorsText((prev) => ({ ...prev, [name]: '' }));
  };

  // Toggle voice auto-pilot
  const toggleVoiceAutoPilot = () => {
    if (voiceAutoPilot) {
      stopAudio();
      setVoiceAutoPilot(false);
      setStatusMessage('Voice auto-pilot paused. Manual typing enabled.');
      logger.info('VOICE_TOGGLE', 'Voice auto-pilot paused by user');
    } else {
      setVoiceAutoPilot(true);
      logger.info('VOICE_TOGGLE', 'Voice auto-pilot resumed by user');
      runVoiceStep(activeStep);
    }
  };

  // View diagnostic logs modal
  const handleOpenLogs = () => {
    setLogs(logger.getLogs());
    setShowLogViewer(true);
  };

  // Submit Registration directly (called via voice confirmation or touch button)
  const submitFormDirectly = async () => {
    if (!isMounted.current || isSubmitting) return;

    const current = formDataRef.current;

    // Validate all compulsory fields
    for (let i = 0; i < activeFields.length; i++) {
      const f = activeFields[i];
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
      gender: '',
      purpose: current.Visit?.trim() || current.purpose || 'Visitor Admission',
      visit: current.Visit?.trim() || current.purpose || 'Visitor Admission',
      place: formatField('Place', current.Place || '', 'text'),
      company: formatField('Place', current.Place || '', 'text') || 'Visitor',
      host: 'Reception Desk',
      badgeType: 'Standard Visitor',
      photo: null,
      status: 'ACTIVE',
      ...current, // Stores any custom fields as well
    };

    logger.info('FORM_SUBMIT', record);

    try {
      await offlineVisitorService.registerVisitor(record);
      raspberryPiService.triggerAction('nod');

      showToast('Registration submitted successfully!', 'success');
      setStatusMessage(`Thank you ${record.name}! Registration complete.`);

      let navigated = false;
      const navigateHome = () => {
        if (navigated) return;
        navigated = true;
        if (onNavigate) {
          onNavigate('/');
        }
      };

      // Fallback timer: in case onEnd never triggers, navigate home safely after 6 seconds
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
      logger.error('FORM_SUBMIT_ERROR', err.message);
      showToast('Failed to submit. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  submitFormDirectlyRef.current = submitFormDirectly;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    submitFormDirectly();
  };

  const currentActiveKey = activeFields[activeStep]?.key;

  return (
    <div className="simple-form-page">
      {/* ── TOP HEADER WITH LIVE FPS & LOGS BUTTON ── */}
      <header className="simple-header">
        <button
          type="button"
          className="simple-back-btn"
          onClick={() => {
            stopAudio();
            onNavigate?.('/');
          }}
        >
          ← Back
        </button>

        <div className="simple-header-title">
          <h1>Visitor Registration</h1>
        </div>

        <div className="simple-header-right">
          <button
            type="button"
            className="simple-fps-badge"
            onClick={handleOpenLogs}
            title="Click to view background diagnostic logs"
          >
            <span className="fps-indicator-dot"></span>
            <span>{fps} FPS</span>
            <span className="logs-tag">Logs</span>
          </button>
        </div>
      </header>

      {/* ── CENTRAL CLEAN FORM CARD ── */}
      <main className="simple-card">
        {/* Voice Conversational Status Banner */}
        <div className={`simple-voice-banner ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
          <div className="voice-icon">
            {isSpeaking ? '🔊' : isListening ? '🎙' : '⚡'}
          </div>
          <div className="voice-message">
            {statusMessage}
          </div>
          <button
            type="button"
            className={`voice-toggle-btn ${voiceAutoPilot ? 'active' : ''}`}
            onClick={toggleVoiceAutoPilot}
          >
            {voiceAutoPilot ? 'Voice: ON' : 'Voice: PAUSED'}
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Dynamic Form Fields */}
          {activeFields.map((field, idx) => {
            const isActive = currentActiveKey === field.key;
            const hasError = !!fieldErrors[field.key];
            return (
              <div
                key={field.id || field.key}
                className={`simple-field ${isActive ? 'active-step' : ''} ${hasError ? 'has-error' : ''}`}
              >
                <label htmlFor={`field-${field.key}`}>
                  <span>
                    {field.label}
                    {field.required && (
                      <span className="field-required-star" title="Compulsory field">
                        *
                      </span>
                    )}
                    {formData[field.key] && (
                      <button
                        type="button"
                        className="field-edit-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectField(idx);
                        }}
                        title={`Click to edit ${field.label} by voice or typing`}
                      >
                        ✎ Edit
                      </button>
                    )}
                  </span>
                  {isActive && isListening && (
                    <span className="listening-badge">● Speaking to fill</span>
                  )}
                </label>
                <input
                  id={`field-${field.key}`}
                  type={field.type || 'text'}
                  name={field.key}
                  placeholder={field.placeholder || `Enter ${field.label}`}
                  value={formData[field.key] || ''}
                  onChange={handleChange}
                  onClick={() => handleSelectField(idx)}
                  maxLength={field.type === 'tel' ? 10 : undefined}
                  autoComplete="off"
                  required={field.required}
                />
                {hasError && (
                  <span className="field-error-text">
                    {fieldErrorsText[field.key] ||
                      (field.key.toLowerCase() === 'email'
                        ? 'Valid email address required (e.g. name@domain.com)'
                        : field.key.toLowerCase() === 'mobile'
                        ? '10-digit mobile number required'
                        : `${field.label} is compulsory`)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Submit Button */}
          <div className="simple-submit-row">
            <button
              type="submit"
              className="simple-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </main>


      {/* ── TOAST ALERT ── */}
      {toast.show && (
        <div className={`simple-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── DIAGNOSTIC LOGS MODAL (TAP FPS BADGE TO OPEN) ── */}
      {showLogViewer && (
        <div className="simple-log-modal-backdrop" onClick={() => setShowLogViewer(false)}>
          <div className="simple-log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <h3>Tablet Diagnostic Logs ({logs.length})</h3>
              <button
                type="button"
                className="log-modal-close"
                onClick={() => setShowLogViewer(false)}
              >
                ✕
              </button>
            </div>
            <div className="log-modal-content">
              {logs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No log entries recorded yet.</div>
              ) : (
                logs.slice().reverse().map((entry) => (
                  <div key={entry.id} className={`log-entry ${entry.level.toLowerCase()}`}>
                    <span className="log-time">{entry.time}</span>
                    <span className={`log-level-badge ${entry.level.toLowerCase()}`}>{entry.level}</span>
                    <span className="log-tag">[{entry.tag}]</span>
                    <span className="log-msg">{entry.message}</span>
                  </div>
                ))
              )}
            </div>
            <div className="log-modal-footer">
              <button
                type="button"
                className="log-action-btn"
                onClick={() => {
                  logger.clearLogs();
                  setLogs([]);
                }}
              >
                Clear Logs
              </button>
              <button
                type="button"
                className="log-action-btn"
                onClick={() => setLogs(logger.getLogs())}
              >
                Refresh
              </button>
              <button
                type="button"
                className="log-action-btn close"
                onClick={() => setShowLogViewer(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
