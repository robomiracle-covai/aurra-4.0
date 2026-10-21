import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Battery,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  X,
  ExternalLink,
  Globe
} from 'lucide-react';
import { OFFICIAL_CHANNELS, DEFAULT_PORTAL_LINKS } from './weblinksData';
import { offlineWebLinksService } from '../../db/offlineServices';
import { logger } from '../../services/logger';
import './WebLinks.css';

// Brand SVGs matching official vector guidelines
function ChannelLogo({ type }) {
  switch (type) {
    case 'linkedin':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#0a66c2' }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#ffffff">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.65 1.65 0 1 0 0-3.3 1.65 1.65 0 0 0 0 3.3m1.39 9.74v-8.37H5.07v8.37h2.78z" />
          </svg>
        </div>
      );
    case 'youtube':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#ff0000' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffffff">
            <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15V9l5.2 3L10 15z" />
          </svg>
        </div>
      );
    case 'facebook':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#1877f2', borderRadius: '50%' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffffff">
            <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" />
          </svg>
        </div>
      );
    case 'instagram':
      return (
        <div
          className="nexus-brand-icon-box"
          style={{
            background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </div>
      );
    case 'maps':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#ea4335' }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#ffffff">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      );
    case 'website':
      return (
        <div className="nexus-brand-icon-box" style={{ background: 'linear-gradient(135deg, #00d5ff 0%, #0284c7 100%)' }}>
          <Globe size={26} color="#ffffff" />
        </div>
      );
    case 'twitter':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.2)' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      );
    case 'threads':
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.2)' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
            <path d="M12.001 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm4.843 11.272c-.067 1.488-.707 2.656-1.849 3.376-.893.56-1.996.79-3.212.67-1.428-.142-2.583-.758-3.344-1.782-.74-1-1.026-2.316-.826-3.804.24-1.78 1.256-3.195 2.784-3.882.898-.403 1.94-.57 3.018-.485 1.096.086 2.062.455 2.793 1.066l-1.055 1.244c-.538-.456-1.25-.733-2.072-.8-1.408-.114-2.736.634-2.947 2.193-.16 1.185.27 2.378 1.124 3.107.604.516 1.403.766 2.315.722.97-.047 1.832-.42 2.366-1.026.43-.49.658-1.173.664-1.98h-3.41v-1.61h5.112c.078.697.11 1.348.093 1.991z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="nexus-brand-icon-box" style={{ background: '#00d5ff' }}>
          <Globe size={24} color="#ffffff" />
        </div>
      );
  }
}

