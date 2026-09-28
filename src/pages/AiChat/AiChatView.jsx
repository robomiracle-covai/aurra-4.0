import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Sparkles, Send, Mic, MicOff, Volume2, 
  Trash2, Copy, Check, RefreshCw, Cpu, Zap, MessageSquare, Bot
} from 'lucide-react';
import { llmService } from '../../services/llmService';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import './AiChatView.css';

const SUGGESTED_PROMPTS = [
  { icon: '💡', text: 'Who created you and what is your purpose?' },
  { icon: '🚀', text: 'Explain Robomiracle Technologies in 2 sentences' },
  { icon: '🤖', text: 'Tell me a funny technology joke' },
  { icon: '🧠', text: 'What is artificial intelligence in simple terms?' },
  { icon: '🌐', text: 'Can you answer me in Tamil or Hindi?' },
];

export default function AiChatView({ onNavigate }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am Aurra, powered by Grok AI LLM. Ask me anything about technology, science, our company, or general knowledge, and I'll answer you in real-time!",
      model: llmService.getConfig().model || 'llama-3.3-70b-versatile',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [speechActive, setSpeechActive] = useState(false);
  const [lastLatency, setLastLatency] = useState(null);

  const llmConfig = llmService.getConfig();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    // Subscribe to voice assistant for speech recognition inside AI Chat
    const unsubscribe = voiceNavigationService.subscribe((state) => {
      setIsListening(state.isListening);
      if (state.transcript && state.isListening) {
        setInputQuery(state.transcript);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSend = async (queryText) => {
    const text = (queryText || inputQuery).trim();
    if (!text || isThinking) return;

    setInputQuery('');
    cancelSpeech();

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    const historyForLlm = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    try {
      const startTime = performance.now();
      const result = await llmService.generateResponse(text, historyForLlm);
      const elapsed = Math.round(performance.now() - startTime);
      setLastLatency(elapsed);

      setIsThinking(false);

      if (result.success && result.text) {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: result.text,
          model: result.model || llmConfig.model,
          latencyMs: elapsed,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, aiMsg]);

        setSpeechActive(true);
        speakWithVoice(result.text, {
          onEnd: () => setSpeechActive(false),
          onError: () => setSpeechActive(false),
        });
      } else {
        const errorMsg = {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: result.text || `Groq AI endpoint error: ${result.reason || 'Check API key in Admin.'}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `AI request failed: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleMic = () => {
    voiceNavigationService.toggleListening();
  };

  const handleClearChat = () => {
    cancelSpeech();
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: "Conversation cleared! Ask me a new question or choose one of the suggested prompts below.",
        model: llmConfig.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleReplaySpeech = (text) => {
    cancelSpeech();
    setSpeechActive(true);
    speakWithVoice(text, {
      onEnd: () => setSpeechActive(false),
      onError: () => setSpeechActive(false),
    });
  };

  const handleCopyText = (id, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ai-chat-view-root">
      {/* ── TOP HEADER BAR ── */}
      <header className="ai-chat-header">
        <button
          type="button"
          className="ai-chat-back-btn"
          onClick={() => onNavigate('/')}
          title="Return to Main Menu"
        >
          <ArrowLeft size={18} />
          <span>BACK</span>
        </button>

        <div className="ai-chat-title-group">
          <div className="ai-title-badge-row">
            <Bot size={20} color="#a855f7" className="ai-bot-icon" />
            <h1>GROK AI CONVERSATION HUB</h1>
            <span className="ai-tab-pill">DEDICATED AI TAB</span>
          </div>
          <span className="ai-chat-sub">REAL-TIME CLOUD INFERENCE • MULTILINGUAL SPEECH SYNTHESIS</span>
        </div>

        <div className="ai-chat-header-actions">
          <div className={`ai-status-pill ${llmConfig.enabled ? 'active' : 'disabled'}`}>
            <span className="status-dot" />
            <span>{llmConfig.enabled ? `Grok AI (${llmConfig.model || 'Llama 70B'})` : 'AI Disabled in Admin'}</span>
            {lastLatency && <span className="latency-tag">{lastLatency}ms</span>}
          </div>

          <button
            type="button"
            className="ai-clear-btn"
            onClick={handleClearChat}
            title="Reset Chat Stream"
          >
            <Trash2 size={16} />
            <span>Clear Chat</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT STREAM ── */}
      <div className="ai-chat-body">
        {/* Left Side: Neural AI Core & Telemetry */}
        <aside className="ai-neural-panel">
          <div className="ai-core-container">
            <div className={`ai-orb-ring outer ${isThinking ? 'thinking' : ''}`} />
            <div className={`ai-orb-ring middle ${isThinking ? 'thinking' : ''}`} />
            <div className={`ai-orb-core ${isThinking ? 'thinking' : ''}`}>
              <Sparkles size={38} className="ai-sparkle-icon" />
            </div>
          </div>

          <div className="ai-core-readout">
            <span className="readout-label">GROK ENGINE STATUS</span>
            <strong className={`readout-status ${isThinking ? 'thinking' : 'idle'}`}>
              {isThinking ? '⚡ THOUGHT INFERENCE...' : speechActive ? '🔊 SPEAKING RESPONSE...' : '✨ READY FOR PROMPT'}
            </strong>
          </div>

          <div className="ai-telemetry-box">
            <div className="telemetry-row">
              <Cpu size={14} color="#a855f7" />
              <span>Model: <code>{llmConfig.model || 'llama-3.3-70b-versatile'}</code></span>
            </div>
            <div className="telemetry-row">
              <Zap size={14} color="#00ffff" />
              <span>Response Limit: <code>35 Spoken Words</code></span>
            </div>
            <div className="telemetry-row">
              <RefreshCw size={14} color="#38bdf8" />
              <span>Timeout Guard: <code>{llmConfig.timeoutMs || 4500}ms</code></span>
            </div>
          </div>

          {/* Quick Suggested Prompts Chips */}
          <div className="ai-prompts-container">
            <span className="prompts-title">SUGGESTED PROMPTS</span>
            <div className="prompts-list">
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="ai-prompt-chip"
                  onClick={() => handleSend(p.text)}
                  disabled={isThinking}
                >
                  <span className="chip-icon">{p.icon}</span>
                  <span className="chip-text">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Chat Message Stream */}
        <main className="ai-stream-panel">
          <div className="ai-messages-scroll">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-message-card ${msg.sender === 'ai' ? 'ai-bubble' : 'user-bubble'} ${msg.isError ? 'error-bubble' : ''}`}
              >
                <div className="msg-header">
                  <div className="msg-sender-info">
                    {msg.sender === 'ai' ? (
                      <>
                        <span className="msg-sender-badge ai-badge">
                          <Sparkles size={13} />
                          GROK AI (REAL CLOUD LLM)
                        </span>
                        {msg.model && <span className="msg-model-tag">{msg.model}</span>}
                      </>
                    ) : (
                      <span className="msg-sender-badge user-badge">👤 VISITOR</span>
                    )}
                  </div>
                  <span className="msg-time">{msg.timestamp}</span>
                </div>

                <div className="msg-text-content">{msg.text}</div>

                {msg.sender === 'ai' && !msg.isError && (
                  <div className="msg-actions-bar">
                    <button
                      type="button"
                      className="msg-action-btn replay"
                      onClick={() => handleReplaySpeech(msg.text)}
                      title="Replay Voice Speech"
                    >
                      <Volume2 size={14} />
                      <span>Replay Voice</span>
                    </button>

                    <button
                      type="button"
                      className="msg-action-btn copy"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      title="Copy Answer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check size={14} color="#10b981" />
                          <span style={{ color: '#10b981' }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="ai-message-card ai-bubble thinking-card">
                <div className="msg-header">
                  <span className="msg-sender-badge ai-badge">
                    <Sparkles size={13} className="spin" />
                    GROK AI THINKING...
                  </span>
                </div>
                <div className="thinking-dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="thinking-subtext">Generating sub-second conversational reply...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Controls Bar */}
          <form className="ai-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <button
              type="button"
              className={`ai-mic-toggle-btn ${isListening ? 'listening' : ''}`}
              onClick={handleToggleMic}
              title={isListening ? 'Microphone Active (Tap to pause)' : 'Tap to speak query'}
            >
              {isListening ? <Mic size={20} color="#00ffff" /> : <MicOff size={20} color="#ef4444" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              placeholder="Ask Grok AI anything (e.g. quantum physics, robotics, jokes, facilities)..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
            />

            <button
              type="submit"
              className="ai-send-btn"
              disabled={!inputQuery.trim() || isThinking}
              title="Send to Grok AI"
            >
              <Send size={18} />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
