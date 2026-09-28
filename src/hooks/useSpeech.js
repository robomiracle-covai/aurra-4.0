import { useState, useCallback } from 'react';
import { cancelSpeech, speakWithVoice } from '../utils/speechSynthesis';

export const useSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const speak = useCallback(async (text, genderOrOptions = 'male') => {
    setIsPlaying(true);
    const opts =
      typeof genderOrOptions === 'object'
        ? genderOrOptions
        : { gender: genderOrOptions };
    const ok = await speakWithVoice(text, {
      ...opts,
      onStart: () => {
        setIsPlaying(true);
        opts.onStart?.();
      },
      onEnd: () => {
        setIsPlaying(false);
        opts.onEnd?.();
      },
      onError: (err) => {
        setIsPlaying(false);
        opts.onError?.(err);
      },
    });
    if (!ok) {
      setIsPlaying(false);
      opts.onError?.(new Error('Speech playback failed'));
    }
    return ok;
  }, []);

  const stop = useCallback(() => {
    cancelSpeech();
    setIsPlaying(false);
  }, []);

  return { speak, stop, isPlaying };
};
