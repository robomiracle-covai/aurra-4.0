import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Terminal, Activity, CheckCircle2, AlertTriangle, 
  Trash2, RefreshCw, Search, Send, Copy, Check, Clock, Cpu, Globe, Cloud, Sparkles
} from 'lucide-react';
import { apiTelemetryService } from '../../services/apiTelemetryService';
import { llmService } from '../../services/llmService';
import './DebugView.css';

export default function DebugView({ onNavigate, isInAdmin = false }) {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, avgLatencyMs: 0 });
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Subscribe to Live API Telemetry
  useEffect(() => {
    setTransactions(apiTelemetryService.getTransactions());
    setStats(apiTelemetryService.getStats());

    const unsubscribe = apiTelemetryService.subscribe((buffer, newStats) => {
      setTransactions([...buffer]);
      setStats(newStats);
    });

    return () => unsubscribe();
  }, []);

  // Filter transactions based on category pill & search term
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Category filter
      if (filterType === 'LLM' && !tx.service.toLowerCase().includes('llm') && !tx.service.toLowerCase().includes('gemini') && !tx.service.toLowerCase().includes('groq')) {
        return false;
      }
      if (filterType === 'RAG SEARCH' && !tx.service.toLowerCase().includes('search') && !tx.service.toLowerCase().includes('serper') && !tx.service.toLowerCase().includes('duck') && !tx.service.toLowerCase().includes('wiki')) {
        return false;
      }
      if (filterType === 'WEATHER' && !tx.service.toLowerCase().includes('weather') && !tx.service.toLowerCase().includes('meteo')) {
        return false;
      }
      if (filterType === 'CLOUD / PDF' && !tx.service.toLowerCase().includes('google') && !tx.service.toLowerCase().includes('drive') && !tx.service.toLowerCase().includes('cloud') && !tx.url.toLowerCase().includes('.pdf')) {
        return false;
      }
      if (filterType === 'ERRORS' && tx.isOk) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inUrl = tx.url?.toLowerCase().includes(q);
        const inService = tx.service?.toLowerCase().includes(q);
        const inStatus = String(tx.status).toLowerCase().includes(q);
        const inReq = JSON.stringify(tx.request || '').toLowerCase().includes(q);
        const inRes = JSON.stringify(tx.response || '').toLowerCase().includes(q);
        return inUrl || inService || inStatus || inReq || inRes;
      }

      return true;
    });
  }, [transactions, filterType, searchQuery]);

  // Set initial selected transaction if none selected
  useEffect(() => {
    if (!selectedTx && filteredTransactions.length > 0) {
      setSelectedTx(filteredTransactions[0]);
    }
  }, [filteredTransactions, selectedTx]);

  const handleCopy = (key, content) => {
    try {
      const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleTestPing = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      await llmService.generateResponse('System Telemetry Health Check. Respond in 10 words.');
    } catch (err) {
      console.error('Test ping failed:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    apiTelemetryService.clear();
    setSelectedTx(null);
  };

  const getServiceColor = (service = '') => {
    const s = service.toLowerCase();
    if (s.includes('groq')) return '#ff3366';
    if (s.includes('gemini')) return '#38bdf8';
    if (s.includes('serper') || s.includes('search')) return '#10b981';
    if (s.includes('weather') || s.includes('meteo')) return '#f59e0b';
    if (s.includes('google') || s.includes('drive')) return '#a855f7';
    return '#00ffff';
  };

  return (
    <div className="debug-container">
      {/* ── Top Header ── */}
      <header className="debug-header">
        <div className="debug-header-left">
          {!isInAdmin && (
            <button 
              className="debug-back-btn"
              onClick={() => onNavigate ? onNavigate('home') : window.history.back()}
            >
              <ArrowLeft size={16} />
              <span>BACK TO LAUNCHER</span>
            </button>
          )}
          <div className="debug-title-group">
            <h1>
              <Terminal size={22} color="#00ffff" />
              <span>LIVE API &amp; NETWORK TELEMETRY</span>
              <span className="debug-header-badge">REAL-TIME</span>
            </h1>
          </div>
        </div>

        <div className="debug-header-actions">
          <button 
            type="button"
            className="debug-btn"
            onClick={handleTestPing}
            disabled={isTesting}
            title="Send test prompt to live AI endpoint"
          >
            <Send size={14} color="#00ffff" />
            <span>{isTesting ? 'TESTING...' : 'TEST AI PING'}</span>
          </button>
          <button 
            type="button"
            className="debug-btn clear-btn"
            onClick={handleClear}
            title="Clear all recorded API requests"
          >
            <Trash2 size={14} />
            <span>CLEAR LOGS</span>
          </button>
        </div>
      </header>

      {/* ── KPI Metrics Toolbar ── */}
      <section className="debug-kpi-bar">
        <div className="debug-kpi-card">
          <div className="debug-kpi-icon" style={{ background: 'rgba(0, 255, 255, 0.15)', color: '#00ffff' }}>
            <Activity size={20} />
          </div>
          <div className="debug-kpi-info">
            <span className="debug-kpi-label">TOTAL API REQUESTS</span>
            <span className="debug-kpi-value">{stats.total}</span>
          </div>
        </div>

        <div className="debug-kpi-card">
          <div className="debug-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="debug-kpi-info">
            <span className="debug-kpi-label">SUCCESSFUL CALLS</span>
            <span className="debug-kpi-value" style={{ color: '#34d399' }}>{stats.success}</span>
          </div>
        </div>

        <div className="debug-kpi-card">
          <div className="debug-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="debug-kpi-info">
            <span className="debug-kpi-label">FAILED / TIMEOUTS</span>
            <span className="debug-kpi-value" style={{ color: stats.failed > 0 ? '#f87171' : '#ffffff' }}>{stats.failed}</span>
          </div>
        </div>

        <div className="debug-kpi-card">
          <div className="debug-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <div className="debug-kpi-info">
            <span className="debug-kpi-label">AVG ROUNDTRIP LATENCY</span>
            <span className="debug-kpi-value">{stats.avgLatencyMs} ms</span>
          </div>
        </div>
      </section>

      {/* ── Category Filter & Search Toolbar ── */}
      <section className="debug-toolbar">
        <div className="debug-filter-pills">
          {['ALL', 'LLM', 'RAG SEARCH', 'WEATHER', 'CLOUD / PDF', 'ERRORS'].map((cat) => (
            <button
              key={cat}
              className={`debug-pill ${filterType === cat ? 'active' : ''}`}
              onClick={() => setFilterType(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="debug-search-box">
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Search endpoint, prompt, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* ── Split Layout: Transaction List & Detailed Inspector ── */}
      <main className="debug-body">
        {/* Left Transaction List */}
        <div className="debug-list-container">
          {filteredTransactions.map((tx) => {
            const isSelected = selectedTx?.id === tx.id;
            return (
              <div 
                key={tx.id}
                className={`debug-tx-row ${isSelected ? 'selected' : ''} ${tx.isOk ? 'ok-row' : 'error-row'}`}
                onClick={() => setSelectedTx(tx)}
              >
                <div className="debug-tx-left">
                  <span className={`debug-method-badge ${tx.method.toLowerCase()}`}>
                    {tx.method}
                  </span>
                  <span 
                    className="debug-service-pill"
                    style={{ 
                      borderColor: getServiceColor(tx.service), 
                      color: getServiceColor(tx.service), 
                      background: `${getServiceColor(tx.service)}18` 
                    }}
                  >
                    {tx.service}
                  </span>
                  <span className="debug-tx-url" title={tx.url}>
                    {tx.url || '(Internal Service Bridge)'}
                  </span>
                </div>

                <div className="debug-tx-right">
                  <span className={`debug-status-pill ${tx.isOk ? 'status-ok' : 'status-err'}`}>
                    {tx.status}
                  </span>
                  <span className="debug-latency">
                    {tx.durationMs}ms
                  </span>
                  <span className="debug-time">
                    {tx.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="debug-empty-state">
              <Globe size={40} color="#334155" />
              <div>
                <strong>No API Transactions Found</strong>
                <p style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {transactions.length === 0 
                    ? 'Ask questions to Aurra, perform a search, or tap "TEST AI PING" to see live requests!' 
                    : 'No requests matched the selected category filter or search query.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Inspector Panel */}
        <aside className="debug-inspector">
          <div className="debug-inspector-header">
            <span className="debug-inspector-title">PAYLOAD &amp; NETWORK INSPECTOR</span>
            {selectedTx && (
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                ID: {selectedTx.id}
              </span>
            )}
          </div>

          {selectedTx ? (
            <div className="debug-inspector-content">
              {/* Endpoint Meta */}
              <div className="debug-section-box">
                <label>Target URL &amp; Protocol</label>
                <div className="debug-code-box" style={{ color: '#00ffff' }}>
                  {selectedTx.method} {selectedTx.url}
                </div>
              </div>

              {/* Status & Latency Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="debug-section-box">
                  <label>HTTP Status</label>
                  <div className="debug-code-box" style={{ color: selectedTx.isOk ? '#34d399' : '#f87171' }}>
                    {selectedTx.status} {selectedTx.error ? `(${selectedTx.error})` : 'OK'}
                  </div>
                </div>
                <div className="debug-section-box">
                  <label>Latency Duration</label>
                  <div className="debug-code-box">
                    {selectedTx.durationMs} ms
                  </div>
                </div>
              </div>

              {/* Request Payload */}
              <div className="debug-section-box">
                <label>
                  <span>Request Payload / Headers</span>
                  <button 
                    type="button" 
                    className="debug-copy-btn"
                    onClick={() => handleCopy('req', selectedTx.request)}
                  >
                    {copiedKey === 'req' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    <span>{copiedKey === 'req' ? 'COPIED' : 'COPY'}</span>
                  </button>
                </label>
                <div className="debug-code-box">
                  {selectedTx.request 
                    ? (typeof selectedTx.request === 'object' ? JSON.stringify(selectedTx.request, null, 2) : String(selectedTx.request))
                    : '(No request body / GET parameters)'}
                </div>
              </div>

              {/* Response Payload */}
              <div className="debug-section-box">
                <label>
                  <span>Response Payload / Stream Data</span>
                  <button 
                    type="button" 
                    className="debug-copy-btn"
                    onClick={() => handleCopy('res', selectedTx.response)}
                  >
                    {copiedKey === 'res' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    <span>{copiedKey === 'res' ? 'COPIED' : 'COPY'}</span>
                  </button>
                </label>
                <div className="debug-code-box">
                  {selectedTx.response 
                    ? (typeof selectedTx.response === 'object' ? JSON.stringify(selectedTx.response, null, 2) : String(selectedTx.response))
                    : (selectedTx.error ? `Error: ${selectedTx.error}` : '(No response body)')}
                </div>
              </div>
            </div>
          ) : (
            <div className="debug-empty-state">
              <Terminal size={36} color="#334155" />
              <span>Select any API transaction on the left to inspect its complete request &amp; response payload.</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
