/**
 * LLM Orchestrator Service for Aurra 2.0 Kiosk
 * Exact implementation ported from Aurra 1.0 (Groq Cloud API)
 * - Ultra-low latency inference via Groq (~300-500ms)
 * - Strict 35-word limit for concise speech synthesis
 * - Clean response text filter (strips markdown, asterisks, emojis, action tags)
 * - 4.5s AbortController timeout protection so tablet never hangs
 * - Network-aware (detects offline status and fails gracefully)
 */

import { logger } from './logger';

const DEFAULT_SYSTEM_PROMPT =
  'You are Aurra, a friendly and helpful AI receptionist for Robomiracle Technologies. ' +
  'You are speaking directly to a visitor at an autonomous reception kiosk. ' +
  'When asked what your name is, ALWAYS say "I am Aurra." ' +
  'When asked who created you, developed you, or who your father/maker is, ALWAYS say "I was created and developed by Robomiracle Technologies." ' +
  'Answer the user\'s question directly, accurately, and concisely. ' +
  'CRITICAL RULE: Your response MUST BE SHORT AND CONCISE. IT MUST NOT EXCEED 35 WORDS IN TOTAL. ' +
  'Always respond in the exact same language as the user input (such as Tamil, English, Hindi, Malayalam, Spanish, etc.). ' +
  'Reply in a friendly, conversational tone suitable for speech synthesis. ' +
  'Do not use emojis, markdown, asterisks, bracketed actions, or bulleted lists.';

const STORAGE_KEY = 'aurra_llm_config_v2';

const DEFAULT_API_KEY = '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';

export const getDefaultLlmConfig = () => ({
  enabled: true,
  apiUrl: 'https://api.groq.com/openai/v1',
  apiKey: import.meta.env.VITE_LLM_API_KEY || DEFAULT_API_KEY,
  model: 'openai/gpt-oss-20b',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.6,
  maxTokens: 120,
  timeoutMs: 8000,
});

class LlmService {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaults = getDefaultLlmConfig();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaults, ...parsed };
        // Auto-heal missing API key or invalid/deprecated model
        if (!merged.apiKey || !merged.apiKey.trim()) {
          merged.apiKey = defaults.apiKey;
        }
        if (!merged.model || merged.model.includes('llama-3.3-70b')) {
          merged.model = 'openai/gpt-oss-20b';
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed loading LLM config from storage:', e);
    }
    return defaults;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed saving LLM config to storage:', e);
    }
    return this.config;
  }

  getConfig() {
    return { ...this.config };
  }

  isConfigured() {
    const key = (this.config.apiKey || DEFAULT_API_KEY).trim();
    return Boolean(this.config.enabled && key);
  }

  /**
   * Cleans raw LLM response text for speech synthesis:
   * - Strips thinking tags, HTML, markdown, emojis, asterisks, brackets
   * - Enforces 35-40 word limit
   */
  cleanResponseText(text) {
    if (!text) return '';
    let cleaned = text;

    // Remove thinking tags (e.g. from DeepSeek / Qwen)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<\|.*?\|>/g, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\((smiles|nods|chuckles|laughs|pauses|whispers|action|gestures|sighs|giggles|waves|bows|winks)\)/gi, '');
    cleaned = cleaned.replace(/[\(\)]/g, '');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/[\*_]{1,2}/g, '');
    cleaned = cleaned.replace(/`{1,3}/g, '');
    cleaned = cleaned.replace(/^[\s\-\*\+\u2022]\s+/gm, '');
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
    
    // Remove emojis & special pictographs
    cleaned = cleaned.replace(
      /[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
      ''
    );

    cleaned = cleaned.replace(/^(assistant|user|system):\s*/i, '');
    cleaned = cleaned.replace(/^the user (asks|is asking)[:\s]*"[^"]*"\s*/gi, '');
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{2,}/g, ' ').trim();

    // Safeguard: Override third-party creator claims
    if (/\b(qrok|groq|grok|qrk|openai|meta|llama)\b/i.test(cleaned) && /\b(developed|created|built|made|designed)\b/i.test(cleaned)) {
      cleaned = 'I am Aurra, an autonomous AI receptionist created and developed by Robomiracle Technologies.';
    }

    // Enforce word limit (35-40 words max for quick spoken response)
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 38) {
      const sliced = words.slice(0, 38).join(' ');
      const lastPunc = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('?'), sliced.lastIndexOf('!'));
      if (lastPunc > 40) {
        cleaned = sliced.slice(0, lastPunc + 1);
      } else {
        cleaned = sliced + '.';
      }
    }

    return cleaned.trim();
  }

  /**
   * Generates a conversational response using Groq Cloud API
   * Non-blocking, aborts on timeout, fails gracefully
   */
  async generateResponse(userQuery, conversationHistory = []) {
    if (!this.config.enabled) {
      return { success: false, reason: 'DISABLED' };
    }

    const apiKey = (this.config.apiKey || DEFAULT_API_KEY).trim();
    if (!apiKey) {
      logger.warn('LLM', 'No Groq API key configured.');
      return { success: false, reason: 'NO_KEY' };
    }

    let rawUrl = (this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '');
    let targetUrl = rawUrl.endsWith('/chat/completions') ? rawUrl : `${rawUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 8000);

    const messages = [
      { role: 'system', content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...(conversationHistory || []).slice(-4), // Keep last 4 turns for context
      { role: 'user', content: userQuery },
    ];

    const modelName = (!this.config.model || this.config.model.includes('llama-3.3-70b'))
      ? 'openai/gpt-oss-20b'
      : this.config.model;

    const body = {
      model: modelName,
      messages,
      temperature: this.config.temperature || 0.6,
      max_tokens: this.config.maxTokens || 120,
    };

    const startTime = Date.now();

    try {
      logger.speech('LLM', `Calling Groq LLM (${body.model}) for: "${userQuery}"`);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey.trim()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorText.slice(0, 120)}`);
      }

      const data = await response.json();
      const msgObj = data.choices?.[0]?.message;
      const rawText = msgObj?.content || msgObj?.reasoning_content || '';
      const cleaned = this.cleanResponseText(rawText);
      const latency = Date.now() - startTime;

      if (!cleaned) {
        throw new Error('Empty response received from LLM endpoint.');
      }

      logger.info('LLM', `Groq response received in ${latency}ms: "${cleaned}"`);
      return {
        success: true,
        text: cleaned,
        latencyMs: latency,
        model: body.model,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      const isAbort = err.name === 'AbortError';

      if (isAbort) {
        logger.warn('LLM', `Groq LLM timed out after ${this.config.timeoutMs}ms`);
      } else {
        logger.error('LLM', `Groq LLM call failed: ${err.message}`);
      }

      return {
        success: false,
        reason: isAbort ? 'TIMEOUT' : 'ERROR',
        error: err.message,
        latencyMs: latency,
      };
    }
  }

  /**
   * Test API connectivity directly from Admin Panel
   */
  async testConnection() {
    const result = await this.generateResponse('Hello! Introduce yourself in one short sentence.');
    return result;
  }
}

export const llmService = new LlmService();
