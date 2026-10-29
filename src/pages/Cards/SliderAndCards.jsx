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
  Pause,
  Cpu,
  LayoutGrid
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
const getCardIcon = (href, className, size = 26, color = '#00ffff') => {
  if (href?.includes('form')) return <FileText size={size} color={color} />;
  if (href?.includes('qa')) return <HelpCircle size={size} color={color} />;
  if (href?.includes('tour')) return <Compass size={size} color={color} />;
  if (href?.includes('facilities')) return <Building2 size={size} color={color} />;
  if (href?.includes('face') || href?.includes('greet')) return <Camera size={size} color={color} />;
  if (href?.includes('control')) return <Sliders size={size} color={color} />;
  if (href?.includes('testing-interaction')) return <FlaskConical size={size} color={color} />;
  if (href?.includes('interaction')) return <Eye size={size} color={color} />;
  if (href?.includes('web')) return <Globe size={size} color={color} />;
  if (href?.includes('hardware')) return <Activity size={size} color={color} />;
  if (href?.includes('pdf')) return <FileText size={size} color={color} />;
  return <Sparkles size={size} color={color} />;
};

// Organic Clustered Bubble Slots (Tightly nestled closer to the constellation core, even spacing, collision-free)
const CLUSTER_CONFIGS = {
  // If 5 cards:
  5: [
    { x: 0, y: -146, size: 108, iconSize: 24, fontSize: 10, labelMax: 86 }, // Top
    { x: 144, y: -46, size: 138, iconSize: 32, fontSize: 12.5, labelMax: 108 }, // Top-Right (Prominent Larger Orb)
    { x: 86, y: 122, size: 108, iconSize: 24, fontSize: 10, labelMax: 86 }, // Bottom-Right
    { x: -86, y: 122, size: 104, iconSize: 22, fontSize: 9.5, labelMax: 82 }, // Bottom-Left
    { x: -142, y: -46, size: 108, iconSize: 24, fontSize: 10, labelMax: 88 }, // Top-Left
  ],
  // If 6 cards:
  6: [
    { x: 0, y: -146, size: 108, iconSize: 24, fontSize: 10, labelMax: 88 }, // Top
    { x: 136, y: -76, size: 138, iconSize: 32, fontSize: 12.5, labelMax: 108 }, // Top-Right (Prominent Larger Orb)
    { x: 130, y: 74, size: 108, iconSize: 24, fontSize: 10, labelMax: 86 }, // Bottom-Right
    { x: 0, y: 144, size: 102, iconSize: 22, fontSize: 9.5, labelMax: 82 }, // Bottom
    { x: -128, y: 74, size: 106, iconSize: 22, fontSize: 10, labelMax: 84 }, // Bottom-Left
    { x: -132, y: -76, size: 108, iconSize: 24, fontSize: 10, labelMax: 88 }, // Top-Left
  ],
  // If 7 cards:
  7: [
    { x: 0, y: -148, size: 108, iconSize: 24, fontSize: 10.5, labelMax: 88 }, // Top
    { x: 130, y: -98, size: 140, iconSize: 32, fontSize: 12.5, labelMax: 110 }, // Top-Right (Prominent Larger Hero Orb)
    { x: 154, y: 34, size: 108, iconSize: 24, fontSize: 10.5, labelMax: 88 }, // Right
    { x: 68, y: 140, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 }, // Bottom-Right
    { x: -68, y: 140, size: 100, iconSize: 22, fontSize: 10, labelMax: 82 }, // Bottom-Left
    { x: -150, y: 34, size: 108, iconSize: 24, fontSize: 10.5, labelMax: 88 }, // Left-Bottom
    { x: -122, y: -96, size: 106, iconSize: 24, fontSize: 10.5, labelMax: 86 }, // Left-Top
  ],
  // If 8 cards:
  8: [
    { x: 0, y: -148, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 },
    { x: 120, y: -100, size: 138, iconSize: 30, fontSize: 12, labelMax: 106 }, // Prominent Larger Orb
    { x: 158, y: 18, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 },
    { x: 96, y: 130, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 82 },
    { x: -46, y: 152, size: 98, iconSize: 22, fontSize: 9.5, labelMax: 80 },
    { x: -148, y: 80, size: 102, iconSize: 22, fontSize: 10, labelMax: 82 },
    { x: -162, y: -42, size: 104, iconSize: 24, fontSize: 10, labelMax: 84 },
    { x: -86, y: -134, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 82 },
  ],
  // If 9 or 10 cards: Curated 2-tier alternating inner/outer planetary constellation
  10: [
    { x: 0, y: -148, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 78 },     // 0: Top (Inner)
    { x: 126, y: -168, size: 94, iconSize: 22, fontSize: 9.5, labelMax: 76 },  // 1: Top-Right (Outer)
    { x: 152, y: -42, size: 134, iconSize: 30, fontSize: 12, labelMax: 102 },   // 2: Right-Top (Inner - Prominent Larger Orb)
    { x: 202, y: 66, size: 94, iconSize: 22, fontSize: 9.5, labelMax: 76 },    // 3: Right-Bottom (Outer)
    { x: 86, y: 124, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 78 },    // 4: Bottom-Right (Inner)
    { x: 0, y: 216, size: 94, iconSize: 22, fontSize: 9.5, labelMax: 76 },      // 5: Bottom (Outer)
    { x: -86, y: 124, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 78 },   // 6: Bottom-Left (Inner)
    { x: -202, y: 66, size: 94, iconSize: 22, fontSize: 9.5, labelMax: 76 },   // 7: Left-Bottom (Outer)
    { x: -148, y: -42, size: 100, iconSize: 22, fontSize: 9.5, labelMax: 78 },  // 8: Left-Top (Inner)
    { x: -126, y: -168, size: 94, iconSize: 22, fontSize: 9.5, labelMax: 76 }, // 9: Top-Left (Outer)
  ],
};

