/**
 * Real-Time API Telemetry & Network Inspector Service for Aurra 4.0
 * Zero-Jank O(1) circular ring buffer capturing all outbound AI & Network transactions.
 */

const MAX_TRANSACTIONS = 150;

class ApiTelemetryService {
  constructor() {
    this.buffer = [];
    this.subscribers = new Set();
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalLatencyMs: 0,
    };
  }

  /**
   * Record an API transaction
   * @param {Object} tx
   * @param {string} tx.service - e.g. 'Groq LLM', 'Gemini AI', 'Serper Search', 'Open-Meteo', 'ElevenLabs'
   * @param {string} tx.method - 'POST' | 'GET' | 'PUT' | 'DELETE'
   * @param {string} tx.url - Request URL
   * @param {number|string} tx.status - HTTP status e.g. 200, 400, 'ERR', 'TIMEOUT'
   * @param {number} tx.durationMs - Duration in milliseconds
   * @param {any} [tx.request] - Request payload / query
   * @param {any} [tx.response] - Response payload / text
   * @param {string} [tx.error] - Optional error details
   */
  record({ service, method = 'POST', url, status = 200, durationMs = 0, request = null, response = null, error = null }) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      isoDate: now.toISOString(),
      service: service || 'Network API',
      method: String(method).toUpperCase(),
      url: url || '',
      status,
      isOk: Number(status) >= 200 && Number(status) < 300,
      durationMs: Math.round(durationMs),
      request: this.sanitizePayload(request),
      response: this.sanitizePayload(response),
      error: error || (Number(status) >= 400 ? `HTTP ${status}` : null),
    };

    this.buffer.unshift(transaction);
    if (this.buffer.length > MAX_TRANSACTIONS) {
      this.buffer.pop();
    }

    // Update Telemetry Stats
    this.stats.totalCalls++;
    if (transaction.isOk) {
      this.stats.successCalls++;
    } else {
      this.stats.failedCalls++;
    }
    this.stats.totalLatencyMs += transaction.durationMs;

    this.notify();
    return transaction;
  }

  /**
   * Sanitizes payloads by avoiding circular refs and trimming massive binaries
   */
  sanitizePayload(payload) {
    if (payload === null || payload === undefined) return null;
    if (typeof payload !== 'object') return String(payload);

    try {
      const seen = new WeakSet();
      return JSON.parse(JSON.stringify(payload, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (typeof value === 'string' && value.length > 500) {
          if (value.startsWith('data:') || value.length > 1000) {
            return `${value.slice(0, 200)}... [Truncated ${value.length} chars]`;
          }
        }
        return value;
      }));
    } catch {
      return String(payload);
    }
  }

  /**
   * Initializes non-blocking global fetch interception.
   * Runs transparently in the background, cloning responses asynchronously
   * so 90 FPS tablet rendering is never impacted.
   */
  initGlobalInterceptor() {
    if (typeof window === 'undefined' || window.__aurra_telemetry_installed) return;
    window.__aurra_telemetry_installed = true;

    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      const options = args[1] || {};
      const method = (options.method || 'GET').toUpperCase();

      // Categorize service
      let service = 'External API';
      if (url.includes('api.groq.com')) service = 'Groq LLM';
      else if (url.includes('generativelanguage.googleapis.com')) service = 'Google Gemini';
      else if (url.includes('google.com') || url.includes('drive.google.com') || url.includes('googleusercontent.com')) service = 'Google Drive / Cloud';
      else if (url.includes('api.serper.dev')) service = 'Serper Google Search';
      else if (url.includes('open-meteo.com')) service = 'Open-Meteo Weather';
      else if (url.includes('wikipedia.org')) service = 'Wikipedia API';
      else if (url.includes('duckduckgo.com')) service = 'DuckDuckGo API';
      else if (url.includes('elevenlabs.io')) service = 'ElevenLabs TTS';

      // Parse request body if possible
      let requestPayload = null;
      if (options.body) {
        try {
          if (typeof options.body === 'string') {
            requestPayload = JSON.parse(options.body);
          } else {
            requestPayload = '[Binary/Stream Body]';
          }
        } catch {
          requestPayload = options.body;
        }
      }

      try {
        const response = await originalFetch.apply(this, args);
        const durationMs = performance.now() - startTime;

        // Clone response in background without blocking the main stream
        Promise.resolve().then(async () => {
          try {
            const clone = response.clone();
            const contentType = clone.headers.get('content-type') || '';
            let responsePayload = null;

            if (contentType.includes('application/json')) {
              responsePayload = await clone.json();
            } else if (contentType.includes('text/')) {
              const text = await clone.text();
              responsePayload = text.slice(0, 1000);
            } else {
              responsePayload = `[${contentType || 'binary'}]`;
            }

            self.record({
              service,
              method,
              url,
              status: response.status,
              durationMs,
              request: requestPayload,
              response: responsePayload,
              error: response.ok ? null : `HTTP ${response.status}`,
            });
          } catch (e) {
            self.record({
              service,
              method,
              url,
              status: response.status,
              durationMs,
              request: requestPayload,
              response: '[Stream consumed or unavailable]',
              error: null,
            });
          }
        });

        return response;
      } catch (err) {
        const durationMs = performance.now() - startTime;
        self.record({
          service,
          method,
          url,
          status: 'ERR',
          durationMs,
          request: requestPayload,
          response: null,
          error: err.message || 'Network Fetch Failed',
        });
        throw err;
      }
    };
  }

  getTransactions() {
    return [...this.buffer];
  }

  getStats() {
    const avgLatency = this.stats.totalCalls > 0
      ? Math.round(this.stats.totalLatencyMs / this.stats.totalCalls)
      : 0;

    return {
      total: this.stats.totalCalls,
      success: this.stats.successCalls,
      failed: this.stats.failedCalls,
      avgLatencyMs: avgLatency,
    };
  }

  clear() {
    this.buffer = [];
    this.stats = { totalCalls: 0, successCalls: 0, failedCalls: 0, totalLatencyMs: 0 };
    this.notify();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    // Notify subscribers via microtask to preserve 90 FPS render loop
    Promise.resolve().then(() => {
      this.subscribers.forEach((fn) => {
        try {
          fn(this.buffer, this.getStats());
        } catch (e) {
          console.warn('Telemetry subscriber error:', e);
        }
      });
    });
  }
}

export const apiTelemetryService = new ApiTelemetryService();
// Automatically install interceptor on import
apiTelemetryService.initGlobalInterceptor();

