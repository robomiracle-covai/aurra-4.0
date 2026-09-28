/** Safe Web Speech API helpers with Android native TTS fallback. */

import { VOICE_PRESETS } from '../config/config';
import { isAndroidApp } from './platform';
import { startSpeakingAnimatronics, stopSpeakingAnimatronics } from './speakingGestures';

export const getAndroidLauncher = () => {
  if (typeof window === 'undefined') return null;
  return window.AndroidLauncher || null;
};

const canUseNativeTts = (launcher) => !!launcher;

export const isNativeTtsAvailable = () => canUseNativeTts(getAndroidLauncher());

export const getSpeechSynthesis = () => {
  try {
    const synth = window.speechSynthesis;
    if (synth && typeof synth.getVoices === 'function') return synth;
  } catch {
    /* WebView may throw when accessing speech APIs */
  }
  return null;
};

export const getSpeechVoices = () => {
  const synth = getSpeechSynthesis();
  if (!synth) return [];
  try {
    return synth.getVoices() || [];
  } catch {
    return [];
  }
};

export const waitForSpeechVoices = (timeoutMs = 2500) =>
  new Promise((resolve) => {
    const synth = getSpeechSynthesis();
    if (!synth) {
      resolve([]);
      return;
    }

    const existing = synth.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.onvoiceschanged = null;
      resolve(synth.getVoices() || []);
    };

    synth.onvoiceschanged = finish;
    setTimeout(finish, timeoutMs);
  });

const FEMALE_VOICE_HINTS = [
  'female', 'zira', 'samantha', 'victoria', 'susan', 'karen', 'moira', 'tessa',
  'hazel', 'linda', 'heera', 'priya', 'salli', 'joanna', 'ivy', 'kimberly',
];

export const isFemaleVoiceName = (name = '') => {
  const lower = String(name).toLowerCase();
  return FEMALE_VOICE_HINTS.some((hint) => lower.includes(hint));
};

const INDIAN_VOICE_HINTS = [
  '-in-', 'en-in', 'hi-in', 'ta-in', 'te-in', 'kn-in', 'ml-in', 'bn-in', 'gu-in', 'mr-in', 'pa-in',
  'india', 'indian', 'hindi', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'gujarati', 'marathi', 'punjabi',
];

const isGoogleIndiaFemaleCode = (name = '') => {
  const lower = String(name).toLowerCase();
  if (!lower.includes('-in-') && !lower.includes('en-in') && !lower.includes('hi-in')) return false;
  return lower.includes('-end-') || lower.includes('-end,') || lower.includes('-end.');
};

export const isIndianVoiceEntry = (voice) => {
  if (!voice) return false;
  const lang = String(voice.lang || voice.locale || '').toLowerCase();
  const name = String(voice.name || '').toLowerCase();
  if (lang.includes('-in')) return true;
  return INDIAN_VOICE_HINTS.some((hint) => hint.includes('-in') && (name.includes(hint) || lang.includes(hint)));
};

/** Male voices from Indian locales only (en-IN, hi-IN, etc.) */
export const filterIndianMaleVoices = (voices = []) =>
  voices.filter((v) => {
    if (!v || isFemaleVoiceName(v.name)) return false;
    if (!isIndianVoiceEntry(v)) return false;
    if (isGoogleIndiaFemaleCode(v.name)) return false;
    return true;
  });

export const filterMaleVoices = filterIndianMaleVoices;

const pickWebVoice = (voices, gender = 'male', selectedVoiceURI = '') => {
  const maleVoices = filterIndianMaleVoices(voices);
  if (selectedVoiceURI) {
    const matched = maleVoices.find(
      (v) => v.voiceURI === selectedVoiceURI || v.name === selectedVoiceURI
    );
    if (matched) return matched;
  }

  const presets = VOICE_PRESETS.male;

  let selected = null;
  for (const preset of presets) {
    selected = maleVoices.find((v) => v.name.toLowerCase().includes(preset.toLowerCase()));
    if (selected) break;
  }

  if (!selected) {
    selected = maleVoices.find((v) => {
      const name = v.name.toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      return (
        (name.includes('en-in') && name.includes('-ene-')) ||
        (lang.includes('-in') && !name.includes('-end-'))
      );
    });
  }

  return selected || maleVoices.find((v) => (v.lang || '').toLowerCase().includes('-in')) || maleVoices[0] || null;
};

