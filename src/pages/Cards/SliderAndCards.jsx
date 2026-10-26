import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { 
  Shield, 
  Terminal, 
  Camera, 
  Layers, 
  Tv, 
  Sparkles, 
  Mic, 
  MicOff, 
  RefreshCw,
  Compass,
  FileText,
  HelpCircle,
  Building2,
  Sliders,
  Eye,
  Globe,
  Activity,
  CheckCircle2,
  ChevronRight,
  Wifi,
  FlaskConical,
  Play,
  Clock,
  Bot,
  Database,
  Volume2,
  Pause
} from 'lucide-react';
import { offlineCardService, offlineSliderService, offlineBrandingService } from '../../db/offlineServices';
import { logger } from '../../services/logger';
import { devSettingsService } from '../../services/devSettingsService';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import AdminAuthModal from '../../components/AdminAuthModal';
import { LogViewerModal } from '../../components/LogViewerModal';
import { esp32Service } from '../../services/esp32Service';
import './SliderAndCards.css';

// Feature Icon Resolver with Dynamic Bubble Sizing
const getCardIcon = (href, className, size = 26) => {
  if (href?.includes('form')) return <FileText size={size} color="#00ffff" />;
  if (href?.includes('qa')) return <HelpCircle size={size} color="#00ffff" />;
  if (href?.includes('tour')) return <Compass size={size} color="#00ffff" />;
  if (href?.includes('facilities')) return <Building2 size={size} color="#00ffff" />;
  if (href?.includes('face') || href?.includes('greet')) return <Camera size={size} color="#00ffff" />;
  if (href?.includes('control')) return <Sliders size={size} color="#00ffff" />;
  if (href?.includes('testing-interaction')) return <FlaskConical size={size} color="#f59e0b" />;
  if (href?.includes('interaction')) return <Eye size={size} color="#00ffff" />;
  if (href?.includes('web')) return <Globe size={size} color="#00ffff" />;
  if (href?.includes('hardware')) return <Activity size={size} color="#00ffff" />;
  if (href?.includes('pdf')) return <FileText size={size} color="#ff3366" />;
  return <Sparkles size={size} color="#00ffff" />;
};

// Organic Clustered Bubble Slots (Referenced directly from Design Spec: tightly nestled, even spacing, varying radii)
const CLUSTER_CONFIGS = {
  // If 5 cards:
  5: [
    { x: 0, y: -138, size: 116, iconSize: 25, fontSize: 10.5, labelMax: 90 }, // Top
    { x: 132, y: -43, size: 126, iconSize: 28, fontSize: 11.5, labelMax: 96 }, // Top-Right
    { x: 82, y: 114, size: 114, iconSize: 24, fontSize: 10.5, labelMax: 88 }, // Bottom-Right
    { x: -82, y: 114, size: 106, iconSize: 22, fontSize: 10, labelMax: 84 }, // Bottom-Left
    { x: -132, y: -43, size: 122, iconSize: 26, fontSize: 11, labelMax: 92 }, // Top-Left
  ],
  // If 6 cards:
  6: [
    { x: 0, y: -136, size: 118, iconSize: 26, fontSize: 11, labelMax: 92 }, // Top
    { x: 126, y: -72, size: 128, iconSize: 28, fontSize: 11.5, labelMax: 98 }, // Top-Right
    { x: 124, y: 72, size: 116, iconSize: 26, fontSize: 11, labelMax: 90 }, // Bottom-Right
    { x: 0, y: 134, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 }, // Bottom
    { x: -120, y: 68, size: 110, iconSize: 24, fontSize: 10.5, labelMax: 86 }, // Bottom-Left
    { x: -124, y: -72, size: 122, iconSize: 26, fontSize: 11, labelMax: 94 }, // Top-Left
  ],
  // If 7 cards:
  7: [
    { x: 0, y: -136, size: 116, iconSize: 26, fontSize: 11, labelMax: 92 }, // Top
    { x: 114, y: -90, size: 124, iconSize: 28, fontSize: 11.5, labelMax: 98 }, // Top-Right
    { x: 142, y: 32, size: 114, iconSize: 24, fontSize: 10.5, labelMax: 88 }, // Right
    { x: 62, y: 130, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 }, // Bottom-Right
    { x: -62, y: 130, size: 100, iconSize: 22, fontSize: 10, labelMax: 82 }, // Bottom-Left
    { x: -140, y: 32, size: 118, iconSize: 26, fontSize: 11, labelMax: 90 }, // Left-Bottom
    { x: -114, y: -90, size: 112, iconSize: 24, fontSize: 10.5, labelMax: 86 }, // Left-Top
  ],
  // If 8 cards:
  8: [
    { x: 0, y: -140, size: 106, iconSize: 24, fontSize: 10.5, labelMax: 86 },
    { x: 112, y: -96, size: 108, iconSize: 24, fontSize: 10.5, labelMax: 88 },
    { x: 154, y: 18, size: 106, iconSize: 24, fontSize: 10.5, labelMax: 86 },
    { x: 92, y: 126, size: 102, iconSize: 22, fontSize: 10, labelMax: 84 },
    { x: -44, y: 148, size: 100, iconSize: 22, fontSize: 10, labelMax: 82 },
    { x: -142, y: 78, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 },
    { x: -158, y: -42, size: 106, iconSize: 24, fontSize: 10.5, labelMax: 86 },
    { x: -82, y: -130, size: 102, iconSize: 22, fontSize: 10, labelMax: 84 },
  ],
  // If 9 or 10 cards: Curated 2-tier alternating inner/outer planetary constellation
  10: [
    { x: 0, y: -140, size: 102, iconSize: 24, fontSize: 10, labelMax: 80 },     // 0: Top (Inner)
    { x: 122, y: -164, size: 96, iconSize: 22, fontSize: 9.5, labelMax: 76 },  // 1: Top-Right (Outer)
    { x: 142, y: -42, size: 102, iconSize: 24, fontSize: 10, labelMax: 80 },   // 2: Right-Top (Inner)
    { x: 196, y: 64, size: 96, iconSize: 22, fontSize: 9.5, labelMax: 76 },    // 3: Right-Bottom (Outer)
    { x: 82, y: 118, size: 102, iconSize: 24, fontSize: 10, labelMax: 80 },    // 4: Bottom-Right (Inner)
    { x: 0, y: 212, size: 96, iconSize: 22, fontSize: 9.5, labelMax: 76 },      // 5: Bottom (Outer)
    { x: -82, y: 118, size: 102, iconSize: 24, fontSize: 10, labelMax: 80 },   // 6: Bottom-Left (Inner)
    { x: -196, y: 64, size: 96, iconSize: 22, fontSize: 9.5, labelMax: 76 },   // 7: Left-Bottom (Outer)
    { x: -142, y: -42, size: 102, iconSize: 24, fontSize: 10, labelMax: 80 },  // 8: Left-Top (Inner)
    { x: -122, y: -164, size: 96, iconSize: 22, fontSize: 9.5, labelMax: 76 }, // 9: Top-Left (Outer)
  ],
};

