import React, { useEffect, useRef } from 'react';
import './InteractionAvatar.css';

export default function InteractionAvatar({ status = 'IDLE', isMuted = false, detectedPerson = null }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const blinkStateRef = useRef({ isBlinking: false, nextBlink: Date.now() + 3000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement?.clientWidth || 280);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 280);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth || 280;
        height = canvas.height = canvas.parentElement.clientHeight || 280;
      }
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      phaseRef.current += 0.05;
      const phase = phaseRef.current;
      const now = Date.now();

      // Handle random eye blinking
      if (now > blinkStateRef.current.nextBlink) {
        blinkStateRef.current.isBlinking = true;
        setTimeout(() => {
          blinkStateRef.current.isBlinking = false;
          blinkStateRef.current.nextBlink = Date.now() + 2500 + Math.random() * 3000;
        }, 180);
      }

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Color Theme according to Status
      let primaryColor = '#00ffff'; // Cyan IDLE
      let secondaryColor = '#0284c7';

      if (isMuted) {
        primaryColor = '#64748b';
        secondaryColor = '#334155';
      } else if (status === 'LISTENING') {
        primaryColor = '#10b981';
        secondaryColor = '#059669';
      } else if (status === 'THINKING') {
        primaryColor = '#c084fc';
        secondaryColor = '#7e22ce';
      } else if (status === 'SPEAKING') {
        primaryColor = '#f43f5e';
        secondaryColor = '#be123c';
      }

      // 1. Render Outer 36-Bar Audio Spectrum Ring
      const bars = 36;
      const radius = Math.min(width, height) * 0.36;
      ctx.lineWidth = 3;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        let amp = 0.15;

        if (status === 'LISTENING') {
          amp = 0.2 + Math.sin(phase * 2 + i * 0.5) * 0.25 + Math.cos(phase * 3 + i) * 0.15;
        } else if (status === 'SPEAKING') {
          amp = 0.3 + Math.sin(phase * 4 + i * 0.8) * 0.35 + Math.random() * 0.2;
        } else if (status === 'THINKING') {
          amp = 0.2 + Math.sin(phase * 6 + i) * 0.2;
        } else {
          amp = 0.1 + Math.sin(phase * 1.2 + i * 0.3) * 0.08;
        }

        const barLen = 10 + amp * 30;
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

      // 2. Render Rotating Inner Energy Rings
      ctx.save();
      ctx.translate(cx, cy);

      // Ring 1 - CW
      ctx.rotate(phase * 0.3);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
      ctx.stroke();

      // Ring 2 - CCW
      ctx.rotate(-phase * 0.6);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Central Core Glowing Sphere
      const pulseRadius = radius - 32 + Math.sin(phase * 2) * (status === 'SPEAKING' ? 6 : 2);
      const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, pulseRadius);
      grad.addColorStop(0, primaryColor);
      grad.addColorStop(0.65, secondaryColor);
      grad.addColorStop(1, 'rgba(3, 17, 39, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

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