const getBubbleSlot = (idx, total) => {
  let slot;
  // If exact configuration exists, use curated slot
  if (CLUSTER_CONFIGS[total] && CLUSTER_CONFIGS[total][idx]) {
    slot = { ...CLUSTER_CONFIGS[total][idx] };
  } else if (total <= 7) {
    // If <= 7 cards and no exact config, calculate single-tier circle closer to core
    const isFeatured = idx === 1;
    const angleDeg = (idx / total) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const r = isFeatured ? 162 : 148;
    slot = {
      x: Math.round(r * Math.cos(angleRad)),
      y: Math.round(r * Math.sin(angleRad)),
      size: isFeatured ? 142 : 108,
      iconSize: isFeatured ? 32 : 24,
      fontSize: isFeatured ? 12.5 : 10,
      labelMax: isFeatured ? 108 : 84,
    };
  } else {
    // For 8+ cards: Dynamic 2-tier alternating concentric orbits (Inner Track & Outer Track)
    const isFeatured = idx === 1;
    const isInner = idx % 2 === 0;
    const r = isFeatured ? 158 : (isInner ? 146 : 210);
    const size = isFeatured ? 136 : (isInner ? 100 : 94);
    const iconSize = isFeatured ? 30 : (isInner ? 24 : 22);
    const fontSize = isFeatured ? 12 : (isInner ? 10 : 9.5);
    const labelMax = isFeatured ? 104 : (isInner ? 80 : 76);
    const angleDeg = (idx / total) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    slot = {
      x: Math.round(r * Math.cos(angleRad)),
      y: Math.round(r * Math.sin(angleRad)),
      size,
      iconSize,
      fontSize,
      labelMax,
    };
  }

  // Calculate radial outward unit vectors to propel highlighted orb and gpu bobber away from constellation core orb
  const dist = Math.hypot(slot.x, slot.y) || 1;
  const ux = slot.x / dist;
  const uy = slot.y / dist;
  // Shift highlighted orb node 12px outward away from central Ask Aurra core
  slot.pushX = Math.round(ux * 12);
  slot.pushY = Math.round(uy * 12);
  // Direct gpu bobber floating animation 4px outward during highlighting
  slot.bobX = Math.round(ux * 4);
  slot.bobY = Math.round(uy * 4);

  return slot;
};

