import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const androidAssetsDir = path.resolve(__dirname, './android/app/src/main/assets/web_assets');

/** Android WebView fixes: strip crossorigin and external fonts after Vite injects script tags */
function androidWebViewPlugin() {
  return {
    name: 'android-webview-fix',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/ crossorigin/g, '')
          .replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/gi, '')
          .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, '')
          .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>\s*/gi, '')
          .replace(
            /<div id="root"><\/div>/,
            '<div id="root"><p style="color:#0ff;text-align:center;padding-top:40vh;font-family:sans-serif">Loading Testing App...</p></div>'
          );
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === 'android' ? './' : '/',
  plugins: [
    react(),
    ...(mode === 'android' ? [androidWebViewPlugin()] : []),
  ],
  build: {
    outDir: mode === 'android' ? androidAssetsDir : 'dist',
    emptyOutDir: mode === 'android',
    cssCodeSplit: mode !== 'android',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5174,
    host: true,
    watch: {
      ignored: ['**/android/**', '**/dist/**'],
    },
  },
}));
