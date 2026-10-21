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

      // Smooth amplitude transition
      let target = isSpeaking ? 42 : isListening ? 28 : 14;
      currentAmp += (target - currentAmp) * 0.08;

      // 2x Faster Wave Animation Speed as requested
      phaseRef.current += isSpeaking ? 0.12 : isListening ? 0.08 : 0.05;
      const phase = phaseRef.current;

      // Center bell curve width (spread of the waving ribbons)
      const sigma = Math.min(width * 0.28, 360);

      // Ribbon Strands Definition
      const strands = [
        {
          color: '#00f0ff',
          glow: 'rgba(0, 240, 255, 0.85)',
          blur: 14,
          lineWidth: 2.8,
          freq: 0.016,
          ampScale: 1.0,
          phaseOffset: 0,
        },
        {
          color: '#d946ef',
          glow: 'rgba(217, 70, 239, 0.85)',
          blur: 16,
          lineWidth: 2.6,
          freq: 0.019,
          ampScale: 0.88,
          phaseOffset: 1.8,
        },
        {
          color: '#a855f7',
          glow: 'rgba(168, 85, 247, 0.85)',
          blur: 18,
          lineWidth: 2.4,
          freq: 0.013,
          ampScale: 1.15,
          phaseOffset: 3.4,
        },
        {
          color: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.9)',
          blur: 12,
          lineWidth: 1.8,
          freq: 0.022,
          ampScale: 0.72,
          phaseOffset: 4.9,
        },
      ];

      // Draw horizontal baseline glow across entire width
      ctx.save();
      const baseGrad = ctx.createLinearGradient(0, centerY, width, centerY);
      baseGrad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
      baseGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.8)');
      baseGrad.addColorStop(0.5, 'rgba(217, 70, 239, 0.9)');
      baseGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.8)');
      baseGrad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = baseGrad;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Draw the undulating ribbon strands
      for (let s = 0; s < strands.length; s++) {
        const strand = strands[s];
        ctx.save();
        ctx.beginPath();

        const step = 4; // Sample every 4px for smooth curves
        let isFirst = true;

        for (let x = 0; x <= width; x += step) {
          // Gaussian envelope to smoothly taper wave to zero at edges
          const dx = x - centerX;
          const envelope = Math.exp(-((dx * dx) / (2 * sigma * sigma)));

          // Multi-frequency undulating wave
          const wave =
            Math.sin(x * strand.freq + phase + strand.phaseOffset) * 0.75 +
            Math.sin(x * (strand.freq * 1.65) - phase * 0.8 + strand.phaseOffset) * 0.25;

          const y = centerY + wave * currentAmp * strand.ampScale * envelope;

          if (isFirst) {
            ctx.moveTo(x, y);
            isFirst = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = strand.color;
        ctx.lineWidth = strand.lineWidth;
        ctx.shadowColor = strand.glow;
        ctx.shadowBlur = strand.blur;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
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
            {/* Outer Cyan Ring */}
            <div className="fs-concentric-ring ring-outer"></div>
            {/* Middle Violet/Magenta Ring */}
            <div className="fs-concentric-ring ring-middle"></div>
            {/* Inner Glowing Gradient Core Orb */}
            <div className="fs-mic-core-orb">
              <div className="fs-core-glass-reflection"></div>
              <div className="fs-core-icon">
                {isListening ? (
                  <Mic size={44} color="#ffffff" />
                ) : (
                  <MicOff size={44} color="#ef4444" />
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

          {/* Live Transcript / Response Feedback Bubble */}
          {(latestReply || transcript) && (
            <div className="fs-transcript-capsule">
              {latestReply ? (
                <div className="fs-reply-block">
                  {latestReply.query && (
                    <div className="fs-user-query-line">
                      <span className="fs-query-tag">You:</span> "{latestReply.query}"
                    </div>
                  )}
                  <div className="fs-aurra-reply-line">
                    <span className="fs-reply-tag">Aurra:</span> {latestReply.reply}
                  </div>
                </div>
              ) : (
                <div className="fs-heard-line">
                  <span className="fs-heard-quote">"{transcript}"</span>
                </div>
              )}
            </div>
          )}

          {/* Frosted Glass Waveform Equalizer Pill (from Screenshot) */}
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
              onClick={() => voiceNavigationService.processVoiceCommand('Show me around')}
            >
              "Show me around"
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
