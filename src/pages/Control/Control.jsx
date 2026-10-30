import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Wifi, AlertTriangle, X, Play, RotateCcw,
  Sliders, Palette, ShieldAlert, Activity, Check, Zap,
  Radio, Globe, RefreshCw, Eye, Sparkles
} from 'lucide-react';
import { esp32Service } from '../../services/esp32Service';
import { raspberryPiService } from '../../services/raspberryPiService';
import { logger } from '../../services/logger';
import './Control.css';

const LED_PRESETS = [
  { id: 'neon',   label: 'NEON',   hex: '#39ff14' },
  { id: 'red',    label: 'RED',    hex: '#ff2244' },
  { id: 'green',  label: 'GREEN',  hex: '#00e676' },
  { id: 'blue',   label: 'BLUE',   hex: '#2979ff' },
  { id: 'yellow', label: 'YELLOW', hex: '#ffea00' },
  { id: 'orange', label: 'ORANGE', hex: '#ff6d00' },
  { id: 'rose',   label: 'ROSE',   hex: '#f50057' },
  { id: 'off',    label: 'OFF',    hex: '#333333' },
];

export default function Control({ onNavigate }) {
  const [hwState, setHwState] = useState(esp32Service.getState());
  const [piState, setPiState] = useState(raspberryPiService.getSnapshot());
  const [activeTab, setActiveTab] = useState('color'); // 'color' | 'servo'
  const [actionProgress, setActionProgress] = useState(0);

  // Network & Diagnostic Modal State
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [modalTab, setModalTab] = useState('esp'); // 'esp' | 'station' | 'pi'
  const [wifiIpInput, setWifiIpInput] = useState(hwState.espIp);
  const [staSsid, setStaSsid] = useState('');
  const [staPassword, setStaPassword] = useState('');
  const [piUrlInput, setPiUrlInput] = useState(piState.activeUrl || '');
  const [pingResult, setPingResult] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [wifiToast, setWifiToast] = useState('');

  // Joystick direct DOM ref + requestAnimationFrame scheduler for locked 90 FPS
  const thumbstickRef = useRef(null);
  const rafIdRef = useRef(null);

  const updateVisualJoystick = useCallback((x, y) => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (thumbstickRef.current) {
        thumbstickRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      rafIdRef.current = null;
    });
  }, []);

  // Subscribe to hardware state updates
  useEffect(() => {
    const unsubEsp = esp32Service.subscribe((state) => {
      setHwState(state);
    });
    const unsubPi = raspberryPiService.subscribe((state) => {
      setPiState(state);
    });

    // Listen for global voice hardware commands
    const handleVoiceHwCommand = (e) => {
      const { action } = e.detail;
      if (action === 'DRIVE_FORWARD') updateVisualJoystick(0, -28);
      else if (action === 'DRIVE_BACKWARD') updateVisualJoystick(0, 28);
      else if (action === 'DRIVE_ROTATE_LEFT') updateVisualJoystick(-28, 0);
      else if (action === 'DRIVE_ROTATE_RIGHT') updateVisualJoystick(28, 0);
      else if (action === 'DRIVE_HALT') updateVisualJoystick(0, 0);
    };

    window.addEventListener('aurra:hardware-command', handleVoiceHwCommand);

    // Completely block long-press context menu (Copy / Select All / Share) across Control cockpit
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    const handleSelectStart = (e) => {
      if (!['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) {
        e.preventDefault();
        return false;
      }
    };
    window.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });
    window.addEventListener('selectstart', handleSelectStart, { capture: true, passive: false });

    return () => {
      unsubEsp();
      unsubPi();
      window.removeEventListener('aurra:hardware-command', handleVoiceHwCommand);
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('selectstart', handleSelectStart, { capture: true });
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [updateVisualJoystick]);

  // Touch-and-hold motor driving
  const startDrive = (direction, dx, dy) => {
    updateVisualJoystick(dx, dy);
    logger.breadcrumb('HARDWARE', `Joystick drive: ${direction.toUpperCase()}`);
    esp32Service.sendMotorCommand(direction);
  };

  const stopDrive = () => {
    updateVisualJoystick(0, 0);
    esp32Service.sendMotorCommand('stop');
  };

  const handleSpeedLeftChange = (e) => {
    esp32Service.setMotorSpeedLeft(Number(e.target.value));
  };

  const handleSpeedRightChange = (e) => {
    esp32Service.setMotorSpeedRight(Number(e.target.value));
  };

  const handleServoChange = (index, value) => {
    esp32Service.setServoAngle(index, Number(value));
  };

  const handleColorPicker = (hex) => {
    logger.breadcrumb('HARDWARE', `Set RGB eye color to: ${hex}`);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      esp32Service.setRgbColor(r, g, b);
    }
  };

  const handleActionClick = (actionNum) => {
    if (hwState.activeAction !== null) return;
    logger.breadcrumb('HARDWARE', `Triggered Action Sequence #${actionNum}`);
    setActionProgress(0);
    esp32Service.triggerActionSequence(actionNum, (prog) => {
      setActionProgress(prog);
    });
  };

  const toHex = (c) => {
    const hex = Math.max(0, Math.min(255, Math.round(c || 0))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  const currentHex = `#${toHex(hwState.rgb.r)}${toHex(hwState.rgb.g)}${toHex(hwState.rgb.b)}`.toUpperCase();

  // Servo Presets
  const applyServoPreset = (presetName) => {
    if (presetName === 'center') {
      [90, 90, 90, 90, 90].forEach((a, i) => esp32Service.setServoAngle(i, a));
    } else if (presetName === 'lookup') {
      esp32Service.setServoAngle(0, 120);
      esp32Service.setServoAngle(1, 90);
    } else if (presetName === 'lookdown') {
      esp32Service.setServoAngle(0, 60);
      esp32Service.setServoAngle(1, 90);
    } else if (presetName === 'lookleft') {
      esp32Service.setServoAngle(1, 45);
    } else if (presetName === 'lookright') {
      esp32Service.setServoAngle(1, 135);
    }
  };

  // Diagnostic Ping Handler
  const handleTestPing = async () => {
    setIsPinging(true);
    setWifiToast('Testing ESP32 ping latency...');
    const res = await esp32Service.ping();
    setIsPinging(false);
    setPingResult(res);
    if (res.success) {
      setWifiToast(`ESP32 Online! Latency: ${res.latency}ms (${res.mode.toUpperCase()} Mode)`);
    } else {
      setWifiToast('ESP32 ping timed out. Operating in 90 FPS Simulation Mode.');
    }
  };

  // Direct AP Join
  const handleJoinAp = () => {
    const success = esp32Service.joinAurraAp('Aurra', '12345678');
    if (success) {
      setWifiToast('Sent connection request to Android for "Aurra" Wi-Fi AP...');
    } else {
      setWifiToast('Please connect tablet to "Aurra" Wi-Fi in Android Settings.');
    }
    setTimeout(() => {
      esp32Service.setEspIp('192.168.4.1');
      esp32Service.checkConnection();
    }, 2500);
  };

  // Save Custom IP
  const handleSaveWifi = (e) => {
    e.preventDefault();
    if (!wifiIpInput.trim()) return;
    esp32Service.setEspIp(wifiIpInput.trim());
    setWifiToast('ESP32 Endpoint Saved & Testing Connection...');
    setTimeout(() => {
      esp32Service.ping().then((res) => {
        setPingResult(res);
        if (res.success) {
          setWifiToast(`Connected to ESP32 at ${wifiIpInput} (${res.latency}ms)`);
        }
      });
    }, 800);
  };

  // Connect ESP32 to Station Wi-Fi
  const handleConnectStation = async (e) => {
    e.preventDefault();
    if (!staSsid.trim()) return;
    setWifiToast(`Sending Wi-Fi credentials to ESP32 for "${staSsid}"...`);
    const res = await esp32Service.connectStationWifi(staSsid, staPassword);
    if (res.success) {
      setWifiToast(`Credentials saved! ESP32 is pairing to "${staSsid}"...`);
    } else {
      setWifiToast(`Pairing failed: ${res.error || 'Check ESP32 connection'}`);
    }
  };

  // Forget Station Wi-Fi
  const handleForgetStation = async () => {
    setWifiToast('Clearing saved Wi-Fi from ESP32 flash memory...');
    const res = await esp32Service.forgetStationWifi();
    if (res.success) {
      setWifiToast('Station Wi-Fi cleared. ESP32 operating in SoftAP mode (192.168.4.1).');
    } else {
      setWifiToast('Could not clear Wi-Fi. Check connection.');
    }
  };

  // Pi Connection Test
  const handleTestPi = async (e) => {
    e.preventDefault();
    setWifiToast(`Testing Raspberry Pi at ${piUrlInput || 'default port 8080'}...`);
    const res = await raspberryPiService.testConnection(piUrlInput);
    if (res.success) {
      setWifiToast(`Raspberry Pi Online! Latency: ${res.latency}ms`);
    } else {
      setWifiToast('Raspberry Pi not reachable. Operating in zero-lag simulation mode.');
    }
  };

  // Pi Expression Trigger
  const handleTriggerPiExpr = (expr) => {
    raspberryPiService.sendExpression(expr);
    setWifiToast(`Triggered "${expr.toUpperCase()}" on Raspberry Pi HDMI display!`);
  };

  return (
    <div className="ctrl-cockpit-root ps5-gamepad-theme">
      {/* ── TOP BAR ── */}
      <header className="ctrl-cockpit-topbar">
        <button 
          type="button" 
          className="ctrl-cockpit-back" 
          onClick={() => onNavigate('/')}
          aria-label="Back to main kiosk"
        >
          <ArrowLeft size={18} />
          <span>BACK</span>
        </button>

        <div className="ctrl-cockpit-title-wrap">
          <h1 className="ctrl-cockpit-title">AURRA CONTROL</h1>
          <span className="ctrl-cockpit-subtitle">PHYSICAL GAMEPAD ROBOTICS STATION</span>
        </div>

        <div className="ctrl-topbar-right">
          {/* ESP32 Status & Wi-Fi Connection Indication Badge */}
          <div 
            className={`ctrl-cockpit-status-badge esp-conn-badge ${
              hwState.online 
                ? (hwState.mode === 'ap' ? 'mode-ap' : 'mode-sta') 
                : 'simulation'
            }`}
            onClick={() => handleTestPing()}
            title="Click to test live ESP32 ping & network latency"
          >
            <div className="esp-badge-indicator">
              <span className="ctrl-cockpit-status-dot" />
              <Wifi size={13} className="esp-wifi-icon" />
            </div>
            <div className="esp-badge-content">
              <div className="esp-badge-row-main">
                <span className="esp-badge-title">
                  {hwState.online 
                    ? (hwState.mode === 'ap' ? 'ESP32: DIRECT AP' : 'ESP32: WI-FI LAN')
                    : 'ESP32: SIMULATION'}
                </span>
                {hwState.online && hwState.latency && (
                  <span className="esp-badge-latency">{hwState.latency}ms</span>
                )}
              </div>
              <span className="esp-badge-sub">
                {hwState.online 
                  ? (hwState.mode === 'ap' 
                      ? `Hotspot "Aurra" • ${hwState.ip}`
                      : `${hwState.ssid ? `"${hwState.ssid}" • ` : ''}${hwState.ip}`)
                  : 'Autonomous 90 FPS • Tap to Ping'}
              </span>
            </div>
          </div>

          {/* Raspberry Pi Status Badge */}
          <div 
            className={`ctrl-cockpit-status-badge ${piState.online ? 'online' : 'simulation'}`}
            onClick={() => setShowWifiModal(true)}
            title="Raspberry Pi Expression Engine"
          >
            <span className="ctrl-cockpit-status-dot pi-dot" />
            <span className="ctrl-cockpit-status-text">
              {piState.online ? 'PI: 8080' : 'PI: SIM'}
            </span>
          </div>

          {/* Wi-Fi Config Button */}
          <button
            type="button"
            className="ctrl-cockpit-wifi-btn"
            onClick={() => setShowWifiModal(true)}
            title="Hardware & Network Settings"
          >
            <Wifi size={16} />
            <span>LAN BRIDGE</span>
          </button>
        </div>
      </header>

      {/* ── PS5 GAMEPAD MAIN CONSOLE DECK ── */}
      <main className="ps5-gamepad-deck">
        {/* ── TOP SHOULDER CONTROLS & ROTARY SPEED DIAL ── */}
        <div className="ps5-top-controls-bar">
          {/* Dual Independent Motor Speed Controls (L2 Left Motor / R2 Right Motor) */}
          <div className="ps5-dual-speed-container">
            {/* LEFT MOTOR SPEED (L2) */}
            <div className="ps5-speed-rotary-dial left-motor">
              <div className="speed-dial-badge">
                <span className="dial-tag l2">L2</span>
                <span className="dial-label">LEFT</span>
              </div>
              <div className="speed-dial-readout">
                <span className="dial-title">LEFT MOTOR</span>
                <span className="dial-val ctrl-mono-text">
                  {Math.round(((hwState.motorSpeedLeft ?? hwState.motorSpeed ?? 180) / 255) * 100)}%
                </span>
              </div>
              <input
                type="range"
                className="ctrl-cockpit-slider speed-rotary-slider"
                min={0}
                max={255}
                value={hwState.motorSpeedLeft ?? hwState.motorSpeed ?? 180}
                onChange={handleSpeedLeftChange}
              />
            </div>

            {/* RIGHT MOTOR SPEED (R2) */}
            <div className="ps5-speed-rotary-dial right-motor">
              <div className="speed-dial-badge">
                <span className="dial-tag r2">R2</span>
                <span className="dial-label">RIGHT</span>
              </div>
              <div className="speed-dial-readout">
                <span className="dial-title">RIGHT MOTOR</span>
                <span className="dial-val ctrl-mono-text">
                  {Math.round(((hwState.motorSpeedRight ?? hwState.motorSpeed ?? 180) / 255) * 100)}%
                </span>
              </div>
              <input
                type="range"
                className="ctrl-cockpit-slider speed-rotary-slider"
                min={0}
                max={255}
                value={hwState.motorSpeedRight ?? hwState.motorSpeed ?? 180}
                onChange={handleSpeedRightChange}
              />
            </div>
          </div>

          {/* Servo vs RGB Tab Switcher */}
          <div className="ps5-servo-toggle-bar">
            <div className="servo-toggle-info align-right">
              <span className="dial-title">ROBOT HARDWARE CORE</span>
              <span className="dial-sub">R1 / R2 TELEMETRY DUAL DECK</span>
            </div>
            <div className="servo-toggle-pills">
              <button
                type="button"
                className={`servo-pill ${activeTab === 'color' ? 'active' : ''}`}
                onClick={() => setActiveTab('color')}
              >
                <Palette size={14} />
                <span>RGB WHEEL</span>
              </button>
              <button
                type="button"
                className={`servo-pill ${activeTab === 'servo' ? 'active' : ''}`}
                onClick={() => setActiveTab('servo')}
              >
                <Sliders size={14} />
                <span>5-AXIS SERVOS</span>
              </button>
            </div>
            <div className="speed-dial-badge">
              <span className="dial-tag">R2</span>
              <span className="dial-tag">R1</span>
            </div>
          </div>
        </div>

        {/* ── 3-COLUMN PHYSICAL GAMEPAD DECK ── */}
        <div className="ps5-gamepad-3col-deck">
          {/* ── LEFT ZONE: MOVEMENT CONTROLLER ── */}
          <section className="ps5-gamepad-zone left-zone">
            <div className="zone-header">
              <h2 className="zone-title">MOVEMENT CONTROLLER</h2>
              <span className="zone-sub ctrl-mono-text">D-PAD ▲ FWD • ▼ BWD • ◀ LEFT • ▶ RIGHT</span>
            </div>

            {/* Interactive Real Analog Joystick Base */}
            <div 
              className="ps5-analog-joystick-base"
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
              onSelectStart={(e) => { e.preventDefault(); return false; }}
            >
              <div 
                className="joystick-ring-outer"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                onSelectStart={(e) => { e.preventDefault(); return false; }}
              >
                <div 
                  className="joystick-ring-inner"
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                  onSelectStart={(e) => { e.preventDefault(); return false; }}
                >
                  {/* Visual Draggable Thumbstick Knob */}
                  <div
                    ref={thumbstickRef}
                    className="ctrl-analog-thumbstick-knob"
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                    onSelectStart={(e) => { e.preventDefault(); return false; }}
                    draggable={false}
                  >
                    <div className="knob-cap-core" />
                  </div>

                  {/* Tactile D-Pad Triggers Overlay */}
                  <button
                    type="button"
                    className="joy-trigger-btn trigger-fwd"
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startDrive('forward', 0, -28); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onMouseDown={(e) => { e.preventDefault(); startDrive('forward', 0, -28); }}
                    onMouseUp={stopDrive}
                    onMouseLeave={stopDrive}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                    onSelectStart={(e) => { e.preventDefault(); return false; }}
                    draggable={false}
                    title="Move Forward"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="joy-trigger-btn trigger-left"
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startDrive('left', -28, 0); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onMouseDown={(e) => { e.preventDefault(); startDrive('left', -28, 0); }}
                    onMouseUp={stopDrive}
                    onMouseLeave={stopDrive}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                    onSelectStart={(e) => { e.preventDefault(); return false; }}
                    draggable={false}
                    title="Turn Left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="joy-trigger-btn trigger-right"
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startDrive('right', 28, 0); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onMouseDown={(e) => { e.preventDefault(); startDrive('right', 28, 0); }}
                    onMouseUp={stopDrive}
                    onMouseLeave={stopDrive}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                    onSelectStart={(e) => { e.preventDefault(); return false; }}
                    draggable={false}
                    title="Turn Right"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className="joy-trigger-btn trigger-bwd"
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startDrive('backward', 0, 28); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); stopDrive(); }}
                    onMouseDown={(e) => { e.preventDefault(); startDrive('backward', 0, 28); }}
                    onMouseUp={stopDrive}
                    onMouseLeave={stopDrive}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
                    onSelectStart={(e) => { e.preventDefault(); return false; }}
                    draggable={false}
                    title="Move Backward"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>

            {/* Precision Drive Telemetry Module */}
            <div className={`ps5-status-module left-module ${hwState.frontDist <= 25 ? 'obstacle-alert' : ''}`}>
              <span className="mod-label">
                {hwState.frontDist <= 25 ? '⚠️ FRONT OBSTACLE WARNING' : 'PRECISION DRIVE ULTRASONIC'}
              </span>
              <span className="mod-val ctrl-mono-text">
                FRONT {hwState.frontDist != null ? `${hwState.frontDist}cm` : '--'}
              </span>
            </div>
          </section>

          {/* ── CENTER ZONE: RGB WHEEL / SERVO SLIDERS & EMERGENCY STOP ── */}
          <section className="ps5-gamepad-zone center-zone">
            {activeTab === 'color' ? (
              <div className="ps5-circular-rgb-container">
                <div className="zone-header align-center">
                  <h2 className="zone-title">AURRA RGB EYE LIGHTING</h2>
                  <span className="zone-sub ctrl-mono-text">CIRCULAR HUE SPECTRUM WHEEL</span>
                </div>

                {/* Circular RGB Spectrum Picker Wheel */}
                <div className="ps5-color-spectrum-wheel-wrap">
                  <div
                    className="ps5-color-spectrum-wheel"
                    style={{
                      boxShadow: `0 0 35px rgba(${hwState.rgb.r}, ${hwState.rgb.g}, ${hwState.rgb.b}, 0.75), inset 0 0 20px rgba(255,255,255,0.3)`
                    }}
                  >
                    {/* Native Hex Color Picker Input */}
                    <input
                      type="color"
                      className="ps5-hidden-hex-input"
                      value={currentHex}
                      onChange={(e) => handleColorPicker(e.target.value)}
                    />

                    {/* Center Circular Live Preview Core */}
                    <div
                      className="ps5-center-color-preview-core"
                      style={{ background: `rgb(${hwState.rgb.r}, ${hwState.rgb.g}, ${hwState.rgb.b})` }}
                    >
                      <span className="core-hex-text ctrl-mono-text">{currentHex}</span>
                      <span className="core-rgb-text ctrl-mono-text">
                        RGB({hwState.rgb.r}, {hwState.rgb.g}, {hwState.rgb.b})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 8 Circular LED Color Presets Swatches */}
                <div className="ps5-presets-halo-row">
                  {LED_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="ps5-halo-swatch"
                      style={{ '--swatch-hex': p.hex }}
                      onClick={() => esp32Service.setLedPreset(p.id)}
                      title={p.label}
                    >
                      <div className="halo-dot" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ps5-servo-sliders-container">
                <div className="zone-header align-center">
                  <h2 className="zone-title">5-AXIS SERVO CONTROLLER</h2>
                  <span className="zone-sub ctrl-mono-text">HEAD PAN/TILT &amp; ANIMATRONIC SERVOS</span>
                </div>

                {/* Quick Presets Row */}
                <div className="servo-quick-presets-row">
                  <button type="button" className="servo-quick-btn" onClick={() => applyServoPreset('center')}>
                    Center (90°)
                  </button>
                  <button type="button" className="servo-quick-btn" onClick={() => applyServoPreset('lookup')}>
                    Look Up
                  </button>
                  <button type="button" className="servo-quick-btn" onClick={() => applyServoPreset('lookdown')}>
                    Look Down
                  </button>
                  <button type="button" className="servo-quick-btn" onClick={() => applyServoPreset('lookleft')}>
                    Look Left
                  </button>
                  <button type="button" className="servo-quick-btn" onClick={() => applyServoPreset('lookright')}>
                    Look Right
                  </button>
                </div>

                <div className="ps5-servo-sliders-list">
                  {hwState.servos.map((angle, i) => (
                    <div key={i} className="ps5-servo-row">
                      <span className="servo-label">
                        {i === 0 ? 'S1 TILT' : i === 1 ? 'S2 PAN' : `S${i + 1} SERVO`}
                      </span>
                      <input
                        type="range"
                        className="ctrl-cockpit-slider servo-slider"
                        min={0}
                        max={180}
                        value={angle}
                        onChange={(e) => handleServoChange(i, e.target.value)}
                      />
                      <span className="servo-val ctrl-mono-text">{angle}°</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raised Physical Industrial Emergency Stop Button */}
            <div className="ps5-physical-emergency-wrap">
              <button
                type="button"
                className="ps5-raised-emergency-btn"
                onTouchStart={(e) => { e.preventDefault(); stopDrive(); }}
                onMouseDown={stopDrive}
                title="EMERGENCY MOTOR STOP"
              >
                <div className="emergency-btn-bevel">
                  <span className="emergency-stop-text">STOP</span>
                  <span className="emergency-sub-text">EMERGENCY</span>
                </div>
              </button>
            </div>
          </section>

          {/* ── RIGHT ZONE: DIAMOND ACTION BUTTON CLUSTER ── */}
          <section className="ps5-gamepad-zone right-zone">
            <div className="zone-header align-right">
              <h2 className="zone-title">AUTOMATED ACTIONS</h2>
              <span className="zone-sub ctrl-mono-text">△ GREET • ○ ALERT • × BOW • □ DANCE</span>
            </div>

            {/* PlayStation Diamond Face Button Cluster */}
            <div className="ps5-diamond-cluster-wrap">
              <div className="ps5-diamond-cluster">
                {/* TOP: △ ACTION 01 (Triangle — Neon Green) */}
                <button
                  type="button"
                  className={`ps5-diamond-btn btn-top-triangle ${hwState.activeAction === 1 ? 'running' : ''}`}
                  disabled={hwState.activeAction !== null}
                  onClick={() => handleActionClick(1)}
                  title="△ ACTION 01: Welcome Greeting"
                >
                  <span className="shape-symbol">△</span>
                  <span className="shape-label">ACTION 01</span>
                  {hwState.activeAction === 1 && (
                    <div className="shape-progress-ring" style={{ '--action-prog': `${actionProgress}%` }} />
                  )}
                </button>

                {/* RIGHT: ○ ACTION 02 (Circle — Coral Red) */}
                <button
                  type="button"
                  className={`ps5-diamond-btn btn-right-circle ${hwState.activeAction === 2 ? 'running' : ''}`}
                  disabled={hwState.activeAction !== null}
                  onClick={() => handleActionClick(2)}
                  title="○ ACTION 02: Attention Alert"
                >
                  <span className="shape-symbol">○</span>
                  <span className="shape-label">ACTION 02</span>
                  {hwState.activeAction === 2 && (
                    <div className="shape-progress-ring" style={{ '--action-prog': `${actionProgress}%` }} />
                  )}
                </button>

                {/* BOTTOM: × ACTION 03 (Cross — Electric Blue) */}
                <button
                  type="button"
                  className={`ps5-diamond-btn btn-bottom-cross ${hwState.activeAction === 3 ? 'running' : ''}`}
                  disabled={hwState.activeAction !== null}
                  onClick={() => handleActionClick(3)}
                  title="× ACTION 03: Courtesy Bow"
                >
                  <span className="shape-symbol">×</span>
                  <span className="shape-label">ACTION 03</span>
                  {hwState.activeAction === 3 && (
                    <div className="shape-progress-ring" style={{ '--action-prog': `${actionProgress}%` }} />
                  )}
                </button>

                {/* LEFT: □ ACTION 04 (Square — Vibrant Gold) */}
                <button
                  type="button"
                  className={`ps5-diamond-btn btn-left-square ${hwState.activeAction === 4 ? 'running' : ''}`}
                  disabled={hwState.activeAction !== null}
                  onClick={() => handleActionClick(4)}
                  title="□ ACTION 04: Celebration Dance"
                >
                  <span className="shape-symbol">□</span>
                  <span className="shape-label">ACTION 04</span>
                  {hwState.activeAction === 4 && (
                    <div className="shape-progress-ring" style={{ '--action-prog': `${actionProgress}%` }} />
                  )}
                </button>
              </div>
            </div>

            {/* Rear Distance / Cam Pan Telemetry */}
            <div className={`ps5-status-module right-module ${hwState.backDist <= 25 ? 'obstacle-alert' : ''}`}>
              <span className="mod-label">
                {hwState.backDist <= 25 ? '⚠️ REAR CLEARANCE LOW' : 'HEAD / CAM PAN ULTRASONIC'}
              </span>
              <span className="mod-val ctrl-mono-text">
                BACK {hwState.backDist != null ? `${hwState.backDist}cm` : '--'}
              </span>
            </div>
          </section>
        </div>
      </main>

      {/* ── COLOR-CODED TELEMETRY LEGEND BAR ── */}
      <footer className="ps5-cockpit-legend-bar">
        <div className="legend-item">
          <span className="legend-dot cyan" />
          <span>Movement / Navigation</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot green" />
          <span>Automated Gestures</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot red" />
          <span>Emergency Halt</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot gold" />
          <span>Motor PWM Drive</span>
        </div>
      </footer>

      {/* ── HARDWARE LAN & DIAGNOSTIC MODAL ── */}
      {showWifiModal && (
        <div className="ctrl-modal-overlay" onClick={() => setShowWifiModal(false)}>
          <div className="ctrl-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ctrl-modal-header">
              <div className="ctrl-modal-title-group">
                <Wifi size={20} color="#00ffff" />
                <h2>HARDWARE NETWORK &amp; DIAGNOSTICS</h2>
              </div>
              <button 
                type="button" 
                className="ctrl-close-modal" 
                onClick={() => setShowWifiModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="ctrl-modal-tabs">
              <button
                type="button"
                className={`ctrl-tab-btn ${modalTab === 'esp' ? 'active' : ''}`}
                onClick={() => setModalTab('esp')}
              >
                <Zap size={14} />
                <span>ESP32 AP (192.168.4.1)</span>
              </button>
              <button
                type="button"
                className={`ctrl-tab-btn ${modalTab === 'station' ? 'active' : ''}`}
                onClick={() => setModalTab('station')}
              >
                <Globe size={14} />
                <span>Station Wi-Fi Mode</span>
              </button>
              <button
                type="button"
                className={`ctrl-tab-btn ${modalTab === 'pi' ? 'active' : ''}`}
                onClick={() => setModalTab('pi')}
              >
                <Radio size={14} />
                <span>Raspberry Pi (8080)</span>
              </button>
            </div>

            {wifiToast && <div className="ctrl-toast-msg">{wifiToast}</div>}

            {/* TAB 1: ESP32 AP & Ping Diagnostics */}
            {modalTab === 'esp' && (
              <div className="modal-tab-body">
                <div className="form-info-box">
                  <strong>ESP32 DIRECT SOFTAP MODE</strong>
                  <p>
                    When connected to <code>SSID: Aurra</code>, the ESP32 serves motor and servo commands at <code>http://192.168.4.1</code> with sub-50ms latency.
                  </p>
                </div>

                <div className="quick-action-row">
                  <button
                    type="button"
                    className="modal-quick-action-btn primary"
                    onClick={handleJoinAp}
                  >
                    <Zap size={16} />
                    <span>Join "Aurra" Robot AP Hotspot</span>
                  </button>

                  <button
                    type="button"
                    className="modal-quick-action-btn secondary"
                    onClick={handleTestPing}
                    disabled={isPinging}
                  >
                    <RefreshCw size={16} className={isPinging ? 'spin' : ''} />
                    <span>{isPinging ? 'Pinging…' : 'Test Ping Latency'}</span>
                  </button>
                </div>

                {pingResult && (
                  <div className={`ping-result-box ${pingResult.success ? 'online' : 'offline'}`}>
                    <span>Status: {pingResult.success ? `ONLINE (${pingResult.latency}ms)` : 'OFFLINE'}</span>
                    <span className="ctrl-mono-text">Endpoint: {pingResult.endpoint || `http://${hwState.espIp}`}</span>
                  </div>
                )}

                <form className="ctrl-wifi-form" onSubmit={handleSaveWifi}>
                  <div className="form-group">
                    <label>Manual ESP32 IP or Hostname:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.4.1"
                      value={wifiIpInput}
                      onChange={(e) => setWifiIpInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="save-wifi-btn">
                    <Check size={16} />
                    <span>Save Endpoint &amp; Re-Test</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: Station Wi-Fi Configuration */}
            {modalTab === 'station' && (
              <div className="modal-tab-body">
                <div className="form-info-box">
                  <strong>PAIR ESP32 TO OFFICE / MOBILE WI-FI</strong>
                  <p>
                    Configure the ESP32 to join your local router or mobile hotspot. This allows both online AI queries and robot motor control on the same subnet.
                  </p>
                </div>

                <form className="ctrl-wifi-form" onSubmit={handleConnectStation}>
                  <div className="form-group">
                    <label>Wi-Fi Network Name (SSID):</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter Wi-Fi SSID"
                      value={staSsid}
                      onChange={(e) => setStaSsid(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Wi-Fi Password:</label>
                    <input
                      type="password"
                      placeholder="Enter password (or leave blank if open)"
                      value={staPassword}
                      onChange={(e) => setStaPassword(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="save-wifi-btn">
                    <Globe size={16} />
                    <span>Push Credentials to ESP32</span>
                  </button>
                </form>

                <div className="forget-wifi-wrap">
                  <button
                    type="button"
                    className="forget-wifi-btn"
                    onClick={handleForgetStation}
                  >
                    Forget Saved Wi-Fi (Reset to Default AP)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Raspberry Pi (Port 8080) */}
            {modalTab === 'pi' && (
              <div className="modal-tab-body">
                <div className="form-info-box">
                  <strong>RASPBERRY PI EXPRESSION ENGINE (PORT 8080)</strong>
                  <p>
                    Controls full-screen animated face reaction GIFs on the robot's HDMI display via REST &amp; WebSocket.
                  </p>
                </div>

                <form className="ctrl-wifi-form" onSubmit={handleTestPi}>
                  <div className="form-group">
                    <label>Raspberry Pi Address:</label>
                    <input
                      type="text"
                      placeholder="e.g. http://192.168.4.2:8080"
                      value={piUrlInput}
                      onChange={(e) => setPiUrlInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="save-wifi-btn">
                    <Activity size={16} />
                    <span>Test Pi Connection</span>
                  </button>
                </form>

                <div className="pi-expr-quick-grid">
                  <span className="form-subhead">Test Live Face Reaction:</span>
                  <div className="pi-expr-btns">
                    {['smile', 'talking', 'angry', 'love', 'listening', 'thinking', 'nod', 'greeting', 'dance'].map((expr) => (
                      <button
                        key={expr}
                        type="button"
                        className="pi-expr-pill"
                        onClick={() => handleTriggerPiExpr(expr)}
                      >
                        {expr.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