// Orbital Sphere Aesthetic Theme Resolver - UNIFIED CYBER NEON CYAN (#00ffff)
const getOrbTheme = (href, idx, card) => {
  let sysId = `SYS_0${idx + 2}`;
  let label = card?.title || 'Feature';

  if (href?.includes('face') || href?.includes('greet')) {
    sysId = 'SYS_02';
    label = card?.title || 'Face Recognition';
  } else if (href?.includes('tour')) {
    sysId = 'SYS_03';
    label = card?.title || 'Guided Tour';
  } else if (href?.includes('facilities')) {
    sysId = 'SYS_04';
    label = card?.title || 'Facilities';
  } else if (href?.includes('form') || href?.includes('register')) {
    sysId = 'SYS_05';
    label = card?.title || 'Visitor Form';
  } else if (href?.includes('web') || href?.includes('qr')) {
    sysId = 'SYS_06';
    label = card?.title || 'QR Links';
  } else if (href?.includes('control') || href?.includes('ros')) {
    sysId = 'SYS_07';
    label = card?.title || 'ROS Controls';
  } else if (href?.includes('pdf') || href?.includes('document')) {
    sysId = 'SYS_08';
    label = card?.title || 'PDF AI';
  } else if (href?.includes('qa') || href?.includes('question')) {
    sysId = 'SYS_02';
    label = card?.title || 'Ask Aurra';
  }

  return {
    sysId,
    color: '#00ffff',
    bg: 'rgba(0, 255, 255, 0.12)',
    border: '#00e5ff',
    glow: 'rgba(0, 255, 255, 0.5)',
    label,
  };
};

