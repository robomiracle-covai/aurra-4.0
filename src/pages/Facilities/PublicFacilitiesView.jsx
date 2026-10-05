import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Volume2,
  VolumeX,
  Compass,
  MapPin,
  Building2,
  Navigation,
  Bot,
  Users,
  Coffee,
  Layers,
  Activity,
  Cpu,
  Sliders,
  Shield,
  Award,
  Sun,
  Sparkles,
  QrCode,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Filter,
  Maximize2,
  FlaskConical,
  Code,
  Package,
  Building,
  Wrench,
  Monitor,
  Wifi
} from 'lucide-react';
import QRCode from 'qrcode';
import { offlineFacilityService } from '../../db/offlineServices';
import { speakWithVoice, cancelSpeech, isAnySpeaking } from '../../utils/speechSynthesis';
import { kioskConfigService } from '../../services/kioskConfigService';
import { logger } from '../../services/logger';
import './PublicFacilitiesView.css';

// Icon resolver helper
const renderCategoryIcon = (iconName, size = 20, color = '#00ffff') => {
  switch (iconName) {
    case 'FlaskConical': return <FlaskConical size={size} color={color} />;
    case 'Cpu': return <Cpu size={size} color={color} />;
    case 'Code': return <Code size={size} color={color} />;
    case 'Package': return <Package size={size} color={color} />;
    case 'Bot': return <Bot size={size} color={color} />;
    case 'Users': return <Users size={size} color={color} />;
    case 'Building2': return <Building2 size={size} color={color} />;
    case 'Building': return <Building size={size} color={color} />;
    case 'Wifi': return <Wifi size={size} color={color} />;
    case 'Wrench': return <Wrench size={size} color={color} />;
    case 'Monitor': return <Monitor size={size} color={color} />;
    case 'Coffee': return <Coffee size={size} color={color} />;
    case 'Layers': return <Layers size={size} color={color} />;
    case 'Navigation': return <Navigation size={size} color={color} />;
    case 'Activity': return <Activity size={size} color={color} />;
    case 'Sliders': return <Sliders size={size} color={color} />;
    case 'Shield': return <Shield size={size} color={color} />;
    case 'Award': return <Award size={size} color={color} />;
    case 'Sun': return <Sun size={size} color={color} />;
    default: return <Sparkles size={size} color={color} />;
  }
};

