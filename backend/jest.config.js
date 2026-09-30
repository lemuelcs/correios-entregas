/**
 * Dois projetos:
 * - unit: `*.test.ts` em `__tests__/`, sem banco nem Redis.
 * - integration: `*.int.test.ts` em `__tests__/`, contra o banco dedicado de
 *   TEST_DATABASE_URL (o globalSetup recusa nomes que não terminem em `_test`,
 *   apaga o schema e aplica as migrations do zero). Rodar em série (--runInBand):
 *   os arquivos compartilham o mesmo banco.
 *
 * `npm run test:unit` / `npm run test:integration` (ou `--selectProjects`).
 */
// Só transpila (isolatedModules): a checagem de tipos é do `tsc --noEmit -p backend`,
// que cobre src/ inteiro com strict. Mais rápido e mais leve em memória.
const tsJest = ['ts-jest', { tsconfig: { esModuleInterop: true, isolatedModules: true } }];

const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.ts$': tsJest },
  clearMocks: true,
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['**/__tests__/**/*.int.test.ts'],
      globalSetup: '<rootDir>/src/__tests__/setup/global-setup.ts',
      setupFiles: ['<rootDir>/src/__tests__/setup/env-integracao.ts'],
    },
  ],
  testTimeout: 10_000,
};
