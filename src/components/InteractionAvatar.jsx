import React, { useEffect, useRef } from 'react';
import './InteractionAvatar.css';

export default function InteractionAvatar({ status = 'IDLE', isMuted = false, detectedPerson = null }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const blinkStateRef = useRef({
    isBlinking: false,
    blinkProgress: 0,
    nextBlink: Date.now() + 2500,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 320);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth || 320;
        height = canvas.height = canvas.parentElement.clientHeight || 320;
      }
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      phaseRef.current += 0.04;
      const phase = phaseRef.current;
      const now = Date.now();

      // Handle natural eye blinking interpolation (smooth closure & opening)
      const blink = blinkStateRef.current;
      if (now > blink.nextBlink && !blink.isBlinking) {
        blink.isBlinking = true;
        blink.blinkProgress = 0;
      }

      if (blink.isBlinking) {
        blink.blinkProgress += 0.15;
        if (blink.blinkProgress >= 1) {
          blink.isBlinking = false;
          blink.blinkProgress = 0;
          blink.nextBlink = now + 2500 + Math.random() * 3500;
        }
      }

      // Blink scale: 1 when open, drops to 0.08 when shut
      const eyeOpenRatio = isMuted
        ? 0.12
        : blink.isBlinking
        ? Math.max(0.08, 1 - Math.sin(blink.blinkProgress * Math.PI))
        : 1;

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Color Palette according to Status
      let primaryColor = '#00ffff'; // Cyan IDLE
      let secondaryColor = '#0284c7';
      let glowColor = 'rgba(0, 255, 255, 0.45)';

      if (isMuted) {
        primaryColor = '#64748b';
        secondaryColor = '#334155';
        glowColor = 'rgba(100, 116, 139, 0.25)';
      } else if (status === 'LISTENING') {
        primaryColor = '#10b981'; // Emerald
        secondaryColor = '#059669';
        glowColor = 'rgba(16, 185, 129, 0.6)';
      } else if (status === 'THINKING') {
        primaryColor = '#c084fc'; // Purple
        secondaryColor = '#7e22ce';
        glowColor = 'rgba(192, 132, 252, 0.6)';
      } else if (status === 'SPEAKING') {
        primaryColor = '#f43f5e'; // Rose / Neon Coral
        secondaryColor = '#be123c';
        glowColor = 'rgba(244, 63, 94, 0.6)';
      }

      const radius = Math.min(width, height) * 0.42;

      // ── 1. Outer 48-Bar Audio Spectrum Reactive Halo ──
      const bars = 48;
      ctx.lineWidth = 2.5;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        let amp = 0.1;

        if (status === 'LISTENING') {
          amp = 0.22 + Math.sin(phase * 3 + i * 0.4) * 0.25 + Math.cos(phase * 4 + i) * 0.15;
        } else if (status === 'SPEAKING') {
          amp = 0.28 + Math.sin(phase * 5 + i * 0.7) * 0.35 + Math.random() * 0.2;
        } else if (status === 'THINKING') {
          amp = 0.18 + Math.sin(phase * 7 + i * 0.3) * 0.18;
        } else if (!isMuted) {
          amp = 0.08 + Math.sin(phase * 1.5 + i * 0.25) * 0.06;
        }

        const barLen = 6 + amp * 32;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + barLen);
        const y2 = cy + Math.sin(angle) * (radius + barLen);

        ctx.strokeStyle = primaryColor;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // ── 2. Rotating Inner Orbital Telemetry Rings ──
      ctx.save();
      ctx.translate(cx, cy);

      // Ring 1 (Clockwise)
      ctx.rotate(phase * 0.25);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([14, 20]);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
      ctx.stroke();

      // Ring 2 (Counter-Clockwise)
      ctx.rotate(-phase * 0.5);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ── 3. Central Ambient Cyber Head Halo Background ──
      const headRadius = radius - 36;
      const headGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, headRadius);
      headGrad.addColorStop(0, glowColor);
      headGrad.addColorStop(0.7, 'rgba(3, 17, 39, 0.85)');
      headGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');

      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, headRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // ── 4. Expressive Cyber Humanoid Eyes ──
      const eyeSpacing = 42;
      const eyeWidth = 26;
      const baseEyeHeight = 16;
      const eyeY = cy - 10 + (status === 'THINKING' ? Math.sin(phase * 2) * 2 : 0);

      const renderCyberEye = (eyeX, isLeft) => {
        ctx.save();
        ctx.translate(eyeX, eyeY);

        // Subtle tilt depending on emotion
        if (status === 'SPEAKING') {
          ctx.rotate(isLeft ? 0.08 : -0.08); // Friendly smiling tilt
        } else if (status === 'THINKING') {
          ctx.rotate(isLeft ? -0.1 : 0.1); // Analyzing squint
        }

        const curH = baseEyeHeight * eyeOpenRatio;

        // Eye Outer Sclera Glow
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = isMuted ? 4 : 14;

        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        // Cyber eye capsule
        ctx.ellipse(0, 0, eyeWidth / 2, Math.max(1.5, curH / 2), 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner Pupil & Reticle (Visible when eye is reasonably open)
        if (eyeOpenRatio > 0.4) {
          // Pupil center with slight gaze tracking
          const gazeX = Math.sin(phase * 0.8) * 3;
          const gazeY = Math.cos(phase * 0.6) * 1.5;

          ctx.fillStyle = '#031127';
          ctx.beginPath();
          ctx.ellipse(gazeX, gazeY, 6, 6 * eyeOpenRatio, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tiny inner pupil sparkle
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gazeX - 2, gazeY - 2 * eyeOpenRatio, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Brow Accents
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const browY = -baseEyeHeight * 0.75;
        if (status === 'SPEAKING') {
          // Arched happy brow
          ctx.moveTo(-eyeWidth / 2, browY + 2);
          ctx.quadraticCurveTo(0, browY - 4, eyeWidth / 2, browY + 2);
        } else if (status === 'THINKING') {
          // Furrowed brow
          ctx.moveTo(-eyeWidth / 2, isLeft ? browY - 3 : browY + 1);
          ctx.lineTo(eyeWidth / 2, isLeft ? browY + 1 : browY - 3);
        } else {
          // Neutral relaxed brow
          ctx.moveTo(-eyeWidth / 2, browY);
          ctx.lineTo(eyeWidth / 2, browY);
        }
        ctx.stroke();

        ctx.restore();
      };

      // Draw Left & Right Eyes
      renderCyberEye(cx - eyeSpacing, true);
      renderCyberEye(cx + eyeSpacing, false);

      // ── 5. Reactive Cyber Mouth / Voice Wave ──
      const mouthY = cy + 32;
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = status === 'SPEAKING' ? 12 : 4;
      ctx.lineWidth = 2.5;

      if (status === 'SPEAKING') {
        // Dynamic speaking waveform mouth
        ctx.beginPath();
        const mouthWidth = 46;
        const waveCount = 5;
        ctx.moveTo(cx - mouthWidth / 2, mouthY);
        for (let i = 0; i <= waveCount; i++) {
          const wx = cx - mouthWidth / 2 + (i / waveCount) * mouthWidth;
          const wy = mouthY + Math.sin(phase * 8 + i * 1.6) * (6 + Math.random() * 4);
          ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      } else if (status === 'LISTENING') {
        // Gentle smiling open curve
        ctx.beginPath();
        ctx.arc(cx, mouthY - 4, 18, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      } else if (status === 'THINKING') {
        // Small focused dot matrix
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.arc(cx + i * 10, mouthY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Gentle resting smile line
        ctx.beginPath();
        ctx.moveTo(cx - 16, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 5, cx + 16, mouthY);
        ctx.stroke();
      }
      ctx.restore();

      // ── 6. VIP Recognition Status Aura ──
      if (detectedPerson && detectedPerson !== 'GUEST') {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, headRadius + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`VIP TARGET: ${detectedPerson.toUpperCase()}`, cx, cy + headRadius + 22);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status, isMuted, detectedPerson]);

  return (
    <div className="interaction-avatar-wrapper">
      <canvas ref={canvasRef} className="interaction-avatar-canvas" />
    </div>
  );
}