export default function PublicFacilitiesView({ onNavigate }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('all'); // 'all' | 'ground' | 'first' | 'second'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'restroom' | 'dining' | 'lab' | 'meeting' | 'utility' | 'medical' | 'executive'
  const [viewMode, setViewMode] = useState('directory'); // 'directory' | 'map'
  const [activeFacility, setActiveFacility] = useState(null); // Facility focused on map or detail drawer
  
  // Audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);

  // QR Modal state
  const [qrModalFacility, setQrModalFacility] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Load facilities from IndexedDB on mount
  useEffect(() => {
    loadFacilities();
    return () => {
      cancelSpeech();
    };
  }, []);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const data = await offlineFacilityService.getFacilities();
      const enabledOnly = (data || []).filter((f) => f.isEnabled !== false);
      setFacilities(enabledOnly);
      // Select first facility as default for map
      if (enabledOnly.length > 0 && !activeFacility) {
        setActiveFacility(enabledOnly[0]);
      }
    } catch (err) {
      logger.error('FACILITIES', `Failed loading facilities: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter facilities based on floor, category, and search query
  const filteredFacilities = useMemo(() => {
    return facilities.filter((item) => {
      // Floor filter
      if (selectedFloor !== 'all' && item.floor !== selectedFloor) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (item.name || item.title || '').toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesCode = (item.code || '').toLowerCase().includes(q);
        const matchesWing = (item.wing || '').toLowerCase().includes(q);
        const matchesCat = (item.categoryLabel || item.category || '').toLowerCase().includes(q);
        const matchesDir = (item.directions || '').toLowerCase().includes(q);
        const matchesAmenity = (item.amenities || []).some((a) => a.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesCode || matchesWing || matchesCat || matchesDir || matchesAmenity;
      }
      return true;
    });
  }, [facilities, selectedFloor, selectedCategory, searchQuery]);

  // Derive unique categories dynamically from current facilities
  const dynamicCategories = useMemo(() => {
    const map = new Map();
    facilities.forEach((f) => {
      const cat = f.category || 'General';
      const label = f.categoryLabel || cat;
      if (!map.has(cat)) {
        map.set(cat, { id: cat, label, count: 0 });
      }
      map.get(cat).count += 1;
    });
    return Array.from(map.values());
  }, [facilities]);

  // Voice readout of directions
  const handleSpeakDirections = (facility) => {
    if (isSpeaking && speakingId === facility.id) {
      cancelSpeech();
      setIsSpeaking(false);
      setSpeakingId(null);
      return;
    }

    cancelSpeech();
    setIsSpeaking(true);
    setSpeakingId(facility.id);

    const speechText = `${facility.name}, Room ${facility.code}, on ${facility.floorLabel}, in the ${facility.wing}. Directions: ${facility.directions}`;

    speakWithVoice(speechText, {
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      },
    });
  };

  // Floor Overview Audio Guide
  const handleSpeakFloorOverview = () => {
    if (isSpeaking && speakingId === 'floor-summary') {
      cancelSpeech();
      setIsSpeaking(false);
      setSpeakingId(null);
      return;
    }

    cancelSpeech();
    setIsSpeaking(true);
    setSpeakingId('floor-summary');

    let text = '';
    if (selectedFloor === 'ground') {
      text = 'Ground floor features the Main Reception, Robotics Live Demonstration Bay, Executive Boardroom Alpha, Public Restrooms, Cafeteria Lounge, and First Aid Center.';
    } else if (selectedFloor === 'first') {
      text = 'Level 1 houses the Autonomous AI Perception Lab, Mechatronics Prototyping Bay, Conference Room Beta, Collaboration Pods, and Level 1 Restrooms.';
    } else if (selectedFloor === 'second') {
      text = 'Level 2 features Executive Management, the SLAM Robotics Arena, Patents Heritage Gallery, Prayer Sanctuary, and the Rooftop Solar Terrace.';
    } else {
      text = `Campus directory lists ${facilities.length} public amenities across Ground, First, and Second floors. You can filter by floor or tap any facility to hear spoken directions.`;
    }

    speakWithVoice(text, {
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      },
    });
  };

  // QR Code Generator for mobile walking directions
  const handleOpenQrModal = async (facility) => {
    try {
      setQrModalFacility(facility);
      const textToEncode = `Robomiracle Campus Directory\nRoom: ${facility.code} - ${facility.name}\nFloor: ${facility.floorLabel}\nWing: ${facility.wing}\nDirections: ${facility.directions}\nHours: ${facility.hours}`;
      const url = await QRCode.toDataURL(textToEncode, {
        width: 320,
        margin: 2,
        color: {
          dark: '#001020',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      logger.error('FACILITIES', `Failed generating QR: ${err.message}`);
    }
  };

  const handleSelectFacilityForMap = (facility) => {
    setActiveFacility(facility);
    if (facility.floor && facility.floor !== 'outdoor') {
      setSelectedFloor(facility.floor);
    }
    setViewMode('map');
  };

  return (
    <div className="public-facilities-view">
      {/* ── Top Cyber Navigation Bar ── */}
      <header className="fac-header">
        <div className="fac-header-left">
          <button
            className="fac-back-btn"
            onClick={() => onNavigate('/')}
            title="Back to Home"
          >
            <ArrowLeft size={22} />
            <span>HOME</span>
          </button>

          <div className="fac-title-wrap">
            <div className="fac-badge-row">
              <span className="fac-cyber-pill">
                <Compass size={13} />
                CAMPUS WAYFINDING & AMENITIES
              </span>
              <span className="fac-count-pill">{facilities.length} VERIFIED LOCATIONS</span>
            </div>
            <h1 className="fac-main-title">
              Public Facilities <span className="fac-gradient-text">&amp; Floor Directory</span>
            </h1>
          </div>
        </div>

        <div className="fac-header-right">
          {/* Audio Overview Guide */}
          <button
            className={`fac-audio-guide-btn ${speakingId === 'floor-summary' ? 'speaking' : ''}`}
            onClick={handleSpeakFloorOverview}
            title="Audio Floor Guide"
          >
            {speakingId === 'floor-summary' ? (
              <>
                <VolumeX size={18} />
                <span>MUTE GUIDE</span>
              </>
            ) : (
              <>
                <Volume2 size={18} />
                <span>VOICE GUIDE</span>
              </>
            )}
          </button>

          {/* View Mode Switcher */}
          <div className="fac-view-switcher">
            <button
              className={`fac-mode-btn ${viewMode === 'directory' ? 'active' : ''}`}
              onClick={() => setViewMode('directory')}
            >
              <Building2 size={16} />
              <span>Directory</span>
            </button>
            <button
              className={`fac-mode-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              <Navigation size={16} />
              <span>Blueprint Map</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Search & Filter Controls ── */}
      <section className="fac-controls-bar">
        {/* Real-Time Search Bar */}
        <div className="fac-search-box">
          <Search size={18} className="fac-search-icon" />
          <input
            type="text"
            className="fac-search-input"
            placeholder="Search rooms, washrooms, cafeterias, labs, boardrooms, directions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="fac-search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Floor Level Tabs */}
        <div className="fac-floor-tabs">
          <button
            className={`fac-floor-tab ${selectedFloor === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFloor('all')}
          >
            All Floors
          </button>
          <button
            className={`fac-floor-tab ${selectedFloor === 'ground' ? 'active' : ''}`}
            onClick={() => setSelectedFloor('ground')}
          >
            Ground (Level 0)
          </button>
          <button
            className={`fac-floor-tab ${selectedFloor === 'first' ? 'active' : ''}`}
            onClick={() => setSelectedFloor('first')}
          >
            Level 1 (R&amp;D)
          </button>
          <button
            className={`fac-floor-tab ${selectedFloor === 'second' ? 'active' : ''}`}
            onClick={() => setSelectedFloor('second')}
          >
            Level 2 (Executive)
          </button>
        </div>
      </section>

      {/* ── Category Quick-Filter Bar ── */}
      <section className="fac-category-pills-bar">
        <button
          className={`fac-cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          All Categories ({facilities.length})
        </button>
        {dynamicCategories.map((cat) => (
          <button
            key={cat.id}
            className={`fac-cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span>{cat.label}</span>
            <span style={{ opacity: 0.65, fontSize: '11px', marginLeft: '5px' }}>
              ({cat.count})
            </span>
          </button>
        ))}
      </section>

      {/* ── Main Content Area (Directory Cards or Holographic Blueprint Map) ── */}
      {viewMode === 'directory' ? (
        <section className="fac-directory-section">
          {filteredFacilities.length === 0 ? (
            <div className="fac-empty-state">
              <Building2 size={48} color="#00ffff" />
              <h3>No facilities found matching your search</h3>
              <p>Try resetting the floor filter or searching for another keyword like "restroom", "water", or "lab".</p>
              <button
                className="fac-reset-filter-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFloor('all');
                  setSelectedCategory('all');
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="fac-cards-grid">
              {filteredFacilities.map((fac) => {
                const isItemSpeaking = isSpeaking && speakingId === fac.id;
                return (
                  <article
                    key={fac.id}
                    className={`fac-card ${activeFacility?.id === fac.id ? 'active' : ''}`}
                    onClick={() => setActiveFacility(fac)}
                  >
                    {/* Top Row: Icon, Room Code & Status Badge */}
                    <div className="fac-card-top">
                      <div className="fac-icon-box">
                        {renderCategoryIcon(fac.icon, 24, '#00ffff')}
                      </div>
                      <div className="fac-room-meta">
                        <span className="fac-room-code">{fac.code}</span>
                        <span className="fac-floor-pill">{fac.floorLabel}</span>
                      </div>
                      <div className="fac-status-indicator">
                        <span className={`fac-status-dot ${fac.status.toLowerCase()}`} />
                        <span className="fac-status-text">{fac.status}</span>
                      </div>
                    </div>

                    {/* Facility Title, Description & Wing */}
                    <h3 className="fac-card-name">{fac.name || fac.title}</h3>
                    {fac.description && (
                      <p className="fac-card-description" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: '6px 0 10px', lineHeight: '1.45' }}>
                        {fac.description}
                      </p>
                    )}
                    <div className="fac-wing-row">
                      <MapPin size={14} className="fac-pin-icon" />
                      <span>{fac.wing}</span>
                      <span className="fac-dot-sep">•</span>
                      <span className="fac-cat-tag">{fac.categoryLabel || fac.category}</span>
                    </div>

                    {/* Walking Distance & Operational Hours */}
                    <div className="fac-meta-stats">
                      <div className="fac-stat-chip">
                        <Navigation size={13} color="#38bdf8" />
                        <span>{fac.distanceMeters === 0 ? '📍 You Are Here' : `${fac.distanceMeters}m (${fac.walkTime})`}</span>
                      </div>
                      <div className="fac-stat-chip">
                        <Clock size={13} color="#a855f7" />
                        <span>{fac.hours}</span>
                      </div>
                    </div>

                    {/* Walking Directions Box */}
                    <div className="fac-directions-box">
                      <div className="fac-directions-label">
                        <Compass size={13} />
                        <span>DIRECTIONS FROM KIOSK</span>
                      </div>
                      <p className="fac-directions-text">{fac.directions}</p>
                    </div>

                    {/* Amenities Tag Cloud */}
                    {fac.amenities && fac.amenities.length > 0 && (
                      <div className="fac-amenities-tags">
                        {fac.amenities.map((a, i) => (
                          <span key={i} className="fac-amenity-tag">
                            <CheckCircle2 size={11} color="#00ffff" />
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="fac-card-actions">
                      <button
                        className={`fac-action-btn speak-btn ${isItemSpeaking ? 'speaking' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakDirections(fac);
                        }}
                        title="Listen to Directions"
                      >
                        {isItemSpeaking ? (
                          <>
                            <VolumeX size={15} />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={15} />
                            <span>Speak Guide</span>
                          </>
                        )}
                      </button>

                      <button
                        className="fac-action-btn map-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFacilityForMap(fac);
                        }}
                        title="Show on Interactive Blueprint Map"
                      >
                        <Compass size={15} />
                        <span>View on Map</span>
                      </button>

                      <button
                        className="fac-action-btn qr-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenQrModal(fac);
                        }}
                        title="Send Directions to Phone"
                      >
                        <QrCode size={15} />
                        <span>QR Pass</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* ── Holographic Architectural Blueprint Map View ── */
        <section className="fac-map-section">
          <div className="fac-map-container">
            {/* Map Header Controls */}
            <div className="fac-map-header">
              <div className="fac-map-title-row">
                <Compass size={20} color="#00ffff" />
                <h2>
                  Floor Blueprint Visualizer &mdash;{' '}
                  <span className="fac-floor-active-text">
                    {selectedFloor === 'ground' ? 'Ground Floor (Level 0)' :
                     selectedFloor === 'first' ? 'First Floor (Level 1)' :
                     selectedFloor === 'second' ? 'Second Floor (Level 2)' : 'Ground Floor (Default)'}
                  </span>
                </h2>
              </div>

              <div className="fac-map-legend">
                <div className="legend-item"><span className="legend-box k-kiosk" /> Kiosk (You)</div>
                <div className="legend-item"><span className="legend-box k-restroom" /> Restrooms</div>
                <div className="legend-item"><span className="legend-box k-lab" /> Robotics &amp; Labs</div>
                <div className="legend-item"><span className="legend-box k-dining" /> Dining</div>
                <div className="legend-item"><span className="legend-box k-meeting" /> Meeting</div>
                <div className="legend-item"><span className="legend-box k-utility" /> Utility / Stairs</div>
              </div>
            </div>

            {/* Interactive SVG Blueprint Canvas */}
            <div className="fac-svg-wrapper">
              <svg
                viewBox="0 0 1000 600"
                className="fac-blueprint-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {/* Glowing Grid Background Pattern */}
                  <pattern id="cyberGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 255, 255, 0.07)" strokeWidth="1" />
                  </pattern>

                  {/* Radial Pulse Filter */}
                  <filter id="kioskGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Cyber Grid Background */}
                <rect width="1000" height="600" fill="#040914" />
                <rect width="1000" height="600" fill="url(#cyberGrid)" />

                {/* Outer Campus Perimeter Walls */}
                <rect
                  x="50"
                  y="40"
                  width="900"
                  height="520"
                  rx="24"
                  fill="rgba(10, 25, 47, 0.6)"
                  stroke="rgba(0, 255, 255, 0.4)"
                  strokeWidth="2.5"
                  strokeDasharray="6,4"
                />

                {/* Central Atrium Corridor Ring */}
                <circle
                  cx="500"
                  cy="300"
                  r="170"
                  fill="none"
                  stroke="rgba(0, 213, 255, 0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />

                {/* ── Floor Specific Blueprint Architectural Rooms ── */}
                {/* 1. North Wing (Top) */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-cafeteria' || activeFacility?.mapZone === 'zone-rooftop' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-cafeteria' || f.mapZone === 'zone-rooftop');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="360" y="60" width="280" height="120" rx="12" className="map-room-box r-dining" />
                  <text x="500" y="110" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'second' ? 'L2-06: ROOFTOP SOLAR TERRACE' : 'G-04: CAFETERIA & COFFEE LOUNGE'}
                  </text>
                  <text x="500" y="132" className="map-room-sub" textAnchor="middle">North Courtyard Hall</text>
                </g>

                {/* 2. East Wing (Right Top: Labs / Demo) */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-demo-bay' || activeFacility?.mapZone === 'zone-ai-lab' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-demo-bay' || f.mapZone === 'zone-ai-lab');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="680" y="70" width="240" height="190" rx="12" className="map-room-box r-lab" />
                  <text x="800" y="150" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'first' ? 'L1-01: AI SOFTWARE LAB' :
                     selectedFloor === 'second' ? 'L2-01: FOUNDERS SUITE' : 'G-02: ROBOTICS DEMO BAY'}
                  </text>
                  <text x="800" y="172" className="map-room-sub" textAnchor="middle">East Wing Wing A</text>
                </g>

                {/* 3. East Wing (Right Bottom: Boardroom Alpha / Mechatronics) */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-boardroom-a' || activeFacility?.mapZone === 'zone-mechatronics' || activeFacility?.mapZone === 'zone-slam-arena' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-boardroom-a' || f.mapZone === 'zone-mechatronics' || f.mapZone === 'zone-slam-arena');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="680" y="310" width="240" height="220" rx="12" className="map-room-box r-meeting" />
                  <text x="800" y="405" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'first' ? 'L1-02: MECHATRONICS BAY' :
                     selectedFloor === 'second' ? 'L2-02: SLAM ARENA' : 'G-05: BOARDROOM ALPHA'}
                  </text>
                  <text x="800" y="427" className="map-room-sub" textAnchor="middle">East Wing Wing B</text>
                </g>

                {/* 4. Central Core: Elevator Bank & Main Stairwell */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-elevators-g' || activeFacility?.mapZone === 'zone-patents' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-elevators-g' || f.mapZone === 'zone-patents');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="420" y="215" width="160" height="90" rx="8" className="map-room-box r-utility" />
                  <text x="500" y="255" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'second' ? 'L2-03: PATENTS GALLERY' : 'ELEVATORS & STAIRS'}
                  </text>
                  <text x="500" y="275" className="map-room-sub" textAnchor="middle">Central Core</text>
                </g>

                {/* 5. West Wing (Left Top: Medical / Focus Pods / Prayer) */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-medical-g' || activeFacility?.mapZone === 'zone-conf-beta' || activeFacility?.mapZone === 'zone-prayer-room' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-medical-g' || f.mapZone === 'zone-conf-beta' || f.mapZone === 'zone-prayer-room');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="80" y="70" width="240" height="190" rx="12" className="map-room-box r-medical" />
                  <text x="200" y="150" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'first' ? 'L1-03: CONF ROOM BETA' :
                     selectedFloor === 'second' ? 'L2-04: PRAYER SANCTUARY' : 'G-08: FIRST AID CENTER'}
                  </text>
                  <text x="200" y="172" className="map-room-sub" textAnchor="middle">West Wing Healthcare</text>
                </g>

                {/* 6. West Wing (Left Bottom: Public Restrooms & Water) */}
                <g
                  className={`map-room-group ${activeFacility?.mapZone === 'zone-restrooms-g' || activeFacility?.mapZone === 'zone-restrooms-l1' || activeFacility?.mapZone === 'zone-restrooms-l2' ? 'active-room' : ''}`}
                  onClick={() => {
                    const found = facilities.find(f => f.mapZone === 'zone-restrooms-g' || f.mapZone === 'zone-restrooms-l1' || f.mapZone === 'zone-restrooms-l2');
                    if (found) setActiveFacility(found);
                  }}
                >
                  <rect x="80" y="310" width="240" height="220" rx="12" className="map-room-box r-restroom" />
                  <text x="200" y="405" className="map-room-title" textAnchor="middle">
                    {selectedFloor === 'first' ? 'L1-05: RESTROOMS' :
                     selectedFloor === 'second' ? 'L2-05: RESTROOMS' : 'G-03: PUBLIC RESTROOMS'}
                  </text>
                  <text x="200" y="427" className="map-room-sub" textAnchor="middle">West Hygiene Wing</text>
                </g>

                {/* ── Walking Path Indicator (Dynamic from Kiosk to Active Room) ── */}
                {activeFacility && activeFacility.distanceMeters > 0 && (
                  <path
                    d={`M 500 420 Q ${activeFacility.coordinates?.x * 10 || 500} 380, ${activeFacility.coordinates?.x * 10 || 800} ${activeFacility.coordinates?.y * 6 || 200}`}
                    fill="none"
                    stroke="#00ffff"
                    strokeWidth="3.5"
                    strokeDasharray="8,6"
                    className="animated-walking-trail"
                  />
                )}

                {/* ── Kiosk Location Pin (YOU ARE HERE) ── */}
                <g className="kiosk-pin-marker" transform="translate(500, 420)" filter="url(#kioskGlow)">
                  {/* Radar Wave Rings */}
                  <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(0, 255, 255, 0.4)" className="kiosk-radar-ring1" />
                  <circle cx="0" cy="0" r="50" fill="none" stroke="rgba(0, 255, 255, 0.2)" className="kiosk-radar-ring2" />

                  {/* Center glowing badge */}
                  <circle cx="0" cy="0" r="14" fill="#00ffff" stroke="#00384d" strokeWidth="3" />
                  <circle cx="0" cy="0" r="6" fill="#021526" />

                  {/* You are here text banner */}
                  <rect x="-80" y="24" width="160" height="26" rx="6" fill="#0a192f" stroke="#00ffff" strokeWidth="1.5" />
                  <text x="0" y="42" fill="#00ffff" fontSize="12" fontWeight="800" textAnchor="middle" letterSpacing="0.8">
                    📍 YOU ARE HERE (KIOSK)
                  </text>
                </g>
              </svg>
            </div>

            {/* ── Selected Facility Quick Drawer / Detail Card (Bottom of Map) ── */}
            {activeFacility && (
              <div className="fac-map-drawer">
                <div className="fac-drawer-info">
                  <div className="fac-drawer-header">
                    <span className="fac-drawer-code">{activeFacility.code}</span>
                    <span className="fac-drawer-floor">{activeFacility.floorLabel}</span>
                    <span className="fac-drawer-dist">
                      <Navigation size={12} color="#00ffff" />
                      {activeFacility.distanceMeters === 0 ? 'Current Location' : `${activeFacility.distanceMeters}m walk`}
                    </span>
                  </div>
                  <h3 className="fac-drawer-title">{activeFacility.name || activeFacility.title}</h3>
                  {activeFacility.description && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 6px', lineHeight: '1.4' }}>
                      {activeFacility.description}
                    </p>
                  )}
                  <p className="fac-drawer-directions">
                    <strong>Walking Route:</strong> {activeFacility.directions}
                  </p>
                </div>

                <div className="fac-drawer-actions">
                  <button
                    className={`fac-drawer-btn ${isSpeaking && speakingId === activeFacility.id ? 'active' : ''}`}
                    onClick={() => handleSpeakDirections(activeFacility)}
                  >
                    <Volume2 size={16} />
                    <span>{isSpeaking && speakingId === activeFacility.id ? 'Stop Speech' : 'Listen Directions'}</span>
                  </button>
                  <button
                    className="fac-drawer-btn qr"
                    onClick={() => handleOpenQrModal(activeFacility)}
                  >
                    <QrCode size={16} />
                    <span>Pass to Phone</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Mobile Directions QR Code Modal ── */}
      {qrModalFacility && (
        <div className="fac-modal-overlay" onClick={() => setQrModalFacility(null)}>
          <div className="fac-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="fac-modal-close-btn" onClick={() => setQrModalFacility(null)}>
              <X size={20} />
            </button>

            <div className="fac-modal-header">
              <QrCode size={28} color="#00ffff" />
              <h3>Scan for Walking Directions</h3>
              <p>Point your mobile camera to load these directions onto your smartphone.</p>
            </div>

            <div className="fac-modal-qr-container">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Directions QR Code" className="fac-qr-image" />
              ) : (
                <div className="fac-qr-placeholder">Generating QR code...</div>
              )}
            </div>

            <div className="fac-modal-details">
              <h4>{qrModalFacility.name} ({qrModalFacility.code})</h4>
              <p><strong>Floor:</strong> {qrModalFacility.floorLabel} &bull; {qrModalFacility.wing}</p>
              <div className="fac-modal-directions-box">
                {qrModalFacility.directions}
              </div>
            </div>

            <button className="fac-modal-done-btn" onClick={() => setQrModalFacility(null)}>
              Done &bull; Return to Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
