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
  FlaskConical
} from 'lucide-react';
import { offlineCardService, offlineSliderService, offlineBrandingService } from '../../db/offlineServices';
import { logger } from '../../services/logger';
import { devSettingsService } from '../../services/devSettingsService';
import AdminAuthModal from '../../components/AdminAuthModal';
import { LogViewerModal } from '../../components/LogViewerModal';
import { esp32Service } from '../../services/esp32Service';
import './SliderAndCards.css';

// Feature Icon Resolver
const getCardIcon = (href, className) => {
  if (href?.includes('form')) return <FileText size={28} color="#00ffff" />;
  if (href?.includes('qa')) return <HelpCircle size={28} color="#00ffff" />;
  if (href?.includes('tour')) return <Compass size={28} color="#00ffff" />;
  if (href?.includes('facilities')) return <Building2 size={28} color="#00ffff" />;
  if (href?.includes('face') || href?.includes('greet')) return <Camera size={28} color="#00ffff" />;
  if (href?.includes('control')) return <Sliders size={28} color="#00ffff" />;
  if (href?.includes('testing-interaction')) return <FlaskConical size={28} color="#f59e0b" />;
  if (href?.includes('interaction')) return <Eye size={28} color="#00ffff" />;
  if (href?.includes('web')) return <Globe size={28} color="#00ffff" />;
  if (href?.includes('hardware')) return <Activity size={28} color="#00ffff" />;
  return <Sparkles size={28} color="#00ffff" />;
};

export default function SliderAndCards({ 
  onNavigate, 
  showCardsInitially = false,
  isAdminOpen = false,
  onOpenAdmin,
  onCloseAdmin 
}) {
  const [headerTitle, setHeaderTitle] = useState('Robomiracle Technologies Private Limited');
  const [slides, setSlides] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(!showCardsInitially);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [devSettings, setDevSettings] = useState(devSettingsService.getSettings());
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [fps, setFps] = useState(60);
  const [espState, setEspState] = useState(esp32Service.getState());

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
    if (showCardsInitially) {
      setShowSlider(false);
    }
  }, [showCardsInitially]);

  // ── 90 FPS Telemetry Counter ──
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId = null;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, []);

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
  }, [loadKioskData]);

  // ── Auto-cycle Banner Slideshow ──
  useEffect(() => {
    if (!showSlider || slides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [showSlider, slides.length]);

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
      {/* HUD Futuristic Framing Accents */}
      <div className="hud-corner-tag top-left">&gt;&gt; ROBOMIRACLE_AURRA_v2 &lt;&lt;</div>
      <div className="hud-corner-tag top-right">STATUS: OPERATIONAL</div>
      <div className="hud-corner-tag bottom-left">FPS: {fps} | HELIO_G100</div>
      <div className="hud-corner-tag bottom-right">VOICE_ENGINE: ACTIVE</div>

      {/* Top Cyber Header Bar - Center Holographic Capsule */}
      <header className="kiosk-top-bar">
        <div
          className="cyber-header-wrapper"
          onClick={handleHeadingTap}
          title="Aurra Kiosk Heading (Tap 4 times to access Admin)"
        >
          <h1 className="cyber-heading-text">{headerTitle}</h1>
        </div>

        {/* Live FPS Telemetry Pill & ESP32 Wi-Fi Pill (Corner) */}
        {devSettings.showFpsBadge !== false && (
          <div className="top-right-telemetry">
            <div 
              className={`hud-metric-pill esp-wifi-pill ${espState.online ? (espState.mode === 'ap' ? 'ap-mode' : 'sta-mode') : 'sim-mode'}`}
              title={espState.online ? espState.connectionDetail : 'ESP32 Simulation Mode'}
            >
              <Wifi size={11} />
              <span style={{ fontSize: '10px', fontWeight: 700 }}>
                {espState.online 
                  ? (espState.mode === 'ap' ? 'AP' : 'STA')
                  : 'SIM'}
              </span>
              {espState.online && espState.latency && (
                <span style={{ fontSize: '9px', opacity: 0.7 }}>{espState.latency}ms</span>
              )}
            </div>
            <div className="hud-metric-pill" title="Live Screen Refresh Rate">
              <span className="pill-dot"></span>
              <strong>{fps} FPS</strong>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="kiosk-main-content">
        {showSlider ? (
          /* SLIDESHOW BANNER VIEW */
          <div className="slider-outer-frame" onDoubleClick={() => setShowSlider(false)}>
            <div className="slider-viewport">
              {activeSlide.url ? (
                <img
                  src={activeSlide.url}
                  alt={activeSlide.title}
                  className="slide-image"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
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
          /* ACTION CARDS GRID VIEW */
          <div className="cards-scroll-container">
            <div className="cards-grid">
              {cards.map((card) => {
                const isVoiceEnabled = card.voiceAccessEnabled !== false;

                return (
                  <div
                    key={card.id}
                    className="action-card-tile"
                    onClick={() => handleCardClick(card)}
                  >
                    {/* Voice Access Status Badge on Card */}
                    <div 
                      className={`card-voice-pill ${isVoiceEnabled ? 'voice-on' : 'voice-off'}`}
                      title={isVoiceEnabled ? 'Voice navigation enabled' : 'Voice navigation blocked by Admin'}
                    >
                      {isVoiceEnabled ? <Mic size={12} /> : <MicOff size={12} />}
                      <span>{isVoiceEnabled ? 'VOICE ON' : 'VOICE OFF'}</span>
                    </div>

                    {/* Card Icon */}
                    <div className="card-icon-pedestal">
                      {getCardIcon(card.href, card.className)}
                    </div>

                    {/* Card Titles */}
                    <h3 className="card-title-text">{card.title}</h3>
                    <p className="card-subtitle-text">{card.subtitle}</p>

                    {/* Glowing bottom projection bar */}
                    <div className="card-neon-floor"></div>
                  </div>
                );
              })}
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
