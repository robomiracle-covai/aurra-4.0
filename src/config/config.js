import { getModelBaseUrl } from '../utils/platform';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const MODEL_URL = getModelBaseUrl();

export const VOICE_PRESETS = {
  male: [
    'en-in-x-ene-network',
    'en-in-x-ene',
    'en-in',
    'hi-in',
    'India English',
    'Indian English',
    'Hindi India',
    'Google हिन्दी',
  ],
};
