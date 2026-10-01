import { defineConfig } from 'vitest/config';
import path from 'path';

// Config só dos testes: sem Tailwind nem PWA. O JSX é transformado pelo próprio
// Vite (runtime automático do tsconfig), então o plugin do React não é preciso.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // O VPS é compartilhado: um processo, um arquivo por vez.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
  },
});
