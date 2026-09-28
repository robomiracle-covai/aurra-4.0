/** Detect Android WebView / APK runtime */
export const isAndroidApp = () => {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  return (
    protocol === 'file:' ||
    hostname === 'appassets.androidplatform.net' ||
    /\bwv\b/i.test(navigator.userAgent)
  );
};

/** Resolve public asset path for browser and APK */
export const assetUrl = (path = '') => {
  if (!path) return '';
  const clean = String(path).replace(/^\//, '');
  if (typeof window !== 'undefined' && (
    window.location.protocol === 'file:' ||
    window.location.hostname === 'appassets.androidplatform.net'
  )) {
    return `./${clean}`;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/${clean}`;
};

export const getModelBaseUrl = () => assetUrl('models');