const getBubbleSlot = (idx, total) => {
  // If exact configuration exists, use curated slot
  if (CLUSTER_CONFIGS[total] && CLUSTER_CONFIGS[total][idx]) {
    return CLUSTER_CONFIGS[total][idx];
  }

  // If <= 7 cards and no exact config, calculate single-tier circle
  if (total <= 7) {
    const angleDeg = (idx / total) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const r = 142;
    return {
      x: Math.round(r * Math.cos(angleRad)),
      y: Math.round(r * Math.sin(angleRad)),
      size: 112,
      iconSize: 24,
      fontSize: 10.5,
      labelMax: 88,
    };
  }

  // For 8+ cards: Dynamic 2-tier alternating concentric orbits (Inner Track & Outer Track)
  // This guarantees ZERO overlapping bubbles regardless of how many action cards exist!
  const isInner = idx % 2 === 0;
  const r = isInner ? 138 : 208;
  const size = isInner ? 102 : 96;
  const iconSize = isInner ? 24 : 22;
  const fontSize = isInner ? 10 : 9.5;
  const labelMax = isInner ? 80 : 76;
  const angleDeg = (idx / total) * 360 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: Math.round(r * Math.cos(angleRad)),
    y: Math.round(r * Math.sin(angleRad)),
    size,
    iconSize,
    fontSize,
    labelMax,
  };
};

// Orbital Sphere Aesthetic Theme Resolver
const getOrbTheme = (href, idx, card) => {
  if (href?.includes('face') || href?.includes('greet')) {
    return { sysId: 'SYS_02', color: '#00A8FF', bg: 'rgba(0, 168, 255, 0.16)', border: '#00E5FF', glow: 'rgba(0, 168, 255, 0.55)', label: card?.title || 'Face Recognition' };
  }
  if (href?.includes('tour')) {
    return { sysId: 'SYS_03', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.16)', border: '#22d3ee', glow: 'rgba(6, 182, 212, 0.55)', label: card?.title || 'Guided Tour' };
  }
  if (href?.includes('facilities')) {
    return { sysId: 'SYS_04', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)', border: '#34d399', glow: 'rgba(16, 185, 129, 0.55)', label: card?.title || 'Facilities' };
  }
  if (href?.includes('form') || href?.includes('register')) {
    return { sysId: 'SYS_05', color: '#00d2ff', bg: 'rgba(0, 210, 255, 0.16)', border: '#38bdf8', glow: 'rgba(0, 210, 255, 0.55)', label: card?.title || 'Visitor Form' };
  }
  if (href?.includes('web') || href?.includes('qr')) {
    return { sysId: 'SYS_06', color: '#00CFEF', bg: 'rgba(0, 207, 239, 0.16)', border: '#00E5FF', glow: 'rgba(0, 207, 239, 0.55)', label: card?.title || 'QR Links' };
  }
  if (href?.includes('control') || href?.includes('ros')) {
    return { sysId: 'SYS_07', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)', border: '#fbbf24', glow: 'rgba(245, 158, 11, 0.55)', label: card?.title || 'ROS Controls' };
  }
  if (href?.includes('pdf') || href?.includes('document')) {
    return { sysId: 'SYS_08', color: '#ff3366', bg: 'rgba(255, 51, 102, 0.16)', border: '#fb7185', glow: 'rgba(255, 51, 102, 0.55)', label: card?.title || 'PDF AI' };
  }
  if (href?.includes('qa') || href?.includes('question')) {
    return { sysId: 'SYS_02', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)', border: '#67e8f9', glow: 'rgba(56, 189, 248, 0.55)', label: card?.title || 'Ask Aurra' };
  }
  return { sysId: `SYS_0${idx + 2}`, color: '#00ffff', bg: 'rgba(0, 255, 255, 0.16)', border: '#22d3ee', glow: 'rgba(0, 255, 255, 0.55)', label: card?.title || 'Module' };
};

