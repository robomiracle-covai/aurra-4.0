import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Volume2,
  Trash2,
  History,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
  Keyboard,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { chatHistoryService } from '../services/chatHistoryService';
import { voiceNavigationService } from '../services/voiceNavigationService';
import { speakWithVoice } from '../utils/speechSynthesis';
import InteractionAvatar from './InteractionAvatar';
import './InteractionChatView.css';

export default function InteractionChatView({
  coreStatus = 'IDLE',
  isListening = true,
  detectedPerson = null,
  showKeyboardInput = true,
  onToggleKeyboard,
  onInterruptSpeech,
}) {
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);
  const [showMiniAvatar, setShowMiniAvatar] = useState(false);
  const [isTypingActive, setIsTypingActive] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const isAutoScrollEnabledRef = useRef(true);

  // Initialize Active Session & Load Messages
  useEffect(() => {
    let isMounted = true;
    async function initChat() {
      try {
        const sid = await chatHistoryService.getActiveSessionId();
        if (isMounted) {
          setCurrentSessionId(sid);
          const historyMsgs = await chatHistoryService.getSessionMessages(sid);
          if (isMounted) {
            setMessages(historyMsgs || []);
          }
        }
      } catch (err) {
        console.warn('[CHAT] Init error:', err);
      }
    }
    initChat();

    // Listen for real-time messages added (from speech, LLM, or keyboard)
    const handleMessageAdded = (e) => {
      const { message, sessionId } = e.detail || {};
      if (message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id && message.id !== undefined)) return prev;
          return [...prev, message];
        });
      }
    };

    window.addEventListener('aurra:chat-message-added', handleMessageAdded);
    return () => {
      isMounted = false;
      window.removeEventListener('aurra:chat-message-added', handleMessageAdded);
    };
  }, []);

  // Instant hardware-accelerated auto-scroll (NO JS smooth interpolator stalls on 2560x1600 Mali GPU)
  useEffect(() => {
    if (isAutoScrollEnabledRef.current && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when keyboard mode is enabled
  useEffect(() => {
    if (showKeyboardInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showKeyboardInput]);

  // Load Past Sessions for Drawer
  const loadPastSessions = async () => {
    try {
      const list = await chatHistoryService.getAllSessions();
      setPastSessions(list || []);
    } catch (err) {
      console.warn('[CHAT] Error loading sessions:', err);
    }
  };

  const handleOpenHistory = async () => {
    await loadPastSessions();
    setShowHistoryDrawer(true);
  };

  const handleSelectSession = async (session) => {
    try {
      setCurrentSessionId(session.id);
      sessionStorage.setItem('aurra_active_chat_session_id', session.id);
      const msgs = await chatHistoryService.getSessionMessages(session.id);
      setMessages(msgs || []);
      setShowHistoryDrawer(false);
    } catch (err) {
      console.warn('[CHAT] Error switching session:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const newSess = await chatHistoryService.startNewSession('Conversation');
      setCurrentSessionId(newSess.id);
      setMessages([]);
      setShowHistoryDrawer(false);
    } catch (err) {
      console.warn('[CHAT] Error starting new chat:', err);
    }
  };

  const handleClearCurrentChat = async () => {
    if (window.confirm('Clear messages in this conversation?')) {
      if (currentSessionId) {
        await chatHistoryService.deleteSession(currentSessionId);
      }
      handleNewChat();
    }
  };

  const handleInputFocus = () => {
    setIsTypingActive(true);
    voiceNavigationService.setTypingMode(true);
  };

  const handleInputBlur = () => {
    if (!inputText.trim()) {
      setIsTypingActive(false);
      voiceNavigationService.setTypingMode(false);
    }
  };

  // Send User Message (Text Query)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query || isSending) return;

    setInputText('');
    setIsSending(true);

    try {
      // Process through universal conversational engine with inputType='text'
      await voiceNavigationService.processVoiceCommand(query, { inputType: 'text' });
    } catch (err) {
      console.error('[CHAT] Error sending text command:', err);
    } finally {
      setIsSending(false);
      setIsTypingActive(false);
      voiceNavigationService.setTypingMode(false);
      if (inputRef.current) inputRef.current.blur();
    }
  };

  // Quick Prompt Chips
  const handlePromptChipClick = (promptText) => {
    setInputText(promptText);
    voiceNavigationService.processVoiceCommand(promptText, { inputType: 'text' });
  };

  // Replay speech for a message
  const handleReplaySpeech = (text) => {
    if (!text) return;
    speakWithVoice(text);
  };

  // Quick prompt suggestions
  const PROMPT_SUGGESTIONS = [
    'What robots do you have?',
    'Take me on a guided tour',
    'Where is the cafeteria?',
    'I want to register as a visitor',
    'Show action cards',
    'Robot tilt head up',
  ];

  return (
    <div className="icv-chat-arena">
      {/* Top Cyber Status & Control Header */}
      <div className="icv-chat-top-header">
        <div className="icv-neural-status-group">
          <div className={`icv-neural-pulse-dot ${isTypingActive ? 'typing' : coreStatus.toLowerCase()}`} />
          <div className="icv-neural-label-col">
            <span className="icv-neural-badge-title">AURRA NEURAL AI</span>
            <span className={`icv-neural-state-tag ${isTypingActive ? 'typing' : coreStatus.toLowerCase()}`}>
              {isTypingActive && '⌨️ TYPING MODE • MIC MUTED'}
              {!isTypingActive && !isListening && 'MIC MUTED'}
              {!isTypingActive && isListening && coreStatus === 'LISTENING' && 'LISTENING TO SPEECH...'}
              {!isTypingActive && isListening && coreStatus === 'THINKING' && 'PROCESSING INTENT...'}
              {!isTypingActive && isListening && coreStatus === 'SPEAKING' && 'SPEAKING RESPONSE'}
              {!isTypingActive && isListening && coreStatus === 'IDLE' && 'ONLINE & STANDBY'}
            </span>
          </div>

          {detectedPerson && (
            <div className="icv-vip-greeting-pill">
              <Sparkles size={12} color="#00ffff" />
              <span>{detectedPerson.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="icv-top-actions-group">
          <button
            type="button"
            className={`icv-mini-btn ${showMiniAvatar ? 'active' : ''}`}
            onClick={() => setShowMiniAvatar(!showMiniAvatar)}
            title={showMiniAvatar ? 'Hide Avatar Orb' : 'Show Avatar Orb'}
          >
            {showMiniAvatar ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>Avatar</span>
          </button>

          <button
            type="button"
            className="icv-mini-btn"
            onClick={handleClearCurrentChat}
            title="Clear Chat Messages"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className="icv-mini-btn history-btn"
            onClick={handleOpenHistory}
            title="View Past Chat Sessions"
          >
            <History size={14} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Optional Mini Floating Avatar Orb */}
      {showMiniAvatar && (
        <div className="icv-mini-avatar-wrap" onClick={onInterruptSpeech}>
          <InteractionAvatar
            status={coreStatus}
            isMuted={!isListening}
            detectedPerson={detectedPerson}
          />
        </div>
      )}

      {/* Main Messages Stream */}
      <div
        ref={scrollAreaRef}
        className="icv-messages-scroll-area"
        onScroll={(e) => {
          const el = e.target;
          const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          isAutoScrollEnabledRef.current = isAtBottom;
        }}
      >
        {messages.length === 0 ? (
          <div className="icv-empty-chat-welcome">
            <div className="icv-welcome-emblem">
              <Bot size={44} className="icv-bot-neon" />
            </div>
            <h3>How can I help you today?</h3>
            <p>
              Speak naturally using your voice, or type questions and commands using the text keyboard below.
            </p>

            <div className="icv-suggestion-chips-grid">
              {PROMPT_SUGGESTIONS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="icv-suggestion-chip"
                  onClick={() => handlePromptChipClick(chip)}
                >
                  <Sparkles size={12} className="icv-chip-icon" />
                  <span>"{chip}"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="icv-messages-list">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const timeString = msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id || index}
                  className={`icv-message-row ${isUser ? 'user-side' : 'assistant-side'}`}
                >
                  <div className="icv-message-avatar">
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  <div className="icv-message-bubble-card">
                    <div className="icv-bubble-meta-row">
                      <span className="icv-bubble-sender">
                        {isUser ? 'You' : 'Aurra AI'}
                      </span>
                      {msg.source && !isUser && (
                        <span className={`icv-source-pill ${msg.source}`}>
                          {msg.source.toUpperCase()}
                        </span>
                      )}
                      {msg.latencyMs !== undefined && !isUser && (
                        <span className="icv-latency-pill" title="Execution latency">
                          ⚡ {msg.latencyMs}ms
                        </span>
                      )}
                      {msg.inputType && isUser && (
                        <span className="icv-input-type-tag">
                          {msg.inputType === 'voice' ? '🎤 Voice' : '⌨️ Text'}
                        </span>
                      )}
                      <span className="icv-bubble-time">{timeString}</span>
                    </div>

                    <div className="icv-bubble-text-content">
                      {msg.text}
                    </div>

                    {!isUser && (
                      <div className="icv-bubble-actions">
                        <button
                          type="button"
                          className="icv-replay-btn"
                          onClick={() => handleReplaySpeech(msg.text)}
                          title="Replay Spoken Audio"
                        >
                          <Volume2 size={13} />
                          <span>Replay Audio</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Thinking Status Indicator */}
            {coreStatus === 'THINKING' && (
              <div className="icv-message-row assistant-side typing-row">
                <div className="icv-message-avatar">
                  <Bot size={16} />
                </div>
                <div className="icv-thinking-indicator-bubble">
                  <div className="icv-typing-dot" />
                  <div className="icv-typing-dot" />
                  <div className="icv-typing-dot" />
                  <span>Aurra is reasoning...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Docked Text Chat Input Bar */}
      {showKeyboardInput && (
        <form className="icv-chat-input-bar" onSubmit={handleSendMessage}>
          <div className="icv-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="icv-text-input"
              placeholder={isTypingActive ? "Type your question (Mic is muted)..." : "Ask Aurra a question or type a command..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={isSending}
            />
            {inputText && (
              <button
                type="button"
                className="icv-clear-input-btn"
                onClick={() => setInputText('')}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="icv-send-btn"
            disabled={!inputText.trim() || isSending}
            title="Send query to Aurra"
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      )}

      {/* Slide-Over Chat History Drawer */}
      {showHistoryDrawer && (
        <div className="icv-history-drawer-overlay" onClick={() => setShowHistoryDrawer(false)}>
          <div className="icv-history-drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="icv-drawer-header">
              <div className="icv-drawer-title-group">
                <History size={18} color="#00ffff" />
                <h3>Chat History Transcripts</h3>
              </div>
              <button
                type="button"
                className="icv-drawer-close-btn"
                onClick={() => setShowHistoryDrawer(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="icv-drawer-actions-bar">
              <button
                type="button"
                className="icv-new-chat-btn"
                onClick={handleNewChat}
              >
                + New Chat Session
              </button>
            </div>

            <div className="icv-drawer-sessions-list">
              {pastSessions.length === 0 ? (
                <div className="icv-drawer-empty">
                  <p>No past chat history recorded yet.</p>
                </div>
              ) : (
                pastSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const dateStr = session.updatedAt
                    ? new Date(session.updatedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={session.id}
                      className={`icv-session-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectSession(session)}
                    >
                      <div className="icv-session-item-info">
                        <strong>{session.title || 'Untitled Session'}</strong>
                        <div className="icv-session-meta">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{session.messageCount || 0} messages</span>
                        </div>
                      </div>
                      {isActive && <CheckCircle2 size={16} color="#00ffff" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
