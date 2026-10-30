/**
 * Raspberry Pi Expression Engine Service for Aurra Robot
 * 
 * Manages robot face expressions & HDMI animations on Raspberry Pi (Port 8080)
 * HTTP REST (/api/expression, /health) with resilient Android Native & WebView fetch fallback
 */

import { logger } from './logger.js';
import { hasNativeHttp, nativeHttpGet, nativeHttpPost } from '../utils/androidNativeHttp.js';

const DEFAULT_PORT = 8080;
const DEFAULT_CANDIDATES = [
  'http://192.168.0.10:8080',
  'http://192.168.0.25:8080',
  'http://192.168.4.2:8080',
  'http://aurra-pi.local:8080',
  'http://raspberrypi.local:8080',
];

/**
 * Expressions natively supported by the Raspberry Pi Flask server GIF_MAP
 * Mapped on Raspberry Pi to:
 * - idle / smile -> smile.gif
 * - talking / speaking -> Speaking_Smile.gif
 * - angry -> angry.gif
 * - love / smiling -> love.gif
 */
export const PI_SUPPORTED_EXPRESSIONS = new Set([
  'idle',
  'smile',
  'talking',
  'speaking',
  'angry',
  'love',
  'smiling',
]);

/**
 * Deliberate semantic fallbacks for robot actions that do not yet have dedicated GIF files
 * on the Raspberry Pi (/home/aurra/aurra_expression/static).
 * Prevents HTTP 400 "Unknown expression" errors from the Flask server while preserving intent.
 */
export const PI_EXPRESSION_FALLBACKS = {
  // Emotional / Alert equivalents
  happy: 'smile',
  alert: 'angry',       // Alert warning maps to angry.gif until alert.gif is added
  warning: 'angry',
  blink: 'smile',
  glow: 'love',

  // Conversational / Kinematic fallbacks
  listening: 'smile',   // Attentive listening face until listening.gif is added
  thinking: 'smile',    // Cognitive processing face until thinking.gif is added
  nod: 'smile',         // Affirmative reaction until nod.gif is added
  greeting: 'smile',    // Welcome greeting smile until greeting.gif is added
  bow: 'smile',         // Courtesy bow until bow.gif is added
  dance: 'love',        // Celebratory joyful reaction until dance.gif is added
};

