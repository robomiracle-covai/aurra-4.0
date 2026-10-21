import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Volume2, VolumeX, Minimize2, Keyboard, Send, X, Sparkles, HelpCircle } from 'lucide-react';
import { voiceNavigationService } from '../services/voiceNavigationService';
import './FullscreenVoiceOverlay.css';

export default function FullscreenVoiceOverlay({
  isOpen,
  onClose,
  isListening,
  isThinking,
  isSpeaking,
  isAiMuted,
  transcript,
  feedback,
  latestReply,
  documentContext,
  onToggleListening,
  onToggleAiMute,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const inputRef = useRef(null);

  // Focus input when keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isKeyboardOpen]);

  // Handle ESC key to close fullscreen
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isKeyboardOpen) {
          setIsKeyboardOpen(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isKeyboardOpen, onClose]);

  // ── Ultra-Smooth Continuous Waving Laser Horizon Animation ──
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // High DPI setup
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Target amplitude based on state
    let targetAmp = 26;
    if (isSpeaking) targetAmp = 42;
    else if (isListening) targetAmp = 28;
    else targetAmp = 14;

    let currentAmp = targetAmp;

    const render = () => {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerY = height * 0.48; // Position at the horizon line
      const centerX = width * 0.5;

      ctx.clearRect(0, 0, width, height);

      // Active dynamic waves when hearing/speaking; very subtle micro-ripple in calm standby
      let target = isSpeaking ? 48 : isListening ? 34 : 3.5;
      currentAmp += (target - currentAmp) * 0.08;

      // Phase speed: energetic when speaking/hearing, very slow gentle drift in calm standby
      phaseRef.current += isSpeaking ? 0.12 : isListening ? 0.08 : 0.012;
      const phase = phaseRef.current;

      // Center bell curve width (spread of the waving ribbons)
      const sigma = Math.min(width * 0.30, 420);

      // Ribbon Strands Definition with Ultra-Delicate Razor-Thin Continuous and Dotted Filaments
      const strands = [
        // --- Continuous Smooth Laser Filaments ---
        {
          color: '#FFFFFF',
          glow: 'rgba(255, 255, 255, 0.65)',
          lineWidth: 0.8,
          freq: 0.016,
          ampScale: 1.15,
          phaseOffset: 0.6,
        },
        {
          color: '#00E5FF',
          glow: 'rgba(0, 229, 255, 0.35)',
          lineWidth: 0.75,
          freq: 0.015,
          ampScale: 1.1,
          phaseOffset: 0,
        },
        {
          color: '#00CFEF',
          glow: 'rgba(0, 207, 239, 0.35)',
          lineWidth: 0.7,
          freq: 0.018,
          ampScale: 0.95,
          phaseOffset: 1.8,
        },
        {
          color: '#00A8FF',
          glow: 'rgba(0, 168, 255, 0.35)',
          lineWidth: 0.65,
          freq: 0.012,
          ampScale: 1.25,
          phaseOffset: 3.4,
        },
        {
          color: '#087FC1',
          glow: 'rgba(8, 127, 193, 0.35)',
          lineWidth: 0.55,
          freq: 0.021,
          ampScale: 0.85,
          phaseOffset: 4.9,
        },

        // --- Cyber Dotted Laser Filaments (Exactly 2 dotted waveforms) ---
        {
          color: '#FFFFFF',
          glow: 'rgba(255, 255, 255, 0.75)',
          lineWidth: 0.9,
          freq: 0.013,
          ampScale: 1.12,
          phaseOffset: 1.25,
          dash: [1, 9],
          dashSpeed: 22,
        },
        {
          color: '#00E5FF',
          glow: 'rgba(0, 229, 255, 0.60)',
          lineWidth: 0.85,
          freq: 0.019,
          ampScale: 0.88,
          phaseOffset: 2.7,
          dash: [1, 8],
          dashSpeed: -18,
        },
      ];

      // Draw horizontal baseline glow across entire width with White and Company Blue/Cyan Gradient
      ctx.save();
      const baseGrad = ctx.createLinearGradient(0, centerY, width, centerY);
      baseGrad.addColorStop(0, 'rgba(0, 123, 168, 0.05)');
      baseGrad.addColorStop(0.2, 'rgba(8, 127, 193, 0.6)');
      baseGrad.addColorStop(0.42, 'rgba(0, 229, 255, 0.85)');
      baseGrad.addColorStop(0.5, '#FFFFFF');
      baseGrad.addColorStop(0.58, 'rgba(0, 229, 255, 0.85)');
      baseGrad.addColorStop(0.8, 'rgba(8, 127, 193, 0.6)');
      baseGrad.addColorStop(1, 'rgba(0, 123, 168, 0.05)');

      // Pass 1: Baseline Ambient Halo (Delicate half-radius halo)
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(0, 207, 239, 0.20)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Pass 2: Sharp Ultra-Delicate Laser Horizon Line
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = baseGrad;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Pass 3: Dotted Baseline Horizon Tick Track
      ctx.beginPath();
      ctx.setLineDash([2, 12]);
      ctx.lineDashOffset = -phase * 14;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 0.65;
      ctx.stroke();
      ctx.restore();

      // Draw the undulating ribbon strands with fast 2-pass GPU-friendly glow
      for (let s = 0; s < strands.length; s++) {
        const strand = strands[s];
        ctx.save();
        ctx.beginPath();

        const step = 4; // Sample every 4px for silky curves
        let isFirst = true;

        for (let x = 0; x <= width; x += step) {
          // Gaussian envelope to smoothly taper wave to zero at edges
          const dx = x - centerX;
          const envelope = Math.exp(-((dx * dx) / (2 * sigma * sigma)));

          // Multi-frequency undulating wave
          const wave =
            Math.sin(x * strand.freq + phase + strand.phaseOffset) * 0.78 +
            Math.sin(x * (strand.freq * 1.65) - phase * 0.85 + strand.phaseOffset) * 0.22;

          const y = centerY + wave * currentAmp * strand.ampScale * envelope;

          if (isFirst) {
            ctx.moveTo(x, y);
            isFirst = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (strand.dash) {
          ctx.setLineDash(strand.dash);
          ctx.lineDashOffset = -(phase * (strand.dashSpeed || 15));
        } else {
          ctx.setLineDash([]);
        }

        // Pass 1: Delicate Neon Glow Aura
        ctx.strokeStyle = strand.glow;
        ctx.lineWidth = strand.lineWidth * 2.0;
        ctx.stroke();

        // Pass 2: Crisp Delicate Core Strand
        ctx.strokeStyle = strand.color;
        ctx.lineWidth = strand.lineWidth;
        ctx.stroke();

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isOpen, isSpeaking, isListening]);

  if (!isOpen) return null;

  const handleSendTyped = (e) => {
    e?.preventDefault();
    const cmd = typedInput.trim();
    if (!cmd) return;
    setIsKeyboardOpen(false);
    voiceNavigationService.processVoiceCommand(cmd);
    setTypedInput('');
  };

  // 28 Equalizer Bars matching the screenshot
  const eqBars = Array.from({ length: 28 }, (_, i) => i);

  return createPortal(
    <div className="fullscreen-voice-hud-root">
      {/* Deep Space Radial Ambient Backdrop */}
      <div className="fs-ambient-backdrop">
        <div className="fs-radial-glow"></div>
        <div className="fs-dust-grid"></div>
      </div>

      {/* Top Cyber Telemetry Header */}
      <header className="fs-top-telemetry-bar">
        <div className="fs-system-badge">
          <span className="fs-badge-dot"></span>
          <span className="fs-badge-text">
            {documentContext ? 'SYS_08 • DOCUMENT AI VOICE IMMERSION' : 'SYS_01 • AURRA VOICE IMMERSION'}
          </span>
        </div>

        <div className="fs-top-controls">
          <button
            className={`fs-header-btn ${isAiMuted ? 'muted' : 'active'}`}
            onClick={onToggleAiMute}
            title={isAiMuted ? 'Speaker Muted — Tap to Unmute' : 'Speaker Active — Tap to Mute'}
          >
            {isAiMuted ? <VolumeX size={18} color="#ef4444" /> : <Volume2 size={18} color="#00ffff" />}
            <span>{isAiMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          <button
            className="fs-header-btn fs-minimize-btn"
            onClick={onClose}
            title="Exit Fullscreen Mode (ESC)"
          >
            <Minimize2 size={18} color="#00ffff" />
            <span>Minimize</span>
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="fs-center-stage">
        {/* Upper Zone: Concentric Glowing Mic Circles & Waving Laser Horizon */}
        <div className="fs-upper-stage">
          <div 
            className={`fs-mic-portal-container ${isSpeaking ? 'is-speaking' : isListening ? 'is-listening' : 'is-idle'}`}
            onClick={onToggleListening}
            title={isListening ? 'Listening Active — Tap to Pause' : 'Mic Paused — Tap to Speak'}
          >
            {/* Outer Cyan Dynamic Ring */}
            <div className="fs-concentric-ring ring-outer"></div>
            {/* Cyber Dotted Orbit Ring */}
            <div className="fs-concentric-ring ring-dotted"></div>
            {/* Middle Pure White Dynamic Ring */}
            <div className="fs-concentric-ring ring-middle"></div>
            {/* Dynamic Expanding Ripple Waves */}
            <div className="fs-concentric-ring ring-ripple-1"></div>
            <div className="fs-concentric-ring ring-ripple-2"></div>
            {/* Inner Glowing Gradient Core Orb */}
            <div className="fs-mic-core-orb">
              <div className="fs-core-glass-reflection"></div>
              <div className="fs-core-icon">
                {isListening ? (
                  <Mic size={60} color="#ffffff" strokeWidth={2.4} />
                ) : (
                  <MicOff size={60} color="#ef4444" strokeWidth={2.4} />
                )}
              </div>
              <div className="fs-core-pulse-aura"></div>
            </div>
          </div>

          {/* Continuous Undulating Waving Laser Horizon Line Canvas */}
          <div className="fs-wave-horizon-wrapper">
            <canvas ref={canvasRef} className="fs-wave-horizon-canvas"></canvas>
          </div>
        </div>

        {/* Below Horizon: Status Typography & Live Speech Transcript */}
        <div className="fs-status-content-area">
          {/* Only show status title when no conversation dialogue is active */}
          {(!latestReply && !transcript) && (
            <div className="fs-listening-title">
              {isThinking ? (
                <span className="fs-thinking-text">
                  <Sparkles size={18} className="fs-sparkle-spin" /> Thinking...
                </span>
              ) : isSpeaking ? (
                <span className="fs-speaking-text">Aurra Speaking...</span>
              ) : isListening ? (
                <span className="fs-listening-text">Listening...</span>
              ) : (
                <span className="fs-paused-text">Tap Mic to Speak</span>
              )}
            </div>
          )}

          {/* Conversation Dialogue Cards (Side-by-Side Dual Panels Matching Reference Screenshot) */}
          {(latestReply || transcript) && (
            <div className="fs-dual-dialog-container">
              {/* Left Panel: User Question + Embedded Cyber Waveform */}
              <div className="fs-dialog-panel fs-question-panel">
                <div className="fs-panel-query-text">
                  {latestReply?.query || transcript}
                </div>

                {/* Embedded Audio Waveform in Left Panel */}
                <div className={`fs-card-waveform ${isSpeaking ? 'is-speaking' : isListening ? 'is-listening' : 'is-idle'}`}>
                  {Array.from({ length: 32 }, (_, i) => {
                    const distFromCenter = Math.abs(i - 15.5) / 15.5;
                    const baseHeight = Math.max(3, Math.round((1 - distFromCenter * distFromCenter) * 22));
                    return (
                      <span
                        key={i}
                        className="fs-card-wave-bar"
                        style={{
                          '--bar-h': `${baseHeight}px`,
                          '--anim-delay': `${(i % 10) * 0.08}s`,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Edge Neon Accent */}
                <div className="fs-panel-edge-glow"></div>
              </div>

              {/* Right Panel: Aurra Answer with Cyber Corner Accent */}
              <div className="fs-dialog-panel fs-answer-panel">
                {/* Sleek Top-Right Cyber Corner Notch/Graphic */}
                <div className="fs-cyber-corner-accent">
                  <svg width="44" height="26" viewBox="0 0 44 26" fill="none">
                    <path d="M0 2 H34 L42 10 V26" stroke="#00E5FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="42" cy="18" r="1.5" fill="#00E5FF" />
                    <line x1="22" y1="2" x2="34" y2="2" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="fs-panel-answer-text">
                  {latestReply?.reply || (isThinking ? 'Aurra is processing your question...' : isSpeaking ? 'Aurra is speaking...' : 'Listening...')}
                </div>

                {/* Edge Neon Accent */}
                <div className="fs-panel-edge-glow"></div>
              </div>
            </div>
          )}

          {/* Frosted Glass Waveform Equalizer Pill (shown when dialogue is not active) */}
          {(!latestReply && !transcript) && (
            <div className="fs-waveform-glass-capsule">
              <div className={`fs-equalizer-bars ${isSpeaking ? 'active-speaking' : isListening ? 'active-listening' : 'idle-bars'}`}>
                {eqBars.map((i) => (
                  <span
                    key={i}
                    className="fs-eq-bar"
                    style={{
                      '--bar-index': i,
                      '--anim-delay': `${(i * 0.05).toFixed(2)}s`,
                    }}
                  ></span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Interactive Prompt Suggestions & Type Command in One Single Line */}
          <div className="fs-suggestions-row">
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('What is Aurra?')}
            >
              "What is Aurra?"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('What features do you have?')}
            >
              "What features do you have?"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('Visitor form')}
            >
              "Visitor form"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('Public facilities')}
            >
              "Public facilities"
            </button>
            <button
              className={`fs-suggest-pill fs-type-command-pill ${isKeyboardOpen ? 'active' : ''}`}
              onClick={() => setIsKeyboardOpen((prev) => !prev)}
              title="Type Command via On-Screen Keyboard"
            >
              <Keyboard size={15} />
              <span>Type Command</span>
            </button>
          </div>

          {/* Floating Keyboard Input Bar when Type Command is activated */}
          {isKeyboardOpen && (
            <form className="fs-keyboard-bar" onSubmit={handleSendTyped}>
              <input
                ref={inputRef}
                type="text"
                className="fs-keyboard-input"
                placeholder="Type a voice query or navigation command..."
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
              />
              <button type="submit" className="fs-keyboard-send-btn" disabled={!typedInput.trim()}>
                <Send size={18} />
              </button>
              <button
                type="button"
                className="fs-keyboard-close-btn"
                onClick={() => setIsKeyboardOpen(false)}
              >
                <X size={18} />
              </button>
            </form>
          )}
        </div>
      </main>
    </div>,
    document.body
  );
}
