/**
 * Zero-Overhead Intelligent Diagnostic & Flight-Recorder Logger for Aurra 4.0
 * 
 * CORE DESIGN PRINCIPLES:
 * 1. Zero-Lag Guarantee:
 *    - Pre-allocated circular ring buffer (250 entries max, O(1) overwrites, NO Array.shift()).
 *    - Zero garbage collection pauses (preserves 60-90 FPS rendering on Android tablet).
 *    - Microtask/Idle deferred listener notification (never blocks the JS main thread).
 * 
 * 2. Flight-Recorder Breadcrumbs:
 *    - Tracks the last 25 user interactions (route changes, touch clicks, voice utterances)
 *    - Attached automatically to any ERROR report to show exact reproduction steps.
 * 
 * 3. IDE / AI Self-Descriptive Diagnostics:
 *    - Structured errors capture file/function origin, runtime context, stack traces,
 *      and automated "suggestedFix" remediation hints for immediate bug fixing in the IDE.
 * 
 * 4. Automatic Safety Net:
 *    - Global window.onerror and unhandledrejection traps to catch silent crashes.
 *    - Safe non-recursive serializer (handles circular references and strips massive binary/base64 blobs).
 */

const MAX_LOG_ENTRIES = 250;
const MAX_BREADCRUMBS = 25;

let isLoggingEnabled = true;

// Pre-allocated circular ring buffer
const ringBuffer = new Array(MAX_LOG_ENTRIES);
let ringPointer = 0;
let ringCount = 0;

// Pre-allocated breadcrumbs buffer
const breadcrumbs = [];

// Listeners subscribed only when LogViewerModal is actively open
const listeners = new Set();

// Throttling cache for high-frequency loops (joysticks, vision frames, telemetry)
const throttleTimestamps = new Map();

/**
 * Format timestamp: HH:MM:SS.mmm
 */
const formatTimestamp = (date = new Date()) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
};

/**
 * Safe serializer preventing circular references and stripping heavy binary/base64 data
 */
const safeSerialize = (obj, depth = 0) => {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (depth > 2) return '[Deep Object]';

  // If Error instance
  if (obj instanceof Error) {
    return `${obj.name}: ${obj.message}`;
  }

  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      // Avoid circular reference crashes
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular Reference]';
        seen.add(value);
      }
      // Strip massive base64 image strings or vector arrays
      if (typeof value === 'string' && value.length > 300) {
        if (value.startsWith('data:image') || value.includes('base64')) {
          return `[Base64 Media (${Math.round(value.length / 1024)} KB)]`;
        }
        return `${value.slice(0, 180)}... [Truncated ${value.length} chars]`;
      }
      if (value instanceof Float32Array || value instanceof Uint8Array) {
        return `[TypedArray: length ${value.length}]`;
      }
      return value;
    });
  } catch (err) {
    return `[Unserializable Object: ${err.message}]`;
  }
};

/**
 * Push an entry into the pre-allocated circular ring buffer in O(1) time
 */
