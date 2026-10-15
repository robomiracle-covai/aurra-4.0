import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Trash2,
  Copy,
  Power,
  Terminal,
  Check,
  Sparkles,
  Search,
  ChevronDown,
  ChevronRight,
  Bug,
  Compass,
  AlertTriangle,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { logger } from '../services/logger';
import './LogViewerModal.css';

const LOG_LEVELS = ['ALL', 'ERROR', 'WARN', 'AI', 'SPEECH', 'PERF', 'INFO'];

export const LogViewerModal = ({ isOpen, onClose }) => {
  const [logEntries, setLogEntries] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loggingEnabled, setLoggingEnabled] = useState(() => logger.isEnabled());
  const [activeLevel, setActiveLevel] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedIde, setCopiedIde] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const logEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial logs & breadcrumbs
    setLogEntries(logger.getLogs());
    setBreadcrumbs(logger.getBreadcrumbs());

    // Subscribe to live log updates only while modal is open
    const unsubscribe = logger.subscribe((_newEntry, allLogs) => {
      setLogEntries([...allLogs]);
      setBreadcrumbs(logger.getBreadcrumbs());
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logEntries, isOpen, autoScroll]);

  // Filter logs by active level and search query
  const filteredLogs = useMemo(() => {
    return logEntries.filter((e) => {
      const matchLevel = activeLevel === 'ALL' || e.level === activeLevel;
      const q = searchFilter.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.message?.toLowerCase().includes(q) ||
        e.tag?.toLowerCase().includes(q) ||
        e.origin?.toLowerCase().includes(q) ||
        e.suggestedFix?.toLowerCase().includes(q);
      return matchLevel && matchSearch;
    });
  }, [logEntries, activeLevel, searchFilter]);

  if (!isOpen) return null;

  const handleToggleLogging = () => {
    const next = !loggingEnabled;
    logger.setEnabled(next);
    setLoggingEnabled(next);
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogEntries([]);
    setBreadcrumbs([]);
  };

  const handleCopyRawLogs = async () => {
    const text = filteredLogs
      .map((e) => `[${e.time}] [${e.level}] [${e.tag}] ${e.message}`)
      .join('\n');
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1800);
    } catch {
      /* clipboard notice */
    }
  };

  const handleCopyIdeReport = async () => {
    const report = logger.generateIdeDiagnosticReport();
    try {
      await navigator.clipboard?.writeText(report);
      setCopiedIde(true);
      setTimeout(() => setCopiedIde(false), 2200);
    } catch {
      /* clipboard notice */
    }
  };

  const toggleExpand = (id) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="log-modal-overlay">
      <div className="log-modal-card">
        {/* Header */}
        <div className="log-modal-header">
          <div className="log-modal-title-wrap">
            <h2 className="log-modal-title">
              <Terminal size={18} color="#00ffff" /> Diagnostic Flight Recorder
            </h2>
            <span className="log-count-badge">
              {filteredLogs.length} / {logEntries.length} events
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`log-btn ide-export-btn ${copiedIde ? 'copied' : ''}`}
              onClick={handleCopyIdeReport}
              title="Copy formatted Markdown diagnostic report with stack traces and reproduction steps to paste in IDE chat for automatic bug fixing"
            >
              {copiedIde ? <Check size={14} color="#4ade80" /> : <Sparkles size={14} color="#00ffff" />}
              <span>{copiedIde ? 'Copied IDE Report!' : 'Export for IDE Fix'}</span>
            </button>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="log-toolbar">
          <div className="log-toolbar-left">
            <button
              type="button"
              className={`log-btn ${loggingEnabled ? 'toggle-on' : 'toggle-off'}`}
              onClick={handleToggleLogging}
              title="Toggle active logging"
            >
              <Power size={13} />
              {loggingEnabled ? 'Active' : 'Paused'}
            </button>

            <button
              type="button"
              className="log-btn danger"
              onClick={handleClearLogs}
              title="Clear all buffered logs from memory"
            >
              <Trash2 size={13} /> Clear
            </button>

            <button
              type="button"
              className={`log-btn ${autoScroll ? 'autoscroll-on' : ''}`}
              onClick={() => setAutoScroll((prev) => !prev)}
              title="Toggle auto-scrolling to bottom on new events"
            >
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="log-toolbar-right">
            <div className="log-search-box">
              <Search size={13} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                placeholder="Filter logs / tag / keyword..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="log-search-input"
              />
              {searchFilter && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchFilter('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button type="button" className="log-btn" onClick={handleCopyRawLogs} title="Copy visible raw logs">
              {copiedRaw ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
              {copiedRaw ? 'Copied!' : 'Copy Raw'}
            </button>
          </div>
        </div>

        {/* Level Filters Pills */}
        <div className="log-level-pills">
          {LOG_LEVELS.map((lvl) => {
            const count =
              lvl === 'ALL'
                ? logEntries.length
                : logEntries.filter((l) => l.level === lvl).length;
            return (
              <button
                key={lvl}
                type="button"
                className={`level-pill-btn ${activeLevel === lvl ? 'active' : ''} pill-${lvl}`}
                onClick={() => setActiveLevel(lvl)}
              >
                <span>{lvl}</span>
                <span className="pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Breadcrumbs Strip (Last 3-4 User Actions) */}
        {breadcrumbs.length > 0 && (
          <div className="log-breadcrumbs-strip">
            <span className="crumb-label">
              <Compass size={12} /> Recent Flow:
            </span>
            <div className="crumb-items">
              {breadcrumbs.slice(-4).map((b, i) => (
                <span key={i} className="crumb-pill">
                  <strong className="crumb-cat">[{b.category}]</strong> {b.action}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Log Viewer Terminal Box */}
        <div className="log-list-container">
          {filteredLogs.length === 0 ? (
            <div className="log-empty-state">
              <Terminal size={32} color="rgba(0, 255, 255, 0.2)" />
              <p>No matching logs recorded in ring buffer.</p>
              <span>User events (touches, voice utterances, LLM responses, hardware) will appear here.</span>
            </div>
          ) : (
            filteredLogs.map((e) => {
              const isExpanded = expandedLogId === e.id;
              const hasExtra = Boolean(e.origin || e.stack || e.context || e.suggestedFix);

              return (
                <div
                  key={e.id}
                  className={`log-row-item ${e.level === 'ERROR' ? 'is-error' : ''} ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => hasExtra && toggleExpand(e.id)}
                  style={{ cursor: hasExtra ? 'pointer' : 'default' }}
                >
                  <div className="log-row-primary">
                    <span className="log-time">{e.time}</span>
                    <span className={`log-level-badge level-${e.level}`}>{e.level}</span>
                    <span className="log-tag">[{e.tag}]</span>
                    <span className="log-msg">{e.message}</span>
                    {hasExtra && (
                      <span className="log-expand-icon" title="Click to view details & IDE fix">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                  </div>

                  {/* Enriched Diagnostic Drawer (For IDE / Debugging) */}
                  {isExpanded && hasExtra && (
                    <div className="log-diagnostic-drawer" onClick={(ev) => ev.stopPropagation()}>
                      {e.origin && (
                        <div className="drawer-row">
                          <span className="drawer-label">Origin:</span>
                          <code className="drawer-code">{e.origin}</code>
                        </div>
                      )}

                      {e.suggestedFix && (
                        <div className="drawer-row highlight-fix">
                          <span className="drawer-label">
                            <Lightbulb size={13} color="#facc15" /> IDE Fix Hint:
                          </span>
                          <span className="drawer-fix-text">{e.suggestedFix}</span>
                        </div>
                      )}

                      {e.context && (
                        <div className="drawer-section">
                          <span className="drawer-label">Runtime Context:</span>
                          <pre className="drawer-pre">{JSON.stringify(e.context, null, 2)}</pre>
                        </div>
                      )}

                      {e.stack && (
                        <div className="drawer-section">
                          <span className="drawer-label">Stack Trace:</span>
                          <pre className="drawer-pre text-red">{e.stack}</pre>
                        </div>
                      )}

                      {e.breadcrumbsSnapshot && e.breadcrumbsSnapshot.length > 0 && (
                        <div className="drawer-section">
                          <span className="drawer-label">Pre-Crash User Trail:</span>
                          <ul className="drawer-crumbs-list">
                            {e.breadcrumbsSnapshot.slice(-6).map((cb, ci) => (
                              <li key={ci}>
                                <span className="text-cyan">[{cb.time}]</span> [{cb.category}] {cb.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