class RaspberryPiService {
  constructor() {
    const getStoredUrl = () => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return localStorage.getItem('aurra_pi_url') || '';
        }
      } catch {
        /* ignore */
      }
      return '';
    };

    this.savedIp = getStoredUrl();
    this.activeUrl = this.savedIp || DEFAULT_CANDIDATES[0];
    this.online = false;
    this.isConnecting = false;
    this.currentExpression = 'idle';
    this.lastDispatchedExpression = null;
    this.latency = null;
    this.subscribers = new Set();
    this.requestId = 0;
    this.pendingAbortController = null;

    // Initial non-blocking discovery/ping
    this.autoConnect();
  }

  getSnapshot() {
    return {
      online: this.online,
      connected: this.online,
      activeUrl: this.activeUrl,
      currentExpression: this.currentExpression,
      lastDispatchedExpression: this.lastDispatchedExpression,
      latency: this.latency,
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
        /* ignore subscriber errors */
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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('aurra_pi_url', formatted);
      }
    } catch {
      /* ignore */
    }
    this.autoConnect([formatted]);
  }

  /**
   * Ping Raspberry Pi using /health, /api/expression, or /
   * Returns latency in ms if online, or null if offline.
   */
  async ping(url, timeoutMs = 1200) {
    if (!url) return { ok: false, latency: null };
    const cleanUrl = url.trim().replace(/\/$/, '');
    const startTime = performance.now();

    // 1. Android Native HTTP Bridge (bypasses WebView CORS/Mixed-Content restrictions)
    if (hasNativeHttp()) {
      const endpoints = ['/health', '/api/expression', '/'];
      for (const ep of endpoints) {
        try {
          const native = nativeHttpGet(`${cleanUrl}${ep}`);
          if (native && (native.ok || (native.status >= 200 && native.status < 500))) {
            const latency = Math.round(performance.now() - startTime);
            return { ok: true, latency };
          }
        } catch {
          /* try next endpoint */
        }
      }
      return { ok: false, latency: null };
    }

    // 2. Browser / WebView Fetch with fallback endpoints and no-cors mode
    const tryFetch = async (path) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        await fetch(`${cleanUrl}${path}`, {
          signal: controller.signal,
          mode: 'no-cors',
        });
        clearTimeout(timer);
        return true;
      } catch {
        return false;
      }
    };

    if (await tryFetch('/health')) {
      return { ok: true, latency: Math.round(performance.now() - startTime) };
    }
    if (await tryFetch('/api/expression')) {
      return { ok: true, latency: Math.round(performance.now() - startTime) };
    }
    if (await tryFetch('/')) {
      return { ok: true, latency: Math.round(performance.now() - startTime) };
    }
    return { ok: false, latency: null };
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
      ]),
    ].filter(Boolean);

    // Test activeUrl first
    const activePing = await this.ping(this.activeUrl, 800);
    if (activePing.ok) {
      this.online = true;
      this.latency = activePing.latency;
      this.isConnecting = false;
      this.notify();
      logger.info('HARDWARE', `[RaspberryPi] Connected to ${this.activeUrl} (${this.latency}ms)`);
      return true;
    }

    // Race candidates
    for (const cand of candidates) {
      if (cand === this.activeUrl) continue;
      const candPing = await this.ping(cand, 700);
      if (candPing.ok) {
        this.activeUrl = cand;
        this.online = true;
        this.latency = candPing.latency;
        this.isConnecting = false;
        this.notify();
        logger.info('HARDWARE', `[RaspberryPi] Discovered at ${cand} (${this.latency}ms)`);
        return true;
      }
    }

    this.online = false;
    this.latency = null;
    this.isConnecting = false;
    this.notify();
    return false;
  }

  /**
   * Resolve raw expression name to a supported wire expression name
   * for the Raspberry Pi Flask server GIF_MAP.
   */
  resolveExpression(name) {
    const raw = String(name || '').toLowerCase().trim();
    if (!raw) return { raw: 'idle', wire: 'smile', isFallback: false };

    if (PI_SUPPORTED_EXPRESSIONS.has(raw)) {
      return { raw, wire: raw, isFallback: false };
    }

    if (PI_EXPRESSION_FALLBACKS[raw]) {
      const wire = PI_EXPRESSION_FALLBACKS[raw];
      return { raw, wire, isFallback: true };
    }

    return { raw, wire: 'smile', isFallback: true };
  }

  /**
   * Dispatch expression command to Raspberry Pi
   * HTTP POST /api/expression with JSON { expression: <wireExpression> }
   * Robust against race conditions, network delays, and WebView CORS.
   */
  async sendExpression(expressionName, force = false) {
    if (!expressionName) return { success: false, error: 'Empty expression name' };

    const { raw, wire, isFallback } = this.resolveExpression(expressionName);
    this.currentExpression = raw;
    this.notify();

    if (isFallback) {
      logger.info(
        'HARDWARE',
        `[RaspberryPi] Expression "${raw}" mapped to supported GIF alias "${wire}"`
      );
    }

    // Deduplication check: Avoid spamming identical in-flight commands unless forced
    if (!force && this.lastDispatchedExpression === wire && this.online) {
      return { success: true, cached: true, expression: wire, raw };
    }

    if (!this.activeUrl) {
      logger.warn('HARDWARE', '[RaspberryPi] No Pi URL configured');
      return { success: false, error: 'No active URL' };
    }

    // Monotonic request sequencing to prevent race conditions during rapid TTS transitions
    const currentReqId = ++this.requestId;

    // Abort any pending HTTP fetch request
    if (this.pendingAbortController) {
      try { this.pendingAbortController.abort(); } catch { /* ignore */ }
      this.pendingAbortController = null;
    }

    const controller = new AbortController();
    this.pendingAbortController = controller;
    const timeoutTimer = setTimeout(() => controller.abort(), 1800);

    const cleanUrl = this.activeUrl.replace(/\/$/, '');
    const endpoint = `${cleanUrl}/api/expression`;
    const payload = JSON.stringify({ expression: wire });

    let responseStatus = 0;
    let responseBody = null;
    let isSuccess = false;

    try {
      // 1. Android Native HTTP Bridge (preferred on Android tablet)
      if (hasNativeHttp()) {
        const native = nativeHttpPost(endpoint, payload);
        if (native) {
          responseStatus = native.status || 0;
          isSuccess = Boolean(native.ok) || (responseStatus >= 200 && responseStatus < 300);
          try {
            responseBody = JSON.parse(native.body || '{}');
          } catch {
            responseBody = { raw: native.body };
          }
        }
      }

      // 2. Browser / WebView Fetch Fallback (if native HTTP was not available or not attempted)
      if (!isSuccess && (!hasNativeHttp() || responseStatus === 0)) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: payload,
          signal: controller.signal,
        });

        responseStatus = response.status;
        isSuccess = response.ok;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = {};
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was deliberately superseded by a newer expression request
        return { success: false, aborted: true };
      }
      logger.warn('HARDWARE', `[RaspberryPi] POST failed for "${wire}": ${err.message}`);
    } finally {
      clearTimeout(timeoutTimer);
      if (this.pendingAbortController === controller) {
        this.pendingAbortController = null;
      }
    }

    // Stale request check: Discard response if a newer request was dispatched while this was in flight
    if (currentReqId !== this.requestId) {
      return { success: false, stale: true };
    }

    if (isSuccess) {
      this.online = true;
      this.lastDispatchedExpression = wire;
      this.notify();
      logger.info(
        'HARDWARE',
        `[RaspberryPi] HTTP ${responseStatus} OK: expression "${wire}" (${raw}) active`
      );
      return { success: true, status: responseStatus, wireExpression: wire, raw };
    } else {
      logger.warn(
        'HARDWARE',
        `[RaspberryPi] Expression "${wire}" failed with status ${responseStatus}: ${JSON.stringify(responseBody || {})}`
      );
      return { success: false, status: responseStatus, body: responseBody, wireExpression: wire, raw };
    }
  }

  triggerAction(actionName) {
    return this.sendExpression(actionName, true);
  }

  setSpeechActive(isSpeaking) {
    if (isSpeaking) {
      this.sendExpression('speaking');
    } else {
      this.sendExpression('idle');
    }
  }

  async testConnection(customUrl = null) {
    const targetUrl = customUrl ? customUrl.trim() : this.activeUrl;
    this.isConnecting = true;
    this.notify();

    const res = await this.ping(targetUrl, 1200);
    this.isConnecting = false;

    if (res.ok) {
      this.activeUrl = targetUrl;
      this.online = true;
      this.latency = res.latency;
      this.notify();
      return { success: true, latency: res.latency, url: targetUrl };
    }

    this.online = false;
    this.latency = null;
    this.notify();
    return { success: false, latency: null, url: targetUrl };
  }
}

export const raspberryPiService = new RaspberryPiService();