// Rich Storyboard Feature Explanations & Speech Scripts
const FEATURE_EXPLANATIONS = {
  form: {
    title: 'Touchless Visitor Registration',
    badge: 'SYS_05',
    color: '#00d2ff',
    speech: 'Welcome to Visitor Registration. Guests can check in touchlessly, submit their visit details, and receive instant digital verification.',
    bullets: ['Touchless QR & On-screen Form', 'Instant Local Storage', 'Admin Verified Check-in'],
  },
  qa: {
    title: 'Ask Aurra AI Intelligence',
    badge: 'SYS_02',
    color: '#38bdf8',
    speech: 'I am Ask Aurra, your interactive voice intelligence. Speak naturally to ask any question about the facility, team, or schedule.',
    bullets: ['Edge AI Voice Recognition', 'Instant Institutional Knowledge', 'Multi-turn Intelligent Dialogue'],
  },
  tour: {
    title: 'Autonomous Guided Robot Tour',
    badge: 'SYS_03',
    color: '#06b6d4',
    speech: 'Show me around initiates our autonomous Guided Tour. Follow our mobile robot as it escorts visitors through key facility checkpoints.',
    bullets: ['Multi-Stop Waypoint Navigation', 'Live Voice Narrated Waypoints', 'Hands-Free Visitor Escort'],
  },
  facilities: {
    title: 'Public Facilities & Directory',
    badge: 'SYS_04',
    color: '#10b981',
    speech: 'Public Facilities provides a complete interactive directory of conference halls, labs, rest zones, and office locations.',
    bullets: ['Interactive Floor Directory', 'Live Status & Availability', 'Step-by-step Room Guidance'],
  },
  face: {
    title: 'Facial Vision & Smart Greetings',
    badge: 'SYS_02',
    color: '#00A8FF',
    speech: 'Face Greetings uses camera vision to detect approaching visitors, recognize registered faces, and deliver personalized audio greetings.',
    bullets: ['High-speed Local Face Matching', 'Emotion & Expression Reflex', 'Automated Visitor Welcoming'],
  },
  control: {
    title: 'Robot Teleoperation & Hardware Cockpit',
    badge: 'SYS_07',
    color: '#f59e0b',
    speech: 'Robot Control Cockpit gives direct access to our ROS 2 motors, multi-axis servos, camera pan-tilt, and telemetry.',
    bullets: ['ROS 2 Teleoperation Grid', 'Head Pan-Tilt & Arm Articulation', 'Real-time ESP32 Serial Telemetry'],
  },
  pdf: {
    title: 'Interactive PDF Document AI',
    badge: 'SYS_08',
    color: '#ff3366',
    speech: 'PDF AI allows visitors and staff to converse with complex documents, research whitepapers, and brochures through AI.',
    bullets: ['On-device Document Ingestion', 'Semantic PDF Search', 'Instant Citation Q&A'],
  },
  testing: {
    title: 'Testing & Diagnostic Interactive Lab',
    badge: 'SYS_09',
    color: '#f59e0b',
    speech: 'Interactive Testing mode lets engineers test 3D face tracking, light reflex simulations, voice channels, and peripheral diagnostics.',
    bullets: ['3D Eye Reflex Simulation', 'Pupil Dilation Dynamics', 'Real-time Diagnostic Metrics'],
  },
};

const getFeatureExplanation = (card) => {
  if (!card) return null;
  const href = (card.href || '').toLowerCase();
  const title = (card.title || '').toLowerCase();
  for (const [key, val] of Object.entries(FEATURE_EXPLANATIONS)) {
    if (href.includes(key) || title.includes(key)) return val;
  }
  return {
    title: card.title,
    badge: 'FEATURE',
    color: '#00ffff',
    speech: `This is ${card.title}. ${card.subtitle || 'Tap to launch this module.'}`,
    bullets: [card.subtitle || 'Interactive Smart Module', 'One-tap Direct Launch', 'Voice Enabled'],
  };
};

