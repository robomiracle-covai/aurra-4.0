import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Compass, Play, Pause, SkipForward, SkipBack, 
  AlertOctagon, Volume2, ShieldAlert, CheckCircle2, MapPin, 
  Sparkles, RefreshCw, Cpu, Activity, Zap, Radio
} from 'lucide-react';
import { offlineTourService } from '../../db/offlineServices';
import { esp32Service } from '../../services/esp32Service';
import { kioskConfigService } from '../../services/kioskConfigService';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { logger } from '../../services/logger';
import './GuidedTourView.css';

/**
 * High-tech synthetic chime using Web Audio API (Zero external file dependency)
 */
function playArrivalChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // Dual frequency harmonic chime (E5 and B5)
    [659.25, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0.2, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  } catch (err) {
    console.warn('[TOUR] Audio chime error:', err);
  }
}

export default function GuidedTourView({ onNavigate }) {
  const [stops, setStops] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tourState, setTourState] = useState('IDLE'); // 'IDLE' | 'NAVIGATING' | 'ARRIVED' | 'SPEAKING' | 'PAUSED' | 'EMERGENCY_STOP'
  const [transitProgress, setTransitProgress] = useState(0); // 0 to 100%
  const [obstacleWarning, setObstacleWarning] = useState(false);
  const [radarDistance, setRadarDistance] = useState({ front: 45, back: 60 });
  const [isEspOnline, setIsEspOnline] = useState(false);
  const [config, setConfig] = useState(() => kioskConfigService.getConfig());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const transitTimerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const currentStop = stops[currentIndex] || null;

  // 1. Load Tour Stops from IndexedDB
  useEffect(() => {
    loadStops();
    const unsubConfig = kioskConfigService.subscribe((cfg) => setConfig(cfg));
    return () => {
      unsubConfig();
      handleCleanup();
    };
  }, []);

  const loadStops = async () => {
    try {
      const data = await offlineTourService.getStops();
      const enabledOnly = data.filter((s) => s.isEnabled !== false);
      setStops(enabledOnly);
    } catch (err) {
      logger.error('TOUR', `Failed to load tour stops: ${err.message}`);
    }
  };

  // 2. Hardware Telemetry & Ultrasonic Radar Polling
  useEffect(() => {
    const unsubHw = esp32Service.subscribe((hw) => {
      setIsEspOnline(Boolean(hw.online));
      if (hw.frontDist !== undefined && hw.backDist !== undefined) {
        setRadarDistance({ front: hw.frontDist, back: hw.backDist });

        // Obstacle Safety Check while driving
        const threshold = config.tourObstacleDistanceCm || 30;
        if (hw.frontDist > 0 && hw.frontDist <= threshold) {
          if (tourState === 'NAVIGATING') {
            triggerObstaclePause(hw.frontDist);
          }
        } else {
          setObstacleWarning(false);
        }
      }
    });

    return () => unsubHw();
  }, [tourState, config.tourObstacleDistanceCm]);

  // 3. Tour Elapsed Timer
  useEffect(() => {
    if (tourState === 'NAVIGATING' || tourState === 'SPEAKING' || tourState === 'ARRIVED') {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [tourState]);

  // Clean unmount helper
  const handleCleanup = () => {
    cancelSpeech();
    esp32Service.stopMotors();
    esp32Service.setServo(1, config.defaultHeadTiltAngle || 90);
    esp32Service.setServo(2, config.defaultHeadPanAngle || 90);
    if (transitTimerRef.current) clearInterval(transitTimerRef.current);
  };

  // Trigger obstacle safety auto-brake
  const triggerObstaclePause = (distCm) => {
    esp32Service.stopMotors();
    setTourState('PAUSED');
    setObstacleWarning(true);
    cancelSpeech();
    speakWithVoice(`Obstacle detected ${distCm} centimeters ahead. Tour navigation temporarily paused for safety.`);
    logger.warn('TOUR', `Obstacle detected at ${distCm}cm - tour paused.`);
  };

  // Start tour from current or first stop
  const handleStartTour = () => {
    if (stops.length === 0) return;
    setTourState('NAVIGATING');
    startTransitToStop(currentIndex);
  };

  // Navigate & Drive to specific stop index
  const startTransitToStop = useCallback((targetIndex) => {
    if (targetIndex < 0 || targetIndex >= stops.length) return;
    
    cancelSpeech();
    setCurrentIndex(targetIndex);
    setTourState('NAVIGATING');
    setTransitProgress(0);

    const targetStop = stops[targetIndex];
    const speed = config.tourSpeed || 160;

    // Dispatch Motor Drive command to ESP32
    esp32Service.driveMotor('forward', speed);

    // Dynamic Eye Color during transit (electric blue drive glow)
    esp32Service.setRgb('#00D5FF');

    // Pan head forward
    esp32Service.setServo(1, 90);
    esp32Service.setServo(2, 90);

    // Simulate / timed transit duration (3.5 seconds transit window)
    const transitDurationMs = 3500;
    const intervalMs = 50;
    const step = 100 / (transitDurationMs / intervalMs);

    if (transitTimerRef.current) clearInterval(transitTimerRef.current);

    transitTimerRef.current = setInterval(() => {
      setTransitProgress((prev) => {
        if (prev >= 100) {
          clearInterval(transitTimerRef.current);
          handleArriveAtStop(targetStop);
          return 100;
        }
        return prev + step;
      });
    }, intervalMs);
  }, [stops, config.tourSpeed]);

  // Arrive at stop: brake motors, pose servos, set theme eye color, speak narration
  const handleArriveAtStop = (stop) => {
    // 1. Brake motors to full stop
    esp32Service.stopMotors();

    // 2. Aim head servos toward exhibit/waypoint
    if (stop.servoTilt !== undefined && stop.servoPan !== undefined) {
      esp32Service.setServo(1, stop.servoTilt);
      esp32Service.setServo(2, stop.servoPan);
    }

    // 3. Set custom exhibit RGB eye glow
    if (stop.rgbColor) {
      esp32Service.setRgb(stop.rgbColor);
    }

    // 4. Play audio arrival chime
    if (config.tourArrivalChime !== false) {
      playArrivalChime();
    }

    // 5. Automatically narrate exhibit if configured
    if (config.tourAutoAnnounce !== false && stop.narration) {
      setTourState('SPEAKING');
      speakWithVoice(stop.narration, {
        onStart: () => setTourState('SPEAKING'),
        onEnd: () => {
          setTourState('ARRIVED');
          // If auto-loop is enabled and on last stop
          if (currentIndex === stops.length - 1 && config.tourLoopEnabled) {
            setTimeout(() => startTransitToStop(0), 4000);
          }
        },
      });
    } else {
      setTourState('ARRIVED');
    }
  };

  // Pause Tour
  const handlePauseTour = () => {
    if (transitTimerRef.current) clearInterval(transitTimerRef.current);
    esp32Service.stopMotors();
    cancelSpeech();
    setTourState('PAUSED');
  };

  // Resume Tour
  const handleResumeTour = () => {
    setObstacleWarning(false);
    if (transitProgress < 100) {
      setTourState('NAVIGATING');
      const speed = config.tourSpeed || 160;
      esp32Service.driveMotor('forward', speed);
      startTransitToStop(currentIndex);
    } else {
      handleNextStop();
    }
  };

  // Next Stop Navigation
  const handleNextStop = () => {
    if (currentIndex < stops.length - 1) {
      startTransitToStop(currentIndex + 1);
    } else if (config.tourLoopEnabled) {
      startTransitToStop(0);
    } else {
      setTourState('ARRIVED');
      speakWithVoice("We have reached the final stop of our guided facility tour. Thank you for visiting Robomiracle Technologies!");
    }
  };

  // Previous Stop Navigation
  const handlePrevStop = () => {
    if (currentIndex > 0) {
      startTransitToStop(currentIndex - 1);
    }
  };

  // Instant Emergency Stop
  const handleEmergencyStop = () => {
    if (transitTimerRef.current) clearInterval(transitTimerRef.current);
    esp32Service.stopMotors();
    cancelSpeech();
    setTourState('EMERGENCY_STOP');
    esp32Service.setRgb('#EF4444'); // Flash Red
    logger.warn('TOUR', 'Emergency stop triggered by user.');
  };

  // Replay Spoken Narration
  const handleReplayNarration = () => {
    if (!currentStop?.narration) return;
    cancelSpeech();
    setTourState('SPEAKING');
    speakWithVoice(currentStop.narration, {
      onEnd: () => setTourState('ARRIVED'),
    });
  };

  // Format seconds mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="guided-tour-root">
      {/* ── Top Header Bar ── */}
      <header className="tour-top-header">
        <button 
          className="tour-back-btn" 
          onClick={() => {
            handleCleanup();
            onNavigate('/');
          }}
          title="Return to Main Menu"
        >
          <ArrowLeft size={20} />
          <span>BACK</span>
        </button>

        <div className="tour-title-group">
          <h1>AUTONOMOUS GUIDED ROBOT TOUR</h1>
          <div className="tour-status-badges">
            <span className="tour-badge cyan">
              <Compass size={14} />
              <span>ROBOT NAV ENGINE</span>
            </span>
            <span className={`tour-badge ${isEspOnline ? 'green' : 'amber'}`}>
              <Radio size={14} />
              <span>{isEspOnline ? 'ESP32: ONLINE' : 'SIMULATION MODE'}</span>
            </span>
            <span className={`tour-state-pill ${tourState.toLowerCase()}`}>
              {tourState === 'IDLE' && 'READY TO START'}
              {tourState === 'NAVIGATING' && '🚗 DRIVING TO WAYPOINT...'}
              {tourState === 'SPEAKING' && '🔊 AURRA NARRATING...'}
              {tourState === 'ARRIVED' && '✨ WAYPOINT ARRIVAL'}
              {tourState === 'PAUSED' && '⏸️ TOUR PAUSED'}
              {tourState === 'EMERGENCY_STOP' && '🛑 EMERGENCY STOP'}
            </span>
          </div>
        </div>

        <button 
          className="tour-estop-btn"
          onClick={handleEmergencyStop}
          title="Immediate Emergency Brake & Stop"
        >
          <AlertOctagon size={18} />
          <span>E-STOP</span>
        </button>
      </header>

      {/* ── Main Split Body ── */}
      <div className="tour-main-body">
        {/* Left Side: Interactive Holographic Facility Floorplan Map */}
        <section className="tour-map-panel">
          <div className="map-panel-header">
            <span className="map-panel-title">
              <MapPin size={16} color="#00ffff" />
              <span>FACILITY WAYPOINT RADAR &amp; PATHFINDER</span>
            </span>
            <span className="map-telemetry">
              RADAR: {radarDistance.front}cm FRONT | {radarDistance.back}cm REAR
            </span>
          </div>

          <div className="holographic-map-container">
            {/* SVG Interactive Cyber Floorplan */}
            <svg className="facility-svg-map" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="cyberPathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00ffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                </linearGradient>
                <filter id="cyberGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Background Lines */}
              <pattern id="gridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0, 255, 255, 0.08)" strokeWidth="0.5" />
              </pattern>
              <rect width="100" height="100" fill="url(#gridPattern)" />

              {/* Facility Boundary Walls */}
              <rect x="5" y="10" width="90" height="80" rx="3" fill="none" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
              
              {/* Internal Department Partitions */}
              <line x1="50" y1="10" x2="50" y2="45" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.8" strokeDasharray="2,2" />
              <line x1="5" y1="50" x2="45" y2="50" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.8" strokeDasharray="2,2" />
              <line x1="55" y1="50" x2="95" y2="50" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.8" strokeDasharray="2,2" />

              {/* Connecting Laser Guide Path between stops */}
              {stops.length > 1 && (
                <polyline
                  points={stops.map((s) => `${s.mapX || 50},${s.mapY || 50}`).join(' ')}
                  fill="none"
                  stroke="url(#cyberPathGrad)"
                  strokeWidth="1.2"
                  strokeDasharray="3,2"
                  filter="url(#cyberGlow)"
                  className="pulsing-tour-path"
                />
              )}

              {/* Waypoint Markers */}
              {stops.map((stop, idx) => {
                const isActive = idx === currentIndex;
                const isVisited = idx < currentIndex;
                const x = stop.mapX || 50;
                const y = stop.mapY || 50;

                return (
                  <g 
                    key={stop.id || idx} 
                    className={`waypoint-node ${isActive ? 'active' : ''}`}
                    onClick={() => startTransitToStop(idx)}
                  >
                    {/* Outer Ping Ring for Active Node */}
                    {isActive && (
                      <circle cx={x} cy={y} r="6" fill="none" stroke="#00ffff" strokeWidth="0.8" className="ping-ring" />
                    )}
                    
                    {/* Node Base Circle */}
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={isActive ? 3.8 : 2.8} 
                      fill={isActive ? (stop.rgbColor || '#00ffff') : (isVisited ? '#00ffff' : '#1e293b')} 
                      stroke={isActive ? '#ffffff' : '#38bdf8'} 
                      strokeWidth="0.8"
                    />

                    {/* Stop Number Label */}
                    <text 
                      x={x} 
                      y={y + 1} 
                      textAnchor="middle" 
                      fontSize="2.2" 
                      fontWeight="bold" 
                      fill={isActive ? '#000000' : '#ffffff'}
                    >
                      {idx + 1}
                    </text>

                    {/* Stop Name Tag */}
                    <text 
                      x={x} 
                      y={y - 4} 
                      textAnchor="middle" 
                      fontSize="2.2" 
                      fill={isActive ? '#00ffff' : 'rgba(255, 255, 255, 0.7)'}
                      fontWeight={isActive ? 'bold' : 'normal'}
                    >
                      {stop.name}
                    </text>
                  </g>
                );
              })}

              {/* Animated Robot Position Marker */}
              {currentStop && (
                <g 
                  className="robot-position-marker"
                  transform={`translate(${currentStop.mapX || 50}, ${currentStop.mapY || 50})`}
                >
                  <circle cx="0" cy="0" r="4.5" fill="none" stroke="#00ffff" strokeWidth="1" className="robot-radar-pulse" />
                  <polygon points="0,-3.2 2.8,2.8 -2.8,2.8" fill="#00ffff" />
                </g>
              )}
            </svg>

            {/* Radar Proximity Obstacle Warning Banner */}
            {obstacleWarning && (
              <div className="tour-obstacle-alert">
                <ShieldAlert size={22} className="alert-icon" />
                <div>
                  <strong>OBSTACLE DETECTED ({radarDistance.front}cm)</strong>
                  <span>Tour paused. Clear path in front of Aurra to resume.</span>
                </div>
                <button className="resume-btn" onClick={handleResumeTour}>
                  Resume
                </button>
              </div>
            )}
          </div>

          {/* Bottom Waypoint Step Pills */}
          <div className="tour-waypoints-timeline">
            {stops.map((stop, idx) => {
              const isActive = idx === currentIndex;
              const isPast = idx < currentIndex;
              return (
                <div 
                  key={stop.id || idx} 
                  className={`waypoint-step ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                  onClick={() => startTransitToStop(idx)}
                >
                  <div className="step-circle">
                    {isPast ? <CheckCircle2 size={14} color="#10b981" /> : idx + 1}
                  </div>
                  <span className="step-label">{stop.name}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Side: Active Waypoint Showcase & Audio Narration Card */}
        <main className="tour-details-panel">
          {currentStop ? (
            <div className="exhibit-card">
              {/* Exhibit Header */}
              <div className="exhibit-header">
                <div className="exhibit-index-badge">
                  WAYPOINT {currentIndex + 1} OF {stops.length}
                </div>
                <span className="exhibit-area-pill">{currentStop.area}</span>
              </div>

              <h2 className="exhibit-title">{currentStop.name}</h2>

              {/* Highlights Chips */}
              {currentStop.highlights && currentStop.highlights.length > 0 && (
                <div className="exhibit-highlights">
                  {currentStop.highlights.map((item, i) => (
                    <span key={i} className="highlight-tag">
                      <Sparkles size={11} color="#00ffff" />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Aurra Spoken Narration Stream Box */}
              <div className="narration-stream-box">
                <div className="narration-stream-header">
                  <div className="aurra-voice-indicator">
                    <span className={`voice-dot ${tourState === 'SPEAKING' ? 'active' : ''}`} />
                    <span className="voice-title">AURRA SPOKEN NARRATION</span>
                  </div>
                  {tourState === 'SPEAKING' && (
                    <div className="sound-wave-bars">
                      <span /><span /><span /><span /><span />
                    </div>
                  )}
                </div>

                <div className="narration-text">
                  "{currentStop.narration || 'Proceeding along guided tour waypoint.'}"
                </div>

                <div className="narration-controls-row">
                  <button 
                    className="replay-speech-btn" 
                    onClick={handleReplayNarration}
                    title="Speak Narration Again"
                  >
                    <Volume2 size={16} />
                    <span>Replay Voice</span>
                  </button>
                  <span className="duration-tag">
                    EST. {currentStop.durationSec || 12}s PRESENTATION
                  </span>
                </div>
              </div>

              {/* Hardware & Servo Sync Card */}
              <div className="hardware-telemetry-row">
                <div className="hw-mini-card">
                  <span className="hw-label">TARGET EYE RGB</span>
                  <div className="rgb-color-badge">
                    <span className="rgb-swatch" style={{ background: currentStop.rgbColor || '#00FFFF' }} />
                    <strong>{currentStop.rgbColor || '#00FFFF'}</strong>
                  </div>
                </div>

                <div className="hw-mini-card">
                  <span className="hw-label">HEAD SERVO POSE</span>
                  <strong>Tilt: {currentStop.servoTilt ?? 90}° | Pan: {currentStop.servoPan ?? 90}°</strong>
                </div>

                <div className="hw-mini-card">
                  <span className="hw-label">TOUR TIME</span>
                  <strong>{formatTime(elapsedSeconds)}</strong>
                </div>
              </div>

              {/* Navigation Progress Bar while driving */}
              {tourState === 'NAVIGATING' && (
                <div className="transit-progress-container">
                  <div className="transit-label">
                    <span>TRANSIT TO WAYPOINT {currentIndex + 1}...</span>
                    <span>{Math.round(transitProgress)}%</span>
                  </div>
                  <div className="transit-bar-track">
                    <div className="transit-bar-fill" style={{ width: `${transitProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Primary Tour Controls Action Bar */}
              <div className="tour-actions-bar">
                <button 
                  className="tour-nav-btn" 
                  onClick={handlePrevStop}
                  disabled={currentIndex === 0 || tourState === 'NAVIGATING'}
                  title="Previous Waypoint"
                >
                  <SkipBack size={18} />
                  <span>PREV</span>
                </button>

                {tourState === 'IDLE' && (
                  <button className="tour-primary-btn start" onClick={handleStartTour}>
                    <Play size={20} />
                    <span>START GUIDED TOUR</span>
                  </button>
                )}

                {tourState === 'NAVIGATING' && (
                  <button className="tour-primary-btn pause" onClick={handlePauseTour}>
                    <Pause size={20} />
                    <span>PAUSE TRANSIT</span>
                  </button>
                )}

                {tourState === 'PAUSED' && (
                  <button className="tour-primary-btn resume" onClick={handleResumeTour}>
                    <Play size={20} />
                    <span>RESUME TOUR</span>
                  </button>
                )}

                {(tourState === 'ARRIVED' || tourState === 'SPEAKING') && (
                  <button 
                    className="tour-primary-btn next" 
                    onClick={handleNextStop}
                    title="Advance to next stop"
                  >
                    <span>NEXT WAYPOINT</span>
                    <SkipForward size={20} />
                  </button>
                )}

                <button 
                  className="tour-nav-btn" 
                  onClick={handleNextStop}
                  disabled={currentIndex === stops.length - 1 && !config.tourLoopEnabled}
                  title="Skip to Next Waypoint"
                >
                  <span>NEXT</span>
                  <SkipForward size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="tour-empty-state">
              <Compass size={48} color="#00ffff" />
              <h3>No Tour Waypoints Found</h3>
              <p>Configure waypoints in the Admin Dashboard to start the tour.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
