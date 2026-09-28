import { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

const requestVideoStream = async (width, height) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Camera is not available. Please allow camera permissions in your browser.'
    );
  }

  const attempts = [
    {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        facingMode: 'user',
      },
    },
    {
      video: {
        width: { ideal: width },
        height: { ideal: height },
      },
    },
    { video: true },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('Unable to access camera');
};

const attachStreamToVideo = async (videoEl, mediaStream) => {
  if (!videoEl || !mediaStream) return;
  try {
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.autoplay = true;
    if (videoEl.srcObject !== mediaStream) {
      videoEl.srcObject = mediaStream;
    }
    await videoEl.play();
  } catch (err) {
    console.warn('[useCamera] Play camera feed notice:', err);
  }
};

export const useCamera = (options = {}) => {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const startingRef = useRef(false);
  const [error, setError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, streamRef.current);
      }
      return streamRef.current;
    }
    if (startingRef.current) {
      return null;
    }

    startingRef.current = true;
    setError(null);

    try {
      const mediaStream = await requestVideoStream(width, height);
      streamRef.current = mediaStream;
      setIsStreaming(true);
      await attachStreamToVideo(videoRef.current, mediaStream);
      return mediaStream;
    } catch (err) {
      const errorObject = err instanceof Error ? err : new Error(String(err));
      setError(errorObject);
      console.error('Error accessing camera:', errorObject);
      throw errorObject;
    } finally {
      startingRef.current = false;
    }
  }, [width, height]);

  useEffect(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      attachStreamToVideo(videoRef.current, streamRef.current);
    }
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { videoRef, stream: streamRef.current, error, isStreaming, startCamera, stopCamera };
};
