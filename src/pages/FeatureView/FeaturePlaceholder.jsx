import React from 'react';
import { ArrowLeft, Sparkles, Cpu, Compass, Building2, Sliders, Globe, Activity, HelpCircle, FileText, CheckCircle2 } from 'lucide-react';
import './FeaturePlaceholder.css';

export default function FeaturePlaceholder({ path, card, onNavigate }) {
  const title = card?.title || 'Kiosk Feature';
  const subtitle = card?.subtitle || 'Robomiracle Autonomous Subsystem';

  // Feature specific UI widget
  const renderFeaturePreview = () => {
    switch (path) {
      case '/form':
        return (
          <div className="preview-card-box">
            <FileText size={48} color="#00ffff" />
            <h3>Visitor Registration & Admission</h3>
            <p>Digital visitor sign-in and biometric verification kiosk terminal.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">Step 1: Identity Entry</span>
              <span className="sample-badge">Step 2: Biometric Sync</span>
              <span className="sample-badge">Step 3: Access Badge</span>
            </div>
          </div>
        );
      case '/qa':
        return (
          <div className="preview-card-box">
            <HelpCircle size={48} color="#00ffff" />
            <h3>Voice Assistant & FAQ Intelligence</h3>
            <p>Spoken AI Q&A answering visitor queries in real-time.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">"Where is the CEO office?"</span>
              <span className="sample-badge">"What are the office timings?"</span>
            </div>
          </div>
        );
      case '/guided-tour':
        return (
          <div className="preview-card-box">
            <Compass size={48} color="#00ffff" />
            <h3>Autonomous Guided Robot Tour</h3>
            <p>Waypoint pathfinding and automated robotic tour guide navigation.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">Route A: Innovation Lab</span>
              <span className="sample-badge">Route B: Robotics Bay</span>
            </div>
          </div>
        );
      case '/facilities':
        return (
          <div className="preview-card-box">
            <Building2 size={48} color="#00ffff" />
            <h3>Public Facilities & Floor Directory</h3>
            <p>Interactive building map, restrooms, cafeterias, and meeting rooms.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">Floor 1: Reception & Demo</span>
              <span className="sample-badge">Floor 2: R&D Laboratory</span>
            </div>
          </div>
        );
      case '/control':
        return (
          <div className="preview-card-box">
            <Sliders size={48} color="#00ffff" />
            <h3>Robot Cockpit Control Center</h3>
            <p>Precision multi-servo animatronics, motor drive, and RGB telemetry.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">Neck Tilt: 45°</span>
              <span className="sample-badge">Base Motors: Standby</span>
              <span className="sample-badge">Eyes: Cyber Cyan</span>
            </div>
          </div>
        );
      case '/hardware':
        return (
          <div className="preview-card-box">
            <Activity size={48} color="#00ffff" />
            <h3>ESP32 Hardware & Subsystem Telemetry</h3>
            <p>Real-time micro-controller I/O status, battery metrics, and sensors.</p>
            <div className="sample-badge-row">
              <span className="sample-badge">ESP32 Status: ONLINE</span>
              <span className="sample-badge">Battery: 98%</span>
              <span className="sample-badge">Bus: I2C / UART</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="preview-card-box">
            <Cpu size={48} color="#00ffff" />
            <h3>{title}</h3>
            <p>{subtitle}</p>
            <div className="sample-badge-row">
              <span className="sample-badge">Status: Subsystem Ready</span>
              <span className="sample-badge">Voice Enabled: {card?.voiceAccessEnabled ? 'YES' : 'NO'}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="feature-view-container">
      {/* Top Header */}
      <header className="feature-header-bar">
        <button className="back-btn" onClick={() => onNavigate?.('/')}>
          <ArrowLeft size={18} />
          <span>Home</span>
        </button>

        <div className="feature-title-center">
          <h2>{title}</h2>
          <span className="feature-subtitle">{subtitle}</span>
        </div>

        <div className="feature-route-tag">{path}</div>
      </header>

      {/* Main Body */}
      <main className="feature-body">
        {renderFeaturePreview()}
      </main>

      {/* Bottom spacer for global floating voice bar */}
      <div className="bottom-global-voice-spacer"></div>
    </div>
  );
}