// Isolated 90 FPS Telemetry Component (zero re-render overhead on main view)
const FpsTelemetry = React.memo(function FpsTelemetry() {
  const [val, setVal] = useState(90);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId = null;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setVal(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <span>CAM/FPS: {val} FPS</span>;
});

// Isolated Live Clock Component (zero re-render overhead on main view)
const LiveClockTelemetry = React.memo(function LiveClockTelemetry() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentTimeStr(`${hours}:${minutes} ${ampm}`);

      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = months[now.getMonth()];
      const day = now.getDate();
      const year = now.getFullYear();
      setCurrentDateStr(`${month} ${day}, ${year}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cyber-clock-box">
      <div className="clock-time">{currentTimeStr || '12:00 PM'}</div>
      <div className="clock-date">{currentDateStr || 'OCT 21, 2026'}</div>
    </div>
  );
});

export default function SliderAndCards({ onNavigate, onOpenAdmin, isAdminOpen, showCardsInitially = false }) {
  const [slides, setSlides] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('AURRA 4.0');
  const [devSettings, setDevSettings] = useState(devSettingsService.getSettings());
  const [espState, setEspState] = useState(esp32Service.getState());

  // Explain Features Mode state (Storyboard Spec)
  const [isExplainMode, setIsExplainMode] = useState(false);
  const [explainIndex, setExplainIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const explainTimerRef = useRef(null);
  const explainCardRef = useRef(null);
  const topNodesRowRef = useRef(null);
  const handleStartExplainRef = useRef(null);
  const kioskTopBarRef = useRef(null);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  // GSAP refs for morph-in animation targets
  const orbitalLayoutRef = useRef(null);
  const coreOrbRef = useRef(null);
  const heroColRef = useRef(null);
  const satelliteNodesRef = useRef([]);
  const orbTrackRingsRef = useRef([]);
  const morphInTlRef = useRef(null);
  const cardsRef = useRef(cards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Sync with developer settings changes in real time
  useEffect(() => {
    const handleSettingsChange = (e) => {
      if (e.detail) setDevSettings(e.detail);
    };
    window.addEventListener('aurra_dev_settings_changed', handleSettingsChange);
    const unsubEsp = esp32Service.subscribe((s) => setEspState(s));
    return () => {
      window.removeEventListener('aurra_dev_settings_changed', handleSettingsChange);
      unsubEsp();
    };
  }, []);

  useEffect(() => {
    const runMorphInGSAP = () => {
      if (morphInTlRef.current) morphInTlRef.current.kill();

      const heroEl = heroColRef.current;
      const coreEl = coreOrbRef.current;
      const satellites = satelliteNodesRef.current.filter(Boolean);
      const trackRings = orbTrackRingsRef.current.filter(Boolean);
      const targetCount = cardsRef.current?.length || 1;

      // If DOM nodes haven't mounted yet, retry on next frame
      if (!coreEl || satellites.length < targetCount) {
        requestAnimationFrame(() => runMorphInGSAP());
        return;
      }

      const tl = gsap.timeline();
      morphInTlRef.current = tl;

      // Reset constellation column position, top bar, and all nodes cleanly
      gsap.set(['.hero-system-column', '.constellation-column', '.constellation-core-orb', '.orbital-track-ring', '.satellite-orb-node'], { clearProps: 'all' });
      if (kioskTopBarRef.current) gsap.to(kioskTopBarRef.current, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' });

      // Set initial starting states
      if (heroEl) gsap.set(heroEl, { x: -280, opacity: 0 });
      if (coreEl) gsap.set(coreEl, { scale: 0.88, opacity: 1 });
      trackRings.forEach((el) => gsap.set(el, { scale: 0.7, opacity: 0 }));

      // Phase 1: Hero system column glides in smoothly from the left
      if (heroEl) {
        tl.to(heroEl, {
          x: 0,
          opacity: 1,
          duration: 0.65,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        }, 0.05);
      }

      // Phase 2: Central Core Ask Aurra sphere stabilizes and pulses at center
      if (coreEl) {
        tl.to(coreEl, {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'back.out(1.4)',
          clearProps: 'transform,opacity',
        }, 0.04);
      }

      // Phase 3: Orbital track rings expand into place around the core
      trackRings.forEach((el, i) => {
        tl.to(el, {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        }, 0.1 + i * 0.08);
      });

      // Phase 4: Rotary Mobile Dialer Circulation - Satellite orbs emerge from the right-down corner
      // of the core orb and circulate around the orbital dial like a vintage rotary phone into their respective slots
      satellites.forEach((el, i) => {
        const slot = getBubbleSlot(i, satellites.length);
        const rawX = el.style.getPropertyValue('--orb-x');
        const rawY = el.style.getPropertyValue('--orb-y');
        const finalX = rawX ? parseFloat(rawX) : (slot.x || 0);
        const finalY = rawY ? parseFloat(rawY) : (slot.y || 0);

        const finalR = Math.hypot(finalX, finalY);
        let finalAngle = Math.atan2(finalY, finalX);
        if (finalAngle < 0) finalAngle += 2 * Math.PI;

        // Emergence point: Right-Down corner (45° in polar screen coordinates) as in Storyboard Frame 1
        const emergenceAngle = 0.25 * Math.PI; // ~45 degrees (right-down / bottom-right corner)
        const startAngle = emergenceAngle + (i * 0.08);
        let targetAngle = finalAngle;
        while (targetAngle < startAngle + 0.35) {
          targetAngle += 2 * Math.PI;
        }

        const startR = 32; // Nestled snugly inside the 154px core orb at the right-down corner

        // Hide and position at right-down corner of core orb initially
        gsap.set(el, {
          xPercent: -50,
          yPercent: -50,
          x: Math.cos(startAngle) * startR,
          y: Math.sin(startAngle) * startR,
          scale: 0.2,
          opacity: 0,
        });

        const dialProxy = { progress: 0 };

        // Rotary circulation around dial into slots
        tl.to(dialProxy, {
          progress: 1,
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: () => {
            const p = dialProxy.progress;
            const curAngle = startAngle + (targetAngle - startAngle) * p;
            const curR = startR + (finalR - startR) * Math.min(1, p * 1.15);
            const curScale = 0.2 + 0.8 * Math.min(1, p * 1.25);
            const curOpacity = Math.min(1, p * 3.5);

            gsap.set(el, {
              xPercent: -50,
              yPercent: -50,
              x: Math.cos(curAngle) * curR,
              y: Math.sin(curAngle) * curR,
              scale: curScale,
              opacity: curOpacity,
            });
          },
          onComplete: () => {
            // Restore native CSS layout with zero offset jump so ambient bobber floats seamlessly
            gsap.set(el, {
              clearProps: 'transform,opacity',
            });
          },
        }, 0.1 + i * 0.12);
      });
    };

    if (showCardsInitially || (typeof window !== 'undefined' && window.location.search.includes('view=cards'))) {
      setShowSlider(false);
    }

    let morphTimer = null;
    const scheduleMorphIn = () => {
      setShowSlider(false);
      setIsExplainMode(false);
      if (morphTimer) cancelAnimationFrame(morphTimer);
      morphTimer = requestAnimationFrame(() => {
        morphTimer = requestAnimationFrame(() => {
          morphTimer = null;
          runMorphInGSAP();
        });
      });
    };

    const handleShowSlider = () => {
      if (morphTimer) {
        cancelAnimationFrame(morphTimer);
        morphTimer = null;
      }
      setIsExplainMode(false);
      setShowSlider(true);
    };

    const handleStartExplainEvent = () => {
      handleStartExplainRef.current?.();
    };

    window.addEventListener('aurra_show_cards', scheduleMorphIn);
    window.addEventListener('aurra_show_features', scheduleMorphIn);
    window.addEventListener('aurra_morph_cards_in', scheduleMorphIn);
    window.addEventListener('aurra_show_slider', handleShowSlider);
    window.addEventListener('aurra_start_explain_features', handleStartExplainEvent);

    return () => {
      if (morphTimer) cancelAnimationFrame(morphTimer);
      window.removeEventListener('aurra_show_cards', scheduleMorphIn);
      window.removeEventListener('aurra_show_features', scheduleMorphIn);
      window.removeEventListener('aurra_morph_cards_in', scheduleMorphIn);
      window.removeEventListener('aurra_show_slider', handleShowSlider);
      window.removeEventListener('aurra_start_explain_features', handleStartExplainEvent);
    };
  }, [showCardsInitially]);

  // ── Load Data from IndexedDB ──
  const loadKioskData = useCallback(async () => {
    try {
      const header = await offlineBrandingService.getHeader();
      if (header?.headerName) {
        setHeaderTitle(header.headerName);
      }

      const rawSlides = await offlineSliderService.getSlideImages();
      setSlides(rawSlides.filter((s) => s.isSelected !== false));

      const rawCards = await offlineCardService.getCards();
      setCards(rawCards.filter((c) => c.isEnabled !== false));

      logger.info('HOME', `Loaded ${rawCards.length} action cards & ${rawSlides.length} slides from IndexedDB`);
    } catch (err) {
      logger.error('HOME', `Failed to load kiosk data: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    loadKioskData();

    const handleCardsChange = () => {
      logger.info('HOME', 'Received aurra_cards_changed event, refreshing constellation...');
      loadKioskData();
    };
    const handleSlidesChange = () => {
      loadKioskData();
    };
    const handleBrandingChange = () => {
      loadKioskData();
    };

    window.addEventListener('aurra_cards_changed', handleCardsChange);
    window.addEventListener('aurra_slides_changed', handleSlidesChange);
    window.addEventListener('aurra_branding_changed', handleBrandingChange);

    return () => {
      window.removeEventListener('aurra_cards_changed', handleCardsChange);
      window.removeEventListener('aurra_slides_changed', handleSlidesChange);
      window.removeEventListener('aurra_branding_changed', handleBrandingChange);
    };
  }, [loadKioskData]);

  // Re-fetch kiosk data when admin closes
  useEffect(() => {
    if (!isAdminOpen) {
      loadKioskData();
    }
  }, [isAdminOpen, loadKioskData]);

  // ── Auto-cycle Banner Slideshow ──
  useEffect(() => {
    if (!showSlider || slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const isVid = (
      currentSlide.mediaType === 'video' ||
      currentSlide.url?.startsWith('data:video/') ||
      /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(currentSlide.url || '')
    );

    // If it's a video set to play full length until end (default for video),
    // slide advance is handled by the video element's onEnded event handler.
    const shouldPlayUntilEnd = isVid && (currentSlide.playUntilEnd !== false);
    if (shouldPlayUntilEnd) {
      // Safety timeout: in case video metadata fails or video stalls, fallback after 10 minutes
      const safetyTimer = setTimeout(() => {
        if (slides.length > 1) {
          setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
        }
      }, 600000);
      return () => clearTimeout(safetyTimer);
    }

    // For image slides or video with fixed timeframe:
    const seconds = Number(currentSlide.duration) > 0 ? Number(currentSlide.duration) : 5;
    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, seconds * 1000);

    return () => clearTimeout(timer);
  }, [showSlider, slides, currentSlideIndex]);

  // ── Explain Features Mode Controllers & Morph Animation (Storyboard Spec) ──
  const switchExplainFeature = useCallback((nextIdx, manual = false) => {
    if (!cards || cards.length === 0) return;
    const targetIdx = (nextIdx + cards.length) % cards.length;
    if (manual) setIsAutoPlaying(false);

    const cardEl = explainCardRef.current;
    if (cardEl) {
      // Morph: Large rounded rectangle card transitions smoothly with subtle scale
      gsap.to(cardEl, {
        scale: 0.94,
        y: -10,
        opacity: 0.3,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          setExplainIndex(targetIdx);
          gsap.fromTo(
            cardEl,
            { scale: 0.94, y: 10, opacity: 0.3 },
            {
              scale: 1,
              y: 0,
              opacity: 1,
              duration: 0.35,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            }
          );
        },
      });
    } else {
      setExplainIndex(targetIdx);
    }
  }, [cards]);

  // ── Seamless In-Place Cinematic Continuous Morph ──
  const handleStartExplain = useCallback(() => {
    if (isExplainMode) return;
    setShowSlider(false);

    const heroEl = heroColRef.current;
    const coreEl = coreOrbRef.current;
    const trackRings = orbTrackRingsRef.current.filter(Boolean);
    const satellites = satelliteNodesRef.current.filter(Boolean);
    const topBarEl = kioskTopBarRef.current;

    // If elements not mounted, switch directly
    if (!heroEl && !coreEl && satellites.length === 0) {
      setIsExplainMode(true);
      setExplainIndex(0);
      setIsAutoPlaying(true);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setIsExplainMode(true);
        setExplainIndex(0);
        setIsAutoPlaying(true);
      }
    });

    // 1. Kiosk Top Bar smoothly glides upward off-screen
    if (topBarEl) {
      tl.to(topBarEl, {
        y: -60,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.inOut',
      }, 0);
    }

    // 2. All text in hero-system-column glides smoothly to the left
    if (heroEl) {
      tl.to(heroEl, {
        x: -250,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      }, 0);
    }

    // 3. Central Core Ask Aurra & Track rings smoothly shrink & fade into background
    if (coreEl) {
      tl.to(coreEl, {
        scale: 0.3,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      }, 0.02);
    }

    trackRings.forEach((ring) => {
      tl.to(ring, {
        scale: 0.4,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      }, 0.02);
    });

    // 4. Satellite bubbles fade out smoothly in place (NO translating constellation column!)
    satellites.forEach((el, i) => {
      tl.to(el, {
        scale: 0.6,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      }, 0.02 + i * 0.03);
    });
  }, [isExplainMode]);

  handleStartExplainRef.current = handleStartExplain;

  const handleExitExplain = useCallback(() => {
    voiceNavigationService.cancelSpeech();
    if (explainTimerRef.current) clearTimeout(explainTimerRef.current);

    const cardEl = explainCardRef.current;
    const topRowEl = topNodesRowRef.current;
    const topBarEl = kioskTopBarRef.current;

    const tl = gsap.timeline({
      onComplete: () => {
        setIsExplainMode(false);
        // Clear all inline transforms and props from previous animations immediately
        requestAnimationFrame(() => {
          gsap.set(['.hero-system-column', '.constellation-column', '.constellation-core-orb', '.orbital-track-ring', '.satellite-orb-node'], { clearProps: 'all' });
          window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
        });
      }
    });

    // 1. Center showcase card glides down
    if (cardEl) {
      tl.to(cardEl, {
        scale: 0.9,
        y: 20,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
      }, 0);
    }

    // 2. Top nodes row smoothly glides up
    if (topRowEl) {
      tl.to(topRowEl, {
        y: -20,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
      }, 0.02);
    }

    // 3. Kiosk Top Bar smoothly glides back down from above
    if (topBarEl) {
      tl.to(topBarEl, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      }, 0.05);
    }
  }, []);

  // Auto-advance & Voice Narration for Explain Features Mode
  useEffect(() => {
    if (!isExplainMode || !cards || cards.length === 0) return;

    const curCard = cards[explainIndex];
    if (curCard) {
      const exp = getFeatureExplanation(curCard);
      if (exp?.speech) {
        voiceNavigationService.speak(exp.speech);
      }
    }

    if (isAutoPlaying) {
      if (explainTimerRef.current) clearTimeout(explainTimerRef.current);
      explainTimerRef.current = setTimeout(() => {
        switchExplainFeature((explainIndex + 1) % cards.length);
      }, 8000);
    }

    return () => {
      if (explainTimerRef.current) clearTimeout(explainTimerRef.current);
    };
  }, [isExplainMode, explainIndex, isAutoPlaying, cards, switchExplainFeature]);

  // Initial Entry Animation for Explain Mode
  useEffect(() => {
    if (isExplainMode) {
      if (topNodesRowRef.current) {
        gsap.fromTo(
          topNodesRowRef.current,
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.2)', clearProps: 'transform,opacity' }
        );
      }
      if (explainCardRef.current) {
        gsap.fromTo(
          explainCardRef.current,
          { scale: 0.9, y: 20, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' }
        );
      }
    }
  }, [isExplainMode]);

  // ── Reload Kiosk Data when Admin Closes ──
  useEffect(() => {
    if (!isAdminOpen) {
      loadKioskData();
    }
  }, [isAdminOpen, loadKioskData]);

  // ── 4-Times Heading Tap Detector (with 1-Tap Developer Option) ──
  const handleHeadingTap = () => {
    // 1. Developer Mode: Single-tap quick access
    if (devSettings.singleTapAdmin) {
      logger.info('ADMIN', 'Admin triggered via 1-tap Developer Quick Access');
      if (devSettings.bypassAdminPin) {
        onOpenAdmin?.();
      } else {
        setIsAuthModalOpen(true);
      }
      return;
    }

    // 2. Production Kiosk Mode: 4 taps required within 2.5s
    tapCountRef.current += 1;
    logger.info('ADMIN', `Heading tap count: ${tapCountRef.current}/4`);

    if (!tapTimerRef.current) {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
        tapTimerRef.current = null;
      }, 2500);
    }

    if (tapCountRef.current >= 4) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      logger.info('ADMIN', '4 taps reached on heading! Opening Admin Access');
      if (devSettings.bypassAdminPin) {
        onOpenAdmin?.();
      } else {
        setIsAuthModalOpen(true);
      }
    }
  };

  // ── Handle Card Click ──
  const handleCardClick = (card) => {
    logger.info('NAV', `Navigating to ${card.title} (${card.href})`);
    onNavigate?.(card.href, card);
  };

  const activeSlide = slides[currentSlideIndex] || {
    title: 'Robomiracle Technologies',
    subtitle: 'Autonomous AI Humanoid Receptionist',
  };

  return (
    <div className={`home-container ${isExplainMode ? 'in-explain-mode' : ''}`}>
      {/* Top Cyber Telemetry Header Bar */}
      <header 
        ref={kioskTopBarRef} 
        className={`kiosk-top-bar ${isExplainMode ? 'kiosk-top-bar-hidden' : ''}`}
      >
        {/* Left: Cyber Brand Badge */}
        <div 
          className="cyber-brand-badge"
          onClick={handleHeadingTap}
          title="Aurra 4.0 System (Tap 4 times to access Admin)"
        >
          <div className="brand-robot-icon">
            <Bot size={22} color="#00ffff" />
          </div>
          <div className="brand-text-col">
            <div className="brand-title">AURRA 4.0</div>
            <div className="brand-sub">ROBOMIRACLE AI SYSTEM</div>
          </div>
        </div>

        {/* Center: Live Telemetry Cluster */}
        <div className="cyber-telemetry-cluster">
          <div className={`hud-telem-pill ${espState.online ? 'telem-online' : 'telem-offline'}`}>
            <span className="telem-dot"></span>
            <span>SERIAL: {espState.online ? (espState.mode === 'ap' ? 'ONLINE (AP)' : 'ONLINE (STA)') : 'OFFLINE'}</span>
          </div>

          <div className="hud-telem-pill telem-db">
            <span className="telem-dot"></span>
            <span>DB: DEXIE LOCAL</span>
          </div>

          <div className="hud-telem-pill telem-fps">
            <span className="telem-dot"></span>
            <FpsTelemetry />
          </div>
        </div>

        {/* Right: Live Real-Time Clock & Action Buttons */}
        <div className="cyber-top-right-group">
          <button 
            className={`cyber-top-explain-btn ${isExplainMode ? 'active-tour' : ''}`}
            onClick={() => {
              if (isExplainMode) {
                handleExitExplain();
              } else {
                handleStartExplain();
              }
            }}
            title="Explain All Features with Voice Walkthrough"
          >
            <Sparkles size={14} color="#00ffff" />
            <span>{isExplainMode ? 'Exit Explain' : 'Explain Features'}</span>
          </button>

          <button 
            className="cyber-top-features-btn"
            onClick={() => {
              if (isExplainMode) setIsExplainMode(false);
              setShowSlider(false);
              window.dispatchEvent(new CustomEvent('aurra_show_cards'));
              window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
            }}
            title="View Features & Action Cards"
          >
            <Sparkles size={15} color="#00ffff" />
            <span>Features</span>
          </button>
          <LiveClockTelemetry />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="kiosk-main-content">
        {showSlider ? (
          /* SLIDESHOW BANNER VIEW */
          <div
            className="slider-outer-frame"
            onDoubleClick={() => setShowSlider(false)}
            onClick={(e) => {
              const vid = e.currentTarget.querySelector('video');
              if (vid && activeSlide.isMuted !== true) {
                vid.muted = false;
                vid.volume = 1.0;
                vid.play().catch(() => {});
              }
            }}
          >
            <div className="slider-viewport">
              {activeSlide.url ? (
                (activeSlide.mediaType === 'video' || activeSlide.url.startsWith('data:video/') || /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(activeSlide.url)) ? (
                  <video
                    key={activeSlide.url}
                    src={activeSlide.url}
                    autoPlay
                    loop={slides.length === 1}
                    playsInline
                    muted={activeSlide.isMuted === true}
                    onEnded={() => {
                      if (slides.length > 1) {
                        setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
                      }
                    }}
                    onError={() => {
                      if (slides.length > 1) {
                        setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
                      }
                    }}
                    className="slide-image slide-video"
                    ref={(videoEl) => {
                      if (videoEl) {
                        const isMuted = activeSlide.isMuted === true;
                        videoEl.muted = isMuted;
                        videoEl.volume = isMuted ? 0 : 1.0;
                        const playPromise = videoEl.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(() => {
                            if (!isMuted) {
                              videoEl.muted = true;
                              videoEl.play().catch(() => {});
                            }
                          });
                        }
                      }
                    }}
                  />
                ) : (
                  <img
                    src={activeSlide.url}
                    alt={activeSlide.title}
                    className="slide-image"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )
              ) : (
                <div className="cyber-slide-banner">
                  <div className="cyber-grid-mesh"></div>
                  <div className="banner-content">
                    <div className="banner-badge">
                      <Sparkles size={16} color="#00ffff" />
                      <span>AURRA AUTONOMOUS KIOSK</span>
                    </div>
                    <h2 className="banner-title">{activeSlide.title}</h2>
                    <p className="banner-subtitle">{activeSlide.subtitle}</p>
                    <div className="banner-cta">
                      <span>Double-tap or say <strong>"Show Cards"</strong> to interact</span>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Slider Dots Indicator */}
            {slides.length > 1 && (
              <div className="slider-dots-row">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    className={`slider-dot ${idx === currentSlideIndex ? 'active' : ''}`}
                    onClick={() => setCurrentSlideIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : isExplainMode ? (
          /* EXPLAIN FEATURES SHOWCASE MODE (STORYBOARD SPEC) */
          <div className="explain-mode-layout">
            {/* 1. Top row of circular nodes (O O O O O O) */}
            <div 
              ref={topNodesRowRef} 
              className="explain-top-nodes-row"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                margin: '0 auto',
              }}
            >
              {cards.map((card, idx) => {
                const theme = getOrbTheme(card.href, idx, card);
                const isActive = idx === explainIndex;
                return (
                  <div
                    key={card.id || idx}
                    className={`explain-top-node ${isActive ? 'active-node' : ''}`}
                    onClick={() => switchExplainFeature(idx, true)}
                    style={{
                      '--node-color': theme.color,
                      '--node-glow': theme.glow,
                    }}
                    title={`Explain ${card.title}`}
                  >
                    <div className="explain-top-node-icon">
                      {getCardIcon(card.href, card.className, 20)}
                    </div>
                    <div className="explain-top-node-pill">
                      {theme.sysId}
                    </div>
                    {isActive && <div className="explain-active-ring"></div>}
                  </div>
                );
              })}
            </div>

            {/* 2. Center Large Rounded Rectangle Card */}
            {(() => {
              const activeCard = cards[explainIndex] || cards[0];
              if (!activeCard) return null;
              const theme = getOrbTheme(activeCard.href, explainIndex, activeCard);
              const exp = getFeatureExplanation(activeCard);

              return (
                <div className="explain-showcase-container">
                  <div 
                    ref={explainCardRef} 
                    className="explain-showcase-card"
                    style={{
                      '--card-color': theme.color,
                      '--card-glow': theme.glow,
                    }}
                  >
                    {/* Ambient specular highlight */}
                    <div className="explain-card-specular"></div>

                    {/* Top header within card */}
                    <div className="explain-card-header">
                      <div className="explain-header-left">
                        <div className="explain-icon-box">
                          {getCardIcon(activeCard.href, activeCard.className, 34)}
                        </div>
                        <div>
                          <div className="explain-sys-badge">{exp.badge || theme.sysId}</div>
                          <h2 className="explain-card-title">{exp.title || activeCard.title}</h2>
                          <div className="explain-card-sub">{activeCard.subtitle}</div>
                        </div>
                      </div>
                      <div className="explain-step-counter">
                        {explainIndex + 1} / {cards.length}
                      </div>
                    </div>

                    {/* Middle body: Audio waveform & Bullet capabilities */}
                    <div className="explain-card-body">
                      <div className="explain-speech-quote">
                        <span className="quote-mark">“ </span>
                        <span>{exp.speech}</span>
                        <span className="quote-mark"> ”</span>
                      </div>

                      <div className="explain-bullets-grid">
                        {exp.bullets?.map((b, i) => (
                          <div key={i} className="explain-bullet-pill">
                            <span className="bullet-dot"></span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="explain-card-footer">
                      <div className="explain-nav-controls">
                        <button 
                          className="explain-nav-btn"
                          onClick={() => switchExplainFeature(explainIndex - 1, true)}
                          title="Previous Feature"
                        >
                          ◀ Prev
                        </button>
                        <button 
                          className="explain-nav-btn play-pause"
                          onClick={() => setIsAutoPlaying(prev => !prev)}
                          title={isAutoPlaying ? "Pause Auto-tour" : "Play Auto-tour"}
                        >
                          {isAutoPlaying ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button 
                          className="explain-nav-btn"
                          onClick={() => switchExplainFeature(explainIndex + 1, true)}
                          title="Next Feature"
                        >
                          Next ▶
                        </button>
                      </div>

                      <div className="explain-right-actions">
                        <button 
                          className="explain-open-btn"
                          onClick={() => handleCardClick(activeCard)}
                          title="Open this feature screen"
                        >
                          <span>Launch Feature</span>
                          <ChevronRight size={16} />
                        </button>
                        <button 
                          className="explain-exit-btn"
                          onClick={handleExitExplain}
                          title="Exit walkthrough"
                        >
                          <span>Exit Tour</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* AURRA 4.0 ORBITAL CONSTELLATION VIEW */
          <div ref={orbitalLayoutRef} className="orbital-home-layout">
            {/* Left: Hero System Highlight Command Deck */}
            <div ref={heroColRef} className="hero-system-column">
              <div className="system-highlight-badge">
                <span className="highlight-pill">SYSTEM HIGHLIGHT</span>
                <span className="highlight-line"></span>
              </div>

              <h1 className="hero-smart-title">
                <span className="title-white">Aurra 4.0</span>
                <span className="title-cyan">Smart System</span>
              </h1>

              <p className="hero-description-text">
                On-device edge AI powered by Dexie IndexedDB & touchless voice autonomy. 
                Ask Aurra sits at the core — tap any node around it or speak naturally to open that module.
              </p>

              <div className="hero-actions-row">
                <button 
                  className="talk-to-aurra-btn"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
                    voiceNavigationService.speak('I am listening. Ask any question or command.');
                  }}
                  title="Activate Hands-Free Voice Listening"
                >
                  <div className="play-icon-circle">
                    <Play size={16} fill="#000" color="#000" />
                  </div>
                  <span>Talk to Aurra</span>
                </button>

                <button
                  className="screensaver-switch-btn"
                  onClick={() => setShowSlider(true)}
                  title="Switch to Slideshow Screensaver"
                >
                  <span>Screensaver</span>
                </button>
              </div>
            </div>

            {/* Right: The Planetary Orbital Constellation */}
            <div className="constellation-column">
              <div className="constellation-canvas">
                {/* Visual Orbit Tracks */}
                <div ref={el => { if (el) orbTrackRingsRef.current[0] = el; }} className="orbital-track-ring track-outer"></div>
                <div ref={el => { if (el) orbTrackRingsRef.current[1] = el; }} className="orbital-track-ring track-inner"></div>

                {/* Central Core Sphere: Ask Aurra (SYS_01) */}
                <div 
                  ref={coreOrbRef}
                  className="constellation-core-orb"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
                    voiceNavigationService.speak('I am Aurra, how can I help you today?');
                  }}
                  title="SYS_01: Ask Aurra Voice Core (Tap to Talk)"
                >
                  <div className="orb-glass-specular"></div>
                  <div className="core-mic-halo">
                    <Mic size={36} color="#00ffff" />
                  </div>
                  <div className="core-orb-title">Ask Aurra</div>
                  <div className="core-orb-sys">SYS_01</div>
                  <div className="core-breathing-aura"></div>
                </div>

                {/* Orbiting Satellite Glass Spheres */}
                {cards.map((card, idx) => {
                  const theme = getOrbTheme(card.href, idx, card);
                  const total = cards.length || 1;
                  const slot = getBubbleSlot(idx, total);

                  return (
                    <div
                      key={card.id || idx}
                      ref={el => { satelliteNodesRef.current[idx] = el; }}
                      className="satellite-orb-node"
                      style={{
                        '--node-idx': idx,
                        '--orb-x': `${slot.x}px`,
                        '--orb-y': `${slot.y}px`,
                        '--orb-size': `${slot.size}px`,
                        '--orb-font-size': `${slot.fontSize}px`,
                        '--orb-label-max': `${slot.labelMax}px`,
                        '--orb-color': theme.color,
                        '--orb-glow': theme.glow,
                        '--orb-bg': theme.bg,
                        '--orb-border': theme.border,
                        '--float-delay': `${(idx * 0.35).toFixed(2)}s`,
                      }}
                      onClick={() => handleCardClick(card)}
                      title={`Open ${card.title}`}
                    >
                      <div className="orb-gpu-bobber">
                        <div className="orb-glass-specular"></div>
                        <div className="orb-icon-glyph">
                          {getCardIcon(card.href, card.className, slot.iconSize)}
                        </div>
                        <div className="orb-label-text">{theme.label || card.title}</div>
                        <div className="orb-sys-badge">{theme.sysId}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom spacer for global floating voice bar */}
      <div className="bottom-global-voice-spacer"></div>

      {/* Secret PIN Authentication Modal */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          onOpenAdmin?.();
        }}
      />

      {/* Diagnostic Log Viewer Modal */}
      <LogViewerModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
