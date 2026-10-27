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

  // Dynamic Feature Spotlight Deck state (Always-moving feature explanation on Home Screen)
  const [spotlightIndex, setSpotlightIndex] = useState(0);

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

  // Auto-cycle the Feature Spotlight Deck on the Home Screen every 4.5 seconds
  useEffect(() => {
    if (showSlider || isExplainMode || !cards || cards.length === 0) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % cards.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [showSlider, isExplainMode, cards]);

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

      // If elements not in DOM yet, do nothing (CSS keeps them cleanly visible)
      if (!coreEl && satellites.length === 0) return;

      const tl = gsap.timeline();
      morphInTlRef.current = tl;

      // Hero system column glides in from left
      if (heroEl) {
        tl.fromTo(heroEl,
          { x: -50, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' },
          0
        );
      }

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

  // ── Seamless In-Place Mode Switch ──
  const handleStartExplain = useCallback(() => {
    if (isExplainMode) return;
    setShowSlider(false);
    setIsExplainMode(true);
    setExplainIndex(0);
    setIsAutoPlaying(true);
  }, [isExplainMode]);

  handleStartExplainRef.current = handleStartExplain;

  const handleExitExplain = useCallback(() => {
    voiceNavigationService.cancelSpeech();
    if (explainTimerRef.current) clearTimeout(explainTimerRef.current);
    setIsExplainMode(false);
    setShowSlider(false);
    // Smoothly animate constellation cards in
    window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
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
        className="kiosk-top-bar"
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

        {/* Center: Live Telemetry Cluster - Converted to Sleek Cyber Icons */}
        <div className="cyber-telemetry-cluster">
          {/* Serial Telemetry Icon */}
          <div 
            className={`hud-telem-icon-btn ${espState.online ? 'telem-online' : 'telem-offline'}`}
            title={`Serial ESP32 Hardware: ${espState.online ? (espState.mode === 'ap' ? 'ONLINE (AP)' : 'ONLINE (STA)') : 'OFFLINE'}`}
          >
            <Cpu size={16} />
            <span className="telem-dot"></span>
          </div>

          {/* Offline Dexie DB Icon */}
          <div 
            className="hud-telem-icon-btn telem-db"
            title="Offline Database: Dexie IndexedDB (Operational & Synced)"
          >
            <Database size={16} />
            <span className="telem-dot"></span>
          </div>

          {/* Camera & FPS Telemetry Icon with number alone */}
          <div 
            className="hud-telem-icon-btn telem-fps"
            title="Vision Camera & Display Engine: Live FPS"
          >
            <FpsTelemetry />
          </div>
        </div>

        {/* Right: Live Real-Time Clock & Action Icon Buttons */}
        <div className="cyber-top-right-group">
          {/* Explain Features Walkthrough Icon Button */}
          <button 
            className={`cyber-top-icon-btn ${isExplainMode ? 'active-tour' : ''}`}
            onClick={() => {
              if (isExplainMode) {
                handleExitExplain();
              } else {
                handleStartExplain();
              }
            }}
            title={isExplainMode ? 'Exit Explain Walkthrough' : 'Explain All Features (Voice Walkthrough)'}
          >
            <Sparkles size={16} color="#00ffff" />
          </button>

          {/* Action Cards / Features Grid Icon Button */}
          <button 
            className="cyber-top-icon-btn"
            onClick={() => {
              if (isExplainMode) setIsExplainMode(false);
              setShowSlider(false);
              window.dispatchEvent(new CustomEvent('aurra_show_cards'));
              window.dispatchEvent(new CustomEvent('aurra_morph_cards_in'));
            }}
            title="View Features & Action Cards"
          >
            <LayoutGrid size={16} color="#00ffff" />
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
            {/* Left: Hero System Feature Spotlight Column */}
            <div ref={heroColRef} className="hero-system-column">
              {/* Dynamic Feature Spotlight Rectangle (Clean & Minimal) */}
              {(() => {
                const spotlightCard = cards[spotlightIndex] || cards[0];
                if (!spotlightCard) return null;
                const spotlightTheme = getOrbTheme(spotlightCard.href, spotlightIndex, spotlightCard);
                const spotlightExp = getFeatureExplanation(spotlightCard) || {
                  title: spotlightCard.title,
                  speech: spotlightCard.subtitle || 'Autonomous robot smart module.',
                };

                return (
                  <div className="hero-feature-spotlight-card">
                    {/* Top Bar: Progress & Nav */}
                    <div className="spotlight-card-topbar">
                      <div className="spotlight-sys-tag">
                        <span className="live-dot-pulse"></span>
                        <span className="spotlight-step-text">FEATURE {(spotlightIndex + 1).toString().padStart(2, '0')} / {cards.length.toString().padStart(2, '0')}</span>
                      </div>
                      
                      {/* Manual prev/next navigation arrows */}
                      <div className="spotlight-nav-controls">
                        <button
                          type="button"
                          className="spotlight-arrow-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpotlightIndex((prev) => (prev - 1 + cards.length) % cards.length);
                          }}
                          title="Previous Feature"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="spotlight-arrow-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpotlightIndex((prev) => (prev + 1) % cards.length);
                          }}
                          title="Next Feature"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    {/* Spotlight Visual Presentation - Title matches active node word color */}
                    <div className="spotlight-card-content" key={spotlightCard.id || spotlightIndex}>
                      <div className="spotlight-title-row">
                        <div className="spotlight-icon-box">
                          {getCardIcon(spotlightCard.href, spotlightCard.className, 24, '#00ffff')}
                        </div>
                        <div className="spotlight-title-col">
                          <h2 className="spotlight-card-title matched-feature-word">{spotlightCard.title}</h2>
                          <div className="spotlight-card-sub">{spotlightCard.subtitle || 'Kiosk Service'}</div>
                        </div>
                      </div>

                      <p className="spotlight-card-desc">
                        {spotlightExp.speech}
                      </p>
                    </div>

                    {/* Visual Bottom Action Row */}
                    <div className="spotlight-card-footer">
                      <button 
                        className="spotlight-launch-btn"
                        onClick={() => handleCardClick(spotlightCard)}
                        title={`Open ${spotlightCard.title}`}
                      >
                        <Play size={12} fill="#00ffff" color="#00ffff" />
                        <span>Open</span>
                        <ChevronRight size={14} />
                      </button>

                      <div className="spotlight-dots-indicator">
                        {cards.map((_, i) => (
                          <span 
                            key={i} 
                            className={`spotlight-dot ${i === spotlightIndex ? 'active' : ''}`}
                            onClick={() => setSpotlightIndex(i)}
                            title={`Jump to ${cards[i]?.title}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

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

                {/* Central Core Sphere: Ask Aurra */}
                <div 
                  ref={coreOrbRef}
                  className="constellation-core-orb"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
                    voiceNavigationService.speak('I am Aurra, how can I help you today?');
                  }}
                  title="Ask Aurra Voice Core (Tap to Talk)"
                >
                  <div className="core-mic-halo">
                    <Mic size={36} color="#00ffff" />
                  </div>
                  <div className="core-orb-title">Ask Aurra</div>
                  <div className="core-breathing-aura"></div>
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
                      className={`satellite-orb-node ${isSpotlightActive ? 'spotlight-active-node' : ''}`}
                      style={{
                        '--node-idx': idx,
                        '--orb-x': `${slot.x}px`,
                        '--orb-y': `${slot.y}px`,
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
                            <Sparkles size={10} color="#000" />
                            <span>ACTIVE</span>
                          </div>
                        </>
                      )}

                      <div className="orb-gpu-bobber">
                        <div className="orb-icon-glyph">
                          {getCardIcon(card.href, card.className, slot.iconSize, '#00ffff')}
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
