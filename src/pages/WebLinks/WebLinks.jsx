import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Globe,
  QrCode,
  ExternalLink,
  BookOpen,
  Share2,
  Copy,
  Check,
  Search,
  Sparkles,
  Maximize2,
  X,
  Volume2,
  VolumeX,
  Smartphone,
  ShieldCheck,
  Layers,
  Cpu,
  Tv,
  Eye,
  FileText,
  MessageCircle,
  Video
} from 'lucide-react';
import { OFFICIAL_WEBLINKS, BROCHURE_SECTIONS } from './weblinksData';
import { offlineWebLinksService } from '../../db/offlineServices';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { logger } from '../../services/logger';
import './WebLinks.css';

export default function WebLinks({ onNavigate }) {
  const [weblinks, setWeblinks] = useState(OFFICIAL_WEBLINKS);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState({});
  const [highContrastMode, setHighContrastMode] = useState(false);
  
  // Modals state
  const [activeQrModal, setActiveQrModal] = useState(null);
  const [isBrochureOpen, setIsBrochureOpen] = useState(false);
  const [activeBrochureTab, setActiveBrochureTab] = useState('overview');
  
  // Custom QR tool state
  const [customQrText, setCustomQrText] = useState('https://robomiracle.com');
  const [customQrUrl, setCustomQrUrl] = useState('');
  
  // Feedback state
  const [copiedId, setCopiedId] = useState(null);
  const [isVoiceSpoken, setIsVoiceSpoken] = useState(false);

  // Load links from IndexedDB
  const loadLinks = async () => {
    try {
      const items = await offlineWebLinksService.getWebLinks();
      if (items && items.length > 0) {
        const enabled = items.filter((item) => item.isEnabled !== false);
        setWeblinks(enabled.length > 0 ? enabled : items);
      }
    } catch (e) {
      console.warn('Failed loading weblinks from DB:', e);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  // Generate QR codes for all links
  useEffect(() => {
    let isCancelled = false;

    const generateCodes = async () => {
      const generated = {};
      const fgColor = highContrastMode ? '#000000' : '#00ffff';
      const bgColor = highContrastMode ? '#ffffff' : '#030c17';

      for (const item of weblinks) {
        try {
          const dataUrl = await QRCode.toDataURL(item.url, {
            width: 280,
            margin: 1.5,
            color: {
              dark: fgColor,
              light: bgColor,
            },
            errorCorrectionLevel: 'M',
          });
          generated[item.id] = dataUrl;
        } catch (err) {
          logger.error('WEBLINKS', `Failed generating QR for ${item.id}: ${err.message}`);
        }
      }

      if (!isCancelled) {
        setQrCodeDataUrls(generated);
      }
    };

    generateCodes();

    return () => {
      isCancelled = true;
    };
  }, [weblinks, highContrastMode]);

  // Generate Custom QR code
  useEffect(() => {
    if (!customQrText.trim()) return;
    const fgColor = highContrastMode ? '#000000' : '#00ffff';
    const bgColor = highContrastMode ? '#ffffff' : '#030c17';

    QRCode.toDataURL(customQrText.trim(), {
      width: 320,
      margin: 1.5,
      color: {
        dark: fgColor,
        light: bgColor,
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setCustomQrUrl(url))
      .catch((err) => logger.warn('WEBLINKS', `Custom QR error: ${err.message}`));
  }, [customQrText, highContrastMode]);

  // Spoken narration on initial entry
  useEffect(() => {
    const welcomeMsg = 'Welcome to Robomiracle digital hub. You can scan any of these high-contrast holographic QR codes on your smartphone to access our website, videos, and product brochure.';
    logger.speech('WEBLINKS', 'Aurra speaking digital hub overview');
    
    speakWithVoice(welcomeMsg);
    setIsVoiceSpoken(true);

    return () => {
      // Clean up TTS if navigating away
      cancelSpeech();
    };
  }, []);

  const handleSpeakOverview = () => {
    const msg = 'Scan any QR code on this screen with your smartphone camera to instantly open Robomiracle links on your mobile device, or tap Open In Kiosk to read the brochure here.';
    speakWithVoice(msg);
  };

  const handleCopyLink = (item) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(item.url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
      logger.info('WEBLINKS', `Copied link: ${item.url}`);
    }
  };

  const handleOpenLink = (url) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      logger.info('WEBLINKS', `Opened external URL: ${url}`);
    } catch {
      window.location.href = url;
    }
  };

  // Filter links
  const filteredLinks = weblinks.filter((item) => {
    const matchCat = activeCategory === 'ALL' || item.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      !query ||
      item.title.toLowerCase().includes(query) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.displayUrl && item.displayUrl.toLowerCase().includes(query));
    return matchCat && matchQuery;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'web':
        return <Globe size={18} />;
      case 'brochure':
        return <BookOpen size={18} />;
      case 'media':
        return <Video size={18} />;
      case 'social':
        return <Share2 size={18} />;
      case 'tech':
        return <Cpu size={18} />;
      case 'contact':
        return <MessageCircle size={18} />;
      default:
        return <Globe size={18} />;
    }
  };

  return (
    <div className="weblinks-container">
      {/* HUD Corner Telemetry Tags */}
      <div className="hud-corner-tag top-left">&gt;&gt; ROBOMIRACLE_DIGITAL_HUB &lt;&lt;</div>
      <div className="hud-corner-tag top-right">PORTALS: ONLINE</div>
      <div className="hud-corner-tag bottom-left">SECURE_QR: V3_OFFLINE</div>
      <div className="hud-corner-tag bottom-right">WQXGA_OPTIMIZED</div>

      {/* Cyber Header Bar */}
      <header className="weblinks-header-bar">
        <button
          className="weblinks-back-btn"
          onClick={() => onNavigate?.('/')}
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
          <span>Home</span>
        </button>

        <div className="weblinks-title-center">
          <div className="weblinks-badge-pill">
            <Sparkles size={14} color="#00ffff" />
            <span>OFFICIAL ROBOMIRACLE CHANNELS</span>
          </div>
          <h1 className="weblinks-main-title">Digital Hub &amp; Scannable Portals</h1>
          <p className="weblinks-subtitle">
            Point your smartphone camera at any holographic QR code to open instantly on your mobile device
          </p>
        </div>

        <div className="weblinks-header-actions">
          {/* Audio narration button */}
          <button
            className="weblinks-action-icon-btn"
            onClick={handleSpeakOverview}
            title="Listen to Aurra spoken guide"
          >
            <Volume2 size={18} color="#00ffff" />
          </button>

          {/* High-contrast QR switch (Crucial for kiosk scanning under different lighting) */}
          <button
            className={`weblinks-contrast-toggle ${highContrastMode ? 'active' : ''}`}
            onClick={() => setHighContrastMode(!highContrastMode)}
            title="Toggle high-contrast white QR background for faster phone scanning"
          >
            <QrCode size={18} />
            <span>{highContrastMode ? 'Inverted (White)' : 'Cyber (Cyan)'}</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <section className="weblinks-toolbar-section">
        <div className="weblinks-search-wrap">
          <Search size={18} color="#00D5FF" />
          <input
            type="text"
            className="weblinks-search-input"
            placeholder="Search portals, brochure, demos, or support..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="weblinks-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="weblinks-filter-pills">
          {[
            { id: 'ALL', label: 'All Portals' },
            { id: 'web', label: 'Official Web' },
            { id: 'brochure', label: 'Brochure' },
            { id: 'media', label: 'Videos & Demos' },
            { id: 'social', label: 'LinkedIn' },
            { id: 'tech', label: 'Developer SDK' },
            { id: 'contact', label: 'Reception Concierge' },
          ].map((cat) => (
            <button
              key={cat.id}
              className={`weblinks-filter-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main Portals Grid */}
      <main className="weblinks-main-content">
        <div className="weblinks-grid">
          {filteredLinks.map((item) => {
            const qrImage = qrCodeDataUrls[item.id];

            return (
              <div
                key={item.id}
                className="weblink-card"
                style={{ '--accent-color': item.accentColor }}
              >
                {/* Header Row: Category Badge & Direct Tag */}
                <div className="weblink-card-top">
                  <div className="weblink-category-tag">
                    {getCategoryIcon(item.category)}
                    <span>{item.tag}</span>
                  </div>
                  <span className="weblink-status-badge">{item.badge}</span>
                </div>

                {/* QR Code Presentation Box */}
                <div className="weblink-qr-container">
                  <div
                    className={`weblink-qr-frame ${highContrastMode ? 'contrast-white' : ''}`}
                    onClick={() => setActiveQrModal(item)}
                    title="Tap to enlarge QR code for quick scanning"
                  >
                    {/* Laser scan animation line */}
                    <div className="weblink-laser-bar"></div>

                    {/* Corner Reticle Accents */}
                    <div className="qr-reticle top-left" />
                    <div className="qr-reticle top-right" />
                    <div className="qr-reticle bottom-left" />
                    <div className="qr-reticle bottom-right" />

                    {qrImage ? (
                      <img
                        src={qrImage}
                        alt={`${item.title} QR Code`}
                        className="weblink-qr-image"
                      />
                    ) : (
                      <div className="weblink-qr-loading">
                        <QrCode size={48} color="#00ffff" />
                        <span>Rendering QR...</span>
                      </div>
                    )}

                    <div className="weblink-tap-to-expand">
                      <Maximize2 size={14} />
                      <span>TAP TO ENLARGE</span>
                    </div>
                  </div>

                  <div className="weblink-scan-helper">
                    <Smartphone size={14} color="#00D5FF" />
                    <span>Scan with Phone Camera</span>
                  </div>
                </div>

                {/* Information Body */}
                <div className="weblink-info-body">
                  <h3 className="weblink-title">{item.title}</h3>
                  <p className="weblink-subtitle">{item.subtitle}</p>
                  <p className="weblink-desc">{item.description}</p>
                  
                  <div className="weblink-url-display">
                    <Globe size={14} color="#00ffff" />
                    <span className="weblink-url-text">{item.displayUrl}</span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="weblink-card-actions">
                  {item.hasInKioskPreview && (
                    <button
                      className="weblink-btn-primary"
                      onClick={() => setIsBrochureOpen(true)}
                    >
                      <BookOpen size={16} />
                      <span>Read In Kiosk</span>
                    </button>
                  )}

                  <button
                    className="weblink-btn-action"
                    onClick={() => setActiveQrModal(item)}
                  >
                    <Maximize2 size={16} />
                    <span>Large QR</span>
                  </button>

                  <button
                    className="weblink-btn-action"
                    onClick={() => handleCopyLink(item)}
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check size={16} color="#00ff88" />
                        <span style={{ color: '#00ff88' }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    className="weblink-btn-action external"
                    onClick={() => handleOpenLink(item.url)}
                    title="Open external webpage"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Quick Custom Visitor QR Code Generator Card */}
          <div className="weblink-card custom-qr-card">
            <div className="weblink-card-top">
              <div className="weblink-category-tag">
                <Sparkles size={18} />
                <span>KIOSK UTILITY</span>
              </div>
              <span className="weblink-status-badge">Live Generator</span>
            </div>

            <div className="weblink-qr-container">
              <div className={`weblink-qr-frame ${highContrastMode ? 'contrast-white' : ''}`}>
                <div className="weblink-laser-bar"></div>
                <div className="qr-reticle top-left" />
                <div className="qr-reticle top-right" />
                <div className="qr-reticle bottom-left" />
                <div className="qr-reticle bottom-right" />

                {customQrUrl ? (
                  <img
                    src={customQrUrl}
                    alt="Custom QR Code"
                    className="weblink-qr-image"
                  />
                ) : (
                  <div className="weblink-qr-loading">
                    <QrCode size={48} color="#00ffff" />
                  </div>
                )}
              </div>
              <div className="weblink-scan-helper">
                <span>Instant Mobile Transfer</span>
              </div>
            </div>

            <div className="weblink-info-body">
              <h3 className="weblink-title">Custom QR Link Transfer</h3>
              <p className="weblink-desc">
                Type any URL or phone number to beam it directly to your mobile phone via scannable QR.
              </p>

              <div className="custom-qr-input-wrap">
                <input
                  type="text"
                  className="custom-qr-input"
                  placeholder="https://..."
                  value={customQrText}
                  onChange={(e) => setCustomQrText(e.target.value)}
                />
              </div>

              <div className="custom-qr-presets">
                <button
                  className="preset-btn"
                  onClick={() => setCustomQrText('https://robomiracle.com')}
                >
                  Robomiracle
                </button>
                <button
                  className="preset-btn"
                  onClick={() => setCustomQrText('https://maps.google.com/?q=Robomiracle+Technologies')}
                >
                  Google Map
                </button>
                <button
                  className="preset-btn"
                  onClick={() => setCustomQrText('tel:+919876543210')}
                >
                  Reception Tel
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── MODAL 1: Full-Screen Laser QR Scanner Modal ── */}
      {activeQrModal && (
        <div className="weblinks-modal-overlay" onClick={() => setActiveQrModal(null)}>
          <div
            className="weblinks-qr-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="weblinks-modal-close-btn"
              onClick={() => setActiveQrModal(null)}
              aria-label="Close QR Modal"
            >
              <X size={20} />
            </button>

            <div className="modal-header-pill">
              <Smartphone size={16} color="#00ffff" />
              <span>POINT PHONE CAMERA AT SCREEN</span>
            </div>

            <h2 className="modal-qr-title">{activeQrModal.title}</h2>
            <p className="modal-qr-subtitle">{activeQrModal.subtitle}</p>

            {/* Giant High-Res QR Display */}
            <div className={`modal-qr-display-box ${highContrastMode ? 'contrast-white' : ''}`}>
              <div className="modal-laser-sweep"></div>
              <div className="qr-reticle top-left" />
              <div className="qr-reticle top-right" />
              <div className="qr-reticle bottom-left" />
              <div className="qr-reticle bottom-right" />

              {qrCodeDataUrls[activeQrModal.id] && (
                <img
                  src={qrCodeDataUrls[activeQrModal.id]}
                  alt={activeQrModal.title}
                  className="modal-giant-qr-img"
                />
              )}
            </div>

            <div className="modal-qr-url-pill">
              <Globe size={16} color="#00ffff" />
              <span>{activeQrModal.url}</span>
            </div>

            <div className="modal-instructions-box">
              <ShieldCheck size={18} color="#00ff88" />
              <span>No app installation required. Works with standard camera on iOS &amp; Android.</span>
            </div>

            <div className="modal-actions-row">
              <button
                className="modal-btn-contrast"
                onClick={() => setHighContrastMode(!highContrastMode)}
              >
                <QrCode size={16} />
                <span>{highContrastMode ? 'Switch to Cyber Cyan' : 'High-Contrast White Mode'}</span>
              </button>

              <button
                className="modal-btn-primary"
                onClick={() => handleCopyLink(activeQrModal)}
              >
                {copiedId === activeQrModal.id ? (
                  <>
                    <Check size={16} color="#00ff88" />
                    <span>Copied Link</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: In-Kiosk Interactive Brochure Viewer ── */}
      {isBrochureOpen && (
        <div className="weblinks-modal-overlay" onClick={() => setIsBrochureOpen(false)}>
          <div
            className="weblinks-brochure-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <header className="brochure-modal-header">
              <div className="brochure-header-left">
                <div className="brochure-avatar-pill">
                  <BookOpen size={20} color="#00ffff" />
                </div>
                <div>
                  <h2 className="brochure-title">Robomiracle Technologies - Product Catalog</h2>
                  <span className="brochure-subtitle">Autonomous Humanoid Receptionist Architecture (Aurra 2.0)</span>
                </div>
              </div>

              <div className="brochure-header-actions">
                <button
                  className="brochure-close-btn"
                  onClick={() => setIsBrochureOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {/* Navigation Tabs */}
            <div className="brochure-tabs-bar">
              {BROCHURE_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  className={`brochure-tab-btn ${activeBrochureTab === sec.id ? 'active' : ''}`}
                  onClick={() => setActiveBrochureTab(sec.id)}
                >
                  {sec.id === 'overview' && <Globe size={16} />}
                  {sec.id === 'hardware' && <Cpu size={16} />}
                  {sec.id === 'features' && <Layers size={16} />}
                  <span>{sec.title.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Active Content Body */}
            <div className="brochure-tab-content">
              {BROCHURE_SECTIONS.filter((s) => s.id === activeBrochureTab).map((sec) => (
                <div key={sec.id} className="brochure-page-card">
                  <div className="brochure-section-badge">{sec.subtitle}</div>
                  <h3 className="brochure-section-heading">{sec.title}</h3>

                  <ul className="brochure-bullets-list">
                    {sec.bullets.map((bullet, idx) => (
                      <li key={idx} className="brochure-bullet-item">
                        <span className="bullet-cyan-check">✓</span>
                        <p>{bullet}</p>
                      </li>
                    ))}
                  </ul>

                  {/* Visual Architecture Diagram Spec */}
                  {sec.id === 'hardware' && (
                    <div className="brochure-spec-grid">
                      <div className="brochure-spec-item">
                        <span className="spec-label">MAIN SOC</span>
                        <span className="spec-val">MediaTek Helio G100</span>
                      </div>
                      <div className="brochure-spec-item">
                        <span className="spec-label">MCU BUS</span>
                        <span className="spec-val">ESP32 2.4GHz SoftAP</span>
                      </div>
                      <div className="brochure-spec-item">
                        <span className="spec-label">HEAD SERVOS</span>
                        <span className="spec-val">5-Axis Animatronics</span>
                      </div>
                      <div className="brochure-spec-item">
                        <span className="spec-label">RADAR ENVELOPE</span>
                        <span className="spec-val">Dual 40kHz Ultrasonic</span>
                      </div>
                    </div>
                  )}

                  {sec.id === 'overview' && (
                    <div className="brochure-kiosk-callout">
                      <strong>100% Offline Resilience:</strong> Aurra functions completely stand-alone inside enterprise facilities without requiring external internet or third-party cloud infrastructure.
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <footer className="brochure-modal-footer">
              <span className="brochure-footer-hint">
                To download the full PDF to your phone, scan the brochure QR on the main screen.
              </span>
              <button
                className="brochure-dismiss-btn"
                onClick={() => setIsBrochureOpen(false)}
              >
                Close Brochure
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Bottom spacer for global floating voice bar clearance */}
      <div className="bottom-global-voice-spacer" />
    </div>
  );
}
