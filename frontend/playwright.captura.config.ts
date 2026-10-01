/**
 * E2E das telas da captura (Playwright, ADR-013): o frontend no `vite preview` do build de
 * teste (`npm run build:e2e`, com `?e2eImage=`) e o backend da captura com o
 * extrator falso, o ViaCEP falso e o banco `_test` de TEST_DATABASE_URL.
 *
 *   npm run test:e2e:captura --workspace frontend
 *
 * Portas: E2E_API_PORT (3192) e E2E_WEB_PORT (4192); só em 127.0.0.1.
 */
import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT || 3192);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4192);
export const API_URL = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: './e2e-captura',
  // O VPS e a CI são compartilhados: uma jornada por vez, cada uma com o banco recriado.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-captura' }]] : [['list']],
  outputDir: 'test-results-captura',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx src/__tests__/e2e-captura/servidor-e2e.ts',
      cwd: '../backend',
      url: `${API_URL}/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
    },
    {
      command: `npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}/login`,
      env: { VITE_API_TARGET: API_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
