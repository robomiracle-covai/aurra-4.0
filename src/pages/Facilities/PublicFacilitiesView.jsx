import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Battery,
  Zap,
  ShoppingBag,
  HeartPulse,
  Bed,
  GraduationCap,
  MapPin,
  Ticket,
  Settings,
  Key,
  Cloud,
  Bot,
  Building2,
  Sparkles,
  Volume2
} from 'lucide-react';
import { offlineFacilityService } from '../../db/offlineServices';
import { logger } from '../../services/logger';
import './PublicFacilitiesView.css';

// Facility icon helper matching the 9 Nexus facilities
export const renderFacilityIcon = (iconName, index, size = 20, color = '#00ffff') => {
  if (iconName) {
    switch (iconName) {
      case 'ShoppingBag':
      case 'Retail':
        return <ShoppingBag size={size} color={color} />;
      case 'HeartPulse':
      case 'Activity':
      case 'Healthcare':
      case 'Medical':
        return <HeartPulse size={size} color={color} />;
      case 'Bed':
      case 'Hospitality':
      case 'Hotel':
        return <Bed size={size} color={color} />;
      case 'GraduationCap':
      case 'Education':
      case 'School':
        return <GraduationCap size={size} color={color} />;
      case 'MapPin':
      case 'Guide':
      case 'Reception':
        return <MapPin size={size} color={color} />;
      case 'Ticket':
      case 'Event':
      case 'Exhibition':
        return <Ticket size={size} color={color} />;
      case 'Settings':
      case 'Cog':
      case 'Development':
      case 'Wrench':
        return <Settings size={size} color={color} />;
      case 'Key':
      case 'Rental':
        return <Key size={size} color={color} />;
      case 'Cloud':
      case 'RaaS':
        return <Cloud size={size} color={color} />;
      case 'Bot':
        return <Bot size={size} color={color} />;
      case 'Building2':
        return <Building2 size={size} color={color} />;
      default:
        break;
    }
  }

  // Fallback array by index
  const iconsByIndex = [
    <ShoppingBag size={size} color={color} />,
    <HeartPulse size={size} color={color} />,
    <Bed size={size} color={color} />,
    <GraduationCap size={size} color={color} />,
    <MapPin size={size} color={color} />,
    <Ticket size={size} color={color} />,
    <Settings size={size} color={color} />,
    <Key size={size} color={color} />,
    <Cloud size={size} color={color} />,
  ];
  return iconsByIndex[index % iconsByIndex.length] || <Sparkles size={size} color={color} />;
};

export default function PublicFacilitiesView({ onNavigate }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    loadFacilities();
  }, []);

  // Live tablet battery monitor
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
      } catch (err) {
        // silent fallback
      }
    };

    fetchBattery();
    const timer = setInterval(fetchBattery, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const data = await offlineFacilityService.getFacilities();
      // Only enabled facilities, up to a maximum of 9 cards
      const enabledOnly = (data || []).filter((f) => f.isEnabled !== false).slice(0, 9);
      setFacilities(enabledOnly);
    } catch (err) {
      logger.error('FACILITIES', `Failed loading facilities: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakFacility = (facility) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `${facility.title || facility.name}. ${facility.description}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="nexus-facilities-viewport">
      {/* ── Top Header Bar ── */}
      <header className="nexus-facilities-top-bar">
        {/* Back Button */}
        <button
          className="nexus-fac-back-btn"
          onClick={() => onNavigate && onNavigate('/')}
          aria-label="Back to Home"
          title="Back to Home"
        >
          <ArrowLeft size={22} color="#00ffff" />
        </button>

        {/* Brand Pill: PUBLIC FACILITIES */}
        <div className="nexus-fac-brand-pill">
          <span className="brand-primary-text">PUBLIC</span>
          <span className="brand-accent-badge">FACILITIES</span>
        </div>

        {/* Battery Pill */}
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

      {/* ── Main Content: 3x3 Grid (Max 9 Cards) ── */}
      <main className="nexus-facilities-main">
        {loading ? (
          <div className="nexus-facilities-loading">
            <div className="nexus-loading-spinner" />
            <span>Loading facilities...</span>
          </div>
        ) : facilities.length === 0 ? (
          <div className="nexus-facilities-empty">
            <Sparkles size={48} color="#00ffff" />
            <h3>No Public Facilities Configured</h3>
            <p>Go to Admin Panel &gt; Public Facilities to set defaults or add items.</p>
          </div>
        ) : (
          <div className="nexus-facilities-grid">
            {facilities.map((fac, idx) => {
              const title = fac.title || fac.name;
              return (
                <div
                  key={fac.id || idx}
                  className="nexus-facility-card"
                  onClick={() => handleSpeakFacility(fac)}
                  title="Tap to listen"
                >
                  <div className="nexus-card-top-row">
                    <div className="nexus-card-icon-box">
                      {renderFacilityIcon(fac.icon, idx, 22, '#00ffff')}
                    </div>
                    <h3 className="nexus-card-title">{title}</h3>
                  </div>
                  <p className="nexus-card-description">{fac.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
