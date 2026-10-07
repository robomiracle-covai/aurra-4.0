import { assetUrl } from './platform';

/** Public folder asset path (works in browser dev and Android APK) */
export const pub = (path) => assetUrl(encodeURI(String(path).replace(/^\//, '')));

/** Aurra brand logo */
export const AURRA_LOGO = pub('aurra/AURRA LOGO.png');
