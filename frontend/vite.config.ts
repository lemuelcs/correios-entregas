import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001';
const whatsappApiTarget = process.env.VITE_WHATSAPP_API_TARGET || 'http://localhost';
const whatsappGatewayPrefix = process.env.VITE_WHATSAPP_API_GATEWAY_PREFIX || '/services/whatsapp';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // App do carteiro instalável (ADR-004): o manifest é o public/manifest.json
    // (start_url /carteiro/captura, scope /carteiro/); o service worker precacheia
    // o shell e o WASM do zxing para a captura abrir e ler códigos sem rede.
    VitePWA({
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      scope: '/carteiro/',
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,json}'],
        globIgnores: ['whatsapp-console-element.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/carteiro\//],
        navigateFallbackDenylist: [/^\/api\//, /^\/events/],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,
    allowedHosts: ['.delivyodev.com', 'correios.delivyodev.com', '.correiosdev.com'],
    hmr: {
      protocol: 'wss',
      host: 'correios.delivyodev.com',
      clientPort: 443,
    },
    watch: {
      usePolling: true,
      interval: 3000,
      binaryInterval: 5000,
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
    proxy: {
      '/api/v1/comunicacao': {
        target: whatsappApiTarget,
        changeOrigin: true,
        rewrite: (path) => `${whatsappGatewayPrefix}${path}`,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/events': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
