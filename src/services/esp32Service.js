/**
 * ESP32 & Hardware Robotics Service for Testing App
 * 
 * Uses Android native HttpURLConnection (via window.AndroidLauncher.httpRequest)
 * to communicate directly with ESP32 micro-controller on local Wi-Fi / SoftAP (192.168.4.1),
 * completely bypassing WebView CORS, network binding, and mixed-content limitations.
 */

import { logger } from './logger';
import { hasNativeHttp, nativeHttpGet, nativeHttpPost } from '../utils/androidNativeHttp';

const DEFAULT_ESP32_IP = '192.168.4.1'; // Aurra SoftAP Default

const fetchWithTimeout = async (url, options = {}, timeoutMs = 800) => {
  const method = (options.method || 'GET').toUpperCase();

  // 1. Android Native HTTP (Preferred on Tablet - executed non-blockingly)
  if (hasNativeHttp()) {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const native = method === 'POST' 
            ? nativeHttpPost(url, options.body || '')
            : nativeHttpGet(url);
          if (native) {
            resolve({
              ok: Boolean(native.ok),
              status: native.status || 0,
              text: async () => native.body || '',
              json: async () => {
                try { return JSON.parse(native.body || '{}'); } catch { return {}; }
              }
            });
            return;
          }
        } catch {
          /* fallback */
        }
        resolve({ ok: false, status: 0, text: async () => '', json: async () => ({}) });
      }, 0);
    });
  }

  // 2. Standard Browser Fetch Fallback
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

class Esp32Service {
  constructor() {
    this.espIp = localStorage.getItem('aurra_esp32_ip') || DEFAULT_ESP32_IP;
    this.online = false;
    this.mode = 'simulation'; // 'sta' | 'ap' | 'simulation'
    this.motorSpeedLeft = 180; // 0 - 255 PWM (Left Motor)
    this.motorSpeedRight = 180; // 0 - 255 PWM (Right Motor)
    this.motorSpeed = 180; // Combined average PWM
    this.servos = [90, 90, 90, 90, 90]; // 5 servos
    this.rgb = { r: 0, g: 255, b: 255 }; // Cyan default
    this.frontDist = 34; // cm
    this.backDist = 62; // cm
    this.currentMotorDir = 'stop';
    this.activeAction = null;
    this.subscribers = new Set();
    this.isChecking = false;
    this.staSsid = null;
    this.staIp = null;
    this.lastLatency = null;

    // Check connection immediately
    this.checkConnection();

    // Periodic heartbeat / distance polling (every 3 seconds)
    setInterval(() => {
      this.pollTelemetry();
    }, 3000);
  }

  getBaseUrl() {
    const cleanIp = this.espIp.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `http://${cleanIp}`;
  }

