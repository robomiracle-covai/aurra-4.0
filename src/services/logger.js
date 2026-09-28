/**
 * Ultra-Low-Overhead Diagnostic Logger for Testing App
 * - Fixed ring buffer (max 120 entries) in memory to guarantee zero memory leaks
 * - Zero DOM re-render cost (only notifies listeners when log viewer modal is open)
 * - Safe native console logging for adb logcat capture
 * - Options to clear (delete) logs or toggle logging ON/OFF
 */

const MAX_LOG_ENTRIES = 120;
let isLoggingEnabled = true;
let logs = [];
const listeners = new Set();

const formatTimestamp = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
};

const pushEntry = (level, tag, message) => {
  if (!isLoggingEnabled) return;

  const entry = {
    id: Date.now() + Math.random(),
    time: formatTimestamp(),
    level, // 'INFO' | 'PERF' | 'AI' | 'SPEECH' | 'ERROR'
    tag,
    message: typeof message === 'object' ? JSON.stringify(message) : String(message),
  };

  logs.push(entry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.shift(); // O(1) buffer trimming
  }

  // Safe adb logcat output
  console.log(`[TestingApp:${level}:${tag}] ${entry.message}`);

  // Notify active UI listeners (only when log drawer is actively open)
  if (listeners.size > 0) {
    listeners.forEach((listener) => {
      try {
        listener(entry, logs);
      } catch {
        /* listener notice */
      }
    });
  }
};

export const logger = {
  info: (tag, message) => pushEntry('INFO', tag, message),
  perf: (tag, message) => pushEntry('PERF', tag, message),
  ai: (tag, message) => pushEntry('AI', tag, message),
  speech: (tag, message) => pushEntry('SPEECH', tag, message),
  warn: (tag, message) => pushEntry('WARN', tag, message),
  error: (tag, message) => pushEntry('ERROR', tag, message),

  getLogs: () => [...logs],

  clearLogs: () => {
    logs = [];
    listeners.forEach((listener) => {
      try {
        listener(null, logs);
      } catch {
        /* listener notice */
      }
    });
    console.log('[TestingApp:INFO:LOGGER] All diagnostic logs cleared.');
  },

  setEnabled: (enabled) => {
    isLoggingEnabled = Boolean(enabled);
    console.log(`[TestingApp:INFO:LOGGER] Logging set to: ${isLoggingEnabled}`);
  },

  isEnabled: () => isLoggingEnabled,

  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
