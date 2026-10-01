import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Trash2,
  Download,
  RotateCcw,
  Volume2,
  User,
  Bot,
  Clock,
  Check,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { chatHistoryService } from '../services/chatHistoryService';
import { speakWithVoice } from '../utils/speechSynthesis';
import './AdminChatHistoryView.css';

export default function AdminChatHistoryView() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingActive, setIsLoggingActive] = useState(true);
  const [testingAudioId, setTestingAudioId] = useState(null);
  const [statusNotice, setStatusNotice] = useState('');

  // Load Sessions and Logging Preference on Mount
  useEffect(() => {
    loadSessions();
    setIsLoggingActive(chatHistoryService.isLoggingEnabled());
  }, []);

  const showNotice = (msg) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(''), 3000);
  };

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const list = await chatHistoryService.getAllSessions();
      setSessions(list || []);
      if (list && list.length > 0 && !selectedSessionId) {
        handleSelectSession(list[0].id);
      }
    } catch (err) {
      console.warn('[ADMIN CHAT] Error loading sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Messages for Selected Session
  const handleSelectSession = async (sid) => {
    setSelectedSessionId(sid);
    try {
      const msgs = await chatHistoryService.getSessionMessages(sid);
      setSessionMessages(msgs || []);
    } catch (err) {
      console.warn('[ADMIN CHAT] Error loading session messages:', err);
      setSessionMessages([]);
    }
  };

  const handleToggleLogging = () => {
    const next = !isLoggingActive;
    setIsLoggingActive(next);
    chatHistoryService.setLoggingEnabled(next);
    showNotice(`Chat history logging ${next ? 'ENABLED' : 'PAUSED'}`);
  };

  const handleDeleteSession = async (sid, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this conversation transcript?')) return;

    try {
      await chatHistoryService.deleteSession(sid);
      const remaining = sessions.filter((s) => s.id !== sid);
      setSessions(remaining);
      if (selectedSessionId === sid) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id);
        } else {
          setSelectedSessionId(null);
          setSessionMessages([]);
        }
      }
      showNotice('Conversation deleted');
    } catch (err) {
      console.warn('[ADMIN CHAT] Error deleting session:', err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm('WARNING: Permanently delete ALL conversation history transcripts? This cannot be undone.')) {
      return;
    }

    try {
      await chatHistoryService.clearAllHistory();
      setSessions([]);
      setSelectedSessionId(null);
      setSessionMessages([]);
      showNotice('All conversation history cleared');
    } catch (err) {
      console.warn('[ADMIN CHAT] Error clearing history:', err);
    }
  };

  const handleExportJson = async () => {
    try {
      const json = await chatHistoryService.exportHistoryJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aurra_chat_transcripts_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('Exported transcripts to JSON');
    } catch (err) {
      console.warn('[ADMIN CHAT] Export JSON error:', err);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await chatHistoryService.exportHistoryCsv();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aurra_chat_transcripts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('Exported transcripts to CSV');
    } catch (err) {
      console.warn('[ADMIN CHAT] Export CSV error:', err);
    }
  };

  const handleTestSpeech = (text, id) => {
    if (!text) return;
    setTestingAudioId(id);
    speakWithVoice(text, {
      onEnd: () => setTestingAudioId(null),
    });
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter((s) => s.title?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Group Sessions by Date
  const groupedSessions = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups = {
      Today: [],
      Yesterday: [],
      'Earlier This Week': [],
      Older: [],
    };

    filteredSessions.forEach((sess) => {
      const d = new Date(sess.updatedAt || sess.createdAt);
      const dStr = d.toDateString();
      const daysDiff = (Date.now() - d.getTime()) / 86400000;

      if (dStr === today) {
        groups.Today.push(sess);
      } else if (dStr === yesterday) {
        groups.Yesterday.push(sess);
      } else if (daysDiff <= 7) {
        groups['Earlier This Week'].push(sess);
      } else {
        groups.Older.push(sess);
      }
    });

    return groups;
  }, [filteredSessions]);

  const activeSessionObj = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="ach-root-container">
      {/* Top Banner Notice */}
      {statusNotice && <div className="ach-status-banner">{statusNotice}</div>}

      {/* Header Bar */}
      <div className="ach-top-header-row">
        <div>
          <h3 className="adm-panel-title">AI Chat Transcripts & Interaction History</h3>
          <p className="adm-panel-desc">
            Review live spoken and typed dialogues between visitors and Aurra, inspect AI sources, and export transcripts.
          </p>
        </div>

        <div className="ach-top-actions">
          {/* Logging Master Toggle */}
          <div className="ach-toggle-card">
            <span className="ach-toggle-label">Logging Transcripts:</span>
            <button
              type="button"
              className={`ach-toggle-switch ${isLoggingActive ? 'active' : 'inactive'}`}
              onClick={handleToggleLogging}
              title="Toggle automatic conversation transcript recording"
            >
              <div className="ach-toggle-thumb" />
            </button>
            <span className={`ach-toggle-status ${isLoggingActive ? 'active' : 'inactive'}`}>
              {isLoggingActive ? 'ON' : 'OFF'}
            </span>
          </div>

          <button type="button" className="ach-action-btn" onClick={handleExportJson} title="Export all transcripts to JSON">
            <FileText size={15} />
            <span>JSON</span>
          </button>

          <button type="button" className="ach-action-btn" onClick={handleExportCsv} title="Export all transcripts to CSV spreadsheet">
            <FileSpreadsheet size={15} />
            <span>CSV</span>
          </button>

          <button type="button" className="ach-action-btn danger" onClick={handleClearAllHistory} title="Delete all conversation transcripts">
            <Trash2 size={15} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* ChatGPT Layout: 2 Columns (Sidebar & Conversation Arena) */}
      <div className="ach-chatgpt-arena">
        {/* Left Column: Sessions Sidebar */}
        <aside className="ach-sidebar-col">
          <div className="ach-sidebar-header">
            <div className="ach-search-input-wrap">
              <Search size={14} className="ach-search-icon" />
              <input
                type="text"
                className="ach-search-input"
                placeholder="Search transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="button" className="ach-refresh-btn" onClick={loadSessions} title="Refresh sessions">
              <RotateCcw size={13} />
            </button>
          </div>

          <div className="ach-sessions-scroll-list">
            {Object.entries(groupedSessions).map(([groupTitle, list]) => {
              if (!list || list.length === 0) return null;
              return (
                <div key={groupTitle} className="ach-session-group">
                  <span className="ach-group-title">{groupTitle}</span>
                  {list.map((sess) => {
                    const isSelected = sess.id === selectedSessionId;
                    const dateFormatted = new Date(sess.updatedAt || sess.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={sess.id}
                        className={`ach-session-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectSession(sess.id)}
                      >
                        <div className="ach-session-card-left">
                          <MessageSquare size={15} className="ach-card-icon" />
                          <div className="ach-session-text-wrap">
                            <strong className="ach-session-title">{sess.title || 'Conversation'}</strong>
                            <div className="ach-session-subline">
                              <span>{dateFormatted}</span>
                              <span>•</span>
                              <span>{sess.messageCount || 0} messages</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="ach-delete-session-btn"
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          title="Delete transcript"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {filteredSessions.length === 0 && (
              <div className="ach-empty-sessions">
                <MessageSquare size={28} className="ach-empty-icon" />
                <p>No conversation sessions found.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right Column: Full Conversation Transcript Viewer */}
        <main className="ach-conversation-col">
          {activeSessionObj ? (
            <div className="ach-thread-container">
              {/* Thread Header */}
              <div className="ach-thread-header">
                <div className="ach-thread-title-wrap">
                  <Bot size={22} className="ach-thread-neon-bot" />
                  <div>
                    <h4>{activeSessionObj.title || 'Conversation Transcript'}</h4>
                    <span className="ach-thread-date">
                      Started: {new Date(activeSessionObj.createdAt).toLocaleString()} • {sessionMessages.length} total messages
                    </span>
                  </div>
                </div>

                <div className="ach-thread-header-actions">
                  <button
                    type="button"
                    className="ach-thread-mini-btn"
                    onClick={() => handleDeleteSession(activeSessionObj.id)}
                  >
                    <Trash2 size={14} />
                    <span>Delete Session</span>
                  </button>
                </div>
              </div>

              {/* Thread Messages Stream */}
              <div className="ach-thread-stream">
                {sessionMessages.length === 0 ? (
                  <div className="ach-thread-empty">
                    <p>No messages recorded in this session.</p>
                  </div>
                ) : (
                  sessionMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const timeStr = msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '';

                    return (
                      <div
                        key={msg.id || idx}
                        className={`ach-thread-row ${isUser ? 'user-turn' : 'aurra-turn'}`}
                      >
                        <div className="ach-thread-avatar">
                          {isUser ? <User size={16} /> : <Bot size={16} />}
                        </div>

                        <div className="ach-thread-bubble">
                          <div className="ach-bubble-header">
                            <strong className="ach-sender-name">
                              {isUser ? 'Visitor' : 'Aurra AI'}
                            </strong>

                            {isUser && msg.inputType && (
                              <span className="ach-badge input-type">
                                {msg.inputType === 'voice' ? '🎤 Voice' : '⌨️ Text Keyboard'}
                              </span>
                            )}

                            {!isUser && msg.source && (
                              <span className={`ach-badge source ${msg.source}`}>
                                {msg.source.toUpperCase()}
                              </span>
                            )}

                            {!isUser && msg.confidence && (
                              <span className="ach-badge confidence">
                                {msg.confidence}% Conf.
                              </span>
                            )}

                            <span className="ach-bubble-time">{timeStr}</span>
                          </div>

                          <div className="ach-bubble-content">
                            {msg.text}
                          </div>

                          {!isUser && (
                            <div className="ach-bubble-footer">
                              <button
                                type="button"
                                className="ach-audio-test-btn"
                                onClick={() => handleTestSpeech(msg.text, msg.id || idx)}
                                title="Synthesize and play audio response"
                              >
                                <Volume2 size={13} />
                                <span>{testingAudioId === (msg.id || idx) ? 'Speaking...' : 'Play Audio'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="ach-no-selection">
              <Bot size={48} className="ach-no-select-icon" />
              <h3>Select a Conversation Transcript</h3>
              <p>Choose any session from the left sidebar to view visitor dialogue exchanges, AI answers, and confidence telemetry.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
