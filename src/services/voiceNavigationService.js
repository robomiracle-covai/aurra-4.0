/**
 * Voice Navigation Service for Testing App
 * - Speech-to-Intent matching against Action Cards & Kiosk Features
 * - Voice Access Gatekeeper: Verifies card.voiceAccessEnabled
 * - Integrates with offlineCardService & IndexedDB
 * - Ultra-low latency TTS feedback via speakWithVoice
 * - Logs all speech recognition events to diagnostic logger
 */

import { offlineCardService, offlineQaService } from '../db/offlineServices';
import { hardwareDispatcher } from './hardwareDispatcher';
import { speakWithVoice, cancelSpeech, isAnySpeaking } from '../utils/speechSynthesis';
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

  // 1. Fixed system phrases that are only ever spoken BY Aurra
  const SYSTEM_PHRASES = [
    'i am aurra',
    'autonomous humanoid',
    'receptionist robot',
    'developed by robomiracle',
    'assist visitors',
    'manage registrations',
    'welcome to robomiracle',
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
    'you can ask me about',
    'access denied voice navigation',
    'could you please clarify',
    'sure how can i assist',
    'hello guest welcome',
    'hello visitor welcome',
    'what is your query',
  ];

  for (const phrase of SYSTEM_PHRASES) {
    if (hNorm.includes(phrase) || phrase.includes(hNorm)) {
      return true;
    }
  }

  // 2. Check against last spoken response
  if (lastSpokenText) {
    const sNorm = normalize(lastSpokenText);
    if (sNorm) {
      if (sNorm.includes(hNorm) || hNorm.includes(sNorm)) {
        return true;
      }

      // Check significant word overlap
      const wordsH = hNorm.split(' ').filter(w => w.length > 2);
      const wordsS = new Set(sNorm.split(' ').filter(w => w.length > 2));
      if (wordsH.length >= 2) {
        let matchCount = 0;
        for (const w of wordsH) {
          if (wordsS.has(w)) matchCount++;
        }
        if (matchCount / wordsH.length >= 0.5) {
          return true;
        }
      }
    }
  }

  return false;
}

