import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, HelpCircle, Keyboard, Send, X, CornerDownLeft, Pause, Play, Sparkles, Maximize2 } from 'lucide-react';
import { voiceNavigationService } from '../services/voiceNavigationService';
import { kioskConfigService } from '../services/kioskConfigService';
import FullscreenVoiceOverlay from './FullscreenVoiceOverlay';
import './VoiceAssistantBar.css';

export default function VoiceAssistantBar({ onNavigate, onOpenAdmin, onToggleView }) {
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
  const inputRef = useRef(null);

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
    window.addEventListener('aurra_open_fullscreen_voice', handleOpenFs);
    window.addEventListener('aurra_close_fullscreen_voice', handleCloseFs);
    return () => {
      window.removeEventListener('aurra_open_fullscreen_voice', handleOpenFs);
      window.removeEventListener('aurra_close_fullscreen_voice', handleCloseFs);
    };
  }, []);

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
    <div className={`voice-assistant-bar ${isKeyboardOpen ? 'keyboard-mode' : ''} ${latestReply ? 'has-reply' : ''}`}>
      {/* Mic Action Toggle Button */}
      <button
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
            <div className="status-line-left">
              {documentContext ? (
                <span className="sys-doc-pill">
                  SYS_08 • 📄 DOC AI ACTIVE
                </span>
              ) : (
                <span className="sys-core-pill">
                  SYS_01 • ASK AURRA
                </span>
              )}

              {isThinking ? (
                <span className="status-indicator thinking">
                  <Sparkles size={13} className="sparkle-pulse" />
                  AURRA THINKING (AI)...
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

              {latestReply && (
                <span className={`inline-source-pill source-${latestReply.source || 'default'}`}>
                  {latestReply.source === 'pdf-document-ai' && '📄 DOCUMENT AI'}
                  {latestReply.source === 'offline-faq' && '🟢 OFFLINE FAQ'}
                  {latestReply.source === 'groq-llm' && '⚡ CLOUD AI'}
                  {latestReply.source === 'hardware' && '⚙️ HARDWARE'}
                  {latestReply.source === 'navigation' && '🧭 NAVIGATION'}
                  {(!latestReply.source || latestReply.source === 'fallback') && '🤖 AURRA AI'}
                </span>
              )}
            </div>

            {latestReply && (
              <button
                type="button"
                className="inline-dismiss-btn"
                onClick={() => {
                  voiceNavigationService.clearInteractiveReply();
                  setLatestReply(null);
                }}
                title="Clear Response"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="voice-speech-text">
            {latestReply ? (
              <div className="inline-qa-content">
                {latestReply.query && (
                  <div className="inline-user-query">
                    <span className="query-prefix">You:</span> "{latestReply.query}"
                  </div>
                )}
                <div className="inline-robot-answer">
                  <span className="answer-prefix">Aurra:</span> {latestReply.reply}
                </div>
              </div>
            ) : transcript ? (
              <span className="heard-text">"{transcript}"</span>
            ) : (
              <span className="prompt-text">
                {documentContext ? (
                  isListening 
                    ? `Ask anything about "${documentContext.title || 'this PDF'}" or tap keyboard...` 
                    : `Document AI active. Tap keyboard or mic icon to ask about "${documentContext.title || 'this PDF'}"...`
                ) : (
                  isListening 
                    ? 'Voice assistant & multi-intent receptionist — the core Aurra runs from.' 
                    : 'Microphone paused. Tap keyboard or mic icon to command Aurra.'
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Real-Time Cyber Audio Equalizer Waveform */}
      <div 
        className={`voice-audio-equalizer ${isSpeaking ? 'speaking-bars' : isListening ? 'listening-bars' : 'idle-bars'}`}
        title={isSpeaking ? 'Aurra Spoken Audio Waveform' : isListening ? 'Live Ambient Microphone Waveform' : 'Microphone Standby'}
      >
        <span className="eq-bar bar-1"></span>
        <span className="eq-bar bar-2"></span>
        <span className="eq-bar bar-3"></span>
        <span className="eq-bar bar-4"></span>
        <span className="eq-bar bar-5"></span>
        <span className="eq-bar bar-6"></span>
        <span className="eq-bar bar-7"></span>
        <span className="eq-bar bar-8"></span>
        <span className="eq-bar bar-9"></span>
        <span className="eq-bar bar-10"></span>
        <span className="eq-bar bar-11"></span>
        <span className="eq-bar bar-12"></span>
      </div>

      {/* Typing Keyboard Toggle Button */}
      <button
        className={`voice-keyboard-btn ${isKeyboardOpen ? 'active' : ''}`}
        onClick={() => setIsKeyboardOpen((prev) => !prev)}
        title={isKeyboardOpen ? 'Hide Typing Keyboard' : 'Type Command via Keyboard'}
      >
        <Keyboard size={18} />
      </button>

      {/* Voice Hints Guide Toggle */}
      <button 
        className="voice-hints-btn" 
        onClick={() => setShowHints((prev) => !prev)}
        title="Voice Commands Guide"
      >
        <HelpCircle size={18} />
      </button>

      {/* Pause AI / Resume AI Efficiency Button (Commented out for now as requested) */}
      {/*
      <button
        className={`voice-pause-ai-btn ${isListening ? 'listening' : 'paused'}`}
        onClick={handleToggle}
        title={isListening ? 'Pause Continuous Audio Listening' : 'Resume Continuous Audio Listening'}
      >
        {isListening ? (
          <>
            <Pause size={14} />
            <span>Pause AI</span>
          </>
        ) : (
          <>
            <Play size={14} />
            <span>Resume AI</span>
          </>
        )}
      </button>
      */}

      {/* Speaker Button: Sound ON / Sound OFF (Muted) */}
      <button
        className={`voice-speaker-btn ${isAiMuted ? 'sound-off' : isSpeaking ? 'speaking' : 'sound-on'}`}
        onClick={handleToggleAiMute}
        title={
          isSpeaking
            ? 'AI is speaking — tap to mute AI speech now'
            : isAiMuted
            ? 'Speaker is OFF (Muted) — tap to turn speaker ON'
            : 'Speaker is ON — tap to turn speaker OFF (Mute AI)'
        }
      >
        {isAiMuted ? (
          <>
            <VolumeX size={16} color="#ef4444" />
            <span>Speaker OFF</span>
          </>
        ) : isSpeaking ? (
          <>
            <VolumeX size={16} className="speaking-pulse-icon" />
            <span>Mute AI</span>
          </>
        ) : (
          <>
            <Volume2 size={16} color="#00ffff" />
            <span>Speaker ON</span>
          </>
        )}
      </button>

      {/* Fullscreen Voice Immersion Toggle Button */}
      <button
        className="voice-fullscreen-btn"
        onClick={() => setIsFullscreenOpen(true)}
        title="Open Fullscreen Voice Assistant (Undulating Wave Horizon)"
      >
        <Maximize2 size={16} color="#00ffff" />
        <span>Full Screen</span>
      </button>

      {showHints && (
        <div className="voice-hints-popup" onClick={() => setShowHints(false)}>
          <div className="hints-header">
            <strong>AURRA VOICE COMMANDS</strong>
            <span>(Controlled by Admin Voice Toggles)</span>
          </div>
          <ul>
            <li>🗣️ <em>"Face Greetings"</em> or <em>"Camera"</em> &rarr; Face scanner</li>
            <li>🗣️ <em>"Facilities"</em> or <em>"Amenities"</em> &rarr; Directory</li>
            <li>🗣️ <em>"Show me around"</em> or <em>"Tour"</em> &rarr; Guided tour</li>
            <li>🗣️ <em>"Register"</em> or <em>"Form"</em> &rarr; Admission form</li>
            <li>🗣️ <em>"Cockpit"</em> or <em>"Control"</em> &rarr; Robot motors</li>
            <li>🗣️ <em>"Admin"</em> or <em>"Settings"</em> &rarr; Configuration</li>
            <li>🗣️ <em>"Show cards"</em> &rarr; Open Action Cards Grid</li>
            <li>🗣️ <em>"Home"</em> or <em>"Banner"</em> &rarr; Return to Main screen</li>
          </ul>
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
    </div>
  );
}
