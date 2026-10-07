/**
 * Raspberry Pi Expression Engine Service for Testing App
 * 
 * Manages robot face expressions & HDMI animations on Raspberry Pi (Port 8080)
 * Ultra-low latency WebSocket & HTTP fallback with zero-lag background discovery
 */

import { logger } from './logger';
import { hasNativeHttp, nativeHttpGet, nativeHttpPost } from '../utils/androidNativeHttp';

const DEFAULT_PORT = 8080;
const DEFAULT_CANDIDATES = [
  'http://192.168.4.2:8080',
  'http://aurra-pi.local:8080',
  'http://raspberrypi.local:8080',
];

class RaspberryPiService {
  constructor() {
    this.savedIp = localStorage.getItem('aurra_pi_url') || '';
    this.activeUrl = this.savedIp || DEFAULT_CANDIDATES[0];
    this.online = false;
    this.isConnecting = false;
    this.currentExpression = 'idle';
    this.ws = null;
    this.subscribers = new Set();
    this.reconnectTimer = null;

    // Initial non-blocking ping
    this.autoConnect();
  }

  getSnapshot() {
    return {
      online: this.online,
      connected: this.online,
      activeUrl: this.activeUrl,
      currentExpression: this.currentExpression,
      isConnecting: this.isConnecting,
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getSnapshot());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const snap = this.getSnapshot();
    this.subscribers.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        /* ignore */
      }
    });
  }

  setPiUrl(url) {
    if (!url) return;
    let formatted = url.trim().replace(/\/$/, '');
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `http://${formatted}`;
    }
    if (!formatted.includes(':', 7)) {
      formatted = `${formatted}:${DEFAULT_PORT}`;
    }
    this.activeUrl = formatted;
    localStorage.setItem('aurra_pi_url', formatted);
    this.autoConnect([formatted]);
  }

  async ping(url, timeoutMs = 800) {
    if (hasNativeHttp()) {
      const native = nativeHttpGet(`${url}/health`);
      return !!(native && native.ok);
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  async autoConnect(customList = []) {
    if (this.isConnecting) return this.online;
    this.isConnecting = true;
    this.notify();

    const candidates = [
      ...new Set([
        this.activeUrl,
        ...customList,
        ...DEFAULT_CANDIDATES,
      ])
    ].filter(Boolean);

    // Test activeUrl first
    const isAlive = await this.ping(this.activeUrl, 700);
    if (isAlive) {
      this.online = true;
      this.isConnecting = false;
      this.notify();
      this.initWebSocket(this.activeUrl);
      logger.info('HARDWARE', `[RaspberryPi] Connected to ${this.activeUrl}`);
      return true;
    }

    // Fast race through candidates
    for (const cand of candidates) {
      if (cand === this.activeUrl) continue;
      const ok = await this.ping(cand, 600);
      if (ok) {
        this.activeUrl = cand;
        this.online = true;
        this.isConnecting = false;
        this.notify();
        this.initWebSocket(cand);
        logger.info('HARDWARE', `[RaspberryPi] Discovered at ${cand}`);
        return true;
      }
    }

    this.online = false;
    this.isConnecting = false;
    this.notify();
    return false;
  }

  initWebSocket(baseUrl) {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }

    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.online = true;
        this.notify();
        this.sendExpression(this.currentExpression);
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.online = false;
        this.notify();
      };

      this.ws.onerror = () => {
        this.ws = null;
      };
    } catch {
      this.ws = null;
    }
  }

  /**
   * Dispatch expression command to Raspberry Pi
   * Zero-lag: sends via WebSocket or fire-and-forget fetch, then updates local UI
   */
  async sendExpression(expressionName) {
    if (!expressionName) return;
    const name = String(expressionName).toLowerCase().trim();
    this.currentExpression = name;
    this.notify();

    logger.info('HARDWARE', `[TestingApp:PI] Expression: "${name.toUpperCase()}"`);

    const payload = JSON.stringify({
      type: 'expression',
      expression: name,
      action: name,
      timestamp: Date.now(),
    });

    // 1. Try WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(payload);
        return;
      } catch (err) {
        logger.warn('HARDWARE', `[RaspberryPi] WS send error: ${err.message}`);
      }
    }

    // 2. HTTP POST (native first, then fetch fallback)
    if (this.online && this.activeUrl) {
      if (hasNativeHttp()) {
        nativeHttpPost(`${this.activeUrl}/api/expression`, payload);
        return;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 600);
        fetch(`${this.activeUrl}/api/expression`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: controller.signal,
          mode: 'no-cors',
        }).finally(() => clearTimeout(timeout));
      } catch {
        /* ignore */
      }
    }
  }

  triggerAction(actionName) {
    return this.sendExpression(actionName);
  }

  setSpeechActive(isSpeaking) {
    if (isSpeaking) {
      this.sendExpression('talking');
    } else {
      this.sendExpression('smile');
    }
  }

  async testConnection(customUrl = null) {
    const targetUrl = customUrl ? customUrl.trim() : this.activeUrl;
    const start = performance.now();
    const ok = await this.ping(targetUrl, 1000);
    const latency = Math.round(performance.now() - start);

    if (ok) {
      this.activeUrl = targetUrl;
      this.online = true;
      this.notify();
      return { success: true, latency, url: targetUrl };
    }
    return { success: false, latency: null, url: targetUrl };
  }
}

export const raspberryPiService = new RaspberryPiService();
