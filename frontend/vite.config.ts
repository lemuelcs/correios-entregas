import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001';
const whatsappApiTarget = process.env.VITE_WHATSAPP_API_TARGET || 'http://localhost';
const whatsappGatewayPrefix = process.env.VITE_WHATSAPP_API_GATEWAY_PREFIX || '/services/whatsapp';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    host: true,
    watch: {
      usePolling: true,
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
