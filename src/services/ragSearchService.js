/**
 * RAG Web Search & Real-Time Weather Context Retrieval Service for Aurra 4.0
 * 
 * Features:
 * 1. Live Weather Engine: Direct Open-Meteo API (zero-key, live Coimbatore weather in °C & conditions)
 *    + Serper.dev fallback for external cities.
 * 2. Real-Time Google Search: Serper.dev API (Extracts Google AnswerBoxes, Knowledge Graph, & Organic snippets).
 * 3. Free Fallbacks: DuckDuckGo Instant Answer & Wikipedia REST API.
 * 4. Local Time & Date Engine: Instant local time in Coimbatore (IST / Asia/Kolkata).
 * 5. Persona Safeguards: Protects Robomiracle identity from accidental search overrides.
 */

import { logger } from './logger.js';

const DEFAULT_SERPER_KEY = '4ad982db526bf552ebe082a969ac6761cdc80821';
const STORAGE_KEY = 'aurra_serper_config_v1';

// WMO Weather Interpretation Codes
const WMO_WEATHER_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

class RagSearchService {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          enabled: parsed.enabled !== false,
          apiKey: parsed.apiKey || DEFAULT_SERPER_KEY,
        };
      }
    } catch {}
    return {
      enabled: true,
      apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERPER_API_KEY) || DEFAULT_SERPER_KEY,
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {}
    return this.config;
  }

  getConfig() {
    return this.config;
  }

  /**
   * Fast 0ms local time & date check
   */
  isTimeOrDateQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.toLowerCase().trim();
    return /\b(what is the time|what time is it|current time|tell me the time|time now|what day is today|what is today'?s date|today'?s date|current date|what date is it|what day is it)\b/i.test(q);
  }

  /**
   * Returns authoritative local time & date in Coimbatore (IST)
   */
  getLocalTimeAndDate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const dateStr = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return {
      timeStr,
      dateStr,
      formattedSpeech: `Right now, the time is ${timeStr}, and today is ${dateStr} in Coimbatore.`,
    };
  }

  /**
   * Weather query detector
   */
  isWeatherQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.toLowerCase().trim();
    return /\b(weather|temperature|climate|rain|raining|forecast|how hot|how cold|humidity|sunny|cloudy)\b/i.test(q);
  }

  /**
   * General factual / news / real-time query detector
   */
  isRealTimeFactQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.toLowerCase().trim();

    // Guard: Exclude identity, company, political leadership, specifications, and facility questions from web search
    // These are authoritative ground truth embedded directly in Aurra's knowledge base and system prompt.
    if (/\b(who are you|what is your name|who created you|who developed you|who made you|who built you|battery|display|motor|caster|speaker|spec sheet|specifications|hello|hi|hey)\b/i.test(q)) {
      return false;
    }

    // Exclude RoboMiracle company details, sales, staff, location
    if (/\b(robomiracle|sales|manager|founder|ceo|contact|address|phone|email|rs puram|coimbatore|team)\b/i.test(q)) {
      return false;
    }

    // Exclude Indian political leadership and state Chief Ministers (strictly governed by designated system prompt)
    if (/\b(chief minister|prime minister|president|governor|modi|stalin|vijay|tamil nadu|tamilnadu|andhra|karnataka|kerala|maharashtra|uttar pradesh|delhi|bengal|bihar|gujarat)\b/i.test(q)) {
      return false;
    }

    // Exclude facility rooms, tour, kiosk features
    if (/\b(facility|campus|room|hall|tour|guide|form|admission|cockpit|settings)\b/i.test(q)) {
      return false;
    }

    return /\b(who is|what is|current|capital|where is|today|latest|news|leader|score|match|winner|stock|price|she|he|did|do|does|was)\b/i.test(q);
  }

  /**
   * Fetches real-time weather information (Open-Meteo for Coimbatore + Serper for others)
   */
  async fetchLiveWeatherContext(query) {
    const t0 = performance.now();
    const q = query.toLowerCase();

    // Check if another city is explicitly requested
    const externalCityMatch = q.match(/\b(in|at|for)\s+([a-zA-Z\s]+)/i);
    let targetCity = 'Coimbatore';
    if (externalCityMatch && externalCityMatch[2]) {
      const extracted = externalCityMatch[2].replace(/\b(today|now|tomorrow|weather|temperature)\b/gi, '').trim();
      if (extracted.length > 2 && !extracted.toLowerCase().includes('coimbatore')) {
        targetCity = extracted;
      }
    }

    // 1. If Coimbatore (default), use ultra-fast zero-key Open-Meteo API
    if (targetCity.toLowerCase() === 'coimbatore') {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=11.0168&longitude=76.9558&current_weather=true';
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json();
          const cw = data.current_weather;
          if (cw) {
            const condition = WMO_WEATHER_MAP[cw.weathercode] || 'Clear';
            const tempC = Math.round(cw.temperature * 10) / 10;
            const wind = cw.windspeed;
            const latencyMs = Math.round(performance.now() - t0);

            const context = `[Live Real-Time Weather in Coimbatore, Tamil Nadu]: Current temperature is ${tempC}°C (${condition}), wind speed is ${wind} km/h.`;
            return {
              context,
              source: 'open-meteo',
              latencyMs,
              summary: `${tempC}°C, ${condition}`,
            };
          }
        }
      } catch (err) {
        logger.warn('RAG', `Open-Meteo failed: ${err.message}. Trying Serper fallback.`);
      }
    }

    // 2. Query Serper for external city weather (or fallback)
    const serperQuery = `current weather in ${targetCity} today`;
    const serperResult = await this.fetchGoogleSerperContext(serperQuery);
    if (serperResult) {
      return {
        context: serperResult.context,
        source: 'google-serper',
        latencyMs: Math.round(performance.now() - t0),
        summary: `Google Weather for ${targetCity}`,
      };
    }

    return null;
  }

  /**
   * Fetches live search snippets from Serper.dev Google Search API
   */
  async fetchGoogleSerperContext(query, conversationHistory = []) {
    if (!this.config.enabled || !this.config.apiKey) return null;
    const t0 = performance.now();
    const cleanQuery = query.trim();

    // Resolve pronouns using previous turn if needed
    let searchQuery = cleanQuery;
    if (/\b(she|he|her|his|they|them|it|that|this|do|did|does|was)\b/i.test(cleanQuery) && conversationHistory.length > 0) {
      const lastTurn = conversationHistory[conversationHistory.length - 1];
      if (lastTurn?.text || lastTurn?.content) {
        const ref = (lastTurn.text || lastTurn.content).slice(0, 50);
        searchQuery = `${ref} ${cleanQuery}`;
      }
    }

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.config.apiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: searchQuery }),
        signal: controller.signal,
      });

      clearTimeout(tid);

      if (res.ok) {
        const data = await res.json();
        const snippets = [];

        // 1. Google Answer Box / Direct Knowledge
        if (data.answerBox) {
          const ab = data.answerBox;
          const abText = ab.answer || ab.snippet || ab.title;
          if (abText) snippets.push(`Direct Answer: ${abText}`);
        }

        // 2. Knowledge Graph
        if (data.knowledgeGraph) {
          const kg = data.knowledgeGraph;
          if (kg.title && kg.description) {
            snippets.push(`${kg.title} (${kg.type || ''}): ${kg.description}`);
          }
        }

        // 3. Top Organic Snippets (up to 3)
        if (Array.isArray(data.organic) && data.organic.length > 0) {
          data.organic.slice(0, 3).forEach((item) => {
            if (item.snippet) {
              snippets.push(`${item.title}: ${item.snippet}`);
            }
          });
        }

        if (snippets.length > 0) {
          const latencyMs = Math.round(performance.now() - t0);
          logger.info('RAG', `Serper retrieved ${snippets.length} snippets in ${latencyMs}ms for "${searchQuery}"`);
          return {
            context: `[Live Real-Time Google Search Ground Truth]:\n${snippets.join('\n')}`,
            source: 'google-serper',
            latencyMs,
            snippetsCount: snippets.length,
          };
        }
      }
    } catch (err) {
      logger.warn('RAG', `Serper API error: ${err.message}`);
    }

    return null;
  }

  /**
   * Free fallbacks: DuckDuckGo + Wikipedia REST API
   */
  async fetchFreeWebContext(query) {
    const t0 = performance.now();
    const cleanQuery = query.trim();

    // 1. DuckDuckGo Instant Answer
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 800);
      const res = await fetch(ddgUrl, { signal: controller.signal });
      clearTimeout(tid);

      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText && data.AbstractText.trim().length > 15) {
          return {
            context: `[Live Web Context (DuckDuckGo)]: ${data.AbstractText.trim()}`,
            source: 'duckduckgo',
            latencyMs: Math.round(performance.now() - t0),
          };
        }
      }
    } catch {}

    // 2. Wikipedia REST API
    try {
      const wikiTopic = cleanQuery
        .replace(/\b(who is|what is|where is|tell me about|current|today|latest|the|a|an)\b/gi, '')
        .trim();
      if (wikiTopic.length > 2) {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTopic)}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 800);
        const wikiRes = await fetch(wikiUrl, { signal: controller.signal });
        clearTimeout(tid);

        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.extract && wikiData.extract.trim().length > 15) {
            return {
              context: `[Live Web Context (Wikipedia)]: ${wikiData.extract.trim()}`,
              source: 'wikipedia',
              latencyMs: Math.round(performance.now() - t0),
            };
          }
        }
      }
    } catch {}

    return null;
  }

  /**
   * Master Context Orchestrator:
   * Evaluates query type (Weather vs Fact Search) and retrieves best real-time context.
   * Hard bounded to 1.2s max so LLM inference never stalls.
   */
  async fetchLiveContext(query, conversationHistory = []) {
    if (!this.config.enabled) return null;
    if (!this.isWeatherQuery(query) && !this.isRealTimeFactQuery(query)) return null;

    try {
      const searchPromise = (async () => {
        // 1. Weather Query
        if (this.isWeatherQuery(query)) {
          const weather = await this.fetchLiveWeatherContext(query);
          if (weather) return weather;
        }

        // 2. Real-Time Fact Query
        if (this.isRealTimeFactQuery(query)) {
          const serper = await this.fetchGoogleSerperContext(query, conversationHistory);
          if (serper) return serper;

          const free = await this.fetchFreeWebContext(query);
          if (free) return free;
        }
        return null;
      })();

      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1200));
      return await Promise.race([searchPromise, timeoutPromise]);
    } catch {
      return null;
    }
  }
}

export const ragSearchService = new RagSearchService();
