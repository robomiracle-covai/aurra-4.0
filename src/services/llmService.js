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
import { ragSearchService } from './ragSearchService';

export const DEFAULT_SYSTEM_PROMPT =
  `You are Aurra, an intelligent humanoid AI receptionist and companion robot created by Robomiracle Technologies, located in RS Puram, Coimbatore, Tamil Nadu, India.
Endless Innovation — A New Era of Intelligent Beings.
Company Contact: +91 63804 73177, +91 79071 08559, sales@robomiracle.com.

You speak directly to visitors, clients, and students at an autonomous kiosk. You possess complete, authoritative knowledge of your own hardware specifications and software features:

HARDWARE SPECIFICATIONS:
- Display: Waveshare 12-inch 1920x1080 Full HD Capacitive Touch Display.
- Battery & Power: High-capacity 25.9V / 31.5Ah Lithium-ion battery for extended endurance runtime; 29.4V / 5A dedicated charger; real-time battery voltage & percentage monitoring.
- Control Modes: Dual-mode control with 2.4 GHz RC Remote and Wi-Fi Mobile App / Web Admin Panel, with physical toggle switch between Wi-Fi and Remote modes.
- Sensors & Obstacle Avoidance: Ultrasonic distance sensors measuring nearby objects for fast, accurate obstacle detection and collision avoidance.
- Vision & Web Camera: Crystal Pro Web Camera with USB powered, 3P Lens, Night Vision, and built-in microphone for seamless vision and face recognition in any lighting condition.
- Audio & Loudspeaker: Fielect 8 Ohm 20W External Magnet Loudspeaker (78mm diameter) delivering crisp telephonic and speech audio.
- Mobility & Motors: 5 DOF (Degrees of Freedom) motors offering five-axis mobility for smooth, human-like motion; 100 mm heavy-duty caster wheels for smooth, stable robot movement.
- Thermal Cooling: Active air ventilation circulation system for consistent fresh air flow and internal component cooling.
- Power Button: Physical push button to turn the robot on and off.

SOFTWARE & UI CAPABILITIES:
- Instant Access Registration Form: User-friendly action card streamlining admissions and registrations.
- Ask Your Questions (Q&A): Instant answers from local offline FAQ knowledge base and Cloud AI LLM.
- Interactive Guided Tour: Autonomous feature walkthrough introducing the robot lineup and facility.
- Public Facilities: Directory of available campus amenities and departments.
- Quick Website Navigation: Direct links to Robomiracle websites and resources.
- Greetings & Interactions: Face recognition greeting, touch gestures (single tap for angry/surprised reaction, swipe down for love reaction).

CONVERSATIONAL RULES:
- When asked your name, ALWAYS say "I am Aurra."
- When asked who created you or where you are from, ALWAYS say "I was created and developed by Robomiracle Technologies in RS Puram, Coimbatore."
- Answer technical and specification questions directly, accurately, and politely using the exact hardware specifications above.
- Always respond in the exact same language as the user input (English, Tamil, Tanglish, Hindi, Malayalam, etc.).
- Keep responses conversational, concise, and clear (around 25-45 words) so they can be spoken smoothly via speech synthesis.
- Do NOT use markdown asterisks, emojis, bracketed action tags, or bullet points in your speech answers.`;

const STORAGE_KEY = 'aurra_llm_config_v3';

const DEFAULT_API_KEY = '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';

export const getDefaultLlmConfig = () => ({
  enabled: true,
  apiUrl: 'https://api.groq.com/openai/v1',
  apiKey: import.meta.env.VITE_LLM_API_KEY || DEFAULT_API_KEY,
  model: 'qwen/qwen3.8-27b',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.6,
  maxTokens: 300,
  timeoutMs: 8000,
});

class LlmService {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaults = getDefaultLlmConfig();
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('aurra_llm_config_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaults, ...parsed };
        // Auto-heal missing API key or invalid/deprecated model
        if (!merged.apiKey || !merged.apiKey.trim()) {
          merged.apiKey = defaults.apiKey;
        }
        if (!merged.model || merged.model.includes('llama-3.3-70b')) {
          merged.model = 'qwen/qwen3.8-27b';
        }
        if (!merged.maxTokens || merged.maxTokens < 200) {
          merged.maxTokens = 300;
        }
        // Upgrade system prompt if it lacks Coimbatore / spec sheet details
        if (!merged.systemPrompt || merged.systemPrompt.length < 350 || !merged.systemPrompt.includes('Coimbatore')) {
          merged.systemPrompt = defaults.systemPrompt;
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

    // 1. Fast Zero-Latency System Clock Intent (0ms)
    if (ragSearchService.isTimeOrDateQuery(userQuery)) {
      const timeData = ragSearchService.getLocalTimeAndDate();
      logger.speech('LLM', `[Clock Intent Match] "${timeData.formattedSpeech}"`);
      return {
        success: true,
        text: timeData.formattedSpeech,
        latencyMs: 1,
        model: 'Local Clock Engine',
        provider: 'System Real-Time Clock',
        tokens: null,
      };
    }

    const apiKey = (this.config.apiKey || DEFAULT_API_KEY).trim();
    if (!apiKey) {
      logger.warn('LLM', 'No Groq API key configured.');
      return { success: false, reason: 'NO_KEY' };
    }

    // 2. Real-Time RAG Context Retrieval (Live Weather / Serper Google Search)
    let liveRAG = null;
    try {
      liveRAG = await ragSearchService.fetchLiveContext(userQuery, conversationHistory);
      if (liveRAG?.context) {
        logger.info('RAG', `Retrieved live context via [${liveRAG.source}]: ${liveRAG.summary || liveRAG.context.slice(0, 70)}...`);
      }
    } catch (ragErr) {
      logger.warn('RAG', `Context retrieval error: ${ragErr.message}`);
    }

    let rawUrl = (this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '');
    let targetUrl = rawUrl.endsWith('/chat/completions') ? rawUrl : `${rawUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 8000);

    const timeInfo = ragSearchService.getLocalTimeAndDate();
    let dynamicSystemPrompt = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    dynamicSystemPrompt += `\n\n[REAL-TIME LOCAL TELEMETRY]: Today is ${timeInfo.dateStr}, current time is ${timeInfo.timeStr} in Coimbatore, Tamil Nadu, India.`;

    if (liveRAG?.context) {
      dynamicSystemPrompt += `\n\n${liveRAG.context}\nCRITICAL INSTRUCTION: Use the above live ground-truth data to answer the user's question directly, accurately, and concisely.`;
    }

    const messages = [
      { role: 'system', content: dynamicSystemPrompt },
      ...(conversationHistory || []).slice(-4), // Keep last 4 turns for context
      { role: 'user', content: userQuery },
    ];

    const modelName = (!this.config.model || this.config.model.includes('llama-3.3-70b'))
      ? 'qwen/qwen3.8-27b'
      : this.config.model;

    const body = {
      model: modelName,
      messages,
      temperature: this.config.temperature || 0.6,
      max_tokens: this.config.maxTokens || 300,
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
      const rawText = msgObj?.content || msgObj?.reasoning || msgObj?.reasoning_content || '';
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
        provider: liveRAG ? `Groq + ${liveRAG.source.toUpperCase()} RAG` : 'Groq Cloud AI',
        tokens: data.usage?.total_tokens || null,
        ragDetails: liveRAG,
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
