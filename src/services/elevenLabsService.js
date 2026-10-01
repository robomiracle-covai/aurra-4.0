/**
 * ElevenLabs High-Fidelity Neural Speech Synthesis Service
 * - Connects directly to ElevenLabs REST API
 * - Optimized with eleven_turbo_v2_5 for ultra-low latency (< 400ms)
 * - Supports custom voice IDs (Indian English, American, British, Tamil, Hindi)
 * - Safe fallback to local Web Speech API on quota exhaustion or network failure
 */

const STORAGE_KEY = 'aurra_elevenlabs_config_v1';

// Default ElevenLabs Popular Voices:
// 21m00Tcm4TlvDq8ikWAM -> Rachel (Calm, Professional Female)
// EXAVITQu4vr4xnSDxMaL -> Bella (Expressive Female)
// AZnzlk1XvdvUeBnXmlld -> Domi (Friendly Receptionist)
// pMsXgVXv3BLzUgSXRplE -> Serena (Pleasant Female)
export const DEFAULT_ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Professional Receptionist - Female)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Warm & Expressive - Female)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Friendly & Energetic - Female)' },
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena (Calm & Soft - Female)' },
  { id: 'custom', name: 'Custom Voice ID (Paste your own)' },
];

export const getDefaultElevenLabsConfig = () => ({
  enabled: false,
  apiKey: '',
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  customVoiceId: '',
  modelId: 'eleven_turbo_v2_5', // Low latency turbo model
  stability: 0.5,
  similarityBoost: 0.75,
  useFallbackOnFailure: true,
});

class ElevenLabsService {
  constructor() {
    this.config = this.loadConfig();
    this.currentAudio = null;
    this.isPlaying = false;
  }

  loadConfig() {
    const defaults = getDefaultElevenLabsConfig();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[ELEVENLABS] Error loading config:', e);
    }
    return defaults;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('[ELEVENLABS] Error saving config:', e);
    }
    return this.config;
  }

  getConfig() {
    return { ...this.config };
  }

  isConfigured() {
    const key = (this.config.apiKey || '').trim();
    const voice = this.getActiveVoiceId();
    return Boolean(key && voice);
  }

  getActiveVoiceId() {
    if (this.config.voiceId === 'custom' && this.config.customVoiceId?.trim()) {
      return this.config.customVoiceId.trim();
    }
    return this.config.voiceId || '21m00Tcm4TlvDq8ikWAM';
  }

  cancel() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  /**
   * Synthesize and play audio stream from ElevenLabs
   * @param {string} text Text to speak
   * @param {object} callbacks { onStart, onEnd, onError }
   * @returns {Promise<{ success: boolean, latencyMs: number, error?: string }>}
   */
  async speak(text, callbacks = {}) {
    const cleanText = (text || '').trim();
    if (!cleanText) return { success: false, error: 'Empty text' };

    const apiKey = (this.config.apiKey || '').trim();
    if (!apiKey) {
      return { success: false, error: 'No ElevenLabs API key provided' };
    }

    const voiceId = this.getActiveVoiceId();
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    this.cancel();
    const startTime = performance.now();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: this.config.modelId || 'eleven_turbo_v2_5',
          voice_settings: {
            stability: this.config.stability ?? 0.5,
            similarity_boost: this.config.similarityBoost ?? 0.75,
          },
        }),
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.detail?.message || errData.message || JSON.stringify(errData);
        } catch {
          errMessage = await response.text();
        }
        throw new Error(errMessage);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      const networkLatencyMs = Math.round(performance.now() - startTime);

      return new Promise((resolve) => {
        audio.onplay = () => {
          this.isPlaying = true;
          callbacks.onStart?.();
        };

        audio.onended = () => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          callbacks.onEnd?.();
          resolve({ success: true, latencyMs: networkLatencyMs });
        };

        audio.onerror = (e) => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          callbacks.onError?.(e);
          resolve({ success: false, latencyMs: networkLatencyMs, error: 'Audio playback failed' });
        };

        audio.play().catch((playErr) => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          callbacks.onError?.(playErr);
          resolve({ success: false, latencyMs: networkLatencyMs, error: playErr.message });
        });
      });
    } catch (err) {
      this.isPlaying = false;
      const latencyMs = Math.round(performance.now() - startTime);
      callbacks.onError?.(err);
      return { success: false, latencyMs, error: err.message };
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