export default function WebLinks({ onNavigate }) {
  const [portalUrls, setPortalUrls] = useState(DEFAULT_PORTAL_LINKS);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isCharging, setIsCharging] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Load saved links from offline storage
  useEffect(() => {
    let isMounted = true;
    const loadUrls = async () => {
      try {
        const loaded = await offlineWebLinksService.getPortalLinks();
        if (isMounted && loaded) {
          setPortalUrls(loaded);
        }
      } catch (err) {
        logger.warn('WEBLINKS', `Failed loading portal links: ${err.message}`);
      }
    };
    loadUrls();
    return () => {
      isMounted = false;
    };
  }, []);

  // Tablet Battery Monitor (aligned with PublicFacilitiesView)
  useEffect(() => {
    let isMounted = true;
    const fetchBattery = async () => {
      try {
        if (window.LauncherBridge?.getBatteryLevel) {
          const level = window.LauncherBridge.getBatteryLevel();
          if (level >= 0 && isMounted) {
            setBatteryLevel(level);
            setIsCharging(true);
            return;
          }
        }
        if (window.AndroidBridge?.getBatteryLevel) {
          const level = window.AndroidBridge.getBatteryLevel();
          if (level >= 0 && isMounted) {
            setBatteryLevel(level);
            return;
          }
        }
        if (navigator.getBattery) {
          const b = await navigator.getBattery();
          if (isMounted) {
            setBatteryLevel(Math.round(b.level * 100));
            setIsCharging(b.charging);
          }
        }
      } catch {
        // Battery API unavailable
      }
    };

    fetchBattery();
    const timer = setInterval(fetchBattery, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Generate QR code whenever selectedChannel opens
  useEffect(() => {
    if (!selectedChannel) {
      setQrCodeDataUrl('');
      setCopied(false);
      return;
    }

    const currentUrl = portalUrls[selectedChannel.key] || selectedChannel.defaultUrl;
    QRCode.toDataURL(currentUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#00ffff',
        light: '#030c17',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => logger.warn('WEBLINKS', `Failed generating QR: ${err.message}`));
  }, [selectedChannel, portalUrls]);

  const handleCardClick = (ch) => {
    setSelectedChannel(ch);
  };

  const handleCopy = () => {
    if (!selectedChannel) return;
    const currentUrl = portalUrls[selectedChannel.key] || selectedChannel.defaultUrl;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="nexus-weblinks-viewport">
      {/* Top Header Bar */}
      <header className="nexus-facilities-top-bar">
        {/* Back Button */}
        <button
          className="nexus-fac-back-btn"
          onClick={() => onNavigate?.('/')}
          aria-label="Back to home"
          title="Return to Main Reception"
        >
          <ArrowLeft size={22} color="#00ffff" />
        </button>

        {/* Center Brand Pill: WEBSITE PORTAL */}
        <div className="nexus-fac-brand-pill">
          <span className="brand-primary-text">WEBSITE</span>
          <span className="brand-accent-badge">PORTAL</span>
        </div>

        {/* Battery Indicator Pill */}
        <div className="nexus-fac-battery-pill">
          <span className="nexus-battery-dot" />
          <span className="nexus-battery-pct">
            {batteryLevel !== null ? `${batteryLevel}%` : '--%'}
          </span>
          {isCharging ? (
            <Zap size={15} color="#22c55e" style={{ marginLeft: '2px' }} />
          ) : (
            <Battery size={17} color="#22c55e" style={{ marginLeft: '2px' }} />
          )}
        </div>
      </header>

      {/* Main Title Section */}
      <div className="nexus-weblinks-header">
        <h1 className="nexus-weblinks-main-title">Explore Our Official Channels</h1>
        <p className="nexus-weblinks-subtitle">
          Connect with us across all major platforms and stay updated.
        </p>
        <div className="nexus-weblinks-accent-bar" />
      </div>

      {/* 8 Official Channels Grid (4 Columns x 2 Rows) */}
      <div className="nexus-channels-grid">
        {OFFICIAL_CHANNELS.map((ch) => {
          const liveUrl = portalUrls[ch.key] || ch.defaultUrl;
          return (
            <div
              key={ch.id}
              className="nexus-channel-card"
              onClick={() => handleCardClick(ch)}
              role="button"
              tabIndex={0}
              title={`Tap to view QR code for ${ch.title}`}
            >
              <div className="nexus-channel-icon-wrap">
                <ChannelLogo type={ch.iconType} />
              </div>
              <div className="nexus-channel-text-wrap">
                <h3 className="nexus-channel-title">{ch.title}</h3>
                <p className="nexus-channel-subtitle">{ch.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Pill */}
      <div className="nexus-links-bottom-pill">
        <CheckCircle2 size={16} color="#00ffff" />
        <span>Scan the QR code to visit our official channel instantly.</span>
      </div>

      {/* Holographic QR Code Modal */}
      {selectedChannel && (
        <div className="nexus-qr-modal-overlay" onClick={() => setSelectedChannel(null)}>
          <div
            className="nexus-qr-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ '--channel-accent': selectedChannel.brandColor || '#00ffff' }}
          >
            {/* Modal Header */}
            <div className="nexus-qr-modal-header">
              <div className="nexus-qr-modal-brand">
                <ChannelLogo type={selectedChannel.iconType} />
                <div>
                  <h3 className="nexus-qr-modal-title">{selectedChannel.title}</h3>
                  <p className="nexus-qr-modal-sub">{selectedChannel.subtitle}</p>
                </div>
              </div>
              <button
                className="nexus-qr-close-btn"
                onClick={() => setSelectedChannel(null)}
                aria-label="Close QR Modal"
              >
                <X size={20} color="#00ffff" />
              </button>
            </div>

            {/* QR Code Graphic Frame */}
            <div className="nexus-qr-frame">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code for ${selectedChannel.title}`}
                  className="nexus-qr-image"
                />
              ) : (
                <div className="nexus-qr-loading">Generating Scannable Portal...</div>
              )}
            </div>

            {/* Instruction Callout */}
            <p className="nexus-qr-instruction">
              Scan with your smartphone camera to open link instantly
            </p>

            {/* URL Display Box */}
            <div className="nexus-qr-url-box">
              <span className="nexus-qr-url-text">
                {portalUrls[selectedChannel.key] || selectedChannel.defaultUrl}
              </span>
              <button
                className="nexus-qr-copy-btn"
                onClick={handleCopy}
                title="Copy URL"
              >
                {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} color="#00ffff" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Modal Actions */}
            <div className="nexus-qr-modal-actions">
              <button
                className="nexus-qr-btn-primary"
                onClick={() => setSelectedChannel(null)}
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
