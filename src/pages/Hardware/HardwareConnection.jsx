import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, Wifi, Cpu, Activity, Play, Zap, Globe, AlertTriangle } from 'lucide-react';
import { raspberryPiService } from '../../services/raspberryPiService';
import { esp32Service } from '../../services/esp32Service';
import './HardwareConnection.css';

export default function HardwareConnection({ onNavigate }) {
  const [piState, setPiState] = useState(raspberryPiService.getSnapshot());
  const [espState, setEspState] = useState(esp32Service.getState());
  const [piInputUrl, setPiInputUrl] = useState(piState.activeUrl || '');
  const [espInputIp, setEspInputIp] = useState(espState.ip || '192.168.4.1');
  const [staSsid, setStaSsid] = useState('');
  const [staPass, setStaPass] = useState('');
  const [testingPi, setTestingPi] = useState(false);
  const [isPingingEsp, setIsPingingEsp] = useState(false);
  const [espPingResult, setEspPingResult] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const unsubPi = raspberryPiService.subscribe((s) => setPiState(s));
    const unsubEsp = esp32Service.subscribe((s) => setEspState(s));
    return () => {
      unsubPi();
      unsubEsp();
    };
  }, []);

  const handleTestPiConnection = async (e) => {
    e.preventDefault();
    setTestingPi(true);
    setNotice('Testing Raspberry Pi connection on port 8080...');

    raspberryPiService.setPiUrl(piInputUrl);
    const res = await raspberryPiService.testConnection(piInputUrl);
    setTestingPi(false);

    if (res.success) {
      setNotice(`Connected to Raspberry Pi Expression Engine! Latency: ${res.latency}ms ✓`);
    } else {
      setNotice(`Could not reach Raspberry Pi at ${piInputUrl || 'default URLs'}. Running in zero-lag simulation mode.`);
    }
  };

  const triggerExpressionTest = (exprName) => {
    raspberryPiService.sendExpression(exprName);
    setNotice(`Triggered expression '${exprName.toUpperCase()}' on Raspberry Pi HDMI display`);
  };

  const handlePingEsp32 = async () => {
    setIsPingingEsp(true);
    setNotice('Testing ESP32 ping latency...');
    const res = await esp32Service.ping();
    setIsPingingEsp(false);
    setEspPingResult(res);

    if (res.success) {
      setNotice(`ESP32 Online! Latency: ${res.latency}ms (${res.mode.toUpperCase()} Mode) ✓`);
    } else {
      setNotice('ESP32 ping timed out. Operating in 90 FPS autonomous simulation mode.');
    }
  };

  const handleJoinAurraAp = () => {
    const success = esp32Service.joinAurraAp('Aurra', '12345678');
    if (success) {
      setNotice('Sent connection request to Android for "Aurra" Wi-Fi AP...');
    } else {
      setNotice('Please join "Aurra" Wi-Fi AP (12345678) in Android Settings.');
    }
    setTimeout(() => {
      esp32Service.setEspIp('192.168.4.1');
      esp32Service.checkConnection();
    }, 2000);
  };

  const handleSaveEspIp = (e) => {
    e.preventDefault();
    if (!espInputIp.trim()) return;
    esp32Service.setEspIp(espInputIp.trim());
    setNotice(`Saved ESP32 IP: ${espInputIp}. Testing connection...`);
    setTimeout(handlePingEsp32, 600);
  };

  const handlePairStationWifi = async (e) => {
    e.preventDefault();
    if (!staSsid.trim()) return;
    setNotice(`Sending Wi-Fi credentials to ESP32 for "${staSsid}"...`);
    const res = await esp32Service.connectStationWifi(staSsid, staPass);
    if (res.success) {
      setNotice(`Wi-Fi credentials saved! ESP32 is pairing to "${staSsid}"...`);
    } else {
      setNotice(`Wi-Fi pairing failed: ${res.error || 'Check ESP32 connection'}`);
    }
  };

  return (
    <div className="hw-conn-container">
      {/* Top Header */}
      <header className="hw-conn-header">
        <button 
          type="button" 
          className="hw-back-btn" 
          onClick={() => onNavigate('/')}
        >
          <ArrowLeft size={18} />
          <span>BACK</span>
        </button>

        <div className="hw-title-group">
          <h1>HARDWARE DIAGNOSTICS &amp; CONNECTION</h1>
          <p className="hw-subtitle">Raspberry Pi Expression Engine &amp; ESP32 Motor Controller LAN Sync</p>
        </div>

        <div className={`hw-overall-badge ${piState.online || espState.online ? 'online' : 'sim'}`}>
          <span className="hw-status-dot" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.06em' }}>
              {espState.online 
                ? (espState.mode === 'ap' ? 'DIRECT AP (HOTSPOT)' : 'STATION (WI-FI LAN)')
                : 'SIMULATION MODE'}
            </span>
            <span style={{ fontSize: '0.58rem', opacity: 0.7 }}>
              {espState.online 
                ? (espState.mode === 'ap' 
                    ? `"Aurra" • ${espState.ip}${espState.latency ? ` • ${espState.latency}ms` : ''}`
                    : `${espState.ssid ? `"${espState.ssid}" • ` : ''}${espState.ip}${espState.latency ? ` • ${espState.latency}ms` : ''}`)
                : 'Autonomous 90 FPS Simulation'}
            </span>
          </div>
        </div>
      </header>

      {notice && <div className="hw-notice-banner">{notice}</div>}

      <div className="hw-conn-grid">
        {/* ESP32 Robotics Panel */}
        <section className="hw-card esp-panel">
          <div className="hw-card-header">
            <div className="hw-card-title-group">
              <span className="hw-icon">⚡</span>
              <div>
                <h2>ESP32 Motor &amp; Servo Controller</h2>
                <span className="hw-device-sub">Drive Chassis, 5-Axis Servos &amp; RGB Eyes</span>
              </div>
            </div>
            <span className={`hw-status-pill ${espState.online ? 'connected' : 'simulation'}`}>
              {espState.online 
                ? `${espState.mode === 'ap' ? 'AP HOTSPOT' : 'STA LAN'} • ${espState.ip}${espState.latency ? ` • ${espState.latency}ms` : ''}`
                : 'SIMULATION MODE'}
            </span>
          </div>

          <div className="hw-card-body">
            {/* Quick AP Connect & Ping Row */}
            <div className="hw-quick-btn-row">
              <button
                type="button"
                className="hw-btn hw-btn-accent"
                onClick={handleJoinAurraAp}
              >
                <Zap size={15} />
                <span>Join "Aurra" AP (192.168.4.1)</span>
              </button>

              <button
                type="button"
                className="hw-btn hw-btn-secondary"
                onClick={handlePingEsp32}
                disabled={isPingingEsp}
              >
                <RefreshCw size={15} className={isPingingEsp ? 'spin' : ''} />
                <span>{isPingingEsp ? 'Pinging…' : 'Ping ESP32 Latency'}</span>
              </button>
            </div>

            {espPingResult && (
              <div className={`hw-ping-badge ${espPingResult.success ? 'online' : 'offline'}`}>
                {espPingResult.success
                  ? `Response in ${espPingResult.latency}ms (${espPingResult.mode.toUpperCase()} Mode)`
                  : 'Ping timed out — ESP32 not responding on local subnet'}
              </div>
            )}

            {/* Ultrasonic Radar Visualizer */}
            <div className="hw-radar-section">
              <span className="hw-input-label">Ultrasonic Radar Telemetry:</span>
              <div className="hw-radar-bars">
                <div className={`radar-item ${espState.frontDist <= 25 ? 'alert' : ''}`}>
                  <div className="radar-head">
                    <span>FRONT SENSOR</span>
                    <strong className="ctrl-mono">{espState.frontDist} cm</strong>
                  </div>
                  <div className="radar-meter-track">
                    <div 
                      className="radar-meter-fill front" 
                      style={{ width: `${Math.min(100, (espState.frontDist / 120) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className={`radar-item ${espState.backDist <= 25 ? 'alert' : ''}`}>
                  <div className="radar-head">
                    <span>REAR SENSOR</span>
                    <strong className="ctrl-mono">{espState.backDist} cm</strong>
                  </div>
                  <div className="radar-meter-track">
                    <div 
                      className="radar-meter-fill rear" 
                      style={{ width: `${Math.min(100, (espState.backDist / 120) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Manual IP input */}
            <form onSubmit={handleSaveEspIp} className="hw-ip-form">
              <label htmlFor="esp-ip-input" className="hw-input-label">
                ESP32 IP Address / Hostname:
              </label>
              <div className="hw-input-group">
                <input
                  id="esp-ip-input"
                  type="text"
                  placeholder="e.g. 192.168.4.1"
                  value={espInputIp}
                  onChange={(e) => setEspInputIp(e.target.value)}
                  className="hw-text-input"
                />
                <button type="submit" className="hw-btn hw-btn-primary">
                  Save &amp; Ping
                </button>
              </div>
            </form>

            {/* Station Wi-Fi Pairing */}
            <form onSubmit={handlePairStationWifi} className="hw-station-form">
              <span className="hw-input-label">Pair ESP32 to Office/Mobile Wi-Fi:</span>
              <div className="hw-station-inputs">
                <input
                  type="text"
                  placeholder="Wi-Fi SSID"
                  value={staSsid}
                  onChange={(e) => setStaSsid(e.target.value)}
                  className="hw-text-input"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={staPass}
                  onChange={(e) => setStaPass(e.target.value)}
                  className="hw-text-input"
                />
                <button type="submit" className="hw-btn hw-btn-accent">
                  <Globe size={14} />
                  <span>Push to ESP32</span>
                </button>
              </div>
            </form>

            <div className="hw-action-footer">
              <button
                type="button"
                onClick={() => onNavigate('/control')}
                className="hw-btn hw-btn-primary full-width"
              >
                <Zap size={15} />
                <span>Launch Physical Robot Cockpit</span>
              </button>
            </div>
          </div>
        </section>

        {/* Raspberry Pi Expression Engine Panel */}
        <section className="hw-card pi-panel">
          <div className="hw-card-header">
            <div className="hw-card-title-group">
              <span className="hw-icon">🍓</span>
              <div>
                <h2>Raspberry Pi Expression Engine</h2>
                <span className="hw-device-sub">HDMI GIF Display &amp; Face Reactions</span>
              </div>
            </div>
            <span className={`hw-status-pill ${piState.online ? 'connected' : 'simulation'}`}>
              {piState.online ? 'ONLINE ✓' : 'SIMULATION MODE'}
            </span>
          </div>

          <div className="hw-card-body">
            <div className="hw-info-row">
              <span className="hw-label">Active Connection URL:</span>
              <span className="hw-value ctrl-mono">{piState.activeUrl || 'Port 8080'}</span>
            </div>
            <div className="hw-info-row">
              <span className="hw-label">Current Face Expression:</span>
              <span className="hw-value highlight-expr">{piState.currentExpression.toUpperCase()}</span>
            </div>

            {/* Manual IP Input Form */}
            <form onSubmit={handleTestPiConnection} className="hw-ip-form">
              <label htmlFor="pi-url-input" className="hw-input-label">
                Raspberry Pi Endpoint (Port 8080):
              </label>
              <div className="hw-input-group">
                <input
                  id="pi-url-input"
                  type="text"
                  placeholder="e.g. http://192.168.4.2:8080"
                  value={piInputUrl}
                  onChange={(e) => setPiInputUrl(e.target.value)}
                  className="hw-text-input"
                />
                <button type="submit" disabled={testingPi} className="hw-btn hw-btn-primary">
                  {testingPi ? 'Testing…' : 'Test Pi'}
                </button>
              </div>
            </form>

            {/* Interactive Expression Tester */}
            <div className="hw-expression-tester">
              <span className="hw-input-label">Test Face Reactions Live on HDMI Display:</span>
              <div className="hw-expr-buttons">
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('idle')}
                  className="hw-expr-btn smile"
                >
                  😊 Smile / Idle
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('speaking')}
                  className="hw-expr-btn speaking"
                >
                  🗣️ Speaking / Talking
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('listening')}
                  className="hw-expr-btn listening"
                >
                  🎤 Listening
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('thinking')}
                  className="hw-expr-btn thinking"
                >
                  ⚡ Thinking
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('nod')}
                  className="hw-expr-btn nod"
                >
                  🤖 Affirmation Nod
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('greeting')}
                  className="hw-expr-btn greeting"
                >
                  👋 Welcome Greeting
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('bow')}
                  className="hw-expr-btn bow"
                >
                  🙇 Courtesy Bow
                </button>
                <button
                  type="button"
                  onClick={() => triggerExpressionTest('dance')}
                  className="hw-expr-btn dance"
                >
                  💃 Celebration Dance
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