class VoiceNavigationService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.manualStop = false;
    this.userPaused = false;
    this.isSpeakingTts = false;
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
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch {
        /* ignore */
      }
    }
    this.isListening = false;
    this.currentTranscript = '';
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
        setTimeout(() => resumeListening(), 250);
        return;
      }
      settled = true;
      clearTimeout(watchdogTimer);
      this.isSpeakingTts = false;
      this.lastSpeechEndTime = Date.now();
      this.notify({ isSpeaking: false });
      
      // Acoustic settling delay (750ms): keep mic quiet until speaker echo in the room fades
      setTimeout(() => {
        if (!this.userPaused && !this.manualStop && !this.isSpeakingTts && !isAnySpeaking()) {
          this.currentTranscript = '';
          this.notify({ transcript: '' });
          this.startListening(true);
        }
      }, 750);
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

  cancelSpeech() {
    this.isSpeakingTts = false;
    this.isThinking = false;
    this.lastSpeechEndTime = Date.now();
    cancelSpeech();
    this.currentTranscript = '';
    this.notify({ isSpeaking: false, isThinking: false, transcript: '' });
    this.startListening(true);
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
      // Handlers updated. Maintain existing listening / pause state across screen transitions.
      return true;
    }

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

        const candidate = (final || interim).toLowerCase().trim();

        // Allow immediate barge-in for urgent navigation/stop commands
        const isUrgent = candidate.includes('home') || candidate === 'stop' || candidate.includes('cancel') || candidate.includes('exit');
        const isBusy = this.isProcessing || this.isSpeakingTts || isAnySpeaking();
        if (!isUrgent && (isBusy || (this.lastSpeechEndTime && Date.now() - this.lastSpeechEndTime < 850))) {
          // Hard drop: mic input is completely muted while Aurra is processing, speaking, or settling
          return;
        }

        const displayText = (final || interim).trim();
        this.currentTranscript = displayText;
        this.notify({ transcript: displayText });

        if (final && final.trim().length >= 3) {
          logger.speech('VOICE', `Heard utterance: "${final.trim()}"`);
          this.processVoiceCommand(final.trim().toLowerCase());
        }
      };

      this.recognition.onerror = (event) => {
        // 'no-speech' is normal when idle
        if (event.error !== 'no-speech') {
          logger.warn('VOICE', `Speech recognition error: ${event.error}`);
        }
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this.notify({ isListening: false, error: 'Microphone permission denied' });
        }
      };

      this.recognition.onend = () => {
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

        // Auto-restart with debounce to avoid Android WebView InvalidStateError
        this.isListening = false;
        setTimeout(() => {
          const isBusy = this.isProcessing || this.isSpeakingTts || isAnySpeaking();
          if (!this.manualStop && !this.userPaused && !isBusy) {
            try {
              this.recognition.start();
              this.isListening = true;
              this.notify({ isListening: true, status: 'listening' });
            } catch {
              // Retry once after 500ms if Android threw already-started or busy error
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
      utterance.includes('home') ||
      utterance.includes('main menu') ||
      utterance.includes('main screen') ||
      utterance.includes('main page') ||
      utterance === 'back' ||
      utterance.includes('go back') ||
      utterance.includes('exit') ||
      utterance.includes('close') ||
      utterance.includes('leave') ||
      utterance.includes('quit');

    if (isHomeIntent) {
      this.cancelSpeech();
      this.setFeedback('Returning to Home screen');
      this.speak('Returning to Home screen');
      setTimeout(() => {
        this.navigationHandler?.('/');
      }, 250);
      return;
    }

    if (utterance === 'stop' || utterance === 'cancel' || utterance === 'shut up' || utterance === 'be quiet' || utterance === 'silence') {
      this.cancelSpeech();
      this.setFeedback('Speech paused');
      return;
    }

    if (utterance.includes('admin') || utterance.includes('setting') || utterance.includes('open admin') || utterance.includes('dashboard')) {
      this.cancelSpeech();
      this.setFeedback('Opening Admin Settings');
      this.speak('Opening Admin Settings');
      this.adminHandler?.();
      return;
    }

    if (utterance.includes('show card') || utterance.includes('show feature') || utterance.includes('action card') || utterance.includes('cards')) {
      this.cancelSpeech();
      this.setFeedback('Switching to Action Cards');
      this.speak('Opening Action Cards');
      this.navigationHandler?.('/?view=cards');
      this.viewToggleHandler?.(false);
      return;
    }

    if (utterance.includes('interaction') || utterance.includes('interactive') || utterance.includes('humanoid') || utterance.includes('hud') || utterance.includes('avatar')) {
      this.cancelSpeech();
      this.setFeedback('Opening Interaction Mode');
      this.speak('Opening Interaction Mode');
      setTimeout(() => {
        this.navigationHandler?.('/interaction');
      }, 250);
      return;
    }

    if (utterance.includes('show slider') || utterance.includes('banner') || utterance.includes('slideshow')) {
      this.cancelSpeech();
      this.setFeedback('Switching to Slideshow Banner');
      this.speak('Displaying banner');
      this.navigationHandler?.('/?view=slider');
      this.viewToggleHandler?.(true);
      return;
    }

    // 2. Strict Concurrency Mutex & Hardware Busy Guard:
    const isBusy = this.isProcessing || this.isSpeakingTts || isAnySpeaking();
    if (isBusy && inputType === 'voice') {
      logger.speech('VOICE', `Rejected utterance while busy (processing=${this.isProcessing}, speaking=${this.isSpeakingTts}): "${rawUtterance}"`);
      return;
    }

    if (inputType === 'text' && isBusy) {
      this.cancelSpeech();
    }

    // 3. Post-speech acoustic settling delay (850ms) - only applies to voice
    if (inputType === 'voice' && this.lastSpeechEndTime && (Date.now() - this.lastSpeechEndTime < 850)) {
      logger.speech('VOICE', `Dropped utterance during acoustic settling: "${rawUtterance}"`);
      return;
    }

    // 4. Acoustic Self-Echo & System Prompt Rejection - only applies to voice
    if (inputType === 'voice' && (isAcousticEcho(rawUtterance, this.lastFeedback) || isAcousticEcho(rawUtterance, this.lastSpokenText))) {
      logger.speech('VOICE', `Dropped acoustic self-echo utterance: "${rawUtterance}"`);
      return;
    }

    // 5. Deduplicate identical/similar utterances within 4 seconds
    const timeSinceLast = Date.now() - this.lastProcessedTime;
    if (timeSinceLast < 4000) {
      if (this.lastProcessedUtterance === utterance || utterance.includes(this.lastProcessedUtterance) || this.lastProcessedUtterance.includes(utterance)) {
        logger.speech('VOICE', `Dropped duplicate utterance: "${rawUtterance}"`);
        return;
      }
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

    try {
      // 4. Direct Cloud AI Mode Override (Sends all queries straight to Groq LLM API using Admin API key)
      if (this.forceLlmOnly) {
      if (!llmService.isConfigured()) {
        const noKeyMsg = "Cloud AI is not configured. Please enter your Groq API key in Admin Settings.";
        this.setFeedback(noKeyMsg);
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

    // 3. Match against Action Cards in IndexedDB (Voice Access Gatekeeper)
    const cards = await offlineCardService.getCards();
      
      let matchedCard = null;

      // Find first card matching utterance
      for (const card of cards) {
        const titleMatch = utterance.includes(card.title.toLowerCase());
        const keywords = card.voiceKeywords || [];
        const keywordMatch = keywords.some((kw) => utterance.includes(kw.toLowerCase()));

        if (titleMatch || keywordMatch) {
          matchedCard = card;
          break;
        }
      }

      if (!matchedCard) {
        // Fallback checks for common navigation terms
        if (utterance.includes('greeting') || utterance.includes('face') || utterance.includes('recognize') || utterance.includes('camera')) {
          matchedCard = cards.find((c) => c.href === '/face-recognition') || {
            title: 'Face Greetings',
            href: '/face-recognition',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('open qa') || 
          utterance.includes('open q&a') || 
          utterance.includes('open questions') || 
          utterance.includes('go to qa') || 
          utterance.includes('faq hub')
        ) {
          matchedCard = cards.find((c) => c.href === '/qa') || {
            title: 'Interactive Q&A',
            href: '/qa',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('website') ||
          utterance.includes('social link') ||
          utterance.includes('brochure') ||
          utterance.includes('qr code') ||
          utterance.includes('open links')
        ) {
          matchedCard = cards.find((c) => c.href === '/weblinks') || {
            title: 'Website & Social Links',
            href: '/weblinks',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('testing interactive') ||
          utterance.includes('test mode') ||
          utterance.includes('diagnostic mode') ||
          utterance.includes('test lab')
        ) {
          matchedCard = cards.find((c) => c.href === '/testing-interaction') || {
            title: 'Testing Interactive Mode',
            href: '/testing-interaction',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('interaction') ||
          utterance.includes('interactive') ||
          utterance.includes('humanoid') ||
          utterance.includes('hud') ||
          utterance.includes('avatar')
        ) {
          matchedCard = cards.find((c) => c.href === '/interaction') || {
            title: 'Interaction Mode',
            href: '/interaction',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('tour') ||
          utterance.includes('show me around') ||
          utterance.includes('guided tour') ||
          utterance.includes('take a tour') ||
          utterance.includes('robot tour')
        ) {
          matchedCard = cards.find((c) => c.href === '/guided-tour') || {
            title: 'Guided Robot Tour',
            href: '/guided-tour',
            voiceAccessEnabled: true,
          };
        } else if (
          utterance.includes('facility') ||
          utterance.includes('facilities') ||
          utterance.includes('amenities') ||
          utterance.includes('washroom') ||
          utterance.includes('restroom') ||
          utterance.includes('toilet') ||
          utterance.includes('canteen') ||
          utterance.includes('cafeteria') ||
          utterance.includes('drinking water') ||
          utterance.includes('elevator') ||
          utterance.includes('stairs') ||
          utterance.includes('room directory') ||
          utterance.includes('floor directory') ||
          utterance.includes('building map')
        ) {
          matchedCard = cards.find((c) => c.href === '/facilities') || {
            title: 'Public Facilities',
            href: '/facilities',
            voiceAccessEnabled: true,
          };
        }
      }

      if (matchedCard) {
        // Voice Access Gatekeeper Check!
        const isVoiceAllowed = matchedCard.voiceAccessEnabled !== false;

        if (!isVoiceAllowed) {
          const blockedMsg = `Access denied. Voice navigation for ${matchedCard.title} is turned OFF in admin.`;
          this.setFeedback(blockedMsg);
          logger.warn('VOICE', `Voice access BLOCKED for [${matchedCard.title}]. Admin toggle is OFF.`);
          this.speak(blockedMsg);
          return;
        }

        // Voice Access Allowed
        const grantedMsg = `Opening ${matchedCard.title}`;
        this.setFeedback(grantedMsg);
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

        // Navigate promptly (350ms) so user experiences snappy screen transitions
        setTimeout(doNavigate, 350);

        return;
      }

      // 4. Tier 2: Universal Offline Q&A Knowledge Matching (< 3ms IndexedDB)
      const qaResult = await offlineQaService.findBestAnswer(rawUtterance);
      if (qaResult && qaResult.match && (qaResult.confidence >= 60 || !llmService.isConfigured())) {
        const item = qaResult.match;
        const latency = Math.round(performance.now() - queryStartTime);
        logTiming(`Offline FAQ matched`, `"${item.question}" (${qaResult.confidence}% in ${latency}ms)`);
        this.setFeedback(item.answer);
        
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

      // 5. Tier 3: Escalate to Real AI Groq LLM (Cloud API)
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
          this.speak(llmResult.text);
          return;
        }
      }

      // 6. Friendly intelligent fallback if LLM is disabled or fails
      this.isThinking = false;
      this.notify({ isThinking: false });
      const fallbackMsg = "Sorry, I could not catch that.";
      const latency = Math.round(performance.now() - queryStartTime);
      logTiming(`Fallback triggered (${latency}ms)`);
      this.setFeedback(fallbackMsg);
      this.speak(fallbackMsg);

    } catch (err) {
      logger.error('VOICE', `Voice command evaluation error: ${err.message}`);
    } finally {
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
    } else if (this.userPaused) {
      // User explicitly paused AI listening; suppress auto-starting on navigation
      return;
    }

    this.manualStop = false;
    if (!this.recognition) {
      this.init({
        onNavigate: this.navigationHandler,
        onOpenAdmin: this.adminHandler,
        onToggleView: this.viewToggleHandler,
      });
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        this.notify({ isListening: true });
      } catch (err) {
        if (err.message && err.message.includes('already started')) {
          this.isListening = true;
          this.notify({ isListening: true });
        } else {
          logger.warn('VOICE', `Recognition start issue: ${err.message}`);
        }
      }
    }
  }

  stopListening(userInitiated = true) {
    if (userInitiated) {
      this.userPaused = true;
      this.manualStop = true;
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
      this.startListening(true);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({
      isListening: this.isListening,
      transcript: this.currentTranscript,
      feedback: this.lastFeedback,
      isThinking: this.isThinking,
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
          transcript: this.currentTranscript,
          feedback: this.lastFeedback,
          isThinking: this.isThinking,
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
