import * as faceapi from 'face-api.js';
import { getModelBaseUrl } from './platform';

let loaded = false;
let loadingPromise = null;

export const loadFaceApiModels = async () => {
  if (loaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const MODEL_URL = getModelBaseUrl();
      // First load fast mobile models (tinyFaceDetector + landmark + recognition)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      // Load ssdMobilenetv1 in background without blocking initial detection
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).catch((err) => {
        console.warn('SSD MobileNet V1 background load notice:', err.message);
      });

      loaded = true;
      loadingPromise = null;
      console.log('Face API models (Tiny Face + Landmark + Recognition) loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading Face API models:', error);
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
};

export const isFaceApiLoaded = () => loaded;

export const detectFacesInVideo = async (videoElement, detectorType = 'tinyFace', options = {}) => {
  if (!loaded || !videoElement) return [];
  const { withDescriptors = false, inputSize = 224, scoreThreshold = 0.5 } = options;
  const detectorOptions = detectorType === 'tinyFace'
    ? new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
    : new faceapi.SsdMobilenetv1Options({ minConfidence: scoreThreshold });

  try {
    if (withDescriptors) {
      // First quick presence check to avoid heavy 68-landmark/descriptor passes when no one is in frame
      const basic = await faceapi.detectAllFaces(videoElement, detectorOptions);
      if (!basic || basic.length === 0) return [];

      const detections = await faceapi
        .detectAllFaces(videoElement, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();
      return detections || [];
    } else {
      const basic = await faceapi.detectAllFaces(videoElement, detectorOptions);
      return basic || [];
    }
  } catch (err) {
    try {
      const basic = await faceapi.detectAllFaces(videoElement, detectorOptions);
      return basic || [];
    } catch (e) {
      return [];
    }
  }
};