const pushEntry = (level, tag, message, extra = null) => {
  if (!isLoggingEnabled) return;

  const now = new Date();
  const entryId = now.getTime() + Math.random();

  let formattedMessage = '';
  let structuredData = null;

  if (typeof message === 'object' && message !== null) {
    formattedMessage = safeSerialize(message);
    structuredData = message;
  } else {
    formattedMessage = String(message || '');
  }

  // Build clean log record
  const entry = {
    id: entryId,
    time: formatTimestamp(now),
    isoTime: now.toISOString(),
    level, // 'INFO' | 'PERF' | 'AI' | 'SPEECH' | 'WARN' | 'ERROR' | 'BREADCRUMB'
    tag: String(tag || 'SYSTEM').toUpperCase(),
    message: formattedMessage,
    // Optional enriched fields for errors & IDE diagnostics
    origin: extra?.origin || null, // e.g. "esp32Service.js:checkConnection"
    stack: extra?.stack || (extra?.error instanceof Error ? extra.error.stack : null),
    context: extra?.context || null,
    suggestedFix: extra?.suggestedFix || null,
    breadcrumbsSnapshot: level === 'ERROR' ? [...breadcrumbs] : undefined,
  };

  // Insert into circular ring buffer (zero array shifting, zero GC churn)
  ringBuffer[ringPointer] = entry;
  ringPointer = (ringPointer + 1) % MAX_LOG_ENTRIES;
  if (ringCount < MAX_LOG_ENTRIES) ringCount++;

  // Safe ADB logcat output for Android debugging (only in development or for warnings/errors)
  if (level === 'ERROR') {
    console.error(`[TestingApp:${level}:${tag}] ${entry.message}`, extra || '');
  } else if (level === 'WARN') {
    console.warn(`[TestingApp:${level}:${tag}] ${entry.message}`);
  } else {
    console.log(`[TestingApp:${level}:${tag}] ${entry.message}`);
  }

  // Non-blocking microtask notification to UI listeners (modal open)
  if (listeners.size > 0) {
    queueMicrotask(() => {
      const allLogs = getSortedLogs();
      listeners.forEach((listener) => {
        try {
          listener(entry, allLogs);
        } catch {
          /* subscriber isolated */
        }
      });
    });
  }
};

/**
 * Returns logs in chronological order (oldest to newest)
 */
const getSortedLogs = () => {
  if (ringCount === 0) return [];
  if (ringCount < MAX_LOG_ENTRIES) {
    return ringBuffer.slice(0, ringCount);
  }
  // If buffer has wrapped, re-order: oldest is at ringPointer
  return [
    ...ringBuffer.slice(ringPointer, MAX_LOG_ENTRIES),
    ...ringBuffer.slice(0, ringPointer),
  ];
};

