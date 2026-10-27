import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
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
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isMorphingIn, setIsMorphingIn] = useState(false);
  const [isMorphingOut, setIsMorphingOut] = useState(false);
  const inputRef = useRef(null);

  // GSAP DOM refs for morph targets
  const rootRef = useRef(null);
  const backdropRef = useRef(null);
  const telemetryBarRef = useRef(null);
  const micPortalRef = useRef(null);
  const micCoreOrbRef = useRef(null);
  const micIconRef = useRef(null);
  const outerRingRef = useRef(null);
  const waveWrapperRef = useRef(null);
  const statusAreaRef = useRef(null);
  const morphTlRef = useRef(null);

  // Helper to accurately measure bottom Voice Assistant Bar and Left Mic Button geometry
  const getMetrics = () => {
    const voiceBarEl = document.querySelector('.voice-assistant-bar');
    const barRect = voiceBarEl ? voiceBarEl.getBoundingClientRect() : null;

    const barWidth = barRect && barRect.width > 0 ? Math.round(barRect.width) : Math.min(window.innerWidth * 0.96, 850);
    const barHeight = barRect && barRect.height > 0 ? Math.round(barRect.height) : 56;
    const barTargetCX = barRect && barRect.width > 0 ? Math.round(barRect.left + barRect.width / 2) : Math.round(window.innerWidth / 2);
    const barTargetCY = barRect && barRect.height > 0 ? Math.round(barRect.top + barRect.height / 2) : Math.round(window.innerHeight - 38);

    const micBtnEl = document.querySelector('.voice-mic-btn');
    const micRect = micBtnEl ? micBtnEl.getBoundingClientRect() : null;
    const barLeft = barTargetCX - barWidth / 2;
    const micTargetCX = micRect && micRect.width > 0 ? Math.round(micRect.left + micRect.width / 2) : Math.round(barLeft + 18 + 24);
    const micTargetCY = micRect && micRect.height > 0 ? Math.round(micRect.top + micRect.height / 2) : barTargetCY;
    const micTargetSize = micRect && micRect.width > 0 ? micRect.width : 48;

    const portalEl = micPortalRef.current;
    const portalRect = portalEl ? portalEl.getBoundingClientRect() : null;
    const portalStartCX = portalRect && portalRect.width > 0 ? portalRect.left + portalRect.width / 2 : window.innerWidth / 2;
    const portalStartCY = portalRect && portalRect.height > 0 ? portalRect.top + portalRect.height / 2 : window.innerHeight * 0.35;

    const outerRingEl = outerRingRef.current;
    const ringRect = outerRingEl ? outerRingEl.getBoundingClientRect() : null;
    const ringStartCX = ringRect && ringRect.width > 0 ? ringRect.left + ringRect.width / 2 : window.innerWidth / 2;
    const ringStartCY = ringRect && ringRect.height > 0 ? ringRect.top + ringRect.height / 2 : portalStartCY;

    const ringDeltaX = Math.round(barTargetCX - ringStartCX);
    const ringDeltaY = Math.round(barTargetCY - ringStartCY);

    const micDeltaX = Math.round(micTargetCX - portalStartCX);
    const micDeltaY = Math.round(micTargetCY - portalStartCY);

    const coreEl = micCoreOrbRef.current;
    const coreOrbSize = coreEl && coreEl.getBoundingClientRect().width > 0 ? coreEl.getBoundingClientRect().width : 132;
    const landScale = Math.max(0.25, Math.min(0.42, micTargetSize / coreOrbSize));

    return {
      barWidth,
      barHeight,
      ringDeltaX,
      ringDeltaY,
      micDeltaX,
      micDeltaY,
      landScale,
    };
  };

  // ── MORPH IN: Voice Bar (curved rectangle) &rarr; Fullscreen Portal (round circle) ──
  const runMorphInTimeline = (onDone) => {
    if (morphTlRef.current) morphTlRef.current.kill();
    const tl = gsap.timeline({ onComplete: () => onDone?.() });
    morphTlRef.current = tl;

    const portalEl = micPortalRef.current;
    const coreEl = micCoreOrbRef.current;
    const outerRingEl = outerRingRef.current;

    const {
      barWidth,
      barHeight,
      ringDeltaX,
      ringDeltaY,
      micDeltaX,
      micDeltaY,
      landScale,
    } = getMetrics();

    const peripherals = [backdropRef.current, telemetryBarRef.current, waveWrapperRef.current, statusAreaRef.current].filter(Boolean);
    gsap.set(peripherals, { opacity: 0 });

    const decorRings = portalEl ? portalEl.querySelectorAll('.ring-dotted, .ring-middle, .ring-ripple-1, .ring-ripple-2') : [];
    gsap.set(decorRings, { opacity: 0 });

    // Initial state: starts at bottom voice assistant bar capsule position
    if (outerRingEl) {
      outerRingEl.style.animation = 'none';
      outerRingEl.style.transition = 'none';
      gsap.set(outerRingEl, {
        xPercent: -50,
        yPercent: -50,
        x: ringDeltaX,
        y: ringDeltaY,
        width: barWidth,
        height: barHeight,
        borderRadius: '9999px',
        backgroundColor: '#090e17',
        borderColor: 'rgba(0, 255, 255, 0.45)',
        boxShadow: '0 0 24px rgba(0, 255, 255, 0.25), inset 0 0 10px rgba(0, 255, 255, 0.08)',
        opacity: 1,
        zIndex: 10,
      });
    }

    // Mic starts as the listening button at bottom-left inside that bar (UPPER LAYER)
    if (portalEl) {
      portalEl.style.transition = 'none';
      gsap.set(portalEl, {
        x: micDeltaX,
        y: micDeltaY,
        scale: landScale,
        opacity: 1,
        zIndex: 10000,
        position: 'relative',
      });
    }

    if (coreEl) {
      coreEl.style.transition = 'none';
      const gl = coreEl.querySelector('.fs-core-glass-reflection');
      const au = coreEl.querySelector('.fs-core-pulse-aura');
      if (gl) gsap.set(gl, { opacity: 0 });
      if (au) gsap.set(au, { opacity: 0 });

      gsap.set(coreEl, {
        borderRadius: '50%',
        backgroundColor: '#002b36',
        borderColor: '#00ffff',
        borderWidth: '2px',
        boxShadow: '0 0 16px rgba(0, 255, 255, 0.65)',
        zIndex: 10001,
        position: 'relative',
      });
    }

    if (rootRef.current) {
      gsap.set(rootRef.current, { backgroundColor: 'rgba(2, 8, 23, 0)' });
    }

    // Phase 1 (0.02–0.4s): Outer ring expands upwards rapidly from curved rectangle into round circle (9999px)
    if (outerRingEl) {
      tl.to(
        outerRingEl,
        {
          x: 0,
          y: 0,
          width: 220,
          height: 220,
          borderRadius: '9999px',
          backgroundColor: 'rgba(9, 14, 23, 0)',
          borderColor: 'rgba(0, 210, 255, 0.30)',
          boxShadow: '0 0 16px rgba(0, 210, 255, 0.16)',
          opacity: 0.48,
          duration: 0.38,
          ease: 'power3.inOut',
        },
        0.02
      );
    }

    // Phase 2 (0.02–0.4s): Mic Portal glides up to center, scaling from button size to full orb
    if (portalEl) {
      tl.to(
        portalEl,
        {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.38,
          ease: 'power3.inOut',
        },
        0.02
      );
    }

    // Phase 3 (0.02–0.4s): Core orb transmits into glowing cosmic gradient orb
    if (coreEl) {
      tl.to(
        coreEl,
        {
          borderRadius: '50%',
          backgroundColor: '#020817',
          borderColor: '#00CFEF',
          borderWidth: '3px',
          boxShadow: '0 0 32px rgba(0, 207, 239, 0.75), 0 0 65px rgba(0, 168, 255, 0.45), inset 0 0 25px rgba(0, 123, 168, 0.5)',
          duration: 0.38,
          ease: 'power3.inOut',
        },
        0.02
      );

      const gl = coreEl.querySelector('.fs-core-glass-reflection');
      const au = coreEl.querySelector('.fs-core-pulse-aura');
      if (gl) tl.to(gl, { opacity: 1, duration: 0.18, ease: 'power2.in' }, 0.2);
      if (au) tl.to(au, { opacity: 0.65, duration: 0.18, ease: 'power2.in' }, 0.2);
    }

    // Phase 4 (0–0.28s): Background fades to deep space `#020817`
    if (rootRef.current) {
      tl.to(
        rootRef.current,
        { backgroundColor: '#020817', duration: 0.28, ease: 'power2.inOut' },
        0
      );
    }

    // Phase 5 (0.18–0.38s): Peripherals & decorative concentric rings fade in briskly
    if (peripherals.length) {
      tl.to(
        peripherals,
        { opacity: 1, duration: 0.2, ease: 'power2.out' },
        0.18
      );
    }

    if (decorRings.length) {
      tl.to(
        decorRings,
        { opacity: 1, duration: 0.18, ease: 'power2.out' },
        0.2
      );
    }

    // Phase 6: Clean up temporary inline styles on finish
    tl.call(() => {
      if (outerRingEl) {
        outerRingEl.style.animation = '';
        outerRingEl.style.transition = '';
      }
      if (portalEl) {
        portalEl.style.transition = '';
      }
      if (coreEl) {
        coreEl.style.transition = '';
      }
    }, null, 0.4);

    return tl;
  };

  // ── MORPH OUT: Fullscreen Portal (round circle) &rarr; Voice Bar (curved rectangle) ──
  const runMorphOutTimeline = (onDone) => {
    if (morphTlRef.current) morphTlRef.current.kill();
    const tl = gsap.timeline({ onComplete: () => onDone?.() });
    morphTlRef.current = tl;

    const portalEl = micPortalRef.current;
    const coreEl = micCoreOrbRef.current;
    const iconEl = micIconRef.current;
    const outerRingEl = outerRingRef.current;

    const {
      barWidth,
      barHeight,
      ringDeltaX,
      ringDeltaY,
      micDeltaX,
      micDeltaY,
      landScale,
    } = getMetrics();

    // ─ Phase 1 (0–0.22s): Quick fade out of peripheral UI & decorative rings ─
    tl.to(
      [backdropRef.current, telemetryBarRef.current, waveWrapperRef.current, statusAreaRef.current].filter(Boolean),
      { opacity: 0, duration: 0.22, ease: 'power2.out' },
      0
    );

    const decorRings = portalEl ? portalEl.querySelectorAll('.ring-dotted, .ring-middle, .ring-ripple-1, .ring-ripple-2') : [];
    if (decorRings.length) {
      tl.to(decorRings, { opacity: 0, duration: 0.18, ease: 'power2.out' }, 0);
    }

    // ─ Phase 2 (0.05–0.75s): fs-mic-core-orb transmits into exact voice-mic-btn.listening appearance ─
    if (coreEl) {
      coreEl.style.transition = 'none';
      gsap.set(coreEl, { zIndex: 10001, position: 'relative' });

      const gl = coreEl.querySelector('.fs-core-glass-reflection');
      const au = coreEl.querySelector('.fs-core-pulse-aura');
      if (gl) tl.to(gl, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0.05);
      if (au) tl.to(au, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0.05);

      tl.to(
        coreEl,
        {
          borderRadius: '50%',
          backgroundColor: '#002b36',
          borderColor: '#00ffff',
          borderWidth: '2px',
          boxShadow: '0 0 16px rgba(0, 255, 255, 0.65)',
          duration: 0.75,
          ease: 'power3.inOut',
        },
        0.05
      );
    }

    if (iconEl) {
      tl.to(iconEl, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0.05);
    }

    // ─ Phase 3 (0.05–0.8s): Outer Ring converts into bottom Voice Assistant Bar Capsule (LOWER LAYER z-index: 10) ─
    // Direct width, height & borderRadius morph prevents ANY distortion of borders or pill corners!
    if (outerRingEl) {
      outerRingEl.style.animation = 'none';
      outerRingEl.style.transition = 'none';
      gsap.set(outerRingEl, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        width: 220,
        height: 220,
        borderRadius: '9999px',
        zIndex: 10,
      });

      tl.to(
        outerRingEl,
        {
          x: ringDeltaX,
          y: ringDeltaY,
          width: barWidth,
          height: barHeight,
          borderRadius: '9999px',
          backgroundColor: '#090e17',
          borderColor: 'rgba(0, 255, 255, 0.45)',
          boxShadow: '0 0 24px rgba(0, 255, 255, 0.25), inset 0 0 10px rgba(0, 255, 255, 0.08)',
          opacity: 1,
          duration: 0.75,
          ease: 'power3.inOut',
        },
        0.05
      );
    }

    // ─ Phase 4 (0.05–0.8s): Mic Portal flies into left mic button slot ON STRICT UPPER LAYER (z-index: 10000) ─
    if (portalEl) {
      portalEl.style.transition = 'none';
      gsap.set(portalEl, { zIndex: 10000, position: 'relative' });

      tl.to(
        portalEl,
        {
          x: micDeltaX,
          y: micDeltaY,
          scale: landScale,
          duration: 0.75,
          ease: 'power3.inOut',
        },
        0.05
      );
    }

    // ─ Phase 5 (0.74s): Dock trigger for voice assistant bar ripple ─
    tl.call(() => {
      window.dispatchEvent(new CustomEvent('aurra_voice_bar_dock'));
    }, null, 0.74);

    // Fade morph proxies seamlessly as the real bar catches
    if (outerRingEl) {
      tl.to(outerRingEl, { opacity: 0, duration: 0.12, ease: 'power2.in' }, 0.76);
    }
    if (portalEl) {
      tl.to(portalEl, { opacity: 0, duration: 0.12, ease: 'power2.in' }, 0.76);
    }

    // ─ Phase 6 (0.45–0.8s): Background fades to transparent ─
    tl.to(
      rootRef.current,
      { backgroundColor: 'rgba(2,8,23,0)', duration: 0.45, ease: 'power1.in' },
      0.45
    );

    return tl;
  };

  // Synchronize rendered state with isOpen prop and trigger two-way morphing
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsMorphingOut(false);
      setIsMorphingIn(true);
      if (!isListening && !isSpeaking && !isThinking) {
        voiceNavigationService.startListening(true);
      }
    } else if (isRendered && !isMorphingOut) {
      setIsMorphingOut(true);
      window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
      runMorphOutTimeline(() => {
        setIsRendered(false);
        setIsMorphingOut(false);
      });
    }
  }, [isOpen]);

  // Synchronously initialize morph-in proxy positions before browser paints Frame 1
  useLayoutEffect(() => {
    if (isRendered && isMorphingIn) {
      runMorphInTimeline(() => {
        setIsMorphingIn(false);
      });
    }
  }, [isRendered, isMorphingIn]);

  // Smooth close morph trigger for user-initiated actions (Minimize / Features / ESC)
  const triggerCloseWithMorph = () => {
    if (isMorphingOut) return;
    setIsMorphingOut(true);
    window.dispatchEvent(new CustomEvent('aurra_show_cards'));
    window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
    runMorphOutTimeline(() => {
      setIsRendered(false);
      setIsMorphingOut(false);
      onClose?.();
    });
  };

  // Focus input when keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isKeyboardOpen]);

  // Handle ESC key to close fullscreen with morph
  useEffect(() => {
    if (!isOpen && !isRendered) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isKeyboardOpen) {
          setIsKeyboardOpen(false);
        } else {
          triggerCloseWithMorph();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRendered, isKeyboardOpen, triggerCloseWithMorph]);

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
  }, [isOpen, isRendered, isSpeaking, isListening]);

  if (!isRendered) return null;

  const handleSendTyped = (e) => {
    e?.preventDefault();
    const cmd = typedInput.trim();
    if (!cmd) return;
    setIsKeyboardOpen(false);
    voiceNavigationService.processVoiceCommand(cmd, { inputType: 'text' });
    setTypedInput('');
  };

  // 28 Equalizer Bars matching the screenshot
  const eqBars = Array.from({ length: 28 }, (_, i) => i);

  return createPortal(
    <div ref={rootRef} className={`fullscreen-voice-hud-root ${isMorphingIn ? 'morphing-in' : ''} ${isMorphingOut ? 'morphing-out' : ''}`}>
      {/* Deep Space Radial Ambient Backdrop */}
      <div ref={backdropRef} className="fs-ambient-backdrop">
        <div className="fs-radial-glow"></div>
        <div className="fs-dust-grid"></div>
      </div>

      {/* Top Cyber Telemetry Header */}
      <header ref={telemetryBarRef} className="fs-top-telemetry-bar">
        <div className="fs-system-badge">
          <span className="fs-badge-dot"></span>
          <span className="fs-badge-text">
            {documentContext ? 'DOCUMENT AI VOICE IMMERSION' : 'AURRA VOICE IMMERSION'}
          </span>
        </div>

        <div className="fs-top-controls">
          <button
            className="fs-header-btn fs-features-btn"
            onClick={triggerCloseWithMorph}
            title="View Features & Action Cards"
          >
            <Sparkles size={16} color="#00ffff" />
            <span>Features</span>
          </button>

          <button
            className={`fs-header-btn ${isAiMuted ? 'muted' : 'active'}`}
            onClick={onToggleAiMute}
            title={isAiMuted ? 'Speaker Muted — Tap to Unmute' : 'Speaker Active — Tap to Mute'}
          >
            {isAiMuted ? <VolumeX size={18} color="#ef4444" /> : <Volume2 size={18} color="#00ffff" />}
            <span>{isAiMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          <button
            className="fs-close-btn"
            onClick={triggerCloseWithMorph}
            title="Close Fullscreen (ESC)"
          >
            <X size={20} color="#ff3b5c" />
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="fs-center-stage">
        {/* Upper Zone: Concentric Glowing Mic Circles & Waving Laser Horizon */}
        <div className="fs-upper-stage">
          <div className="fs-portal-wrapper">
            {/* Outer Cyan Dynamic Ring (Morphs directly into the bottom voice assistant bar pill) */}
            <div ref={outerRingRef} className="fs-concentric-ring ring-outer"></div>

            <div 
              ref={micPortalRef}
              className={`fs-mic-portal-container ${isSpeaking ? 'is-speaking' : isListening ? 'is-listening' : 'is-idle'}`}
              onClick={onToggleListening}
              title={isListening ? 'Listening Active — Tap to Pause' : 'Mic Paused — Tap to Speak'}
            >
              {/* Cyber Dotted Orbit Ring */}
              <div className="fs-concentric-ring ring-dotted"></div>
              {/* Middle Pure White Dynamic Ring */}
              <div className="fs-concentric-ring ring-middle"></div>
              {/* Dynamic Expanding Ripple Waves */}
              <div className="fs-concentric-ring ring-ripple-1"></div>
              <div className="fs-concentric-ring ring-ripple-2"></div>
              {/* Inner Glowing Gradient Core Orb */}
              <div ref={micCoreOrbRef} className="fs-mic-core-orb">
                <div className="fs-core-glass-reflection"></div>
                <div ref={micIconRef} className="fs-core-icon">
                  {isListening ? (
                    <Mic size={60} color="#ffffff" strokeWidth={2.4} />
                  ) : (
                    <MicOff size={60} color="#ef4444" strokeWidth={2.4} />
                  )}
                </div>
                <div className="fs-core-pulse-aura"></div>
              </div>
            </div>
          </div>

          {/* Continuous Undulating Waving Laser Horizon Line Canvas */}
          <div ref={waveWrapperRef} className="fs-wave-horizon-wrapper">
            <canvas ref={canvasRef} className="fs-wave-horizon-canvas"></canvas>
          </div>
        </div>

        {/* Below Horizon: Status Typography & Live Speech Transcript */}
        <div ref={statusAreaRef} className="fs-status-content-area">
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
                  {latestReply?.reply || (isThinking ? 'Aurra is processing your question...' : isSpeaking ? 'Aurra is speaking...' : transcript ? 'Aurra is thinking...' : 'Listening...')}
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
              onClick={() => voiceNavigationService.processVoiceCommand('What is Aurra?', { inputType: 'touch' })}
            >
              "What is Aurra?"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('What features do you have?', { inputType: 'touch' })}
            >
              "What features do you have?"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('Visitor form', { inputType: 'touch' })}
            >
              "Visitor form"
            </button>
            <button
              className="fs-suggest-pill"
              onClick={() => voiceNavigationService.processVoiceCommand('Public facilities', { inputType: 'touch' })}
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
