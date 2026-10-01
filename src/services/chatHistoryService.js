import { db } from '../db/dexieDb';
import { logger } from './logger';

const ACTIVE_SESSION_KEY = 'aurra_active_chat_session_id';
const LOGGING_ENABLED_KEY = 'aurra_chat_history_logging_enabled';

export const chatHistoryService = {
  /**
   * Check if chat transcript logging is enabled (defaults to true)
   */
  isLoggingEnabled() {
    try {
      const val = localStorage.getItem(LOGGING_ENABLED_KEY);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  setLoggingEnabled(enabled) {
    try {
      localStorage.setItem(LOGGING_ENABLED_KEY, String(enabled));
    } catch (e) {
      console.warn('Failed to save logging setting:', e);
    }
  },

  /**
   * Get current active session ID or create a new session if none exists
   */
  async getActiveSessionId() {
    let currentId = null;
    try {
      currentId = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    } catch (_) {}

    if (currentId) {
      try {
        const exists = await db.chatSessions.get(currentId);
        if (exists) return currentId;
      } catch (_) {}
    }

    // Create a new session
    const newSession = await this.startNewSession('Interaction Session');
    return newSession.id;
  },

  /**
   * Start a brand new chat session
   */
  async startNewSession(title = 'New Interaction') {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const session = {
      id,
      title: title || `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    try {
      await db.chatSessions.add(session);
      sessionStorage.setItem(ACTIVE_SESSION_KEY, id);
      logger.info('CHAT', `Started new chat session: ${id}`);
    } catch (err) {
      console.warn('[CHAT] Error creating session in Dexie:', err);
    }

    return session;
  },

  /**
   * Get all past sessions ordered by most recently updated
   */
  async getAllSessions() {
    try {
      const sessions = await db.chatSessions.toArray();
      return sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    } catch (err) {
      console.warn('[CHAT] Error fetching sessions:', err);
      return [];
    }
  },

  /**
   * Get all messages for a specific session
   */
  async getSessionMessages(sessionId) {
    if (!sessionId) return [];
    try {
      const msgs = await db.chatMessages.where('sessionId').equals(sessionId).toArray();
      return msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (err) {
      console.warn('[CHAT] Error fetching session messages:', err);
      return [];
    }
  },

  /**
   * Add a message (role: 'user' | 'assistant') to the active or specified session
   */
  async addMessage({
    sessionId,
    role = 'user',
    text = '',
    inputType = 'voice', // 'voice' | 'text'
    source = 'kiosk',    // 'voice-ai' | 'groq-llm' | 'offline-faq' | 'hardware' | 'greeting'
    confidence = 100,
  }) {
    if (!text || !text.trim()) return null;
    if (!this.isLoggingEnabled()) return null;

    try {
      const sid = sessionId || (await this.getActiveSessionId());
      const now = new Date().toISOString();

      const messageRecord = {
        sessionId: sid,
        role,
        text: text.trim(),
        timestamp: now,
        inputType,
        source,
        confidence: Number(confidence) || 100,
      };

      const msgId = await db.chatMessages.add(messageRecord);
      messageRecord.id = msgId;

      // Update session title dynamically if it's the first user message
      const session = await db.chatSessions.get(sid);
      if (session) {
        let newTitle = session.title;
        if (role === 'user' && (session.messageCount === 0 || session.title.startsWith('Interaction Session') || session.title.startsWith('New Interaction'))) {
          newTitle = text.trim().slice(0, 38) + (text.length > 38 ? '...' : '');
        }

        await db.chatSessions.update(sid, {
          title: newTitle,
          updatedAt: now,
          messageCount: (session.messageCount || 0) + 1,
        });
      }

      // Notify any active listeners (e.g. Chat UI)
      window.dispatchEvent(
        new CustomEvent('aurra:chat-message-added', {
          detail: { message: messageRecord, sessionId: sid },
        })
      );

      return messageRecord;
    } catch (err) {
      console.warn('[CHAT] Error adding message:', err);
      return null;
    }
  },

  /**
   * Delete a session and its associated messages
   */
  async deleteSession(sessionId) {
    if (!sessionId) return;
    try {
      await db.chatMessages.where('sessionId').equals(sessionId).delete();
      await db.chatSessions.delete(sessionId);
      if (sessionStorage.getItem(ACTIVE_SESSION_KEY) === sessionId) {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      }
      logger.info('CHAT', `Deleted session: ${sessionId}`);
    } catch (err) {
      console.warn('[CHAT] Error deleting session:', err);
    }
  },

  /**
   * Clear all chat history
   */
  async clearAllHistory() {
    try {
      await db.chatMessages.clear();
      await db.chatSessions.clear();
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      logger.info('CHAT', 'Cleared all chat history');
    } catch (err) {
      console.warn('[CHAT] Error clearing chat history:', err);
    }
  },

  /**
   * Export all chat sessions and messages as formatted JSON
   */
  async exportHistoryJson() {
    const sessions = await this.getAllSessions();
    const fullHistory = [];
    for (const s of sessions) {
      const messages = await this.getSessionMessages(s.id);
      fullHistory.push({
        session: s,
        messages,
      });
    }
    return JSON.stringify(fullHistory, null, 2);
  },

  /**
   * Export history as CSV
   */
  async exportHistoryCsv() {
    const sessions = await this.getAllSessions();
    const rows = [
      ['Session ID', 'Session Title', 'Date', 'Role', 'Input Type', 'Source', 'Confidence', 'Message Content']
    ];

    for (const s of sessions) {
      const messages = await this.getSessionMessages(s.id);
      for (const m of messages) {
        rows.push([
          `"${s.id}"`,
          `"${(s.title || '').replace(/"/g, '""')}"`,
          `"${m.timestamp}"`,
          `"${m.role}"`,
          `"${m.inputType || 'voice'}"`,
          `"${m.source || 'ai'}"`,
          `"${m.confidence || 100}"`,
          `"${(m.text || '').replace(/"/g, '""')}"`
        ]);
      }
    }

    return rows.map(r => r.join(',')).join('\n');
  }
};
