import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Copy, Power, Terminal, Check } from 'lucide-react';
import { logger } from '../services/logger';
import './LogViewerModal.css';

export const LogViewerModal = ({ isOpen, onClose }) => {
  const [logEntries, setLogEntries] = useState([]);
  const [loggingEnabled, setLoggingEnabled] = useState(() => logger.isEnabled());
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial logs
    setLogEntries(logger.getLogs());

    // Subscribe to live log updates only while modal is open
    const unsubscribe = logger.subscribe((_newEntry, allLogs) => {
      setLogEntries([...allLogs]);
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logEntries, isOpen]);

  if (!isOpen) return null;

  const handleToggleLogging = () => {
    const next = !loggingEnabled;
    logger.setEnabled(next);
    setLoggingEnabled(next);
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogEntries([]);
  };

  const handleCopyLogs = () => {
    const text = logEntries
      .map((e) => `[${e.time}] [${e.level}] [${e.tag}] ${e.message}`)
      .join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="log-modal-overlay">
      <div className="log-modal-card">
        {/* Header */}
        <div className="log-modal-header">
          <h2 className="log-modal-title">
            <Terminal size={18} color="#00ffff" /> Diagnostic Event Logs
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="log-toolbar">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={`log-btn ${loggingEnabled ? 'toggle-on' : 'toggle-off'}`}
              onClick={handleToggleLogging}
              title="Toggle logging on or off"
            >
              <Power size={14} />
              {loggingEnabled ? 'Logging: ACTIVE' : 'Logging: PAUSED'}
            </button>

            <button
              type="button"
              className="log-btn danger"
              onClick={handleClearLogs}
              title="Delete all buffered logs from memory"
            >
              <Trash2 size={14} /> Delete / Clear Logs
            </button>
          </div>

          <button type="button" className="log-btn" onClick={handleCopyLogs}>
            {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Logs'}
          </button>
        </div>

        {/* Log Viewer Terminal Box */}
        <div className="log-list-container">
          {logEntries.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontStyle: 'italic' }}>
              No logs recorded yet. Events (camera, detection, speech, enrollment) will stream here.
            </div>
          ) : (
            logEntries.map((e) => (
              <div key={e.id} className="log-row">
                <span className="log-time">{e.time}</span>
                <span className={`log-level-badge level-${e.level}`}>{e.level}</span>
                <span className="log-tag">[{e.tag}]</span>
                <span className="log-msg">{e.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