  async checkConnection() {
    if (this.isChecking) return this.online;
    this.isChecking = true;

    const base = this.getBaseUrl();
    const candidatePaths = ['/wifi/status', '/distance', '/'];

    let reachable = false;
    for (const path of candidatePaths) {
      try {
        const res = await fetchWithTimeout(`${base}${path}`, { method: 'GET' }, 800);
        if (res && res.ok) {
          reachable = true;
          if (path === '/wifi/status') {
            try {
              const data = await res.json();
              if (data && data.ssid) this.staSsid = data.ssid;
              if (data && data.ip) this.staIp = data.ip;
            } catch {}
          }
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (reachable) {
      this.online = true;
      this.mode = this.espIp.includes('192.168.4.') ? 'ap' : 'sta';
      logger.info('HARDWARE', `[ESP32] Online at ${base} (${this.mode.toUpperCase()})`);
    } else {
      this.online = false;
      this.mode = 'simulation';
    }

    this.isChecking = false;
    this.notify();
    return this.online;
  }

  async ping() {
    const start = performance.now();
    const base = this.getBaseUrl();
    const candidatePaths = ['/wifi/status', '/distance', '/'];

    for (const path of candidatePaths) {
      try {
        const res = await fetchWithTimeout(`${base}${path}`, { method: 'GET' }, 800);
        if (res && res.ok) {
          const latency = Math.round(performance.now() - start);
          this.lastLatency = latency;
          this.online = true;
          this.mode = this.espIp.includes('192.168.4.') ? 'ap' : 'sta';

          if (path === '/wifi/status') {
            try {
              const data = await res.json();
              if (data && data.ssid) this.staSsid = data.ssid;
              if (data && data.ip) this.staIp = data.ip;
            } catch {}
          }

          this.notify();
          return { success: true, latency, mode: this.mode, endpoint: `${base}${path}`, ssid: this.staSsid };
        }
      } catch {
        /* try next */
      }
    }

    this.online = false;
    this.mode = 'simulation';
    this.lastLatency = null;
    this.notify();
    return { success: false, latency: null, mode: 'simulation' };
  }

  joinAurraAp(ssid = 'Aurra', password = '12345678') {
    if (typeof window !== 'undefined' && typeof window.AndroidLauncher?.connectToWifi === 'function') {
      try {
        window.AndroidLauncher.connectToWifi(ssid, password);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  releaseWifiBinding() {
    if (typeof window !== 'undefined' && typeof window.AndroidLauncher?.releaseWifiNetwork === 'function') {
      try {
        window.AndroidLauncher.releaseWifiNetwork();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  setEspIp(ip) {
    if (!ip) return;
    this.espIp = ip.trim();
    localStorage.setItem('aurra_esp32_ip', this.espIp);
    this.checkConnection();
  }

  async pollTelemetry() {
    if (this.online) {
      try {
        const base = this.getBaseUrl();
        const res = await fetchWithTimeout(`${base}/distance`, { method: 'GET' }, 600);
        if (res && res.ok) {
          const data = await res.json();
          if (data) {
            if (data.front != null && data.front > 0) this.frontDist = Math.round(data.front);
            if (data.back != null && data.back > 0) this.backDist = Math.round(data.back);
            this.notify();
            return;
          }
        }
      } catch {
        // Soft fallback
      }
    }

    // Realistic variation in simulation mode
    if (this.mode === 'simulation') {
      this.frontDist = Math.max(10, Math.min(150, Math.round(34 + (Math.random() * 4 - 2))));
      this.backDist = Math.max(10, Math.min(150, Math.round(62 + (Math.random() * 6 - 3))));
      this.notify();
    }
  }

  // Motor Driving (/motor?cmd=forward|backward|left|right|stop)
  async sendMotorCommand(direction) {
    const cmd = direction.toLowerCase().trim();
    this.currentMotorDir = cmd;
    logger.info('HARDWARE', `[TestingApp:MOTOR] Command: ${cmd.toUpperCase()} | Speed: ${this.motorSpeed}`);

    // Fire-and-forget HTTP command to ESP32 only if online
    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/motor?cmd=${encodeURIComponent(cmd)}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
    return { success: true, direction: cmd };
  }

  setMotorSpeedLeft(speed) {
    const val = Math.max(0, Math.min(255, Number(speed) || 0));
    this.motorSpeedLeft = val;
    this.motorSpeed = Math.round((this.motorSpeedLeft + this.motorSpeedRight) / 2);

    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/speed?left=${encodeURIComponent(val)}`, { method: 'GET' }, 400).catch(() => {});
      fetchWithTimeout(`${base}/speed/left?value=${encodeURIComponent(val)}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
  }

  setMotorSpeedRight(speed) {
    const val = Math.max(0, Math.min(255, Number(speed) || 0));
    this.motorSpeedRight = val;
    this.motorSpeed = Math.round((this.motorSpeedLeft + this.motorSpeedRight) / 2);

    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/speed?right=${encodeURIComponent(val)}`, { method: 'GET' }, 400).catch(() => {});
      fetchWithTimeout(`${base}/speed/right?value=${encodeURIComponent(val)}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
  }

  setMotorSpeed(speed) {
    const val = Math.max(0, Math.min(255, Number(speed) || 0));
    this.motorSpeedLeft = val;
    this.motorSpeedRight = val;
    this.motorSpeed = val;

    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/speed?value=${encodeURIComponent(val)}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
  }

  // Servo Control (/servo?num=1..5&angle=0..180)
  async setServoAngle(servoIndex, angle) {
    const sIdx = Number(servoIndex);
    const clampedAngle = Math.max(0, Math.min(180, Number(angle) || 0));

    if (sIdx >= 0 && sIdx < this.servos.length) {
      this.servos[sIdx] = clampedAngle;
    }

    logger.info('HARDWARE', `[TestingApp:SERVO] S${sIdx + 1} -> ${clampedAngle}°`);

    // Fire-and-forget to ESP32 only if online
    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/servo?num=${sIdx + 1}&angle=${clampedAngle}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
    return { servo: sIdx + 1, angle: clampedAngle };
  }

  // RGB Eye & Lighting Control (/rgb?r=...&g=...&b=...)
  async setRgbColor(r, g, b) {
    this.rgb = {
      r: Math.max(0, Math.min(255, Math.round(Number(r) || 0))),
      g: Math.max(0, Math.min(255, Math.round(Number(g) || 0))),
      b: Math.max(0, Math.min(255, Math.round(Number(b) || 0))),
    };

    logger.info('HARDWARE', `[TestingApp:RGB] Set: RGB(${this.rgb.r}, ${this.rgb.g}, ${this.rgb.b})`);

    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/rgb?r=${this.rgb.r}&g=${this.rgb.g}&b=${this.rgb.b}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
  }

  // LED Presets (/led?color=red|green|blue|...)
  setLedPreset(presetId) {
    const presets = {
      neon: { r: 57, g: 255, b: 20 },
      red: { r: 255, g: 34, b: 68 },
      green: { r: 0, g: 230, b: 118 },
      blue: { r: 41, g: 121, b: 255 },
      yellow: { r: 255, g: 234, b: 0 },
      orange: { r: 255, g: 109, b: 0 },
      rose: { r: 245, g: 0, b: 87 },
      off: { r: 0, g: 0, b: 0 },
    };

    const target = presets[presetId] || presets.neon;
    this.rgb = { ...target };

    if (this.online) {
      const base = this.getBaseUrl();
      fetchWithTimeout(`${base}/led?color=${encodeURIComponent(presetId)}`, { method: 'GET' }, 400).catch(() => {});
    }

    this.notify();
  }

  // Automated Action Sequences (1 to 4)
  async triggerActionSequence(actionNum, onProgress) {
    if (this.activeAction !== null) return;
    this.activeAction = actionNum;
    this.notify();

    logger.info('HARDWARE', `[TestingApp:ACTION] Executing Action Sequence 0${actionNum}`);

    const duration = 2000;
    const startTime = Date.now();

    if (actionNum === 1) {
      this.setLedPreset('neon');
      [90, 110, 45, 90, 85].forEach((a, i) => this.setServoAngle(i, a));
    } else if (actionNum === 2) {
      this.setLedPreset('yellow');
      [120, 75, 110, 85, 120].forEach((a, i) => this.setServoAngle(i, a));
    } else if (actionNum === 3) {
      this.setLedPreset('blue');
      [45, 60, 90, 60, 45].forEach((a, i) => this.setServoAngle(i, a));
    } else if (actionNum === 4) {
      this.setLedPreset('rose');
      [150, 45, 135, 45, 150].forEach((a, i) => this.setServoAngle(i, a));
    }

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / duration) * 100));
        if (onProgress) onProgress(progress);

        if (elapsed >= duration) {
          clearInterval(interval);
          this.activeAction = null;
          [90, 90, 90, 90, 90].forEach((a, i) => this.setServoAngle(i, a));
          this.setLedPreset('neon');
          this.notify();
          resolve();
        }
      }, 50);
    });
  }

  sendServoAngle(servoIndex, angle) {
    return this.setServoAngle(servoIndex, angle);
  }

  async connectStationWifi(ssid, password) {
    const base = this.getBaseUrl();
    try {
      const body = new URLSearchParams({ 
        ssid: ssid.trim(), 
        password: password || '' 
      }).toString();

      const res = await fetchWithTimeout(
        `${base}/wifi/connect?ssid=${encodeURIComponent(ssid.trim())}&password=${encodeURIComponent(password || '')}`,
        { 
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        },
        15000
      );
      if (res && res.ok) {
        let json = null;
        try { json = await res.json(); } catch { json = null; }
        return { success: true, data: json };
      }
      return { success: false, error: 'ESP32 rejected Wi-Fi configuration' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async forgetStationWifi() {
    const base = this.getBaseUrl();
    try {
      const res = await fetchWithTimeout(`${base}/wifi/forget`, { method: 'GET' }, 3000);
      return { success: res && res.ok };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getWifiStatus() {
    const base = this.getBaseUrl();
    try {
      const res = await fetchWithTimeout(`${base}/wifi/status`, { method: 'GET' }, 2000);
      if (res && res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  getState() {
    const isAp = this.mode === 'ap' || (this.espIp && this.espIp.includes('192.168.4.'));
    const isSta = this.mode === 'sta';
    
    let connectionTitle = 'ESP32: SIMULATION';
    let connectionSummary = 'Simulation Mode';
    let connectionDetail = 'Autonomous 90 FPS Simulation (Hardware Offline)';

    if (this.online) {
      if (isAp) {
        connectionTitle = 'ESP32: DIRECT AP';
        connectionSummary = 'Direct Robot Hotspot (SoftAP)';
        connectionDetail = `Tablet paired to "Aurra" AP @ ${this.espIp}`;
      } else if (isSta) {
        connectionTitle = `ESP32: WI-FI LAN`;
        connectionSummary = `Station Mode (${this.staSsid || 'Local Wi-Fi'})`;
        connectionDetail = `Paired to Wi-Fi Router @ ${this.espIp}`;
      } else {
        connectionTitle = `ESP32: ONLINE`;
        connectionSummary = `Active Link (${this.espIp})`;
        connectionDetail = `Connected @ ${this.espIp}`;
      }
    }

    return {
      online: this.online,
      connected: this.online,
      ip: this.espIp,
      mode: this.online ? (isAp ? 'ap' : 'sta') : 'simulation',
      connectionTitle,
      connectionSummary,
      connectionDetail,
      ssid: this.staSsid || (isAp ? 'Aurra' : null),
      latency: this.lastLatency || null,
      motorSpeed: this.motorSpeed,
      motorSpeedLeft: this.motorSpeedLeft,
      motorSpeedRight: this.motorSpeedRight,
      servos: [...this.servos],
      rgb: { ...this.rgb },
      frontDist: this.frontDist,
      backDist: this.backDist,
      currentMotorDir: this.currentMotorDir,
      activeAction: this.activeAction,
    };
  }

  getConnectionStatus() {
    return this.getState();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach((cb) => {
      try { cb(state); } catch { /* ignore */ }
    });
  }
}

export const esp32Service = new Esp32Service();
