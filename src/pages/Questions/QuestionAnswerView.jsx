import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, MessageSquare, Volume2, 
  Settings, Plus, Trash2, RotateCcw, ExternalLink, Sparkles, X, Check, Send, Filter
} from 'lucide-react';
import { offlineQaService } from '../../db/offlineServices';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import './QuestionAnswerView.css';

export default function QuestionAnswerView({ onNavigate }) {
  const [questions, setQuestions] = useState([]);
  const [conversations, setConversations] = useState([
    {
      id: 'welcome',
      sender: 'aurra',
      text: "Hello! I am Aurra, your humanoid AI guide. Ask me anything about our facilities, services, working hours, or speak to command my robot hardware!",
      actionRoute: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [coreStatus, setCoreStatus] = useState('IDLE'); // 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'
  const [inputText, setInputText] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [showAdminModal, setShowAdminModal] = useState(false);

  // New FAQ form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newKeywords, setNewKeywords] = useState('');
  const [newActionRoute, setNewActionRoute] = useState('');
  const [adminToast, setAdminToast] = useState('');

  const INITIAL_WELCOME = {
    id: 'welcome',
    sender: 'aurra',
    text: "Hello! I am Aurra, your humanoid AI guide. Ask me anything about our facilities, services, working hours, or speak to command my robot hardware!",
    actionRoute: null,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const handleInputSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    handleSendQuery(text);
  };

  const handleClearChat = () => {
    cancelSpeech();
    setConversations([INITIAL_WELCOME]);
  };

  const chatEndRef = useRef(null);

  // Load questions from IndexedDB on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const qList = await offlineQaService.getQuestions();
      setQuestions(qList);
    } catch (err) {
      console.error('Failed to load questions from IndexedDB', err);
    }
  };

  // Subscribe to voice navigation events & QA broadcast events
  useEffect(() => {
    const handleQaAnswered = (e) => {
      const { query, match } = e.detail;
      if (!match) return;

      const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setConversations((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sender: 'user',
          text: query,
          timestamp: userTime,
        },
        {
          id: `aurra-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sender: 'aurra',
          text: match.answer,
          actionRoute: match.actionRoute,
          category: match.category,
          source: e.detail?.source || 'groq-llm',
          timestamp: userTime,
        }
      ]);

    };

    window.addEventListener('aurra:qa-answered', handleQaAnswered);

    const unsubscribe = voiceNavigationService.subscribe((state) => {
      setIsListening(state.isListening);
      if (state.isSpeaking) {
        setCoreStatus('SPEAKING');
      } else if (state.isThinking) {
        setCoreStatus('THINKING');
      } else if (state.isListening) {
        setCoreStatus('LISTENING');
      } else {
        setCoreStatus('IDLE');
      }
    });

    return () => {
      window.removeEventListener('aurra:qa-answered', handleQaAnswered);
      unsubscribe();
    };
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  const handleSendQuery = async (queryText) => {
    const query = (queryText || '').trim();
    if (!query) return;

    setCoreStatus('THINKING');
    voiceNavigationService.processVoiceCommand(query);
  };

  const handleReplaySpeech = (text) => {
    cancelSpeech();
    setCoreStatus('SPEAKING');
    speakWithVoice(text, {
      onEnd: () => setCoreStatus('IDLE')
    });
  };

  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      showToast('Please provide both question and answer.');
      return;
    }

    try {
      await offlineQaService.addQuestion({
        question: newQuestion,
        answer: newAnswer,
        category: newCategory,
        keywords: newKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        actionRoute: newActionRoute || null,
      });

      showToast('FAQ added successfully!');
      setNewQuestion('');
      setNewAnswer('');
      setNewKeywords('');
      setNewActionRoute('');
      loadQuestions();
    } catch (err) {
      showToast(`Error adding FAQ: ${err.message}`);
    }
  };

  const handleDeleteFaq = async (id) => {
    try {
      await offlineQaService.deleteQuestion(id);
      showToast('Question deleted.');
      loadQuestions();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`);
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      await offlineQaService.restoreDefaultQuestions();
      showToast('Restored default FAQ database!');
      loadQuestions();
    } catch (err) {
      showToast(`Restore failed: ${err.message}`);
    }
  };

  const showToast = (msg) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(''), 3000);
  };

  return (
    <div className="qa-view-container">
      {/* Top Header Bar */}
      <header className="qa-top-header">
        <button 
          className="qa-back-btn" 
          onClick={() => onNavigate('/')}
          title="Return to Main Menu"
        >
          <ArrowLeft size={20} />
          <span>BACK</span>
        </button>

        <div className="qa-title-group">
          <h1>INTERACTIVE VOICE &amp; TEXT Q&amp;A</h1>
          <span className="qa-badge">AURRA NEURAL KB • OFFLINE &lt;3ms</span>
        </div>

        <button 
          className="qa-admin-btn"
          onClick={() => setShowAdminModal(true)}
          title="Manage FAQ Database"
        >
          <Settings size={18} />
          <span>MANAGE FAQs</span>
        </button>
      </header>

      {/* Main Content Layout */}
      <div className="qa-main-body">
        {/* Left Side: Holographic Aurra Core & Suggested Query Chips */}
        <aside className="qa-core-panel">
          <div className="aurra-core-visual">
            <div className={`core-ring-outer ${coreStatus.toLowerCase()}`}></div>
            <div className={`core-ring-middle ${coreStatus.toLowerCase()}`}></div>
            <div className={`core-ring-center ${coreStatus.toLowerCase()}`}>
              <Sparkles size={34} className="core-icon" />
            </div>
          </div>

          <div className="core-status-info">
            <span className="status-label">AURRA STATUS</span>
            <strong className={`status-val ${coreStatus.toLowerCase()}`}>
              {coreStatus === 'LISTENING' && '🎤 LISTENING TO YOU...'}
              {coreStatus === 'THINKING' && '⚡ PROCESSING QUERY...'}
              {coreStatus === 'SPEAKING' && '🔊 SPEAKING ANSWER...'}
              {coreStatus === 'IDLE' && '✨ READY & MONITORING'}
            </strong>
          </div>

          {/* Quick FAQ Chips with Category Filter */}
          <div className="qa-chips-container">
            <div className="chips-title">
              <span>SUGGESTED TOPICS</span>
            </div>

            {/* Category Filter Pills */}
            <div className="qa-category-pills">
              {['ALL', 'About', 'Company', 'General'].map((cat) => (
                <button
                  key={cat}
                  className={`qa-cat-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="chips-list">
              {questions
                .filter((q) => activeCategory === 'ALL' || (q.category || '').toLowerCase() === activeCategory.toLowerCase())
                .slice(0, 8)
                .map((q) => (
                  <button
                    key={q.id}
                    className="qa-chip"
                    onClick={() => handleSendQuery(q.question)}
                  >
                    <MessageSquare size={13} />
                    <span>{q.question}</span>
                  </button>
                ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Interactive Conversation Stream */}
        <main className="qa-chat-panel">
          <div className="qa-chat-header">
            <span className="qa-chat-subtitle">INTERACTIVE CONVERSATION STREAM</span>
            {conversations.length > 1 && (
              <button className="qa-clear-stream-btn" onClick={handleClearChat} title="Clear conversation history">
                <Trash2 size={14} />
                <span>Clear Chat</span>
              </button>
            )}
          </div>

          <div className="qa-messages-stream">
            {conversations.map((msg) => (
              <div 
                key={msg.id} 
                className={`qa-message-bubble ${msg.sender === 'aurra' ? 'bubble-aurra' : 'bubble-user'}`}
              >
                <div className="bubble-header">
                  <span className={`sender-tag ${msg.source === 'groq-llm' ? 'grok-ai' : ''}`}>
                    {msg.sender === 'aurra' 
                      ? (msg.source === 'groq-llm' ? '🤖 GROK AI (REAL LLM)' : '🤖 AURRA FAQ') 
                      : '👤 VISITOR'}
                  </span>
                  <span className="time-tag">{msg.timestamp}</span>
                </div>

                <div className="bubble-text">{msg.text}</div>

                {msg.sender === 'aurra' && (
                  <div className="bubble-actions">
                    <button 
                      className="replay-speech-btn" 
                      onClick={() => handleReplaySpeech(msg.text)}
                      title="Speak Answer Again"
                    >
                      <Volume2 size={15} />
                      <span>Replay Voice</span>
                    </button>

                    {msg.actionRoute && (
                      <button 
                        className="route-link-btn" 
                        onClick={() => onNavigate(msg.actionRoute)}
                        title={`Go to ${msg.actionRoute}`}
                      >
                        <ExternalLink size={14} />
                        <span>Open Feature</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Interactive Chat Input Bar */}
          <form className="qa-input-bar" onSubmit={handleInputSubmit}>
            <input
              type="text"
              className="qa-chat-input"
              placeholder="Type your question or query (e.g. 'What is Robomiracle?', 'Working hours')..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="qa-send-btn" disabled={!inputText.trim()}>
              <Send size={16} />
              <span>Ask Aurra</span>
            </button>
          </form>
        </main>
      </div>

      {/* Admin FAQ Management Modal */}
      {showAdminModal && (
        <div className="qa-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="qa-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="qa-modal-header">
              <h2>FAQ KNOWLEDGE BASE MANAGER</h2>
              <button className="qa-close-modal" onClick={() => setShowAdminModal(false)}>
                <X size={20} />
              </button>
            </div>

            {adminToast && <div className="qa-admin-toast">{adminToast}</div>}

            <div className="qa-modal-body">
              {/* Add New FAQ Form */}
              <form className="add-faq-form" onSubmit={handleAddFaq}>
                <h3>ADD NEW QUESTION</h3>
                <div className="form-group">
                  <label>Question:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Where is the canteen?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Answer (Spoken &amp; Displayed):</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. The cafeteria is located on the second floor near Bay B."
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>Category:</label>
                    <input
                      type="text"
                      placeholder="e.g. Facilities, Reception"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                  </div>

                  <div className="form-group half">
                    <label>Action Link Route (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. /facilities or /form"
                      value={newActionRoute}
                      onChange={(e) => setNewActionRoute(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Voice Keywords (comma separated):</label>
                  <input
                    type="text"
                    placeholder="canteen, cafeteria, lunch, food, dining"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                </div>

                <button type="submit" className="save-faq-btn">
                  <Plus size={16} />
                  <span>Save to Offline IndexedDB</span>
                </button>
              </form>

              {/* Current FAQs List */}
              <div className="faq-list-section">
                <div className="faq-list-header">
                  <h3>STORED FAQs ({questions.length})</h3>
                  <button 
                    type="button" 
                    className="restore-defaults-btn" 
                    onClick={handleRestoreDefaults}
                  >
                    <RotateCcw size={14} />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="faq-scroll-box">
                  {questions.map((item) => (
                    <div key={item.id} className="faq-admin-item">
                      <div className="faq-item-info">
                        <strong>{item.question}</strong>
                        <p>{item.answer}</p>
                        <div className="faq-item-tags">
                          <span className="tag-cat">{item.category}</span>
                          {item.actionRoute && <span className="tag-route">{item.actionRoute}</span>}
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="delete-faq-btn" 
                        onClick={() => handleDeleteFaq(item.id)}
                        title="Delete FAQ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