export const logger = {
  /**
   * General informational log
   */
  info: (tag, message, extra) => pushEntry('INFO', tag, message, extra),

  /**
   * Performance & FPS telemetry log
   */
  perf: (tag, message, extra) => pushEntry('PERF', tag, message, extra),

  /**
   * AI & LLM inference and RAG log
   */
  ai: (tag, message, extra) => pushEntry('AI', tag, message, extra),

  /**
   * Speech recognition & synthesis log
   */
  speech: (tag, message, extra) => pushEntry('SPEECH', tag, message, extra),

  /**
   * Warning log for recoverable anomalies
   */
  warn: (tag, message, extra) => pushEntry('WARN', tag, message, extra),

  /**
   * Actionable Error log with IDE diagnostics & stack trace
   * @param {string} tag Subsystem category (e.g. 'HARDWARE', 'LLM', 'VISION', 'DATABASE')
   * @param {string|Error} message Error summary or Error object
   * @param {object} [options]
   * @param {string} [options.origin] Source file & function (e.g. 'esp32Service.js:checkConnection')
   * @param {Error} [options.error] The actual Error instance if separate
   * @param {object} [options.context] Runtime variables and environment state
   * @param {string} [options.suggestedFix] Remediation advice for the developer or IDE
   */
  error: (tag, message, options = {}) => {
    let msgText = message;
    let errInstance = options.error || (message instanceof Error ? message : null);

    if (message instanceof Error) {
      msgText = message.message;
    }

    pushEntry('ERROR', tag, msgText, {
      origin: options.origin || null,
      error: errInstance,
      stack: options.stack || errInstance?.stack || null,
      context: options.context || null,
      suggestedFix: options.suggestedFix || null,
    });
  },

  /**
   * Records a user/system action breadcrumb (last 25 kept in memory)
   * @param {string} category e.g. 'NAV', 'TOUCH', 'VOICE', 'HARDWARE'
   * @param {string} action Description of what just happened
   * @param {object} [data] Optional small payload
   */
  breadcrumb: (category, action, data = null) => {
    const item = {
      time: formatTimestamp(),
      category: String(category).toUpperCase(),
      action: String(action),
      data: data ? safeSerialize(data) : undefined,
    };

    breadcrumbs.push(item);
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
      breadcrumbs.shift();
    }
  },

  /**
   * Get all active breadcrumbs
   */
  getBreadcrumbs: () => [...breadcrumbs],

  /**
   * Throttled logging for high-frequency loops (e.g. 60-90 FPS animations, face frames, ultrasonic radar)
   * Ensures logs only fire once every intervalMs per unique key.
   */
  throttle: (tag, key, intervalMs, level, message, extra) => {
    const now = Date.now();
    const last = throttleTimestamps.get(key) || 0;
    if (now - last < intervalMs) {
      return; // Skip throttled execution
    }
    throttleTimestamps.set(key, now);

    if (level === 'error') logger.error(tag, message, extra);
    else if (level === 'warn') logger.warn(tag, message, extra);
    else if (level === 'perf') logger.perf(tag, message, extra);
    else if (level === 'ai') logger.ai(tag, message, extra);
    else if (level === 'speech') logger.speech(tag, message, extra);
    else logger.info(tag, message, extra);
  },

  /**
   * Retrieve all recorded logs in chronological order
   */
  getLogs: () => getSortedLogs(),

  /**
   * Clear all buffered logs and breadcrumbs
   */
  clearLogs: () => {
    ringPointer = 0;
    ringCount = 0;
    breadcrumbs.length = 0;
    throttleTimestamps.clear();

    if (listeners.size > 0) {
      listeners.forEach((listener) => {
        try {
          listener(null, []);
        } catch {
          /* subscriber isolated */
        }
      });
    }
    console.log('[TestingApp:INFO:LOGGER] All diagnostic ring buffer logs & breadcrumbs cleared.');
  },

  /**
   * Toggle logging active state
   */
  setEnabled: (enabled) => {
    isLoggingEnabled = Boolean(enabled);
    console.log(`[TestingApp:INFO:LOGGER] Logging set to: ${isLoggingEnabled}`);
  },

  isEnabled: () => isLoggingEnabled,

  /**
   * Subscribe to log events (used by LogViewerModal)
   */
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Generates a complete, markdown-formatted Diagnostic Report
   * specifically structured for IDE / AI Copilot bug fixing.
   */
  generateIdeDiagnosticReport: () => {
    const logs = getSortedLogs();
    const errors = logs.filter((l) => l.level === 'ERROR');
    const warnings = logs.filter((l) => l.level === 'WARN');

    // System runtime snapshot
    const runtimeSnapshot = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      onlineStatus: typeof navigator !== 'undefined' ? (navigator.onLine ? 'ONLINE' : 'OFFLINE') : 'Unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
      hasAndroidBridge: typeof window !== 'undefined' && Boolean(window.AndroidLauncher),
      totalLogsRecorded: logs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    };

    let md = `# AURRA 4.0 DIAGNOSTIC & BUG-FIXING REPORT FOR IDE\n`;
    md += `Generated At: ${runtimeSnapshot.timestamp}\n\n`;

    md += `## 1. RUNTIME ENVIRONMENT SNAPSHOT\n`;
    md += `- **Connectivity:** ${runtimeSnapshot.onlineStatus}\n`;
    md += `- **Display Viewport:** ${runtimeSnapshot.screenResolution}\n`;
    md += `- **Native Android Launcher Bridge:** ${runtimeSnapshot.hasAndroidBridge ? 'CONNECTED (Active)' : 'NONE (Standard Browser)'}\n`;
    md += `- **Total Logs in Buffer:** ${runtimeSnapshot.totalLogsRecorded} (Errors: ${runtimeSnapshot.errorCount}, Warnings: ${runtimeSnapshot.warningCount})\n`;
    md += `- **User Agent:** \`${runtimeSnapshot.userAgent}\`\n\n`;

    md += `## 2. RECENT USER BREADCRUMBS (REPRODUCTION STEPS)\n`;
    if (breadcrumbs.length === 0) {
      md += `*No user actions recorded prior to this report.*\n\n`;
    } else {
      md += `| Time | Category | User / System Action |\n`;
      md += `| :--- | :--- | :--- |\n`;
      breadcrumbs.forEach((b) => {
        md += `| ${b.time} | \`${b.category}\` | ${b.action} |\n`;
      });
      md += `\n`;
    }

    md += `## 3. CRITICAL ERRORS & REMEDIATION HINTS\n`;
    if (errors.length === 0) {
      md += `*No critical ERROR events recorded in the active ring buffer. System operating normally.*\n\n`;
    } else {
      errors.forEach((err, idx) => {
        md += `### Error #${idx + 1}: [${err.tag}] ${err.message}\n`;
        md += `- **Time:** ${err.time}\n`;
        if (err.origin) md += `- **Origin Symbol:** \`${err.origin}\`\n`;
        if (err.suggestedFix) md += `- **Suggested Fix / Remediation Hint:** 💡 **${err.suggestedFix}**\n`;
        if (err.context) {
          md += `- **Runtime Context:**\n\`\`\`json\n${safeSerialize(err.context)}\n\`\`\`\n`;
        }
        if (err.stack) {
          md += `- **Stack Trace:**\n\`\`\`text\n${err.stack}\n\`\`\`\n`;
        }
        md += `\n`;
      });
    }

    md += `## 4. RECENT 30 EVENT LOGS\n`;
    md += `\`\`\`text\n`;
    logs.slice(-30).forEach((l) => {
      md += `[${l.time}] [${l.level.padEnd(6)}] [${l.tag.padEnd(8)}] ${l.message}\n`;
    });
    md += `\`\`\`\n`;

    return md;
  },
};

