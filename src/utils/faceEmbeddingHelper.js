import { loadFaceApiModels } from './faceApiHelper';
import { fileToDataUrl } from './mediaUtils';

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

export const extractFaceFromFile = async (file) => {
  if (!file) {
    throw new Error('No image provided.');
  }

  const faceapi = await import('face-api.js');
  await loadFaceApiModels();
  const imgUrl = await fileToDataUrl(file);
  const img = await loadImageFromDataUrl(imgUrl);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error(
      'No face detected in the image. Please use a clear, well-lit frontal photo.'
    );
  }

  return {
    faceEmbedding: Array.from(detection.descriptor),
    imgUrl,
  };
};