export const cancelSpeech = () => {
  stopSpeakingAnimatronics();
  const launcher = getAndroidLauncher();
  if (launcher) {
    try {
      launcher.stopSpeech();
    } catch {
      /* ignore */
    }
    return;
  }
  const synth = getSpeechSynthesis();
  if (synth) synth.cancel();
};

const speakViaNative = (launcher, text, selectedVoiceURI, onStart, onEnd) => {
  try {
    try {
      launcher.setVoiceGender('male');
    } catch {
      /* host object — ignore */
    }
    if (selectedVoiceURI) {
      try {
        const voiceName = selectedVoiceURI.startsWith('android:')
          ? selectedVoiceURI.slice('android:'.length)
          : selectedVoiceURI;
        if (voiceName && typeof launcher.setSelectedTtsVoice === 'function') {
          launcher.setSelectedTtsVoice(voiceName);
        }
      } catch {
        /* ignore */
      }
    }
    onStart?.();
    startSpeakingAnimatronics();
    launcher.speakWithGender(String(text), 'male');
    const duration = Math.max(1500, String(text).length * 50);
    window.onNativeSpeechEnd = () => {
      window.onNativeSpeechEnd = null;
      stopSpeakingAnimatronics();
      onEnd?.();
    };
    setTimeout(() => {
      if (window.onNativeSpeechEnd) {
        window.onNativeSpeechEnd();
      }
    }, duration);
    return true;
  } catch (err) {
    console.error('Native TTS error:', err);
    stopSpeakingAnimatronics();
    return false;
  }
};

import { kioskConfigService } from '../services/kioskConfigService';

export const speakWithVoice = async (text, options = {}) => {
  const currentCfg = kioskConfigService?.getConfig ? kioskConfigService.getConfig() : null;
  const {
    gender = currentCfg?.voiceGender || 'female',
    selectedVoiceURI = options.voiceURI || '',
    rate = currentCfg?.speechRate || 1,
    pitch = currentCfg?.speechPitch || 1.05,
    onStart,
    onEnd,
    onError,
  } = options;

  if (!text || !String(text).trim()) {
    onEnd?.();
    return false;
  }

  // Cancel any ongoing speech output to prevent audio collision / overlapping voices
  cancelSpeech();

  const handleStart = () => {
    startSpeakingAnimatronics();
    onStart?.();
  };

  const handleEnd = () => {
    stopSpeakingAnimatronics();
    onEnd?.();
  };

  const handleError = (err) => {
    stopSpeakingAnimatronics();
    onError?.(err);
  };

  if (isAndroidApp()) {
    const launcher = getAndroidLauncher();
    if (launcher) {
      const ok = speakViaNative(launcher, text, selectedVoiceURI, handleStart, handleEnd);
      if (ok) return true;
      handleError(new Error('Native TTS failed'));
      return false;
    }
  } else {
    const launcher = getAndroidLauncher();
    if (launcher) {
      const ok = speakViaNative(launcher, text, selectedVoiceURI, handleStart, handleEnd);
      if (ok) return true;
    }
  }

  const synth = getSpeechSynthesis();
  if (!synth) {
    handleError(new Error('Speech not available on this device'));
    return false;
  }

  try {
    const voices = await waitForSpeechVoices();
    const utterance = new SpeechSynthesisUtterance(String(text));
    const selectedVoice = pickWebVoice(voices, 'male', selectedVoiceURI);

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.pitch = pitch ?? 0.85;
    utterance.volume = 1;
    utterance.onstart = handleStart;
    utterance.onend = handleEnd;
    utterance.onerror = handleError;

    try {
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }
      if (synth.paused) synth.resume();
    } catch {
      /* ignore */
    }

    console.log('[Aurra Speech] Speaking text:', text);
    setTimeout(() => {
      try {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      } catch (err) {
        console.error('[Web Speech] Speak invocation error:', err);
        handleError(err);
      }
    }, 40);
    return true;
  } catch (err) {
    console.error('Web speech error:', err);
    handleError(err);
    return false;
  }
};

export const speakText = (text, options = {}) => speakWithVoice(text, options);
