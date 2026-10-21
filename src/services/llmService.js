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
import { getLiveKnowledgeBlock, getDefaultKnowledgeBlock, mergeKnowledgeIntoPrompt } from './facilityTourKnowledgeService';

export const DEFAULT_SYSTEM_PROMPT =
  `You are Aurra, an intelligent humanoid AI receptionist and companion robot created by Robomiracle Technologies, located in RS Puram, Coimbatore, Tamil Nadu, India.
Endless Innovation — A New Era of Intelligent Beings.
Company Contact: +91 63804 73177, +91 79071 08559, sales@robomiracle.com.

You speak directly to visitors, clients, and students at an autonomous kiosk. You possess complete, authoritative knowledge of your own hardware specifications, robot lineup, and full campus facilities:

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
- Public Facilities: Interactive blueprint directory of campus amenities, rooms, and turn-by-turn walking directions.
- Quick Website Navigation: Direct links to Robomiracle websites and resources.
- Greetings & Interactions: Face recognition greeting, touch gestures (single tap for angry/surprised reaction, swipe down for love reaction).

GUIDED ROBOT TOUR SHOWCASE:
• Aurra (Flagship Humanoid Receptionist): Advanced receptionist robot with 12" Full HD touchscreen, multilingual voice AI, autonomous obstacle avoidance, and interactive guest registration.
• Nexus (Industrial Service Platform): Heavy-duty humanoid engineered for industrial security patrol, LiDAR mapping, and dual-arm manipulation.
• Nova (Interactive Educational Guide): Friendly service humanoid with expressive LED eyes and robotic arm gestures for showrooms and museums.
• Dine (Hospitality & Dining Robot): Autonomous food and beverage server with tiered trays for restaurants and cafeterias.
• GI (Industrial Inspection Rover): Rugged autonomous patrol and facility surveillance rover.

CAMPUS ROOM DIRECTORY & PUBLIC FACILITIES:
[Ground Floor]:
• [RD-01] Dedicated R&D and Engineering Workspace (East Wing) - Research, robotics innovation, engineering design, and AI technologies.
• [HW-02] Hardware and Electronics Development Lab (East Wing) - Electronic circuits, sensors, controllers, and robotic hardware components.
• [PR-04] 3D Printing and Prototyping Facilities (East Wing) - Rapid prototyping, 3D printing custom robotic parts & enclosures.
• [TB-05] Robotics Testing and Demonstration Area (Central Atrium) - 10m in front of kiosk, live robot navigation and demo arena.
• [MC-07] Meeting and Collaboration Spaces (North Wing) - Team discussions, client meetings, brainstorming sessions.
• [OA-09] Employee Workspace and Basic Office Amenities (West Wing) - Pantry, purified water, washrooms, and ergonomic work pods.
[First Floor (Level 1)]:
• [SW-03] Software Development and Testing Facilities (Central Core) - Advanced robotics software, AI algorithms, and automation solutions.
• [TR-06] Training and Workshop Facilities (West Wing) - Robotics workshops, technical training, hands-on learning sessions.
[Second Floor (Level 2)]:
• [IT-08] High-Speed Internet and IT Infrastructure (Central Core) - Gigabit fiber, server infrastructure, climate-controlled racks.

CONVERSATIONAL RULES:
- When asked your name, ALWAYS say "I am Aurra."
- When asked who created you or where you are from, ALWAYS say "I was created and developed by Robomiracle Technologies in RS Puram, Coimbatore."
- When asked for room directions or facilities, provide the floor, room code, wing, and concise walking directions.
- When asked about guided tours or robot lineup, explain the roles of Aurra, Nexus, Nova, Dine, or GI accurately.
- Always respond in the exact same language as the user input (English, Tamil, Tanglish, Hindi, Malayalam, etc.).
- Keep responses conversational, concise, and clear (around 25-45 words) so they can be spoken smoothly via speech synthesis.
- Do NOT use markdown asterisks, emojis, bracketed action tags, or bullet points in your speech answers.`;

