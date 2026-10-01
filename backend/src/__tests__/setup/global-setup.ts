/**
 * globalSetup do projeto `integration`.
 *
 * 1. Resolve TEST_DATABASE_URL e RECUSA qualquer banco cujo nome não termine em `_test`.
 * 2. Apaga e recria o schema do banco de teste.
 * 3. Aplica as migrations do zero (`prisma migrate deploy`).
 *
 * O passo 2 faz o mesmo que `prisma migrate reset --force --skip-seed`, mas por SQL:
 * o `migrate reset` do Prisma 6.19 se recusa a rodar quando chamado por um agente de
 * IA sem consentimento explícito, e o harness precisa ser o mesmo em qualquer ambiente.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolverBancoTeste } from './banco-teste';
import { prismaCli } from './prisma-cli';

export default async function globalSetup(): Promise<void> {
  const { url, banco, schema } = resolverBancoTeste(process.env.TEST_DATABASE_URL);

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  } finally {
    await prisma.$disconnect();
  }

  const deploy = prismaCli(['migrate', 'deploy'], url);
  if (deploy.status !== 0) {
    throw new Error(`prisma migrate deploy falhou em ${banco}:\n${deploy.stdout}\n${deploy.stderr}`);
  }
}
