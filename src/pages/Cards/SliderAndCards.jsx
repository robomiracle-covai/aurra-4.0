import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Database
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
    { x: 0, y: -136, size: 116, iconSize: 26, fontSize: 11, labelMax: 92 },
    { x: 114, y: -90, size: 124, iconSize: 28, fontSize: 11.5, labelMax: 98 },
    { x: 142, y: 32, size: 114, iconSize: 24, fontSize: 10.5, labelMax: 88 },
    { x: 62, y: 130, size: 104, iconSize: 22, fontSize: 10, labelMax: 84 },
    { x: -62, y: 130, size: 100, iconSize: 22, fontSize: 10, labelMax: 82 },
    { x: -140, y: 32, size: 118, iconSize: 26, fontSize: 11, labelMax: 90 },
    { x: -114, y: -90, size: 112, iconSize: 24, fontSize: 10.5, labelMax: 86 },
    { x: 218, y: -12, size: 102, iconSize: 22, fontSize: 10, labelMax: 80 },
  ],
};

const getBubbleSlot = (idx, total) => {
  const config = CLUSTER_CONFIGS[total] || CLUSTER_CONFIGS[6];
  if (config && config[idx]) return config[idx];
  const angleDeg = (idx / total) * 360 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round(140 * Math.cos(angleRad)),
    y: Math.round(140 * Math.sin(angleRad)),
    size: 112,
    iconSize: 24,
    fontSize: 10.5,
    labelMax: 88,
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
  const [isMorphingIn, setIsMorphingIn] = useState(false);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

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
    if (showCardsInitially || (typeof window !== 'undefined' && window.location.search.includes('view=cards'))) {
      setShowSlider(false);
    }

    const handleShowCards = () => {
      setShowSlider(false);
      setIsMorphingIn(true);
      setTimeout(() => setIsMorphingIn(false), 1200);
    };
    const handleMorphCardsIn = () => {
      setShowSlider(false);
      setIsMorphingIn(true);
      setTimeout(() => setIsMorphingIn(false), 1200);
    };
    const handleShowSlider = () => {
      setShowSlider(true);
      setIsMorphingIn(false);
    };

    window.addEventListener('aurra_show_cards', handleShowCards);
    window.addEventListener('aurra_show_features', handleShowCards);
    window.addEventListener('aurra_morph_cards_in', handleMorphCardsIn);
    window.addEventListener('aurra_show_slider', handleShowSlider);

    return () => {
      window.removeEventListener('aurra_show_cards', handleShowCards);
      window.removeEventListener('aurra_show_features', handleShowCards);
      window.removeEventListener('aurra_morph_cards_in', handleMorphCardsIn);
      window.removeEventListener('aurra_show_slider', handleShowSlider);
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
    <div className="home-container">
      {/* Top Cyber Telemetry Header Bar */}
      <header className="kiosk-top-bar">
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

        {/* Right: Live Real-Time Clock */}
        <LiveClockTelemetry />
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
        ) : (
          /* AURRA 4.0 ORBITAL CONSTELLATION VIEW */
          <div className={`orbital-home-layout ${isMorphingIn ? 'is-morphing-in' : ''}`}>
            {/* Left: Hero System Highlight Command Deck */}
            <div className="hero-system-column">
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
                    voiceNavigationService.speak('I am listening. Ask any question or command.');
                    voiceNavigationService.startListening();
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
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
                <div className="orbital-track-ring track-outer"></div>
                <div className="orbital-track-ring track-inner"></div>

                {/* Central Core Sphere: Ask Aurra (SYS_01) */}
                <div 
                  className="constellation-core-orb"
                  onClick={() => {
                    voiceNavigationService.speak('I am Aurra, how can I help you today?');
                    voiceNavigationService.startListening();
                    window.dispatchEvent(new CustomEvent('aurra_open_fullscreen_voice'));
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