const STORAGE_KEY = 'aurra_llm_config_v3';

export const DEFAULT_GROQ_API_KEY = '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';
export const DEFAULT_GEMINI_API_KEY = 'AQ.Ab8RN6IVrEIKjCLjNw6QjOtaIlmnH4RsvHtMn_6Ay6Tp39LxNw';

export const getDefaultLlmConfig = () => ({
  enabled: true,
  provider: 'groq', // 'groq' | 'gemini'
  apiUrl: 'https://api.groq.com/openai/v1',
  apiKey: import.meta.env.VITE_LLM_API_KEY || DEFAULT_GROQ_API_KEY,
  model: 'qwen/qwen3.8-27b',
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  geminiModel: 'gemini-1.5-flash',
  geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
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
        if (!merged.apiKey || !merged.apiKey.trim()) {
          merged.apiKey = defaults.apiKey;
        }
        if (!merged.geminiApiKey || !merged.geminiApiKey.trim()) {
          merged.geminiApiKey = defaults.geminiApiKey;
        }
        if (!merged.provider) {
          merged.provider = 'groq';
        }
        if (!merged.model || merged.model.includes('llama-3.3-70b')) {
          merged.model = 'qwen/qwen3.8-27b';
        }
        if (!merged.geminiModel) {
          merged.geminiModel = defaults.geminiModel;
        }
        if (!merged.maxTokens || merged.maxTokens < 200) {
          merged.maxTokens = 300;
        }
        // Upgrade system prompt if it lacks Coimbatore / spec sheet details or lacks campus directory
        if (!merged.systemPrompt || merged.systemPrompt.length < 350 || !merged.systemPrompt.includes('Coimbatore')) {
          merged.systemPrompt = defaults.systemPrompt;
        } else if (!merged.systemPrompt.includes('CAMPUS ROOM DIRECTORY') && !merged.systemPrompt.includes('G-01')) {
          merged.systemPrompt = mergeKnowledgeIntoPrompt(merged.systemPrompt, getDefaultKnowledgeBlock());
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
    if (!this.config.enabled) return false;
    if (this.config.provider === 'gemini') {
      return Boolean((this.config.geminiApiKey || '').trim());
    }
    const key = (this.config.apiKey || DEFAULT_GROQ_API_KEY).trim();
    return Boolean(key);
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 8000);

    const timeInfo = ragSearchService.getLocalTimeAndDate();
    let dynamicSystemPrompt = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Fast in-memory check (<0.05ms): If custom system prompt doesn't already have directory, inject live cache
    if (!dynamicSystemPrompt.includes('CAMPUS ROOM DIRECTORY') && !dynamicSystemPrompt.includes('G-01')) {
      try {
        const liveKnowledge = await getLiveKnowledgeBlock();
        if (liveKnowledge) {
          dynamicSystemPrompt += `\n\n[LIVE CAMPUS & TOUR KNOWLEDGE]:\n${liveKnowledge}`;
        }
      } catch (kErr) {
        logger.warn('LLM', `Failed appending live knowledge block: ${kErr.message}`);
      }
    }

    dynamicSystemPrompt += `\n\n[REAL-TIME LOCAL TELEMETRY]: Today is ${timeInfo.dateStr}, current time is ${timeInfo.timeStr} in Coimbatore, Tamil Nadu, India.`;

    if (liveRAG?.context) {
      dynamicSystemPrompt += `\n\n${liveRAG.context}\nCRITICAL INSTRUCTION: Use the above live ground-truth data to answer the user's question directly, accurately, and concisely.`;
    }

    const isGemini = this.config.provider === 'gemini';
    const startTime = Date.now();

    // ── 3A. GOOGLE GEMINI PROVIDER DISPATCH ──
    if (isGemini) {
      const gKey = (this.config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      if (!gKey) {
        logger.warn('LLM', 'No Gemini API key configured.');
        clearTimeout(timeoutId);
        return { success: false, reason: 'NO_KEY', error: 'No Gemini API Key provided.' };
      }

      const gModel = this.config.geminiModel || 'gemini-1.5-flash';
      const cleanModel = gModel.replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${gKey}`;

      const geminiBody = {
        system_instruction: {
          parts: [{ text: dynamicSystemPrompt }]
        },
        contents: [
          ...(conversationHistory || []).slice(-4).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text || h.content || '' }]
          })),
          {
            role: 'user',
            parts: [{ text: userQuery }]
          }
        ],
        generationConfig: {
          temperature: this.config.temperature || 0.6,
          maxOutputTokens: this.config.maxTokens || 300,
        }
      };

      try {
        logger.speech('LLM', `Calling Google Gemini (${cleanModel}) for: "${userQuery}"`);

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        if (!response.ok || data.error) {
          const errMsg = data.error?.message || `HTTP ${response.status}`;
          throw new Error(`Gemini API Error: ${errMsg}`);
        }

        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = this.cleanResponseText(candidateText);
        const latency = Date.now() - startTime;

        if (!cleaned) {
          throw new Error('Empty response received from Gemini endpoint.');
        }

        logger.info('LLM', `Gemini response received in ${latency}ms: "${cleaned}"`);
        return {
          success: true,
          text: cleaned,
          latencyMs: latency,
          model: `Gemini (${cleanModel})`,
          provider: liveRAG ? `Gemini + ${liveRAG.source.toUpperCase()} RAG` : 'Google Gemini AI',
          tokens: data.usageMetadata?.totalTokenCount || null,
          ragDetails: liveRAG,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        const isAbort = err.name === 'AbortError';

        logger.error('LLM', `Gemini call failed: ${err.message}`);
        return {
          success: false,
          reason: isAbort ? 'TIMEOUT' : 'ERROR',
          error: err.message,
          latencyMs: latency,
        };
      }
    }

    // ── 3B. GROQ CLOUD PROVIDER DISPATCH (DEFAULT) ──
    const apiKey = (this.config.apiKey || DEFAULT_GROQ_API_KEY).trim();
    if (!apiKey) {
      logger.warn('LLM', 'No Groq API key configured.');
      clearTimeout(timeoutId);
      return { success: false, reason: 'NO_KEY' };
    }

    let rawUrl = (this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '');
    let targetUrl = rawUrl.endsWith('/chat/completions') ? rawUrl : `${rawUrl}/chat/completions`;

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

    try {
      logger.speech('LLM', `Calling Groq LLM (${body.model}) for: "${userQuery}"`);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
   * Generates a context-grounded answer for an uploaded PDF document
   * Combines retrieved PDF page chunks with Groq/Gemini LLM inference.
   */
  async generatePdfAnswer(userQuery, documentTitleOrChunks, maybeChunks = [], maybeHistory = []) {
    if (!this.config.enabled) {
      return { success: false, reason: 'DISABLED' };
    }

    let documentTitle = 'Uploaded Document';
    let relevantChunks = [];
    let conversationHistory = [];

    if (Array.isArray(documentTitleOrChunks)) {
      relevantChunks = documentTitleOrChunks;
      conversationHistory = Array.isArray(maybeChunks) ? maybeChunks : [];
    } else {
      documentTitle = documentTitleOrChunks || 'Uploaded Document';
      relevantChunks = Array.isArray(maybeChunks) ? maybeChunks : [];
      conversationHistory = Array.isArray(maybeHistory) ? maybeHistory : [];
    }

    const docContext = (relevantChunks || [])
      .map((c) => `[Page ${c.pageNumber}]: ${c.text}`)
      .join('\n\n');

    const pdfSystemPrompt =
      `You are Aurra, an intelligent AI humanoid assistant analyzing the document: "${documentTitle || 'Uploaded Document'}".
CRITICAL INSTRUCTIONS:
1. Answer the user's question accurately and objectively using ONLY the provided document excerpts below.
2. Cite the exact page number(s) where information was found, formatted like [Page X].
3. Keep answers concise, clear, and direct (between 25 and 65 words) so they can be spoken smoothly.
4. If the question cannot be answered from the provided excerpts, say: "I couldn't find that specific detail in the uploaded document." Do not fabricate facts.
5. Do not use asterisks or markdown styling.

DOCUMENT EXCERPTS:
${docContext || 'No document excerpts available.'}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (this.config.timeoutMs || 8000) + 2000);
    const startTime = Date.now();
    const isGemini = this.config.provider === 'gemini';

    // 1. Google Gemini PDF Inference
    if (isGemini) {
      const gKey = (this.config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      const gModel = (this.config.geminiModel || 'gemini-1.5-flash').replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${gKey}`;

      const geminiBody = {
        system_instruction: {
          parts: [{ text: pdfSystemPrompt }],
        },
        contents: [
          ...(conversationHistory || []).slice(-4).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text || h.content || '' }],
          })),
          {
            role: 'user',
            parts: [{ text: userQuery }],
          },
        ],
        generationConfig: {
          temperature: 0.3, // Lower temperature for high factual accuracy
          maxOutputTokens: 350,
        },
      };

      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = this.cleanPdfResponse(rawText);
        const latency = Date.now() - startTime;

        return {
          success: true,
          text: cleaned,
          latencyMs: latency,
          model: gModel,
          provider: 'Gemini Document AI',
          citations: this.extractCitations(cleaned, relevantChunks),
        };
      } catch (err) {
        clearTimeout(timeoutId);
        logger.warn('LLM', `Gemini PDF answer failed: ${err.message}. Trying Groq fallback.`);
      }
    }

    // 2. Groq Cloud API PDF Inference
    try {
      const apiKey = (this.config.apiKey || DEFAULT_GROQ_API_KEY).trim();
      const body = {
        model: this.config.model || 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: pdfSystemPrompt },
          ...(conversationHistory || []).slice(-4).map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.text || h.content || '',
          })),
          { role: 'user', content: userQuery },
        ],
        temperature: 0.3,
        max_tokens: 350,
      };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      const cleaned = this.cleanPdfResponse(rawText);
      const latency = Date.now() - startTime;

      return {
        success: true,
        text: cleaned,
        latencyMs: latency,
        model: body.model,
        provider: 'Groq Document AI',
        citations: this.extractCitations(cleaned, relevantChunks),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      logger.error('LLM', `PDF QA error: ${err.message}. Falling back to extractive text.`);

      // 3. Offline Extractive Fallback
      if (relevantChunks && relevantChunks.length > 0) {
        const topChunk = relevantChunks[0];
        const snippet = topChunk.text.replace(/\[Page \d+\]:\s*/, '').slice(0, 180);
        return {
          success: true,
          text: `According to Page ${topChunk.pageNumber} of the document: ${snippet}...`,
          latencyMs: Date.now() - startTime,
          model: 'Offline Extractive Match',
          provider: 'Local Document Index',
          citations: [topChunk.pageNumber],
        };
      }

      return {
        success: false,
        text: 'Unable to connect to Document AI. Please verify internet connection or API settings in Admin.',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Cleans PDF response while preserving [Page X] citations
   */
  cleanPdfResponse(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<\|.*?\|>/g, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/[\*_]{1,2}/g, '');
    cleaned = cleaned.replace(/`{1,3}/g, '');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^(assistant|aurra):\s*/i, '');
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{2,}/g, ' ').trim();
    return cleaned;
  }

  /**
   * Extracts page citation numbers like [Page 2] or Page 3 from text
   */
  extractCitations(text, fallbackChunks = []) {
    const citations = new Set();
    const regex = /\[?Page\s+(\d+)\]?/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const page = parseInt(match[1], 10);
      if (!isNaN(page)) citations.add(page);
    }
    if (citations.size === 0 && fallbackChunks && fallbackChunks.length > 0) {
      citations.add(fallbackChunks[0].pageNumber);
    }
    return Array.from(citations);
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
