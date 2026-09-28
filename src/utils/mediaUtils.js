import { assetUrl, isAndroidApp } from './platform';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (file instanceof Blob || file instanceof File) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      resolve(String(file || ''));
    }
  });

export const createMediaObjectUrl = (blobOrFile) => {
  if (!blobOrFile) return '';
  if (blobOrFile instanceof Blob || blobOrFile instanceof File) {
    return URL.createObjectURL(blobOrFile);
  }
  if (typeof blobOrFile === 'string') {
    return resolveMediaSrc(blobOrFile);
  }
  return '';
};

export const revokeMediaObjectUrl = (url) => {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // Ignored if already revoked
    }
  }
};

export const resolveMediaSrc = (src) => {
  if (!src) return '';
  if (src instanceof Blob || src instanceof File) {
    return URL.createObjectURL(src);
  }
  if (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  ) {
    return src;
  }
  if (src.startsWith('/')) {
    return isAndroidApp() || import.meta.env.BASE_URL === './'
      ? assetUrl(src.slice(1))
      : src;
  }
  if (!API_BASE_URL) return assetUrl(src);
  return `${API_BASE_URL}/uploads/${src}`;
};