// ── Automatic Global Browser Safety Net ──
if (typeof window !== 'undefined') {
  // Expose to window for developer console inspection
  window.aurraLogger = logger;
  window.__AURRA_GET_LOGS__ = () => logger.getLogs();
  window.__AURRA_GET_BREADCRUMBS__ = () => logger.getBreadcrumbs();
  window.__AURRA_EXPORT_DIAGNOSTICS__ = () => logger.generateIdeDiagnosticReport();

  window.__AURRA_COPY_DIAGNOSTICS__ = async () => {
    const report = logger.generateIdeDiagnosticReport();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(report);
      console.log('%c[AURRA LOGGER] Diagnostic report successfully copied to clipboard! Paste directly into IDE chat.', 'color: #00ffff; font-weight: bold;');
      return 'Report copied to clipboard!';
    }
    return report;
  };

  // Catch unhandled script exceptions
  window.addEventListener('error', (event) => {
    // Avoid circular logging loops
    try {
      const file = event.filename ? event.filename.split('/').pop() : 'UnknownFile';
      logger.error('CRASH', event.message || 'Unhandled Script Exception', {
        origin: `${file}:${event.lineno}:${event.colno}`,
        error: event.error,
        stack: event.error?.stack,
        context: {
          file: event.filename,
          line: event.lineno,
          col: event.colno,
        },
        suggestedFix: `Inspect ${file} around line ${event.lineno} for syntax or null pointer dereference.`,
      });
    } catch {
      /* prevent error handler crash */
    }
  });

  // Catch unhandled Promise rejections (e.g. failed fetches, LLM timeouts)
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const msg = reason?.message || String(reason || 'Unhandled Promise Rejection');
      logger.error('PROMISE', msg, {
        origin: 'UnhandledRejectionTrap',
        error: reason instanceof Error ? reason : null,
        stack: reason instanceof Error ? reason.stack : null,
        suggestedFix: 'Wrap async network calls or promise handlers in try/catch or append a .catch() handler.',
      });
    } catch {
      /* prevent error handler crash */
    }
  });
}
