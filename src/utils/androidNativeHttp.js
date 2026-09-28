/**
 * Android Native HTTP Bridge
 * 
 * Bypasses WebView fetch, CORS, and mixed-content restrictions by using 
 * Android's native HttpURLConnection (via window.AndroidLauncher.httpRequest).
 * Essential for communicating with ESP32 SoftAP (192.168.4.1) and Raspberry Pi on local LAN.
 */

export const hasNativeHttp = () => {
  return (
    typeof window !== 'undefined' &&
    typeof window.AndroidLauncher?.httpRequest === 'function'
  );
};

export const nativeHttpRequest = (method, url, body = '') => {
  if (!hasNativeHttp()) return null;
  try {
    const raw = window.AndroidLauncher.httpRequest(method, url, body || '');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[NativeHttp] Error executing native request:', err);
    return null;
  }
};

export const nativeHttpGet = (url) => nativeHttpRequest('GET', url);
export const nativeHttpPost = (url, body) => nativeHttpRequest('POST', url, body);
