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
import { speakWithVoice, cancelSpeech } from '../utils/speechSynthesis';
import { llmService } from './llmService';
import { logger } from './logger';

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
  }

  setForceLlmOnly(enabled) {
    this.forceLlmOnly = !!enabled;
    this.notify({ forceLlmOnly: this.forceLlmOnly });
    logger.info('VOICE', `Force Direct Cloud AI Mode: ${this.forceLlmOnly ? 'ENABLED' : 'DISABLED'}`);
  }

  speak(text, options = {}) {
    this.isSpeakingTts = true;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch {
        /* ignore */
      }
    }
    const originalOnEnd = options.onEnd;
    const resumeListening = () => {
      setTimeout(() => {
        this.isSpeakingTts = false;
        if (!this.userPaused && !this.manualStop) {
          this.startListening(true);
        }
      }, 600);
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

  init({ onNavigate, onOpenAdmin, onToggleView, autoStart = false }) {
    this.navigationHandler = onNavigate;
    this.adminHandler = onOpenAdmin;
    this.viewToggleHandler = onToggleView;

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
        if (this.isSpeakingTts) {
          // Mute mic processing while Aurra is speaking to prevent self-echo loops
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

        const displayText = (final || interim).trim();
        this.currentTranscript = displayText;
        this.notify({ transcript: displayText });

        if (final) {
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
        // If currently speaking TTS or user stopped/paused, do NOT restart
        if (this.isSpeakingTts || this.manualStop || this.userPaused) {
          this.isListening = false;
          this.notify({ isListening: false });
          return;
        }

        // Auto-restart if user did not manually stop listening
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            this.isListening = false;
            this.notify({ isListening: false });
          }
        } else {
          this.isListening = false;
          this.notify({ isListening: false });
        }
      };

      this.isInitialized = true;
      return true;
    } catch (err) {
      logger.error('VOICE', `Init error: ${err.message}`);
      return false;
    }
  }

  async processVoiceCommand(rawUtterance) {
    if (!rawUtterance || typeof rawUtterance !== 'string') return;
    const utterance = rawUtterance.toLowerCase().trim();

    // Echo Protection: Filter out self-hearing of TTS output or system prompts
    const lastSpoken = (this.lastFeedback || '').toLowerCase().trim();
    if (lastSpoken) {
      const isSelfEcho = utterance.length >= 4 && (
        lastSpoken.includes(utterance) ||
        utterance.includes(lastSpoken.slice(0, 20)) ||
        utterance.includes("didn't quite catch") ||
        utterance.includes("you can ask me") ||
        utterance.includes("visitor registration") ||
        utterance.includes("welcome to robomiracle")
      );
      if (isSelfEcho) {
        logger.speech('VOICE', `Dropped self-echo utterance: "${rawUtterance}"`);
        return;
      }
    }

    // Direct Cloud AI Mode Override (Sends all queries straight to Groq LLM API using Admin API key)
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
        this.setFeedback(aiReply);
        logger.speech('VOICE', `[Direct Groq AI Answer (${llmResult.latencyMs}ms)]: "${aiReply}"`);

        this.conversationHistory.push({ role: 'user', content: rawUtterance });
        this.conversationHistory.push({ role: 'assistant', content: aiReply });
        if (this.conversationHistory.length > 8) {
          this.conversationHistory = this.conversationHistory.slice(-8);
        }

        this.speak(aiReply);

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

    // 1. Robot Hardware Commands (ESP32 / Motors / Servos / Eyes)
    const hwResult = hardwareDispatcher.evaluate(utterance);
    if (hwResult.handled) {
      this.setFeedback(hwResult.message);
      logger.speech('VOICE', `Hardware command: [${hwResult.action}] -> "${hwResult.message}"`);
      this.speak(hwResult.message);
      return;
    }

    // 2. System Navigation Intents
    if (utterance.includes('home') || utterance.includes('main menu') || utterance.includes('go home') || utterance.includes('back to home')) {
      this.setFeedback('Returning to Home screen');
      this.speak('Returning to Home screen');
      this.navigationHandler?.('/');
      return;
    }

    if (utterance.includes('admin') || utterance.includes('setting') || utterance.includes('open admin') || utterance.includes('dashboard')) {
      this.setFeedback('Opening Admin Settings');
      this.speak('Opening Admin Settings');
      this.adminHandler?.();
      return;
    }

    if (utterance.includes('show card') || utterance.includes('show feature') || utterance.includes('action card') || utterance.includes('cards')) {
      this.setFeedback('Switching to Action Cards');
      this.speak('Opening Action Cards');
      this.navigationHandler?.('/?view=cards');
      this.viewToggleHandler?.(false); // false = show cards
      return;
    }

    if (utterance.includes('show slider') || utterance.includes('banner') || utterance.includes('slideshow')) {
      this.setFeedback('Switching to Slideshow Banner');
      this.speak('Displaying banner');
      this.navigationHandler?.('/?view=slider');
      this.viewToggleHandler?.(true); // true = show slider
      return;
    }

    // 3. Match against Action Cards in IndexedDB (Voice Access Gatekeeper)
    try {
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
        
        this.speak(grantedMsg, {
          onEnd: () => {
            this.navigationHandler?.(matchedCard.href, matchedCard);
          },
        });

        // Navigate immediately as fallback if TTS completes or is silent
        setTimeout(() => {
          this.navigationHandler?.(matchedCard.href, matchedCard);
        }, 1200);

        return;
      }

      // 4. Tier 2: Universal Offline Q&A Knowledge Matching (< 3ms IndexedDB)
      const qaResult = await offlineQaService.findBestAnswer(rawUtterance);
      if (qaResult && qaResult.match && (qaResult.confidence >= 60 || !llmService.isConfigured())) {
        const item = qaResult.match;
        this.setFeedback(item.answer);
        logger.speech('VOICE', `[Tier 2: Offline FAQ] [${item.question}] (${qaResult.confidence}% match): "${item.answer}"`);
        
        this.speak(item.answer);

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
        logger.speech('VOICE', `[Tier 3: Escalating to Real AI LLM] Query: "${rawUtterance}"`);

        const llmResult = await llmService.generateResponse(rawUtterance, this.conversationHistory);
        this.isThinking = false;
        this.notify({ isThinking: false });

        if (llmResult.success && llmResult.text) {
          const aiReply = llmResult.text;
          this.setFeedback(aiReply);
          logger.speech('VOICE', `[Tier 3: Groq AI Answer (${llmResult.latencyMs}ms)]: "${aiReply}"`);

          // Maintain recent conversation history
          this.conversationHistory.push({ role: 'user', content: rawUtterance });
          this.conversationHistory.push({ role: 'assistant', content: aiReply });
          if (this.conversationHistory.length > 8) {
            this.conversationHistory = this.conversationHistory.slice(-8);
          }

          this.speak(aiReply);

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
      const fallbackMsg = "I didn't quite catch that. You can ask me about our company, working hours, visitor registration, say 'show cards', or command my robot hardware.";
      this.setFeedback(fallbackMsg);
      logger.info('VOICE', `Utterance "${utterance}" did not match any active cards or FAQs.`);
      this.speak(fallbackMsg);

    } catch (err) {
      logger.error('VOICE', `Voice command evaluation error: ${err.message}`);
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