// Rich Storyboard Feature Explanations & Speech Scripts (Unified Cyber Theme)
const FEATURE_EXPLANATIONS = {
  form: {
    title: 'Touchless Visitor Registration',
    badge: 'SYS_05',
    color: '#00ffff',
    speech: 'Welcome to Visitor Registration. Guests can check in touchlessly, submit their visit details, and receive instant digital verification.',
    bullets: ['Touchless QR & On-screen Form', 'Instant Local Storage', 'Admin Verified Check-in'],
  },
  qa: {
    title: 'Ask Aurra AI Intelligence',
    badge: 'SYS_02',
    color: '#00ffff',
    speech: 'I am Ask Aurra, your interactive voice intelligence. Speak naturally to ask any question about the facility, team, or schedule.',
    bullets: ['Edge AI Voice Recognition', 'Instant Institutional Knowledge', 'Multi-turn Intelligent Dialogue'],
  },
  tour: {
    title: 'Autonomous Guided Robot Tour',
    badge: 'SYS_03',
    color: '#00ffff',
    speech: 'Show me around initiates our autonomous Guided Tour. Follow our mobile robot as it escorts visitors through key facility checkpoints.',
    bullets: ['Multi-Stop Waypoint Navigation', 'Live Voice Narrated Waypoints', 'Hands-Free Visitor Escort'],
  },
  facilities: {
    title: 'Public Facilities & Directory',
    badge: 'SYS_04',
    color: '#00ffff',
    speech: 'Public Facilities provides a complete interactive directory of conference halls, labs, rest zones, and office locations.',
    bullets: ['Interactive Floor Directory', 'Live Status & Availability', 'Step-by-step Room Guidance'],
  },
  face: {
    title: 'Facial Vision & Smart Greetings',
    badge: 'SYS_02',
    color: '#00ffff',
    speech: 'Face Greetings uses camera vision to detect approaching visitors, recognize registered faces, and deliver personalized audio greetings.',
    bullets: ['High-speed Local Face Matching', 'Emotion & Expression Reflex', 'Automated Visitor Welcoming'],
  },
  control: {
    title: 'Robot Teleoperation & Hardware Cockpit',
    badge: 'SYS_07',
    color: '#00ffff',
    speech: 'Robot Control Cockpit gives direct access to our ROS 2 motors, multi-axis servos, camera pan-tilt, and telemetry.',
    bullets: ['ROS 2 Teleoperation Grid', 'Head Pan-Tilt & Arm Articulation', 'Real-time ESP32 Serial Telemetry'],
  },
  pdf: {
    title: 'Interactive PDF Document AI',
    badge: 'SYS_08',
    color: '#00ffff',
    speech: 'PDF AI allows visitors and staff to converse with complex documents, research whitepapers, and brochures through AI.',
    bullets: ['On-device Document Ingestion', 'Semantic PDF Search', 'Instant Citation Q&A'],
  },
  testing: {
    title: 'Testing & Diagnostic Interactive Lab',
    badge: 'SYS_09',
    color: '#00ffff',
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

  return <span className="telem-fps-top-num">{val}</span>;
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

export default function SliderAndCards({ onNavigate, onOpenAdmin, isAdminOpen, showCardsInitially = false, onToggleView }) {
  const [slides, setSlides] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(!showCardsInitially);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('AURRA 4.0');
  const [devSettings, setDevSettings] = useState(devSettingsService.getSettings());
  const [espState, setEspState] = useState(esp32Service.getState());

  // Dynamic Feature Spotlight Deck state (Always-moving feature explanation on Home Screen)
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Real-time voice listening state for Constellation Core frequency animation
  const [isVoiceListening, setIsVoiceListening] = useState(() => Boolean(voiceNavigationService?.isListening));
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);

  useEffect(() => {
    const unsubVoiceState = voiceNavigationService.subscribe((vState) => {
      if (vState.isListening !== undefined) {
        setIsVoiceListening(Boolean(vState.isListening));
      }
      if (vState.isSpeaking !== undefined) {
        setIsVoiceSpeaking(Boolean(vState.isSpeaking));
      }
    });
    return () => unsubVoiceState();
  }, []);

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
  const idleTimerRef = useRef(null);
  const isFsVoiceOpenRef = useRef(false);
  const lastSliderTapRef = useRef(0);

  // GSAP refs for morph-in animation targets
  const orbitalLayoutRef = useRef(null);
  const coreOrbRef = useRef(null);

  const satelliteNodesRef = useRef([]);
  const orbTrackRingsRef = useRef([]);
  const morphInTlRef = useRef(null);
  const cardsRef = useRef(cards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Auto-cycle the Feature Spotlight Deck on the Home Screen every 4.5 seconds
  useEffect(() => {
    if (showSlider || isExplainMode || !cards || cards.length === 0) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % cards.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [showSlider, isExplainMode, cards]);

  // Track Fullscreen Voice state to prevent idle interrupt while voice interaction is active
  useEffect(() => {
    const handleFsOpen = () => { isFsVoiceOpenRef.current = true; };
    const handleFsClose = () => { isFsVoiceOpenRef.current = false; };
    window.addEventListener('aurra_open_fullscreen_voice', handleFsOpen);
    window.addEventListener('aurra_close_fullscreen_voice', handleFsClose);
    return () => {
      window.removeEventListener('aurra_open_fullscreen_voice', handleFsOpen);
      window.removeEventListener('aurra_close_fullscreen_voice', handleFsClose);
    };
  }, []);

  // ── Auto-return to Ads Card / Slideshow after 1 minute of inactivity on the main page ──
  useEffect(() => {
    // Only track idle inactivity when on the main cards view (not already on the ads card)
    if (showSlider) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute (60,000ms)

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        // Guard: Don't trigger if admin modal, auth modal, logs, or fullscreen voice are open
        if (isAdminOpen || isAuthModalOpen || isLogsOpen || isFsVoiceOpenRef.current) {
          resetIdleTimer();
          return;
        }

        // Guard: Don't trigger if voice is actively speaking or speech synthesis is busy
        if (window.speechSynthesis?.speaking) {
          resetIdleTimer();
          return;
        }

        logger.info('IDLE', 'No interaction for 1 minute on main page; showing ads card automatically.');
        if (isExplainMode) {
          setIsExplainMode(false);
        }
        setShowSlider(true);
        onToggleView?.(true);
      }, IDLE_TIMEOUT_MS);
    };

    // Arm the 1-minute timer immediately upon viewing cards
    resetIdleTimer();

    // Throttled user activity listener (tap, click, mousemove, keydown, wheel)
    let lastActivity = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 400) return;
      lastActivity = now;
      resetIdleTimer();
    };

    const userEvents = ['pointerdown', 'touchstart', 'click', 'keydown', 'wheel'];
    userEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Also reset timer whenever user interacts via voice commands
    const unsubVoice = voiceNavigationService.subscribe((vState) => {
      if (vState.transcript || vState.isSpeaking || vState.isThinking) {
        resetIdleTimer();
      }
    });

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      userEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      unsubVoice();
    };
  }, [showSlider, isAdminOpen, isAuthModalOpen, isLogsOpen, isExplainMode]);

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

      const coreEl = coreOrbRef.current;
      const satellites = satelliteNodesRef.current.filter(Boolean);
      const trackRings = orbTrackRingsRef.current.filter(Boolean);

      // If elements not in DOM yet, do nothing (CSS keeps them cleanly visible)
      if (!coreEl && satellites.length === 0) return;

      const tl = gsap.timeline();
      morphInTlRef.current = tl;

      // Central core Ask Aurra sphere stabilizes and pulses
      if (coreEl) {
        tl.fromTo(coreEl,
          { scale: 0.85, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.4)', clearProps: 'transform,opacity' },
          0.04
        );
      }

      // Orbital track rings expand into place
      trackRings.forEach((el, i) => {
        tl.fromTo(el,
          { scale: 0.75, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' },
          0.06 + i * 0.05
        );
      });

      // Satellite cards bloom outward cleanly at their orbital slots
      if (satellites.length > 0) {
        tl.fromTo(satellites,
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(1.2)', clearProps: 'transform,opacity' },
          0.08
        );
      }
    };

    if (showCardsInitially || (typeof window !== 'undefined' && window.location.search.includes('view=cards'))) {
      setShowSlider(false);
    } else {
      setShowSlider(true);
    }

    let morphTimer = null;
    const scheduleMorphIn = () => {
      setShowSlider(false);
      setIsExplainMode(false);
      onToggleView?.(false);
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
      onToggleView?.(true);
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
      if (header?.headerName && header.headerName !== 'Robomiracle Technologies Private Limited') {
        setHeaderTitle(header.headerName);
      } else {
        setHeaderTitle('AURRA 4.0');
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

  // ── Seamless In-Place Mode Switch ──
  const handleStartExplain = useCallback(() => {
    if (isExplainMode) return;
    setShowSlider(false);
    setIsExplainMode(true);
    setExplainIndex(0);
    setIsAutoPlaying(true);
    onToggleView?.(false);
  }, [isExplainMode, onToggleView]);

  handleStartExplainRef.current = handleStartExplain;

  const handleExitExplain = useCallback(() => {
    voiceNavigationService.cancelSpeech();
    if (explainTimerRef.current) clearTimeout(explainTimerRef.current);
    setIsExplainMode(false);
    setShowSlider(false);
    onToggleView?.(false);
    // Smoothly animate constellation cards in
    window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
  }, [onToggleView]);

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

  const handleSliderDoubleTap = useCallback(() => {
    logger.info('HOME', 'Double tap on slider outer frame detected, entering main cards page');
    if (isExplainMode) setIsExplainMode(false);
    setShowSlider(false);
    onToggleView?.(false);
    window.dispatchEvent(new CustomEvent('aurra_show_cards'));
    window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
  }, [isExplainMode, onToggleView]);

  const handleSliderTap = (e) => {
    const now = Date.now();
    const diff = now - lastSliderTapRef.current;
    if (diff > 0 && diff < 450) {
      lastSliderTapRef.current = 0;
      handleSliderDoubleTap();
      return;
    }
    lastSliderTapRef.current = now;

    // Single click/tap behavior: unmute video if present
    const vid = e.currentTarget.querySelector('video');
    if (vid && activeSlide.isMuted !== true) {
      vid.muted = false;
      vid.volume = 1.0;
      vid.play().catch(() => { });
    }
  };

  return (
    <div className={`home-container ${isExplainMode ? 'in-explain-mode' : ''}`}>
      {/* Global SVG Gradients matching background (deep navy to ocean blue to cyan) */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0, width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="aurra-bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#092c4c" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#00c4db" />
          </linearGradient>
          <linearGradient id="aurra-constellation-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#092c4c" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#00c4db" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Cyber Telemetry Header Bar */}
      <header
        ref={kioskTopBarRef}
        className="kiosk-top-bar"
      >
        {/* Left: Cyber Brand Badge */}
        <div
          className="cyber-brand-badge"
          onClick={handleHeadingTap}
          title="Aurra System (Tap 4 times to access Admin)"
        >
          <div className="brand-robot-icon">
            <Bot size={22} color="#00ffff" />
          </div>
          <div className="brand-text-col">
            <div className="brand-title">{(!headerTitle || headerTitle === 'Robomiracle Technologies Private Limited' || headerTitle === 'AURRA 4.0' || headerTitle === 'AURRA') ? 'AURRA' : headerTitle.replace(/\s*4\.0/gi, '').trim()}</div>
          </div>
        </div>

        {/* Right: Real-Time Clock */}
        <div className="cyber-top-right-group">
          <LiveClockTelemetry />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="kiosk-main-content">
        {showSlider ? (
          /* SLIDESHOW BANNER VIEW */
          <div
            className="slider-outer-frame"
            onClick={handleSliderTap}
            onDoubleClick={handleSliderDoubleTap}
            onTouchEnd={(e) => {
              const now = Date.now();
              const diff = now - lastSliderTapRef.current;
              if (diff > 0 && diff < 450) {
                lastSliderTapRef.current = 0;
                handleSliderDoubleTap();
              } else {
                lastSliderTapRef.current = now;
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
                              videoEl.play().catch(() => { });
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
                          <h2 className="explain-card-title matched-feature-word">{activeCard.title}</h2>
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
            {/* Planetary Orbital Constellation (Centered) */}
            <div className="constellation-column">
              <div className="constellation-canvas">
                {/* Visual Orbit Tracks */}
                <div ref={el => { if (el) orbTrackRingsRef.current[0] = el; }} className="orbital-track-ring track-outer"></div>
                <div ref={el => { if (el) orbTrackRingsRef.current[1] = el; }} className="orbital-track-ring track-inner"></div>

                {/* Central Core Sphere: Ask Aurra */}
                <div
                  ref={coreOrbRef}
                  className={`constellation-core-orb ${isVoiceListening ? 'is-listening' : ''} ${isVoiceSpeaking ? 'is-speaking' : ''}`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
                    voiceNavigationService.speak('I am Aurra, how can I help you today?');
                  }}
                  title={isVoiceListening ? "Aurra is Listening (Tap to Talk)" : "Ask Aurra Voice Core (Tap to Talk)"}
                >
                  <div className="core-robot-face-wrapper">
                    <div className="core-robot-head-container">
                      {/* Aurra Robot Head with Face Visor */}
                      <img
                        src="/aurra_core_robot_eyeless.png"
                        alt="Aurra Robot"
                        className="core-robot-face-img"
                      />

                      {/* Wave Frequency Animation directly inside the Robo Eyes */}
                      <div className={`core-robot-eyes-wave-overlay ${isVoiceListening ? 'is-listening' : 'is-idle'} ${isVoiceSpeaking ? 'is-speaking' : ''}`}>
                        {/* Left Eye Frequency Spectrum Cluster */}
                        <div className="core-eye-spectrum left-eye-spectrum">
                          {[
                            { min: 5, mid: 18, max: 10, delay: 0.0 },
                            { min: 7, mid: 24, max: 14, delay: 0.08 },
                            { min: 9, mid: 28, max: 18, delay: 0.16 },
                            { min: 10, mid: 30, max: 20, delay: 0.24 },
                            { min: 8, mid: 25, max: 15, delay: 0.12 },
                            { min: 6, mid: 19, max: 11, delay: 0.04 },
                          ].map((bar, i) => (
                            <span
                              key={`l-${i}`}
                              className="core-eye-bar"
                              style={{
                                '--bar-min': `${bar.min}px`,
                                '--bar-mid': `${bar.mid}px`,
                                '--bar-max': `${bar.max}px`,
                                '--anim-delay': `${bar.delay}s`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Right Eye Frequency Spectrum Cluster */}
                        <div className="core-eye-spectrum right-eye-spectrum">
                          {[
                            { min: 4, mid: 12, max: 7, delay: 0.06 },
                            { min: 6, mid: 16, max: 9, delay: 0.18 },
                            { min: 5, mid: 13, max: 8, delay: 0.1 },
                          ].map((bar, i) => (
                            <span
                              key={`r-${i}`}
                              className="core-eye-bar"
                              style={{
                                '--bar-min': `${bar.min}px`,
                                '--bar-mid': `${bar.mid}px`,
                                '--bar-max': `${bar.max}px`,
                                '--anim-delay': `${bar.delay}s`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Visor Cyber Laser Horizon Filament */}
                        <div className="core-eyes-laser-line"></div>
                      </div>
                    </div>
                  </div>
                  <div className="core-orb-title">
                    {isVoiceListening ? 'Listening...' : 'Ask Aurra'}
                  </div>
                  <div className={`core-breathing-aura ${isVoiceListening ? 'is-listening' : ''}`}></div>
                </div>

                {/* Orbiting Satellite Glass Spheres */}
                {cards.map((card, idx) => {
                  const theme = getOrbTheme(card.href, idx, card);
                  const total = cards.length || 1;
                  const slot = getBubbleSlot(idx, total);
                  const isSpotlightActive = idx === spotlightIndex;

                  return (
                    <div
                      key={card.id || idx}
                      ref={el => { satelliteNodesRef.current[idx] = el; }}
                      className={`satellite-orb-node ${isSpotlightActive ? 'spotlight-active-node' : ''} ${slot.size >= 130 ? 'prominent-larger-orb' : ''}`}
                      style={{
                        '--node-idx': idx,
                        '--orb-x': `${slot.x}px`,
                        '--orb-y': `${slot.y}px`,
                        '--push-x': `${slot.pushX || 0}px`,
                        '--push-y': `${slot.pushY || 0}px`,
                        '--bob-x': `${slot.bobX || 0}px`,
                        '--bob-y': `${slot.bobY || 0}px`,
                        top: `calc(50% + ${slot.y}px)`,
                        left: `calc(50% + ${slot.x}px)`,
                        '--orb-size': `${slot.size}px`,
                        '--orb-font-size': `${slot.fontSize}px`,
                        '--orb-label-max': `${slot.labelMax}px`,
                        '--orb-color': theme.color,
                        '--orb-glow': theme.glow,
                        '--orb-bg': theme.bg,
                        '--orb-border': theme.border,
                        '--float-delay': `${(idx * 0.35).toFixed(2)}s`,
                      }}
                      onClick={() => {
                        setSpotlightIndex(idx);
                        handleCardClick(card);
                      }}
                      title={`Open ${card.title}`}
                    >
                      {/* Active Spotlight Holographic Beacon & Rings */}
                      {isSpotlightActive && (
                        <>
                          <div className="spotlight-active-pulse-ring ring-inner"></div>
                          <div className="spotlight-active-pulse-ring ring-outer"></div>
                          <div className={`spotlight-active-beacon ${slot.y > 10 ? 'beacon-bottom' : 'beacon-top'}`}>
                            <Sparkles size={10} color="#00ffff" />
                            <span>ACTIVE</span>
                          </div>
                        </>
                      )}

                      <div className="orb-gpu-bobber">
                        <div className="orb-icon-glyph">
                          {getCardIcon(card.href, card.className, slot.iconSize, 'url(#aurra-constellation-gradient)')}
                        </div>
                        <div className={`orb-label-text ${isSpotlightActive ? 'matched-feature-word active-label-glow' : 'inactive-label'}`}>
                          {theme.label || card.title}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom spacer for global floating voice bar (only when cards are showing) */}
      {!showSlider && <div className="bottom-global-voice-spacer"></div>}

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
