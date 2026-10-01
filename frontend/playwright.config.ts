/**
 * Testes de interface da área Entregas (task_07, _tests.md E2E-005..E2E-015).
 *
 * Sobe dois processos:
 * - o backend em modo de teste (`backend/src/__tests__/e2e-ui/servidor-e2e.ts`):
 *   API real + Prosio falso + servidor de controle, contra TEST_DATABASE_URL
 *   (nome terminado em `_test`; o schema é recriado a cada execução);
 * - o Vite do frontend, com o proxy `/api` apontando para esse backend.
 *
 * Exemplo:
 *   TEST_DATABASE_URL=postgresql://u:s@127.0.0.1:5432/correiosentregas_test \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379/2 npx playwright test
 */
import { defineConfig, devices } from '@playwright/test';

const PORTA_API = process.env.E2E_API_PORTA ?? '3712';
const PORTA_PROSIO = process.env.E2E_PROSIO_PORTA ?? '3713';
const PORTA_CONTROLE = process.env.E2E_CONTROLE_PORTA ?? '3714';
const PORTA_WEB = process.env.E2E_WEB_PORTA ?? '5712';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Defina TEST_DATABASE_URL (banco dedicado terminado em _test) para rodar os testes de interface.');
}

process.env.E2E_CONTROLE_URL = `http://127.0.0.1:${PORTA_CONTROLE}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORTA_WEB}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'npx tsx src/__tests__/e2e-ui/servidor-e2e.ts',
      cwd: '../backend',
      url: `http://127.0.0.1:${PORTA_CONTROLE}/saude`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
        TEST_REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/2',
        E2E_API_PORTA: PORTA_API,
        E2E_PROSIO_PORTA: PORTA_PROSIO,
        E2E_CONTROLE_PORTA: PORTA_CONTROLE,
        FRONTEND_URL: `http://127.0.0.1:${PORTA_WEB}`,
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${PORTA_WEB} --strictPort`,
      url: `http://127.0.0.1:${PORTA_WEB}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_E2E: '1',
        VITE_API_TARGET: `http://127.0.0.1:${PORTA_API}`,
        // O hub de WhatsApp das telas antigas não existe nos testes: porta fechada, nada externo.
        VITE_WHATSAPP_API_TARGET: 'http://127.0.0.1:9',
      },
    },
  ],
});
