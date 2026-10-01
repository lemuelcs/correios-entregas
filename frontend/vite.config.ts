import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001';
const whatsappApiTarget = process.env.VITE_WHATSAPP_API_TARGET || 'http://localhost';
const whatsappGatewayPrefix = process.env.VITE_WHATSAPP_API_GATEWAY_PREFIX || '/services/whatsapp';
// Testes de interface (Playwright): sem HMR pelo domínio público de dev.
const e2e = process.env.VITE_E2E === '1';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    hmr: e2e ? false : {
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
