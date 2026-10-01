import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001';
const whatsappApiTarget = process.env.VITE_WHATSAPP_API_TARGET || 'http://localhost';
const whatsappGatewayPrefix = process.env.VITE_WHATSAPP_API_GATEWAY_PREFIX || '/services/whatsapp';
// Testes E2E (Playwright), `VITE_E2E=1`:
// - build da captura (ADR-013): liga o `?e2eImage=` da câmera e publica as fixtures de
//   rótulo em /e2e-fixtures/ (precacheadas, para fotografar sem sinal);
// - dev server da área Entregas (task_07): sem HMR pelo domínio público de dev.
const modoE2E = process.env.VITE_E2E === '1';
const DIR_FIXTURES_ROTULOS = path.resolve(__dirname, '../backend/src/__tests__/fixtures/rotulos');

function fixturesDeRotulo(): Plugin {
  return {
    name: 'captura-e2e-fixtures',
    apply: 'build',
    generateBundle() {
      for (const arquivo of fs.readdirSync(DIR_FIXTURES_ROTULOS).filter((f) => f.endsWith('.jpg'))) {
        this.emitFile({
          type: 'asset',
          fileName: `e2e-fixtures/${arquivo}`,
          source: fs.readFileSync(path.join(DIR_FIXTURES_ROTULOS, arquivo)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(modoE2E ? [fixturesDeRotulo()] : []),
    // App do carteiro instalável (ADR-004): o manifest é o public/manifest.json
    // (start_url /carteiro/captura, scope /carteiro/); o service worker precacheia
    // o shell e o WASM do zxing para a captura abrir e ler códigos sem rede.
    VitePWA({
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      scope: '/carteiro/',
      workbox: {
        globPatterns: modoE2E ? ['**/*.{js,css,html,wasm,png,svg,json,jpg}'] : ['**/*.{js,css,html,wasm,png,svg,json}'],
        globIgnores: ['whatsapp-console-element.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/carteiro\//],
        navigateFallbackDenylist: [/^\/api\//, /^\/events/],
        cleanupOutdatedCaches: true,
        // O service worker novo assume a aba aberta já na 1ª visita: sem isso, quem entra
        // e perde o sinal na mesma sessão não reabre o app offline (ADR-003).
        clientsClaim: true,
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
    hmr: modoE2E ? false : {
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
