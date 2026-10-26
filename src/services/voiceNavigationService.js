/**
 * Voice Navigation Service for Testing App
 * - Speech-to-Intent matching against Action Cards & Kiosk Features
 * - Voice Access Gatekeeper: Verifies card.voiceAccessEnabled
 * - Integrates with offlineCardService & IndexedDB
 * - Ultra-low latency TTS feedback via speakWithVoice
 * - Logs all speech recognition events to diagnostic logger
 */

import { offlineCardService, offlineQaService, offlinePdfService } from '../db/offlineServices';
import { hardwareDispatcher } from './hardwareDispatcher';
import { speakWithVoice, cancelSpeech, isAnySpeaking, setAiSpeechMuted } from '../utils/speechSynthesis';
import { llmService } from './llmService';
import { logger } from './logger';
import { chatHistoryService } from './chatHistoryService';

export function isAcousticEcho(heardText, lastSpokenText) {
  if (!heardText) return false;

  const normalize = (s) => (s || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\baura\b/g, 'aurra')
    .replace(/\brobot miracle\b/g, 'robomiracle')
    .replace(/\brobo miracle\b/g, 'robomiracle')
    .replace(/\s+/g, ' ')
    .trim();

  const hNorm = normalize(heardText);
  if (!hNorm || hNorm.length < 3) return false;

  const wordsH = hNorm.split(' ').filter(w => w.length > 1);

  // Self-voice echo guard: Phrases that a user talking to Aurra would never say, but robot begins answers with
  if (hNorm === 'i am' || hNorm === 'i am i am' || hNorm === 'i am aurra' || hNorm.startsWith('i am aurra')) {
    return true;
  }

  // Short human utterances (1 to 3 words like "hello", "hi aurra", "who are you") are NEVER acoustic echoes
  if (wordsH.length < 4) {
    return false;
  }

  // 1. Fixed system phrases that are only ever spoken BY Aurra (heard utterance must contain the full phrase)
  const SYSTEM_PHRASES = [
    'i am aurra',
    'autonomous humanoid',
    'receptionist robot',
    'developed by robomiracle',
    'assist visitors',
    'manage registrations',
    'welcome to robomiracle',
    'welcome to robomiracle technologies',
    'returning to home screen',
    'opening action cards',
    'opening admin settings',
    'displaying banner',
    'opening check in form',
    'opening robot cockpit',
    'opening hardware setup',
    'sorry i could not catch',
    'sorry i could not catch that',
    'could not catch that',
    'didn t quite catch',
    'access denied voice navigation',
    'official hardware and software specifications',
  ];

  for (const phrase of SYSTEM_PHRASES) {
    if (hNorm.includes(phrase)) {
      return true;
    }
  }

  // 2. Check against last spoken response (only for long echo transcripts with >= 65% token overlap)
  if (lastSpokenText) {
    const sNorm = normalize(lastSpokenText);
    if (sNorm) {
      if (hNorm.includes(sNorm)) {
        return true;
      }

      // Check significant word overlap for long sentences
      const longWordsH = hNorm.split(' ').filter(w => w.length > 2);
      const wordsS = new Set(sNorm.split(' ').filter(w => w.length > 2));
      if (longWordsH.length >= 4) {
        let matchCount = 0;
        for (const w of longWordsH) {
          if (wordsS.has(w)) matchCount++;
        }
        if (matchCount / longWordsH.length >= 0.65) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Merge consecutive speech recognition chunks into a coherent utterance without stutter or duplication
 */
export function mergeSpeechUtterances(prevText, nextText) {
  const prev = (prevText || '').trim();
  const next = (nextText || '').trim();
  if (!prev) return next;
  if (!next) return prev;

  const prevLower = prev.toLowerCase();
  const nextLower = next.toLowerCase();

  // 1. If next is an extension of prev (e.g. prev="who are", next="who are you")
  if (nextLower.startsWith(prevLower)) {
    return next;
  }

  // 2. If prev already contains next or ends with next
  if (prevLower.endsWith(nextLower) || prevLower.includes(nextLower)) {
    return prev;
  }

  // 3. Word-level overlap: match trailing words of prev with leading words of next
  const prevWords = prev.split(/\s+/);
  const nextWords = next.split(/\s+/);

  for (let k = Math.min(prevWords.length, nextWords.length); k > 0; k--) {
    const prevSuffix = prevWords.slice(-k).join(' ').toLowerCase();
    const nextPrefix = nextWords.slice(0, k).join(' ').toLowerCase();
    if (prevSuffix === nextPrefix) {
      return [...prevWords, ...nextWords.slice(k)].join(' ');
    }
  }

  // 4. Disjoint separate clauses
  return `${prev} ${next}`;
}

class VoiceNavigationService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.manualStop = false;
    this.userPaused = false;
    this.isSpeakingTts = false;
    this.isAiMuted = false;
    this.forceLlmOnly = false;
    this.subscribers = new Set();
    this.currentTranscript = '';
    this.lastFeedback = '';
    this.isThinking = false;
    this.conversationHistory = [];
    this.navigationHandler = null;
    this.adminHandler = null;
    this.viewToggleHandler = null;
    this.isInitialized = false;
    this.lastSpeechEndTime = 0;
    this.isProcessingCommand = false;
    this.isProcessing = false;
    this.isTypingMode = false;
    this.lastUserQueryTime = 0;
    this.lastProcessedUtterance = '';
    this.lastProcessedTime = 0;
    this.lastSpokenText = '';
    this.speechAccumulator = '';
    this.speechDebounceTimer = null;
    this.latestInteractiveReply = null;
    this.replyDismissTimer = null;
    this.documentContext = null;
  }

  setDocumentContext(ctx) {
    this.documentContext = ctx;
    this.notify({ documentContext: ctx });
    logger.info('VOICE', `Active Document Context registered: "${ctx?.title || 'Unknown'}" (ID: ${ctx?.docId})`);
  }

  clearDocumentContext() {
    this.documentContext = null;
    this.notify({ documentContext: null });
    logger.info('VOICE', 'Active Document Context cleared');
  }

  getDocumentContext() {
    return this.documentContext;
  }

  setTypingMode(enabled) {
    this.isTypingMode = Boolean(enabled);
    if (this.isTypingMode) {
      logger.info('VOICE', 'Typing mode ON: Microphone muted to avoid voice/keyboard cross-talk');
      if (this.recognition && this.isListening) {
        try {
          this.recognition.abort();
        } catch {
          /* ignore */
        }
      }
      this.isListening = false;
      this.currentTranscript = '';
      this.notify({ isListening: false, isTypingMode: true, transcript: '' });
    } else {
      logger.info('VOICE', 'Typing mode OFF: Resuming background listener if appropriate');
      this.notify({ isTypingMode: false });
      if (!this.userPaused && !this.manualStop && !this.isSpeakingTts && !this.isProcessing) {
        this.startListening(true);
      }
    }
  }

  setForceLlmOnly(enabled) {
    this.forceLlmOnly = !!enabled;
    this.notify({ forceLlmOnly: this.forceLlmOnly });
    logger.info('VOICE', `Force Direct Cloud AI Mode: ${this.forceLlmOnly ? 'ENABLED' : 'DISABLED'}`);
  }

  speak(text, options = {}) {
    const isPriority = options.priority === true;
    if (this.isSpeakingTts && !isPriority && isAnySpeaking()) {
      logger.warn('VOICE', `Rejected overlapping speak request: "${text}"`);
      return;
    }

    this.isSpeakingTts = true;
    this.isProcessing = false;
    this.lastSpokenText = String(text || '');
    this.notify({ isSpeaking: true, isThinking: false });
    if (this.isAndroid && typeof window !== 'undefined' && window.AndroidLauncher?.stopSpeechRecognizer) {
      try {
        window.AndroidLauncher.stopSpeechRecognizer();
      } catch {
        /* ignore */
      }
    } else if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch {
        /* ignore */
      }
    }
    this.isListening = false;
    this.currentTranscript = '';
    this.speechAccumulator = '';
    if (this.speechDebounceTimer) {
      clearTimeout(this.speechDebounceTimer);
      this.speechDebounceTimer = null;
    }
    this.notify({ isListening: false, transcript: '' });

    const originalOnEnd = options.onEnd;
    let settled = false;

    // Safety watchdog: ensure isSpeakingTts NEVER stays stuck true
    const words = String(text).trim().split(/\s+/).length;
    const maxTtsDurationMs = Math.max(7000, words * 700 + 4000);
    const watchdogTimer = setTimeout(() => {
      if (!settled && this.isSpeakingTts) {
        if (isAnySpeaking()) {
          // Android hardware is still actively playing audio! Wait for onEnd
          return;
        }
        logger.warn('VOICE', `Speech watchdog auto-recovery after ${maxTtsDurationMs}ms`);
        resumeListening();
      }
    }, maxTtsDurationMs);

    const resumeListening = () => {
      if (settled) return;
      // If hardware is still speaking, poll briefly until speech finishes
      if (isAnySpeaking()) {
        setTimeout(() => resumeListening(), 200);
        return;
      }
      settled = true;
      clearTimeout(watchdogTimer);
      this.isSpeakingTts = false;
      this.lastSpeechEndTime = Date.now();
      this.notify({ isSpeaking: false });
      
      // Fast settling delay (250ms): ready for user's next question promptly
      setTimeout(() => {
        if (!this.userPaused && !this.manualStop && !this.isSpeakingTts && !isAnySpeaking()) {
          this.currentTranscript = '';
          this.speechAccumulator = '';
          this.notify({ transcript: '' });
          this.startListening(true);
        }
      }, 250);
    };

    speakWithVoice(text, {
      ...options,
      onEnd: () => {
        originalOnEnd?.();
        resumeListening();
      },
      onError: (err) => {
        options.onError?.(err);
        resumeListening();
      },
    });
  }

  cancelSpeech(resumeMic = false) {
    this.isSpeakingTts = false;
    this.isThinking = false;
    this.isProcessing = false;
    this.lastSpeechEndTime = Date.now();
    cancelSpeech();
    this.currentTranscript = '';
    this.speechAccumulator = '';
    if (this.speechDebounceTimer) {
      clearTimeout(this.speechDebounceTimer);
      this.speechDebounceTimer = null;
    }
    this.notify({ isSpeaking: false, isThinking: false, transcript: '' });
    if (resumeMic) {
      this.startListening(true);
    }
  }

  setInteractiveReply(replyObj) {
    this.latestInteractiveReply = replyObj;
    this.notify({ latestReply: replyObj });

    if (this.replyDismissTimer) {
      clearTimeout(this.replyDismissTimer);
    }
    // Auto-dismiss reply card after 16 seconds so screen doesn't stay permanently covered
    this.replyDismissTimer = setTimeout(() => {
      this.clearInteractiveReply();
    }, 16000);
  }

  clearInteractiveReply() {
    if (this.replyDismissTimer) {
      clearTimeout(this.replyDismissTimer);
      this.replyDismissTimer = null;
    }
    this.latestInteractiveReply = null;
    this.notify({ latestReply: null });
  }

  dispatchAccumulatedSpeech() {
    if (this.speechDebounceTimer) {
      clearTimeout(this.speechDebounceTimer);
      this.speechDebounceTimer = null;
    }

    const fullUtterance = (this.speechAccumulator || this.currentTranscript || '').trim();
    this.speechAccumulator = '';

    if (!fullUtterance || fullUtterance.length < 2) return;

    logger.speech('VOICE', `Dispatched full speech utterance: "${fullUtterance}"`);
    logger.breadcrumb('VOICE', `Full Utterance: "${fullUtterance}"`);
    this.processVoiceCommand(fullUtterance.toLowerCase(), { inputType: 'voice' });
  }

  setAiMuted(muted) {
    this.isAiMuted = Boolean(muted);
    setAiSpeechMuted(this.isAiMuted);
    if (this.isAiMuted) {
      this.cancelSpeech();
    }
    this.notify({ isAiMuted: this.isAiMuted });
    logger.info('VOICE', `AI speech output: ${this.isAiMuted ? 'MUTED' : 'UNMUTED'}`);
  }

  toggleAiMute() {
    this.setAiMuted(!this.isAiMuted);
    return this.isAiMuted;
  }

  setNavigationHandler(fn) {
    if (typeof fn === 'function') {
      this.navigationHandler = fn;
    }
  }

  init({ onNavigate, onOpenAdmin, onToggleView, autoStart = false }) {
    if (onNavigate) this.navigationHandler = onNavigate;
    if (onOpenAdmin) this.adminHandler = onOpenAdmin;
    if (onToggleView) this.viewToggleHandler = onToggleView;

    if (this.isInitialized) {
      // Handlers updated. If autoStart is requested and mic is not running or paused by user, resume listening
      if (autoStart && !this.userPaused && !this.isListening) {
        this.startListening(false);
      }
      return true;
    }

    // 1. Android Native Bridge Speech Recognition (avoid WebView webkitSpeechRecognition not-allowed/network failure)
    const hasAndroidBridge = typeof window !== 'undefined' && Boolean(window.AndroidLauncher);
    if (hasAndroidBridge) {
      this.isAndroid = true;
      this.isInitialized = true;
      logger.info('VOICE', 'Initialized voice service via Android Native Bridge');

      window.onAndroidSpeechReady = () => {
        logger.speech('VOICE', 'Android SpeechRecognizer ready');
        this.isListening = true;
        this.notify({ isListening: true, status: 'listening' });
      };

      window.onAndroidSpeechStart = () => {
        logger.speech('VOICE', 'Android SpeechRecognizer capturing speech');
        this.isListening = true;
        this.notify({ isListening: true, status: 'listening' });
      };

      window.onAndroidSpeechPartial = (partial) => {
        if (!partial || this.isSpeakingTts || isAnySpeaking() || this.isProcessing) return;
        this.currentTranscript = partial;
        this.notify({ transcript: partial });
      };

      window.onAndroidSpeechResult = (text) => {
        logger.speech('VOICE', `Android Speech result received: "${text}"`);
        this.isListening = false;
        this.notify({ isListening: false });
        if (!text || !text.trim()) return;
        const clean = text.trim();
        this.currentTranscript = clean;
        this.notify({ transcript: clean });
        this.processVoiceCommand(clean, { inputType: 'voice' });
      };

      window.onAndroidSpeechError = (errorCode) => {
        logger.warn('VOICE', `Android SpeechRecognizer error code: ${errorCode}`);
        this.isListening = false;
        this.notify({ isListening: false });
        // Auto-recover after timeouts and transient error codes (7: NO_MATCH, 6: SPEECH_TIMEOUT, 8: BUSY, 5: CLIENT)
        if (!this.manualStop && !this.userPaused && !this.isSpeakingTts && !this.isProcessing) {
          setTimeout(() => {
            if (!this.manualStop && !this.userPaused && !this.isSpeakingTts && !this.isProcessing) {
              this.startListening(true);
            }
          }, 350);
        }
      };

      window.onAndroidSpeechCancel = () => {
        this.isListening = false;
        this.notify({ isListening: false });
      };

      if (autoStart && !this.userPaused) {
        this.startListening(true);
      }
      return true;
    }

    // 2. Standard Web Speech API (Desktop Chrome / Edge / Vivaldi)
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      logger.warn('VOICE', 'Speech Recognition API is not supported in this browser/WebView');
      return false;
    }

    try {
      this.isInitialized = true;
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.notify({ isListening: true, status: 'listening' });
        logger.speech('VOICE', 'Microphone active - listening for voice commands...');
      };

      this.recognition.onresult = (event) => {
        // Immediate drop: if user is typing on the keyboard, ignore any voice noise
        if (this.isTypingMode) {
          return;
        }

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        // Live user speech detected: cancel any background speech audio immediately
        if ((final || interim) && (this.isSpeakingTts || isAnySpeaking())) {
          this.cancelSpeech(false);
        }

        // Live visual interim transcript preview
        if (interim) {
          const livePreview = mergeSpeechUtterances(this.speechAccumulator, interim).trim();
          this.currentTranscript = livePreview;
          this.notify({ transcript: livePreview });
        }

        if (final && final.trim().length > 0) {
          const cleanFinal = final.trim();

          // Acoustic echo filter (block echo of Aurra's own spoken text)
          if (isAcousticEcho(cleanFinal, this.lastSpokenText)) {
            return;
          }

          // Accumulate speech tokens using mergeSpeechUtterances to eliminate duplicate prefixes
          const accumulated = mergeSpeechUtterances(this.speechAccumulator, cleanFinal).trim();
          this.speechAccumulator = accumulated;
          this.currentTranscript = accumulated;
          this.notify({ transcript: accumulated });

          // Urgent single commands dispatch immediately
          const lowerAcc = accumulated.toLowerCase();
          if (lowerAcc === 'stop' || lowerAcc === 'shut up' || lowerAcc === 'cancel' || lowerAcc === 'silence' || lowerAcc === 'home' || lowerAcc === 'go home') {
            if (this.speechDebounceTimer) {
              clearTimeout(this.speechDebounceTimer);
              this.speechDebounceTimer = null;
            }
            this.dispatchAccumulatedSpeech();
            return;
          }

          // Reset debounce timer
          if (this.speechDebounceTimer) {
            clearTimeout(this.speechDebounceTimer);
          }

          // 750ms End-of-Thought Patience Window: Waits for user to finish speaking multi-word sentences
          this.speechDebounceTimer = setTimeout(() => {
            this.dispatchAccumulatedSpeech();
          }, 750);
        }
      };

      this.recognition.onerror = (event) => {
        // 'no-speech' is normal when idle
        if (event.error !== 'no-speech') {
          logger.warn('VOICE', `Speech recognition error: ${event.error}`);
        }
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this.notify({ isListening: false, error: 'Microphone permission denied. Tap mic to allow.' });
        } else if (event.error === 'network') {
          // Transient network glitch: retry once after 1.5s
          setTimeout(() => {
            if (!this.manualStop && !this.userPaused && !this.isListening && !this.isSpeakingTts && !this.isProcessing) {
              this.startListening(false);
            }
          }, 1500);
        }
      };

      this.recognition.onend = () => {
        // Flush any pending utterance if microphone ended
        if (this.speechAccumulator && this.speechAccumulator.trim().length >= 2) {
          this.dispatchAccumulatedSpeech();
        }

        // If user is typing on the keyboard, or explicitly paused, do NOT restart
        if (this.isTypingMode || this.manualStop || this.userPaused) {
          this.isListening = false;
          this.notify({ isListening: false });
          return;
        }

        // If currently processing or speaking TTS, do NOT restart recognition
        if (this.isProcessing || this.isSpeakingTts || isAnySpeaking()) {
          this.isListening = false;
          this.notify({ isListening: false });
          return;
        }

        // Auto-restart with debounce to avoid InvalidStateError
        this.isListening = false;
        setTimeout(() => {
          const isBusy = this.isProcessing || this.isSpeakingTts || isAnySpeaking();
          if (!this.manualStop && !this.userPaused && !isBusy) {
            try {
              this.recognition.start();
              this.isListening = true;
              this.notify({ isListening: true, status: 'listening' });
            } catch {
              // Retry once after 500ms if threw already-started or busy error
              setTimeout(() => {
                const retryBusy = this.isProcessing || this.isSpeakingTts || isAnySpeaking();
                if (!this.manualStop && !this.userPaused && !retryBusy) {
                  try {
                    this.recognition.start();
                    this.isListening = true;
                    this.notify({ isListening: true });
                  } catch {
                    /* ignore */
                  }
                }
              }, 500);
            }
          }
        }, 150);
      };

      this.isInitialized = true;
      if (autoStart && !this.userPaused) {
        this.startListening(true);
      }
      return true;
    } catch (err) {
      logger.error('VOICE', `Init error: ${err.message}`);
      return false;
    }
  }

  async processVoiceCommand(rawUtterance, { inputType = 'voice' } = {}) {
    if (!rawUtterance || typeof rawUtterance !== 'string') return;
    const utterance = rawUtterance.toLowerCase().trim();

    // 1. High-Priority System Navigation & Interruption Intents (Never blocked by settling or echo)
    const isHomeIntent =
      utterance === 'home' ||
      utterance === 'go home' ||
      utterance.includes('main menu') ||
      utterance.includes('main screen') ||
      utterance.includes('main page') ||
      utterance === 'back' ||
      utterance === 'go back' ||
      utterance === 'exit' ||
      utterance === 'close';

    if (isHomeIntent) {
      this.cancelSpeech();
      this.setFeedback('Returning to Home screen');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Returning to Home screen',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Returning to Home screen');
      setTimeout(() => {
        this.navigationHandler?.('/');
      }, 250);
      return;
    }

    if (utterance === 'stop' || utterance === 'cancel' || utterance === 'shut up' || utterance === 'be quiet' || utterance === 'silence') {
      this.cancelSpeech();
      this.setFeedback('Speech paused');
      this.clearInteractiveReply();
      return;
    }

    // 1B. Instant Conversational Greeting Intent (Zero Latency < 1ms)
    const isGreeting =
      utterance === 'hello' ||
      utterance === 'hi' ||
      utterance === 'hey' ||
      utterance === 'hello aurra' ||
      utterance === 'hi aurra' ||
      utterance === 'hey aurra' ||
      utterance === 'namaste' ||
      utterance === 'vanakkam' ||
      utterance === 'good morning' ||
      utterance === 'good afternoon' ||
      utterance === 'good evening' ||
      utterance === 'hello there' ||
      utterance === 'hi there';

    if (isGreeting) {
      this.cancelSpeech(false);
      let greeting = "Hello! I am Aurra, your humanoid AI receptionist developed by RoboMiracle Technologies in Coimbatore. How can I assist you today?";
      const hr = new Date().getHours();
      if (utterance.includes('morning') || (hr >= 4 && hr < 12 && (utterance === 'hello' || utterance === 'hi' || utterance === 'hey'))) {
        greeting = "Good morning! I am Aurra, your humanoid AI assistant from RoboMiracle Technologies. How can I assist you today?";
      } else if (utterance.includes('afternoon') || (hr >= 12 && hr < 17 && (utterance === 'hello' || utterance === 'hi' || utterance === 'hey'))) {
        greeting = "Good afternoon! Welcome to RoboMiracle Technologies. I am Aurra, how may I assist you today?";
      } else if (utterance.includes('evening') || (hr >= 17 && (utterance === 'hello' || utterance === 'hi' || utterance === 'hey'))) {
        greeting = "Good evening! Welcome to RoboMiracle Technologies. I am Aurra, how can I assist you today?";
      } else if (utterance.includes('vanakkam')) {
        greeting = "Vanakkam! Welcome to RoboMiracle Technologies. I am Aurra, how may I help you today?";
      } else if (utterance.includes('namaste')) {
        greeting = "Namaste! Welcome to RoboMiracle Technologies. I am Aurra, how may I help you today?";
      }

      this.setFeedback(greeting);
      this.setInteractiveReply({
        query: rawUtterance,
        reply: greeting,
        source: 'instant-greeting',
        confidence: 100,
        category: 'Greeting',
        timestamp: Date.now(),
      });
      this.speak(greeting);
      return;
    }

    // 1C. Instant Identity & Persona Intent (Zero Latency < 1ms)
    const cleanNoPunct = utterance.replace(/[?.!,]/g, '').trim();
    const isIdentityIntent =
      cleanNoPunct === 'who are you' ||
      cleanNoPunct === 'who are u' ||
      cleanNoPunct === 'who r u' ||
      cleanNoPunct === 'who you are' ||
      cleanNoPunct === 'what is your name' ||
      cleanNoPunct === 'whats your name' ||
      cleanNoPunct === 'what is ur name' ||
      cleanNoPunct === 'whats ur name' ||
      cleanNoPunct === 'tell me about yourself' ||
      cleanNoPunct === 'introduce yourself' ||
      cleanNoPunct === 'about you' ||
      cleanNoPunct.includes('who are you') ||
      cleanNoPunct.includes('who are u') ||
      cleanNoPunct.includes('what is your name') ||
      cleanNoPunct.includes('whats your name');

    if (isIdentityIntent) {
      this.cancelSpeech(false);
      const identityMsg = "I am Aurra, an autonomous humanoid AI receptionist and companion robot created and developed by RoboMiracle Technologies in Coimbatore. I assist visitors, manage registrations, and guide you around our facility.";
      this.setFeedback(identityMsg);
      this.setInteractiveReply({
        query: rawUtterance,
        reply: identityMsg,
        source: 'identity',
        confidence: 100,
        category: 'About',
        timestamp: Date.now(),
      });
      this.speak(identityMsg);
      return;
    }

    const isAdminIntent =
      utterance === 'admin' ||
      utterance === 'settings' ||
      utterance.includes('open admin') ||
      utterance.includes('go to admin') ||
      utterance.includes('open settings') ||
      utterance.includes('dashboard');

    if (isAdminIntent) {
      this.cancelSpeech();
      this.setFeedback('Opening Admin Settings');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Opening Admin Settings',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Opening Admin Settings');
      this.adminHandler?.();
      return;
    }

    const cleanUtterance = utterance.replace(/[?.!,]/g, '').trim();

    const isCardsIntent =
      cleanUtterance === 'features' ||
      cleanUtterance === 'cards' ||
      cleanUtterance === 'action cards' ||
      cleanUtterance === 'show features' ||
      cleanUtterance === 'show feature' ||
      cleanUtterance === 'show cards' ||
      cleanUtterance === 'show card' ||
      cleanUtterance === 'open cards' ||
      cleanUtterance === 'what can you do' ||
      cleanUtterance === 'what do you do' ||
      cleanUtterance.includes('what feature') ||
      cleanUtterance.includes('what features') ||
      cleanUtterance.includes('your features') ||
      cleanUtterance.includes('tell me features') ||
      cleanUtterance.includes('show me features') ||
      cleanUtterance.includes('show features') ||
      cleanUtterance.includes('show the features') ||
      cleanUtterance.includes('list features') ||
      cleanUtterance.includes('show card') ||
      cleanUtterance.includes('show cards') ||
      cleanUtterance.includes('open cards') ||
      cleanUtterance.includes('what can you do') ||
      cleanUtterance.includes('what capabilities') ||
      cleanUtterance.includes('what services') ||
      cleanUtterance.includes('show services') ||
      cleanUtterance.includes('features screen') ||
      cleanUtterance.includes('features do you have') ||
      cleanUtterance.includes('features do you offer') ||
      cleanUtterance.includes('current screen') ||
      (cleanUtterance.includes('feature') && (cleanUtterance.includes('have') || cleanUtterance.includes('what') || cleanUtterance.includes('show') || cleanUtterance.includes('tell')));

    // Check for "Explain Features" intent
    const isExplainFeaturesIntent =
      cleanUtterance.includes('explain features') ||
      cleanUtterance.includes('explain the features') ||
      cleanUtterance.includes('explain all features') ||
      cleanUtterance.includes('explain each feature') ||
      cleanUtterance.includes('feature tour') ||
      cleanUtterance.includes('walkthrough features') ||
      cleanUtterance.includes('tour the features') ||
      cleanUtterance.includes('what are all the features');

    if (isExplainFeaturesIntent) {
      this.cancelSpeech();
      this.setFeedback('Starting Feature Walkthrough');
      this.navigationHandler?.('/?view=cards');
      this.viewToggleHandler?.(false);
      window.dispatchEvent(new CustomEvent('aurra_show_cards'));
      window.dispatchEvent(new CustomEvent('aurra_start_explain_features'));
      window.dispatchEvent(new CustomEvent('aurra_close_fullscreen_voice'));
      return;
    }

    if (isCardsIntent) {
      this.cancelSpeech();
      const replyMsg = 'Here are the features and services I offer. You can tap any card or ask me to open a feature.';
      this.setFeedback('Here are the features and services I offer');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: replyMsg,
        source: 'navigation',
        confidence: 100,
        category: 'Features',
        timestamp: Date.now(),
      });
      this.speak(replyMsg);
      this.navigationHandler?.('/?view=cards');
      this.viewToggleHandler?.(false);
      window.dispatchEvent(new CustomEvent('aurra_show_cards'));
      window.dispatchEvent(new CustomEvent('aurra_close_fullscreen_voice'));
      return;
    }

    // High-specificity check for Testing / Diagnostic Lab
    const isTestingIntent =
      utterance === 'testing' ||
      utterance === 'test mode' ||
      utterance === 'testing mode' ||
      utterance === 'diagnostic' ||
      utterance === 'diagnostic mode' ||
      utterance.includes('open testing') ||
      utterance.includes('go to testing') ||
      utterance.includes('open diagnostic') ||
      utterance.includes('diagnostic lab') ||
      utterance.includes('testing lab');

    if (isTestingIntent) {
      this.cancelSpeech();
      this.setFeedback('Opening Testing Interactive Mode');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Opening Testing Interactive Mode',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Opening Testing Interactive Mode');
      setTimeout(() => {
        this.navigationHandler?.('/testing-interaction');
      }, 250);
      return;
    }

    const isInteractionIntent =
      utterance === 'interaction' ||
      utterance === 'interaction mode' ||
      utterance === 'interactive mode' ||
      utterance.includes('open interaction') ||
      utterance.includes('go to interaction') ||
      utterance.includes('open interactive mode') ||
      utterance.includes('hud mode');

    if (isInteractionIntent) {
      this.cancelSpeech();
      this.setFeedback('Opening Interaction Mode');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Opening Interaction Mode',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Opening Interaction Mode');
      setTimeout(() => {
        this.navigationHandler?.('/interaction');
      }, 250);
      return;
    }

    const isPdfIntent =
      utterance === 'pdf' ||
      utterance === 'open pdf' ||
      utterance === 'pdf document' ||
      utterance === 'pdf chat' ||
      utterance === 'ask pdf' ||
      utterance === 'upload pdf' ||
      utterance === 'read pdf' ||
      utterance === 'documents' ||
      utterance.includes('open pdf') ||
      utterance.includes('go to pdf') ||
      utterance.includes('ask pdf') ||
      utterance.includes('pdf reader');

    if (isPdfIntent) {
      this.cancelSpeech();
      this.setFeedback('Opening PDF Document AI');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Opening PDF Document AI',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Opening PDF Document Assistant');
      setTimeout(() => {
        this.navigationHandler?.('/pdf');
      }, 250);
      return;
    }

    const isDebugIntent =
      utterance === 'debug' ||
      utterance === 'api debug' ||
      utterance === 'telemetry' ||
      utterance === 'open debug' ||
      utterance === 'go to debug' ||
      utterance === 'network logs' ||
      utterance.includes('api logs') ||
      utterance.includes('debug mode') ||
      utterance.includes('open telemetry') ||
      utterance.includes('network inspector');

    if (isDebugIntent) {
      this.cancelSpeech();
      this.setFeedback('Opening Live API Telemetry & Debug');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Opening Live API Telemetry & Debug',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Opening API Telemetry Debugger');
      setTimeout(() => {
        this.navigationHandler?.('/debug');
      }, 250);
      return;
    }

    if (utterance.includes('show slider') || utterance.includes('banner') || utterance.includes('slideshow')) {
      this.cancelSpeech();
      this.setFeedback('Switching to Slideshow Banner');
      this.setInteractiveReply({
        query: rawUtterance,
        reply: 'Switching to Slideshow Banner',
        source: 'navigation',
        confidence: 100,
        category: 'Navigation',
        timestamp: Date.now(),
      });
      this.speak('Displaying banner');
      this.navigationHandler?.('/?view=slider');
      this.viewToggleHandler?.(true);
      return;
    }

    // 2. User Barge-In & State Sync:
    // If user speaks into mic or inputs a command, user intent ALWAYS takes priority over background TTS
    if (this.isSpeakingTts || isAnySpeaking()) {
      logger.speech('VOICE', `User barge-in: clearing active speech for "${rawUtterance}"`);
      this.cancelSpeech(false);
    }


    // 4. Acoustic Self-Echo & System Prompt Rejection - only applies to voice
    if (inputType === 'voice' && (isAcousticEcho(rawUtterance, this.lastFeedback) || isAcousticEcho(rawUtterance, this.lastSpokenText))) {
      logger.speech('VOICE', `Dropped acoustic self-echo utterance: "${rawUtterance}"`);
      return;
    }

    // 5. Deduplicate exact stutter utterances within 1.2 seconds
    const timeSinceLast = Date.now() - this.lastProcessedTime;
    if (timeSinceLast < 1200 && this.lastProcessedUtterance === utterance) {
      logger.speech('VOICE', `Dropped duplicate stutter utterance: "${rawUtterance}"`);
      return;
    }

    this.lastProcessedUtterance = utterance;
    this.lastProcessedTime = Date.now();
    this.lastUserQueryTime = Date.now();
    const queryStartTime = performance.now();

    const logTiming = (stage, detail = '') => {
      const elapsed = Math.round(performance.now() - queryStartTime);
      logger.info('TIMING', `[+${elapsed}ms] ${stage} ${detail}`.trim());
      console.log(`%c[AURRA TIMING +${elapsed}ms] ${stage} ${detail}`.trim(), 'color: #00ffff; font-weight: bold;');
    };

    logTiming(`Query received via [${inputType.toUpperCase()}]`, `"${rawUtterance}"`);

    // Log user query to persistent chat history
    chatHistoryService.addMessage({
      role: 'user',
      text: rawUtterance,
      inputType,
      source: 'user',
      confidence: 100,
    });

    // ACQUIRE MUTEX LOCK
    this.isProcessing = true;
    this.notify({ isThinking: true });

    // Safety watchdog: ensure isProcessing NEVER remains stuck true
    const processingWatchdog = setTimeout(() => {
      if (this.isProcessing) {
        logger.warn('VOICE', 'Processing command watchdog timeout (15s) - resetting mutex');
        this.isProcessing = false;
        this.notify({ isThinking: false });
      }
    }, 15000);

    try {
      // 4A. Active PDF Document AI Context Interceptor (When user is viewing a PDF document)
      if (this.documentContext && this.documentContext.docId) {
        const docId = this.documentContext.docId;
        const docTitle = this.documentContext.title || 'Document';
        this.notify({ isThinking: true, feedback: `Analyzing ${docTitle}...` });
        logger.speech('VOICE', `[Document AI Mode] Searching chunks for: "${rawUtterance}" in doc ${docId}`);

        // Immediate visual feedback to document chat view
        if (typeof this.documentContext.onQuestion === 'function') {
          this.documentContext.onQuestion(rawUtterance);
        }

        const relevantChunks = await offlinePdfService.searchChunks(docId, rawUtterance);
        const answerResult = await llmService.generatePdfAnswer(
          rawUtterance,
          docTitle,
          relevantChunks,
          this.conversationHistory
        );

        this.isProcessing = false;
        this.isThinking = false;
        this.notify({ isThinking: false });

        if (answerResult.success && answerResult.text) {
          const answerText = answerResult.text;
          const citations = answerResult.citations || (relevantChunks[0] ? [relevantChunks[0].pageNumber] : []);

          this.setFeedback(answerText);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: answerText,
            source: 'pdf-document-ai',
            confidence: 100,
            category: 'PDF Document AI',
            citations,
            timestamp: Date.now(),
          });

          if (typeof this.documentContext.onAnswer === 'function') {
            this.documentContext.onAnswer({
              query: rawUtterance,
              answer: answerText,
              citations,
              model: answerResult.model,
              provider: answerResult.provider,
            });
          }

          this.speak(answerText);

          chatHistoryService.addMessage({
            role: 'assistant',
            text: answerText,
            inputType,
            source: 'pdf-document-ai',
            confidence: 100,
            citations,
          });

          return;
        } else {
          const fallbackText = answerResult.text || 'I could not find an answer in this document.';
          this.setFeedback(fallbackText);
          this.speak(fallbackText);
          if (typeof this.documentContext.onAnswer === 'function') {
            this.documentContext.onAnswer({
              query: rawUtterance,
              answer: fallbackText,
              citations: [],
              model: 'Fallback',
            });
          }
          return;
        }
      }

      // 4B. Direct Cloud AI Mode Override (Sends all queries straight to Groq LLM API using Admin API key)
      if (this.forceLlmOnly) {
        if (!llmService.isConfigured()) {
          const noKeyMsg = "Cloud AI is not configured. Please enter your Groq API key in Admin Settings.";
          this.setFeedback(noKeyMsg);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: noKeyMsg,
            source: 'fallback',
            confidence: 0,
            category: 'Admin Config',
            timestamp: Date.now(),
          });
          this.speak(noKeyMsg);
          return;
        }

        this.isThinking = true;
        this.notify({ isThinking: true, feedback: 'Consulting Groq AI...' });
        logger.speech('VOICE', `[Direct Cloud AI Mode] Sending query to Groq LLM: "${rawUtterance}"`);

        const llmResult = await llmService.generateResponse(rawUtterance, this.conversationHistory);
        this.isThinking = false;
        this.notify({ isThinking: false });

        if (llmResult.success && llmResult.text) {
          const aiReply = llmResult.text;
          const latency = Math.round(performance.now() - queryStartTime);
          logTiming(`Groq LLM response arrived`, `(${latency}ms total latency)`);
          this.setFeedback(aiReply);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: aiReply,
            source: 'groq-llm',
            confidence: 100,
            category: 'Groq Cloud AI',
            timestamp: Date.now(),
          });

          this.conversationHistory.push({ role: 'user', content: rawUtterance });
          this.conversationHistory.push({ role: 'assistant', content: aiReply });
          if (this.conversationHistory.length > 8) {
            this.conversationHistory = this.conversationHistory.slice(-8);
          }

          this.speak(aiReply);

          chatHistoryService.addMessage({
            role: 'assistant',
            text: aiReply,
            inputType,
            source: 'groq-llm-direct',
            confidence: 100,
            latencyMs: latency,
          });

          window.dispatchEvent(new CustomEvent('aurra:qa-answered', {
            detail: {
              query: rawUtterance,
              match: { question: rawUtterance, answer: aiReply, category: 'Groq Cloud AI' },
              confidence: 100,
              source: 'groq-llm-direct',
            }
          }));
          return;
        } else {
          const detail = llmResult.error ? ` (${llmResult.error})` : '';
          const errReply = llmResult.text || `Unable to connect to Cloud AI${detail}. Please check your internet or API key in Admin Settings.`;
          this.setFeedback(errReply);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: errReply,
            source: 'fallback',
            confidence: 0,
            category: 'Cloud AI Error',
            timestamp: Date.now(),
          });
          this.speak(errReply);
          return;
        }
      }

      // 5. Robot Hardware Commands (ESP32 / Motors / Servos / Eyes)
      const hwResult = hardwareDispatcher.evaluate(utterance);
      if (hwResult.handled) {
        const latency = Math.round(performance.now() - queryStartTime);
        logTiming(`Hardware command matched`, `(${hwResult.action} in ${latency}ms)`);
        this.setFeedback(hwResult.message);
        this.setInteractiveReply({
          query: rawUtterance,
          reply: hwResult.message,
          source: 'hardware',
          confidence: 100,
          category: 'Hardware Control',
          timestamp: Date.now(),
        });
        this.speak(hwResult.message);

        chatHistoryService.addMessage({
          role: 'assistant',
          text: hwResult.message,
          inputType,
          source: 'hardware',
          confidence: 100,
          latencyMs: latency,
        });

        return;
      }

      // Check for explicit navigation verbs and commands
      const hasNavVerb = /^(open|go to|take me to|navigate to|switch to|show|launch|start|display)\b/i.test(utterance);
      const isNavOnlyWord = ['register', 'registration', 'form', 'admission', 'sign up', 'tour', 'guided tour', 'show me around', 'walkthrough', 'robot tour', 'cockpit', 'camera', 'face greeting', 'public facilities', 'facilities', 'weblinks', 'website'].includes(utterance);
      const isExplicitNav = hasNavVerb || isNavOnlyWord;

      const cards = await offlineCardService.getCards();

      // IF EXPLICIT NAVIGATION WAS REQUESTED (e.g. "Open Form", "Take a tour", "Register")
      if (isExplicitNav) {
        let matchedCard = null;

        for (const card of cards) {
          if (card.href === '/interaction' && (utterance.includes('testing') || utterance.includes('test') || utterance.includes('diagnostic'))) {
            continue;
          }
          const titleMatch = utterance.includes(card.title.toLowerCase());
          const keywords = card.voiceKeywords || [];
          const keywordMatch = keywords.some((kw) => utterance.includes(kw.toLowerCase()));

          if (titleMatch || keywordMatch) {
            matchedCard = card;
            break;
          }
        }

        if (!matchedCard) {
          if (utterance.includes('greeting') || utterance.includes('face') || utterance.includes('recognize') || utterance.includes('camera')) {
            matchedCard = cards.find((c) => c.href === '/face-recognition') || {
              title: 'Face Greetings',
              href: '/face-recognition',
              voiceAccessEnabled: true,
            };
          } else if (utterance.includes('tour') || utterance.includes('show me around')) {
            matchedCard = cards.find((c) => c.href === '/guided-tour') || {
              title: 'Guided Robot Tour',
              href: '/guided-tour',
              voiceAccessEnabled: true,
            };
          } else if (utterance.includes('form') || utterance.includes('register') || utterance.includes('admission')) {
            matchedCard = cards.find((c) => c.href === '/form') || {
              title: "I'd like to register",
              href: '/form',
              voiceAccessEnabled: true,
            };
          } else if (utterance.includes('facilities') || utterance.includes('amenities')) {
            matchedCard = cards.find((c) => c.href === '/facilities') || {
              title: 'Public Facilities',
              href: '/facilities',
              voiceAccessEnabled: true,
            };
          }
        }

        if (matchedCard) {
          const isEnabled = matchedCard.isEnabled !== false;
          if (!isEnabled) {
            const hiddenMsg = `${matchedCard.title} is currently disabled in system settings.`;
            this.setFeedback(hiddenMsg);
            this.setInteractiveReply({
              query: rawUtterance,
              reply: hiddenMsg,
              source: 'navigation',
              confidence: 0,
              category: 'Access Denied',
              timestamp: Date.now(),
            });
            logger.warn('VOICE', `Voice access BLOCKED for [${matchedCard.title}]. Card is hidden/disabled.`);
            this.speak(hiddenMsg);
            return;
          }

          const isVoiceAllowed = matchedCard.voiceAccessEnabled !== false;

          if (!isVoiceAllowed) {
            const blockedMsg = `Access denied. Voice navigation for ${matchedCard.title} is turned OFF in admin.`;
            this.setFeedback(blockedMsg);
            this.setInteractiveReply({
              query: rawUtterance,
              reply: blockedMsg,
              source: 'navigation',
              confidence: 0,
              category: 'Access Denied',
              timestamp: Date.now(),
            });
            logger.warn('VOICE', `Voice access BLOCKED for [${matchedCard.title}]. Admin toggle is OFF.`);
            this.speak(blockedMsg);
            return;
          }

          const grantedMsg = `Opening ${matchedCard.title}`;
          this.setFeedback(grantedMsg);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: grantedMsg,
            source: 'navigation',
            confidence: 100,
            category: 'Navigation',
            timestamp: Date.now(),
          });
          logger.speech('VOICE', `Voice access GRANTED for [${matchedCard.title}] -> ${matchedCard.href}`);

          let navigated = false;
          const doNavigate = () => {
            if (navigated) return;
            navigated = true;
            this.navigationHandler?.(matchedCard.href, matchedCard);
          };

          this.speak(grantedMsg, {
            onEnd: doNavigate,
          });

          setTimeout(doNavigate, 350);
          return;
        }
      }


      // 6. Conversational / Q&A Intent: Tier 1 - Universal Offline Q&A Matching (< 3ms IndexedDB)
      const qaResult = await offlineQaService.findBestAnswer(rawUtterance);
      if (qaResult && qaResult.match && (qaResult.confidence >= 50 || !llmService.isConfigured())) {
        const item = qaResult.match;
        const latency = Math.round(performance.now() - queryStartTime);
        logTiming(`Offline FAQ matched`, `"${item.question}" (${qaResult.confidence}% in ${latency}ms)`);
        this.setFeedback(item.answer);
        this.setInteractiveReply({
          query: rawUtterance,
          reply: item.answer,
          source: 'offline-faq',
          confidence: qaResult.confidence,
          category: item.category || 'Knowledge Base',
          timestamp: Date.now(),
        });

        this.speak(item.answer);

        chatHistoryService.addMessage({
          role: 'assistant',
          text: item.answer,
          inputType,
          source: 'offline-faq',
          confidence: qaResult.confidence,
          latencyMs: latency,
        });

        window.dispatchEvent(new CustomEvent('aurra:qa-answered', {
          detail: {
            query: rawUtterance,
            match: item,
            confidence: qaResult.confidence,
            source: 'offline-faq',
          }
        }));
        return;
      }

      // 7. Tier 2: Escalate to Real AI Groq LLM (Cloud API)
      if (llmService.isConfigured()) {
        this.isThinking = true;
        this.notify({ isThinking: true, feedback: 'Thinking...' });
        logTiming(`Escalating to Groq LLM Cloud API`);

        const llmResult = await llmService.generateResponse(rawUtterance, this.conversationHistory);
        this.isThinking = false;
        this.notify({ isThinking: false });

        if (llmResult.success && llmResult.text) {
          const aiReply = llmResult.text;
          const latency = Math.round(performance.now() - queryStartTime);
          logTiming(`Groq LLM answer arrived`, `(API: ${llmResult.latencyMs}ms, Total: ${latency}ms)`);
          this.setFeedback(aiReply);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: aiReply,
            source: 'groq-llm',
            confidence: 99,
            category: 'Groq Cloud AI',
            timestamp: Date.now(),
          });

          // Maintain recent conversation history
          this.conversationHistory.push({ role: 'user', content: rawUtterance });
          this.conversationHistory.push({ role: 'assistant', content: aiReply });
          if (this.conversationHistory.length > 8) {
            this.conversationHistory = this.conversationHistory.slice(-8);
          }

          this.speak(aiReply);

          chatHistoryService.addMessage({
            role: 'assistant',
            text: aiReply,
            inputType,
            source: 'groq-llm',
            confidence: 99,
            latencyMs: latency,
          });

          window.dispatchEvent(new CustomEvent('aurra:qa-answered', {
            detail: {
              query: rawUtterance,
              match: { question: rawUtterance, answer: aiReply, category: 'AI Intelligence' },
              confidence: 99,
              source: 'groq-llm',
            }
          }));
          return;
        } else if (llmResult.reason === 'OFFLINE' && llmResult.text) {
          this.setFeedback(llmResult.text);
          this.setInteractiveReply({
            query: rawUtterance,
            reply: llmResult.text,
            source: 'groq-llm',
            confidence: 80,
            category: 'Offline Fallback',
            timestamp: Date.now(),
          });
          this.speak(llmResult.text);
          return;
        }
      }

      // 8. Tier 3: Action Card Keyword Fallback (e.g. user mentioned "canteen" or "washroom" without asking directly)
      for (const card of cards) {
        const keywords = card.voiceKeywords || [];
        if (keywords.some((kw) => utterance.includes(kw.toLowerCase()))) {
          const isVoiceAllowed = card.voiceAccessEnabled !== false;
          if (isVoiceAllowed) {
            const grantedMsg = `Opening ${card.title}`;
            this.setFeedback(grantedMsg);
            this.setInteractiveReply({
              query: rawUtterance,
              reply: grantedMsg,
              source: 'navigation',
              confidence: 90,
              category: 'Navigation',
              timestamp: Date.now(),
            });
            this.speak(grantedMsg);
            setTimeout(() => this.navigationHandler?.(card.href, card), 350);
            return;
          }
        }
      }

      // 9. Friendly intelligent fallback response
      this.isThinking = false;
      this.notify({ isThinking: false });
      const fallbackMsg = "I am Aurra, your humanoid AI assistant. You can ask me questions about our facility, or say 'open form' or 'open tour' to explore.";
      const latency = Math.round(performance.now() - queryStartTime);
      logTiming(`Fallback triggered (${latency}ms)`);
      this.setFeedback(fallbackMsg);
      this.setInteractiveReply({
        query: rawUtterance,
        reply: fallbackMsg,
        source: 'fallback',
        confidence: 0,
        category: 'Aurra AI',
        timestamp: Date.now(),
      });
      this.speak(fallbackMsg);

    } catch (err) {
      logger.error('VOICE', `Voice command evaluation error: ${err.message}`);
    } finally {
      clearTimeout(processingWatchdog);
      this.isProcessing = false;
      this.notify({ isThinking: false });
    }
  }

  setFeedback(text) {
    this.lastFeedback = text;
    this.notify({ feedback: text });
  }

  startListening(force = false) {
    if (force) {
      this.userPaused = false;
      this.manualStop = false;
      this.isProcessing = false;
    } else if (this.userPaused) {
      // User explicitly paused AI listening; suppress auto-starting on navigation
      return;
    }

    this.manualStop = false;

    // 1. Android Native SpeechRecognizer Bridge
    if (this.isAndroid || (typeof window !== 'undefined' && Boolean(window.AndroidLauncher))) {
      this.isAndroid = true;
      if (this.isSpeakingTts || isAnySpeaking()) {
        logger.info('VOICE', 'Android speech recognizer delayed: TTS is currently speaking');
        return;
      }
      try {
        if (window.AndroidLauncher?.startSpeechRecognizer) {
          window.AndroidLauncher.startSpeechRecognizer();
          this.isListening = true;
          this.notify({ isListening: true, status: 'listening' });
          logger.speech('VOICE', 'Android Native SpeechRecognizer started');
        } else if (window.AndroidLauncher?.startAndroidVoiceRecognition) {
          window.AndroidLauncher.startAndroidVoiceRecognition();
        }
      } catch (err) {
        logger.error('VOICE', `Android startSpeechRecognizer error: ${err.message}`);
      }
      return;
    }

    // 2. Browser Web Speech API (Desktop Chrome / Edge / Vivaldi)
    if (!this.recognition) {
      this.init({
        onNavigate: this.navigationHandler,
        onOpenAdmin: this.adminHandler,
        onToggleView: this.viewToggleHandler,
      });
    }

    if (this.recognition && !this.isListening) {
      if (force && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          this.doStartRecognition();
        }).catch((err) => {
          logger.warn('VOICE', `getUserMedia prompt error: ${err.message}`);
          this.doStartRecognition();
        });
        return;
      }
      this.doStartRecognition();
    }
  }

  doStartRecognition() {
    if (!this.recognition || this.isListening) return;
    try {
      this.recognition.start();
      this.isListening = true;
      this.notify({ isListening: true, status: 'listening' });
    } catch (err) {
      if (err.message && err.message.includes('already started')) {
        this.isListening = true;
        this.notify({ isListening: true, status: 'listening' });
      } else {
        logger.warn('VOICE', `Recognition start issue: ${err.message}`);
      }
    }
  }

  stopListening(userInitiated = true) {
    if (userInitiated) {
      this.userPaused = true;
      this.manualStop = true;
    }

    if (this.isAndroid || (typeof window !== 'undefined' && Boolean(window.AndroidLauncher))) {
      try {
        window.AndroidLauncher?.stopSpeechRecognizer?.();
      } catch {
        /* ignore */
      }
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
    }
    this.isListening = false;
    this.notify({ isListening: false });
    logger.speech('VOICE', 'Microphone paused by user');
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening(true);
    } else {
      this.cancelSpeech();
      this.startListening(true);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({
      isListening: this.isListening,
      isSpeaking: this.isSpeakingTts,
      isAiMuted: this.isAiMuted,
      transcript: this.currentTranscript,
      feedback: this.lastFeedback,
      isThinking: this.isThinking,
      latestReply: this.latestInteractiveReply,
      documentContext: this.documentContext,
    });
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    if (data.isThinking !== undefined) this.isThinking = data.isThinking;
    if (data.transcript !== undefined) this.currentTranscript = data.transcript;
    if (data.feedback !== undefined) this.lastFeedback = data.feedback;
    this.subscribers.forEach((cb) => {
      try {
        cb({
          isListening: this.isListening,
          isSpeaking: this.isSpeakingTts,
          isAiMuted: this.isAiMuted,
          transcript: this.currentTranscript,
          feedback: this.lastFeedback,
          isThinking: this.isThinking,
          latestReply: this.latestInteractiveReply,
          documentContext: this.documentContext,
          ...data,
        });
      } catch {
        /* ignore */
      }
    });
  }

  destroy() {
    this.stopListening();
    this.subscribers.clear();
    cancelSpeech();
  }
}

export const voiceNavigationService = new VoiceNavigationService();

if (typeof window !== 'undefined') {
  window.voiceNavigationService = voiceNavigationService;
}
