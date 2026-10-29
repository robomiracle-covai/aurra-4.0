import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, HelpCircle, Keyboard, Send, X, CornerDownLeft, Pause, Play, Sparkles, Maximize2 } from 'lucide-react';
import { voiceNavigationService } from '../services/voiceNavigationService';
import { kioskConfigService } from '../services/kioskConfigService';
import FullscreenVoiceOverlay from './FullscreenVoiceOverlay';
import './VoiceAssistantBar.css';

export default function VoiceAssistantBar({ onNavigate, onOpenAdmin, onToggleView, hideBarOnly = false }) {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiMuted, setIsAiMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [latestReply, setLatestReply] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [documentContext, setDocumentContext] = useState(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isCatchingMorph, setIsCatchingMorph] = useState(false);
  const inputRef = useRef(null);
  const micBtnRef = useRef(null);

  // Expose mic button position globally and listen for landing dock animation
  useEffect(() => {
    const update = () => {
      if (micBtnRef.current) {
        window.__aurra_mic_btn_rect = micBtnRef.current.getBoundingClientRect();
      }
    };
    update();
    window.addEventListener('resize', update);

    const handleDock = () => {
      setIsCatchingMorph(true);
      setTimeout(() => setIsCatchingMorph(false), 900);
    };
    window.addEventListener('aurra_voice_bar_dock', handleDock);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('aurra_voice_bar_dock', handleDock);
    };
  }, []);

  useEffect(() => {
    // Initialize voice navigation service with action callbacks
    const cfg = kioskConfigService.getConfig();
    voiceNavigationService.init({
      onNavigate,
      onOpenAdmin,
      onToggleView,
      autoStart: cfg.autoListenOnBoot !== false,
    });

    setDocumentContext(voiceNavigationService.getDocumentContext());

    const unsubscribe = voiceNavigationService.subscribe((state) => {
      setIsListening(state.isListening);
      if (state.isThinking !== undefined) setIsThinking(state.isThinking);
      if (state.isSpeaking !== undefined) setIsSpeaking(state.isSpeaking);
      if (state.isAiMuted !== undefined) setIsAiMuted(state.isAiMuted);
      if (state.documentContext !== undefined) setDocumentContext(state.documentContext);
      if (state.transcript !== undefined) {
        setTranscript(state.transcript);
        if (state.transcript && state.transcript.trim().length > 0) {
          setLatestReply(null);
        }
      }
      if (state.feedback !== undefined) setFeedback(state.feedback);
      if (state.latestReply !== undefined) setLatestReply(state.latestReply);
    });

    return () => {
      unsubscribe();
    };
  }, [onNavigate, onOpenAdmin, onToggleView]);

  useEffect(() => {
    const handleOpenFs = () => setIsFullscreenOpen(true);
    const handleCloseFs = () => setIsFullscreenOpen(false);
    const handleMorphCatch = () => {
      setTimeout(() => {
        setIsCatchingMorph(true);
        setTimeout(() => setIsCatchingMorph(false), 1000);
      }, 800);
    };

    window.addEventListener('aurra_open_fullscreen_voice', handleOpenFs);
    window.addEventListener('aurra_close_fullscreen_voice', handleCloseFs);
    window.addEventListener('aurra_morph_cards_in', handleMorphCatch);
    return () => {
      window.removeEventListener('aurra_open_fullscreen_voice', handleOpenFs);
      window.removeEventListener('aurra_close_fullscreen_voice', handleCloseFs);
      window.removeEventListener('aurra_morph_cards_in', handleMorphCatch);
    };
  }, []);

  // Watchdog: Clear stuck transcript if no reply or speaking state occurs within 8s
  useEffect(() => {
    if (transcript && !latestReply && !isSpeaking && !isThinking) {
      const timer = setTimeout(() => {
        setTranscript('');
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [transcript, latestReply, isSpeaking, isThinking]);

  useEffect(() => {
    if (isKeyboardOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isKeyboardOpen]);

  const handleToggle = () => {
    voiceNavigationService.toggleListening();
  };

  const handleToggleAiMute = () => {
    // If AI is currently speaking, mute/silence speech immediately!
    if (isSpeaking) {
      voiceNavigationService.cancelSpeech();
      voiceNavigationService.setAiMuted(true);
    } else {
      voiceNavigationService.toggleAiMute();
    }
  };

  const handleSendTypedCommand = (e) => {
    e?.preventDefault();
    const command = typedInput.trim();
    if (!command) return;

    // Echo typed command into transcript
    setTranscript(command);
    voiceNavigationService.notify({ transcript: command });

    // Close typing keyboard mode so live transcript & response feedback are visible
    setIsKeyboardOpen(false);

    // Process intent through voice navigation service
    voiceNavigationService.processVoiceCommand(command);

    setTypedInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendTypedCommand();
    } else if (e.key === 'Escape') {
      setIsKeyboardOpen(false);
    }
  };

  return (
    <>
      {!hideBarOnly && (
        <div className={`voice-assistant-bar ${isKeyboardOpen ? 'keyboard-mode' : ''} ${latestReply ? 'has-reply' : ''} ${isCatchingMorph ? 'morph-catch' : ''} ${isFullscreenOpen && !isCatchingMorph ? 'is-fullscreen-open' : ''}`}>
      {/* Mic Action Toggle Button */}
      <button
        ref={micBtnRef}
        className={`voice-mic-btn ${isListening ? 'listening' : 'muted'}`}
        onClick={handleToggle}
        title={isListening ? 'Continuous Voice AI Active (Click to mute)' : 'Microphone Muted (Click to talk)'}
      >
        {isListening ? (
          <>
            <div className="pulse-ring"></div>
            <Mic size={22} color="#ffffff" />
          </>
        ) : (
          <MicOff size={22} color="#ef4444" />
        )}
      </button>

      {/* Main Content: Either Live Voice Transcript or Typing Keyboard Input */}
      {isKeyboardOpen ? (
        <form className="voice-typing-container" onSubmit={handleSendTypedCommand}>
          <input
            ref={inputRef}
            type="text"
            className="voice-typing-input"
            placeholder={documentContext ? `Ask anything about "${documentContext.title || 'this PDF'}"...` : "Type command (e.g. 'show cards', 'facilities', 'register', 'admin')..."}
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="voice-send-btn"
            disabled={!typedInput.trim()}
            title="Send Command"
          >
            <Send size={16} />
          </button>
          <button
            type="button"
            className="voice-close-input-btn"
            onClick={() => setIsKeyboardOpen(false)}
            title="Close Typing Mode"
          >
            <X size={16} />
          </button>
        </form>
      ) : (
        <div className="voice-content-wrap">
          <div className="voice-status-line">
            {isThinking ? (
              <span className="status-indicator thinking">
                <Sparkles size={14} className="sparkle-pulse" />
                AURRA THINKING
              </span>
            ) : isSpeaking ? (
              <span className="status-indicator speaking">
                <div className="gemini-mini-bars">
                  <span className="g-bar b1"></span>
                  <span className="g-bar b2"></span>
                  <span className="g-bar b3"></span>
                  <span className="g-bar b4"></span>
                </div>
                AURRA SPEAKING
              </span>
            ) : (
              <span className={`status-indicator ${isListening ? 'live' : 'idle'}`}>
                <span className="dot"></span>
                {isListening ? 'AURRA LISTENING' : 'MIC PAUSED'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Typing Keyboard Toggle Button */}
      <button
        className={`voice-keyboard-btn ${isKeyboardOpen ? 'active' : ''}`}
        onClick={() => setIsKeyboardOpen((prev) => !prev)}
        title={isKeyboardOpen ? 'Hide Typing Keyboard' : 'Type Command via Keyboard'}
      >
        <Keyboard size={18} />
      </button>

      {/* Speaker Button: Sound ON / Sound OFF (Muted) - Icon Only */}
      <button
        className={`voice-speaker-btn ${isAiMuted ? 'sound-off' : isSpeaking ? 'speaking' : 'sound-on'}`}
        onClick={handleToggleAiMute}
        title={
          isSpeaking
            ? 'AI is speaking — tap to mute AI speech'
            : isAiMuted
            ? 'Speaker is OFF (Muted) — tap to turn speaker ON'
            : 'Speaker is ON — tap to turn speaker OFF (Mute AI)'
        }
      >
        {isAiMuted ? (
          <VolumeX size={18} color="#ef4444" />
        ) : isSpeaking ? (
          <VolumeX size={18} className="speaking-pulse-icon" />
        ) : (
          <Volume2 size={18} color="#000000" />
        )}
      </button>

      {/* Fullscreen Voice Immersion Toggle Button - Icon Only */}
      <button
        className="voice-fullscreen-btn"
        onClick={() => setIsFullscreenOpen(true)}
        title="Open Fullscreen Voice Assistant"
      >
        <Maximize2 size={18} color="#000000" />
      </button>
        </div>
      )}

      {/* Fullscreen Voice Immersion HUD Overlay */}
      <FullscreenVoiceOverlay
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        isListening={isListening}
        isThinking={isThinking}
        isSpeaking={isSpeaking}
        isAiMuted={isAiMuted}
        transcript={transcript}
        feedback={feedback}
        latestReply={latestReply}
        documentContext={documentContext}
        onToggleListening={handleToggle}
        onToggleAiMute={handleToggleAiMute}
      />
    </>
  );
}
