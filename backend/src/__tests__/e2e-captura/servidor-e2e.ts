/**
 * Backend das jornadas E2E da captura (Playwright, ADR-013). Uso:
 *
 *   TEST_DATABASE_URL=… [TEST_REDIS_URL=…] E2E_API_PORT=3192 npx tsx src/__tests__/e2e-captura/servidor-e2e.ts
 *
 * 1. Recusa banco que não termine em `_test`, recria o schema e aplica as migrations
 *    (o mesmo globalSetup dos testes de integração).
 * 2. Sobe um ViaCEP falso em memória e aponta `VIACEP_URL` para ele.
 * 3. Sobe o app Express com `CAPTURA_AI_PROVIDER=fake` (o extrator responde pelas
 *    fixtures de rótulo), fotos num diretório temporário e SEM os workers BullMQ.
 * 4. `POST /__e2e/semente` limpa o banco e cria o cenário da captura (C1 no D-03).
 *
 * Escuta só em 127.0.0.1. Não é usado fora dos testes.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { resolverBancoTeste } from '../setup/banco-teste';

/** Os CEPs das fixtures de rótulo, como o ViaCEP responde (73800000: CEP único, sem rua). */
const CEPS: Record<string, Record<string, string>> = {
  '72115040': { cep: '72115-040', logradouro: 'QNC 4', bairro: 'Taguatinga Norte (Taguatinga)', localidade: 'Brasília', uf: 'DF' },
  '71919360': { cep: '71919-360', logradouro: 'Rua 25 Norte', bairro: 'Norte (Águas Claras)', localidade: 'Brasília', uf: 'DF' },
  '73800000': { cep: '73800-000', logradouro: '', bairro: '', localidade: 'Formosa', uf: 'GO' },
};

function viaCepFalso(): Promise<http.Server> {
  const servidor = http.createServer((req, res) => {
    const cep = /^\/ws\/(\d{8})\/json\/?$/.exec(req.url ?? '')?.[1];
    res.setHeader('content-type', 'application/json');
    if (!cep) {
      res.statusCode = 400;
      res.end('{"erro":true}');
      return;
    }
    res.end(JSON.stringify(CEPS[cep] ?? { erro: true }));
  });
  return new Promise((resolve) => servidor.listen(0, '127.0.0.1', () => resolve(servidor)));
}

async function main() {
  const { url } = resolverBancoTeste(process.env.TEST_DATABASE_URL);
  const porta = Number(process.env.E2E_API_PORT || 3192);
  const fotos = fs.mkdtempSync(path.join(os.tmpdir(), 'captura-e2e-fotos-'));
  const cep = await viaCepFalso();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = url;
  if (process.env.TEST_REDIS_URL) process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  process.env.CAPTURA_AI_PROVIDER = 'fake';
  process.env.VIACEP_URL = `http://127.0.0.1:${(cep.address() as AddressInfo).port}/ws`;
  process.env.FOTOS_DIR = fotos;
  delete process.env.CORREIOS_CWS_USERNAME;
  process.env.JWT_SECRET ??= 'segredo-jwt-dos-testes-com-32-caracteres';
  process.env.JWT_REFRESH_SECRET ??= 'segredo-refresh-dos-testes-com-32-chars';
  process.env.ENTREGAS_CRYPTO_KEY ??= 'chave-de-cifra-dos-testes-com-32-bytes!!';

  const { default: prepararBanco } = await import('../setup/global-setup');
  await prepararBanco();

  // Só depois do ambiente pronto: o singleton do Prisma lê DATABASE_URL na importação.
  const express = (await import('express')).default;
  const { app } = await import('../../app');
  const { semearCaptura, limparCacheCep } = await import('./semente-captura');

  const raiz = express();
  raiz.post('/__e2e/semente', express.json(), async (req, res) => {
    try {
      await limparCacheCep(Object.keys(CEPS));
      res.json(await semearCaptura({ senhaTemporaria: req.body?.senhaTemporaria === true }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  raiz.use(app);

  const servidor = raiz.listen(porta, '127.0.0.1', () => {
    console.log(`✓ backend E2E da captura em http://127.0.0.1:${porta}`);
  });

  const encerrar = () => {
    servidor.close();
    cep.close();
    fs.rmSync(fotos, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

main().catch((err) => {
  console.error('Falha ao subir o backend E2E:', err);
  process.exit(1);
});
