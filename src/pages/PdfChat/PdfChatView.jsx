import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, FileText, Volume2, 
  Trash2, Sparkles, BookOpen, Layers, CheckCircle2, AlertCircle, RefreshCw, X, Link2, Globe
} from 'lucide-react';
import { offlinePdfService } from '../../db/offlineServices';
import { extractTextFromPdf, chunkPdfPages, generateStarterQuestions, downloadPdfFromUrl } from '../../utils/pdfExtractor';
import { llmService } from '../../services/llmService';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import './PdfChatView.css';

export default function PdfChatView({ onNavigate }) {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [pages, setPages] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [starterQuestions, setStarterQuestions] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [isThinking, setIsThinking] = useState(false);
  const [activeTab, setActiveTab] = useState('pages'); // 'pages' | 'library'
  const [highlightedPage, setHighlightedPage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pageRefs = useRef({});

  // 1. Initial Load of Documents from IndexedDB
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await offlinePdfService.getDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) {
        selectDocument(docs[0]);
      }
    } catch (err) {
      console.error('Failed loading PDF documents:', err);
      setErrorMessage('Could not load documents from local storage.');
    }
  };

  // 2. Select Document & Load Details
  const selectDocument = async (doc) => {
    setActiveDoc(doc);
    setHighlightedPage(null);
    cancelSpeech();

    try {
      const docChunks = await offlinePdfService.getChunks(doc.id);
      setChunks(docChunks);

      // Reconstruct pages list for navigation
      const pagesMap = new Map();
      docChunks.forEach((c) => {
        if (!pagesMap.has(c.pageNumber)) {
          pagesMap.set(c.pageNumber, {
            pageNumber: c.pageNumber,
            text: c.text.replace(/^\[Page \d+\]:\s*/, ''),
          });
        }
      });
      const pageList = Array.from(pagesMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
      setPages(pageList);

      // Generate Starter Questions
      const questions = generateStarterQuestions(pageList);
      setStarterQuestions(questions);

      // Load Chat Messages
      const msgs = await offlinePdfService.getChatMessages(doc.id);
      if (msgs && msgs.length > 0) {
        setChatMessages(msgs);
      } else {
        const welcome = {
          role: 'assistant',
          text: `I have opened "${doc.title}". Ask me any question using the microphone below or tap a suggested prompt!`,
          citations: [1],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages([welcome]);
      }
    } catch (err) {
      console.error(`Error loading details for document ${doc.id}:`, err);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  // Subscribe to universal voice bar thinking state so transcript stays 100% in sync
  useEffect(() => {
    const unsubVoice = voiceNavigationService.subscribe((state) => {
      if (state.isThinking !== undefined) {
        setIsThinking(state.isThinking);
      }
    });

    return () => unsubVoice();
  }, []);

  // 3. Register Active Document Context with Universal Voice Assistant Bar
  useEffect(() => {
    if (activeDoc?.id) {
      voiceNavigationService.setDocumentContext({
        docId: activeDoc.id,
        title: activeDoc.title,
        onQuestion: (query) => {
          const userMsg = {
            role: 'user',
            text: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setChatMessages((prev) => [...prev, userMsg]);
          offlinePdfService.addChatMessage(activeDoc.id, userMsg);
        },
        onAnswer: async ({ query, answer, citations, model, provider }) => {
          const assistantMsg = {
            role: 'assistant',
            text: answer,
            citations: citations || [],
            provider,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setChatMessages((prev) => {
            // Avoid duplicate user message if already appended via onQuestion
            const hasUserMsg = prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].text === query;
            if (hasUserMsg) {
              return [...prev, assistantMsg];
            }
            const userMsg = {
              role: 'user',
              text: query,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            return [...prev, userMsg, assistantMsg];
          });
          await offlinePdfService.addChatMessage(activeDoc.id, assistantMsg);
        },
      });

      // Ensure voice listening is actively unpaused so user can speak immediately
      if (!voiceNavigationService.isListening && !voiceNavigationService.userPaused) {
        voiceNavigationService.startListening(true);
      }
    } else {
      voiceNavigationService.clearDocumentContext();
    }

    return () => {
      voiceNavigationService.clearDocumentContext();
      cancelSpeech();
    };
  }, [activeDoc]);

  // 5. Handle File Upload & Processing
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }

    setErrorMessage('');
    setIsExtracting(true);
    setExtractionProgress({ current: 0, total: 1 });

    try {
      // Extract text page by page with live progress callback
      const { pages: extractedPages, pageCount } = await extractTextFromPdf(file, (curr, tot) => {
        setExtractionProgress({ current: curr, total: tot });
      });

      if (!extractedPages || extractedPages.length === 0) {
        throw new Error('No readable text content found in PDF.');
      }

      // Chunk document
      const docChunks = chunkPdfPages(extractedPages, 250, 30);

      // Create Document Record
      const docTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      const newDoc = {
        title: docTitle,
        fileName: file.name,
        fileSize: file.size,
        pageCount,
        summary: extractedPages[0]?.text.slice(0, 160) + '...',
      };

      const savedDoc = await offlinePdfService.saveDocument(newDoc, docChunks);
      await loadDocuments();
      await selectDocument(savedDoc);
      setActiveTab('pages');
    } catch (err) {
      console.error('PDF extraction failed:', err);
      setErrorMessage(`Failed to parse PDF: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // 6. Handle Google Drive & Web PDF Link Import
  const handleUrlImport = async (urlToFetch) => {
    const targetUrl = (urlToFetch || urlInput).trim();
    if (!targetUrl || isExtracting) return;

    setErrorMessage('');
    setIsExtracting(true);
    setExtractionProgress({ current: 0, total: 1 });

    try {
      // 1. Download binary data from URL or Google Drive
      const arrayBuffer = await downloadPdfFromUrl(targetUrl);
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded file is empty or link is inaccessible.');
      }

      // 2. Extract text page by page
      const { pages: extractedPages, pageCount } = await extractTextFromPdf(arrayBuffer, (curr, tot) => {
        setExtractionProgress({ current: curr, total: tot });
      });

      if (!extractedPages || extractedPages.length === 0) {
        throw new Error('No readable text content found in PDF.');
      }

      // 3. Chunk document
      const docChunks = chunkPdfPages(extractedPages, 250, 30);

      // Derive title from URL or Google Drive
      let derivedTitle = 'Google Drive Document';
      if (targetUrl.includes('drive.google.com')) {
        derivedTitle = 'Google Drive PDF Document';
      } else {
        const urlParts = targetUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1].split('?')[0];
        if (lastPart) {
          derivedTitle = decodeURIComponent(lastPart).replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        }
      }

      const newDoc = {
        title: derivedTitle,
        fileName: derivedTitle + '.pdf',
        fileSize: arrayBuffer.byteLength,
        pageCount,
        summary: extractedPages[0]?.text.slice(0, 160) + '...',
      };

      const savedDoc = await offlinePdfService.saveDocument(newDoc, docChunks);
      setUrlInput('');
      await loadDocuments();
      await selectDocument(savedDoc);
      setActiveTab('pages');
    } catch (err) {
      console.error('URL import failed:', err);
      setErrorMessage(`Failed to import from link: ${err.message}. Please make sure Google Drive link has "Anyone with the link can view" permission.`);
    } finally {
      setIsExtracting(false);
    }
  };

  // 7. Send Query & Generate Context-Grounded Answer
  const handleSendQuery = async (queryText) => {
    const query = (queryText || inputText).trim();
    if (!query || isThinking || !activeDoc) return;

    setInputText('');
    cancelSpeech();

    // 1. Add User Message
    const userMsg = {
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Save user message to Dexie
      await offlinePdfService.addChatMessage(activeDoc.id, userMsg);

      // 2. Retrieve Relevant Chunks using Offline Semantic Search
      const relevantChunks = await offlinePdfService.searchChunks(activeDoc.id, query, 4);

      // 3. Format Conversation History for LLM
      const historyForLlm = chatMessages.slice(-4).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      // 4. Generate AI Answer with Context Grounding
      const aiResult = await llmService.generatePdfAnswer(
        query,
        activeDoc.title,
        relevantChunks,
        historyForLlm
      );

      const aiText = aiResult.text || "I was unable to retrieve a response from the document.";
      const citations = aiResult.citations || (relevantChunks[0] ? [relevantChunks[0].pageNumber] : []);

      const assistantMsg = {
        role: 'assistant',
        text: aiText,
        citations,
        provider: aiResult.provider,
        latencyMs: aiResult.latencyMs,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
      await offlinePdfService.addChatMessage(activeDoc.id, assistantMsg);

      // 5. Speak Answer via Aurra's Speech Synthesis
      speakWithVoice(aiText);
    } catch (err) {
      console.error('PDF Q&A failed:', err);
      const errorMsg = {
        role: 'assistant',
        text: `Error processing query: ${err.message}`,
        citations: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // 7. Handle Citation Click (Highlights & Scrolls to Page)
  const handleCitationClick = (pageNum) => {
    setActiveTab('pages');
    setHighlightedPage(pageNum);
    const targetElement = pageRefs.current[pageNum];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 8. Delete Active Document
  const handleDeleteDocument = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this PDF document?')) return;

    try {
      await offlinePdfService.deleteDocument(id);
      const remaining = documents.filter((d) => d.id !== id);
      setDocuments(remaining);
      if (activeDoc?.id === id) {
        if (remaining.length > 0) {
          selectDocument(remaining[0]);
        } else {
          setActiveDoc(null);
          setChunks([]);
          setPages([]);
          setChatMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // 9. Clear Chat History
  const handleClearChat = async () => {
    if (!activeDoc) return;
    try {
      cancelSpeech();
      await offlinePdfService.clearChatMessages(activeDoc.id);
      setChatMessages([
        {
          role: 'assistant',
          text: `Chat history cleared. What else would you like to know about "${activeDoc.title}"?`,
          citations: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Failed clearing chat:', err);
    }
  };

  return (
    <div className="pdf-view-container">
      {/* ── Top Header Bar ── */}
      <header className="pdf-top-header">
        <div className="pdf-header-left">
          <button 
            className="pdf-back-btn" 
            onClick={() => onNavigate('/')}
            title="Return to Main Menu"
          >
            <ArrowLeft size={18} />
            <span>BACK TO HOME</span>
          </button>

          <div className="pdf-title-group">
            <h1>
              <FileText size={22} color="#ff3366" />
              <span>PDF DOCUMENT AI</span>
            </h1>
            <span className="pdf-header-badge">AURRA NEURAL RETRIEVAL • RAG</span>
          </div>
        </div>

        <div className="pdf-header-actions">
          <button 
            className="pdf-action-btn upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload New PDF"
          >
            <Upload size={16} />
            <span>UPLOAD PDF</span>
          </button>

          <button 
            className="pdf-action-btn secondary-btn"
            onClick={handleClearChat}
            title="Clear Chat History"
          >
            <RefreshCw size={15} />
            <span>CLEAR CHAT</span>
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".pdf,application/pdf" 
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          }}
        />
      </header>

      {/* ── Main Workspace ── */}
      <div className="pdf-workspace">
        {/* ── Left Sidebar (Document, Pages & Library) ── */}
        <aside className="pdf-sidebar">
          {/* Active Document Card */}
          {activeDoc && (
            <div className="pdf-active-card">
              <div className="pdf-doc-meta-row">
                <div className="pdf-doc-icon">
                  <BookOpen size={20} />
                </div>
                <div className="pdf-doc-info">
                  <div className="pdf-doc-title" title={activeDoc.title}>
                    {activeDoc.title}
                  </div>
                  <div className="pdf-doc-subtext">
                    <span>{activeDoc.pageCount} Pages</span>
                    <span>•</span>
                    <span>{Math.round(activeDoc.fileSize / 1024)} KB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div 
            className={`pdf-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} color="#ff3366" />
            <p>Tap or Drag PDF file here</p>
            <span>Supports tech specs, manuals, brochures &amp; books</span>
          </div>

          {/* Google Drive / Cloud Web Link Import Card */}
          <div className="pdf-url-import-card">
            <div className="pdf-url-header">
              <Link2 size={14} color="#00ffff" />
              <span>PASTE GOOGLE DRIVE OR PDF LINK</span>
            </div>
            <div className="pdf-url-input-row">
              <input
                type="text"
                className="pdf-url-input"
                placeholder="https://drive.google.com/file/d/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUrlImport();
                  }
                }}
                disabled={isExtracting}
              />
              <button
                type="button"
                className="pdf-url-fetch-btn"
                onClick={() => handleUrlImport()}
                disabled={!urlInput.trim() || isExtracting}
              >
                {isExtracting ? '...' : 'IMPORT'}
              </button>
            </div>
            <span className="pdf-url-caption">
              Supports Google Drive sharing links &amp; any public PDF URL
            </span>
          </div>

          {/* Extraction Progress Bar */}
          {isExtracting && (
            <div className="pdf-progress-bar-container">
              <div className="pdf-progress-text">
                <span>PARSING DOCUMENT PAGES...</span>
                <span>{extractionProgress.current} / {extractionProgress.total || '?'}</span>
              </div>
              <div className="pdf-progress-track">
                <div 
                  className="pdf-progress-fill" 
                  style={{ 
                    width: `${extractionProgress.total ? (extractionProgress.current / extractionProgress.total) * 100 : 30}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div style={{ margin: '0 20px 12px', padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="pdf-tab-bar">
            <button 
              className={`pdf-tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
            >
              PAGES ({pages.length})
            </button>
            <button 
              className={`pdf-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              STORED DOCUMENTS ({documents.length})
            </button>
          </div>

          {/* Tab 1: Pages Viewer */}
          {activeTab === 'pages' && (
            <div className="pdf-pages-list">
              {pages.map((p) => (
                <div 
                  key={p.pageNumber}
                  ref={(el) => (pageRefs.current[p.pageNumber] = el)}
                  className={`pdf-page-card ${highlightedPage === p.pageNumber ? 'highlighted' : ''}`}
                  onClick={() => setHighlightedPage(p.pageNumber)}
                >
                  <span className="pdf-page-badge">PAGE {p.pageNumber}</span>
                  <div className="pdf-page-snippet">{p.text}</div>
                </div>
              ))}
              {pages.length === 0 && !isExtracting && (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 40 }}>
                  No pages loaded. Upload a PDF to start!
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Stored Documents Library */}
          {activeTab === 'library' && (
            <div className="pdf-docs-library">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  className={`pdf-doc-item ${activeDoc?.id === doc.id ? 'active' : ''}`}
                  onClick={() => selectDocument(doc)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {doc.pageCount} Pages • {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    className="pdf-doc-delete-btn"
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Right Panel (Interactive Chat & Voice) ── */}
        <main className="pdf-chat-area">
          {/* Suggested Prompts Bar */}
          {starterQuestions.length > 0 && (
            <div className="pdf-suggestions-bar">
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ff3366', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Suggested:
              </span>
              {starterQuestions.map((q, idx) => (
                <button 
                  key={idx} 
                  className="pdf-suggestion-chip"
                  onClick={() => voiceNavigationService.processVoiceCommand(q, { inputType: 'text' })}
                >
                  <Sparkles size={12} color="#00ffff" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          )}

          {/* Chat Transcript */}
          <div className="pdf-chat-transcript">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`pdf-message-row ${msg.role}`}>
                <div className={`pdf-avatar ${msg.role === 'assistant' ? 'assistant-avatar' : 'user-avatar'}`}>
                  {msg.role === 'assistant' ? <FileText size={18} /> : <span>U</span>}
                </div>
                <div className="pdf-bubble">
                  <div>{msg.text}</div>

                  <div className="pdf-bubble-footer">
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pdf-citations-group">
                        <span style={{ fontSize: 10, opacity: 0.7 }}>SOURCE:</span>
                        {msg.citations.map((page) => (
                          <span 
                            key={page} 
                            className="pdf-citation-pill"
                            onClick={() => handleCitationClick(page)}
                            title={`Jump to Page ${page} in document`}
                          >
                            Page {page}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <span>{msg.timestamp}</span>
                      {msg.role === 'assistant' && (
                        <button 
                          className="pdf-speak-btn"
                          onClick={() => {
                            cancelSpeech();
                            speakWithVoice(msg.text);
                          }}
                          title="Replay Audio"
                        >
                          <Volume2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="pdf-message-row assistant">
                <div className="pdf-avatar assistant-avatar">
                  <FileText size={18} />
                </div>
                <div className="pdf-bubble">
                  <div className="pdf-thinking-bubble">
                    <span>Searching document &amp; thinking</span>
                    <div className="pdf-thinking-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </main>
      </div>
    </div>
  );
}
