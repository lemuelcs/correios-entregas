import { Prisma, PrismaClient } from '@prisma/client';
import { resolverBancoTeste, urlComSchema } from './setup/banco-teste';
import { prismaCli } from './setup/prisma-cli';
import {
  codigoS10,
  criarCenarioDistrito,
  limparBanco,
} from './fixtures/entregas';
import { tokenPara } from './helpers/login';
import { encerrarRecursos } from './helpers/recursos';
import jwt from 'jsonwebtoken';

const { url } = resolverBancoTeste(process.env.TEST_DATABASE_URL);

describe('migrations', () => {
  // Schema vazio e exclusivo deste teste, no mesmo banco _test.
  const schema = `it052_${process.pid}`;
  const urlVazia = urlComSchema(url, schema);
  const admin = new PrismaClient({ datasourceUrl: url });

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  });

  it('IT-052 migrate deploy num banco vazio cria todas as tabelas e migrate status fica limpo', async () => {
    const deploy = prismaCli(['migrate', 'deploy'], urlVazia);
    expect(deploy.stderr + deploy.stdout).toContain('0000_baseline');
    expect(deploy.status).toBe(0);

    const tabelas = await admin.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema}`;
    const criadas = new Set(tabelas.map((t) => t.table_name));
    const esperadas = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);

    for (const tabela of ['pacotes_dia', 'orientacoes', ...esperadas]) {
      expect(criadas.has(tabela)).toBe(true);
    }

    const status = prismaCli(['migrate', 'status'], urlVazia);
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('Database schema is up to date');

    // Sem drift: o banco migrado é exatamente o schema.prisma.
    const diff = prismaCli(
      ['migrate', 'diff', '--from-url', urlVazia, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'],
      urlVazia,
    );
    expect(diff.status).toBe(0);
  }, 180_000);
});

describe('harness de integração', () => {
  beforeAll(limparBanco);
  afterAll(async () => {
    await limparBanco();
    await encerrarRecursos();
  });

  it('as fábricas montam o grafo do distrito e o login emite token do supervisor', async () => {
    const c = await criarCenarioDistrito({ pacotes: 2 });

    expect(c.unidade.canalProsioId).toBe(c.canal.canal.id);
    expect(c.carteiro.usuarioId).toBeNull();
    expect(c.distrito.carteiroPadraoId).toBe(c.carteiro.id);
    expect(c.pacotes).toHaveLength(2);
    expect(c.pacotes[0].data.toISOString()).toBe(c.carga.data.toISOString());
    expect(codigoS10(10000002)).toBe('AA100000025BR');

    const payload = jwt.verify(tokenPara(c.supervisor), process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(payload).toEqual(expect.objectContaining({ sub: c.supervisor.id, role: 'UNIDADE', unidadeId: c.unidade.id }));
  });

  it('limparBanco esvazia as tabelas sem tocar no histórico de migrations', async () => {
    await limparBanco();
    const { prisma } = await import('../shared/utils/prisma');
    expect(await prisma.pacoteDia.count()).toBe(0);
    expect(await prisma.unidade.count()).toBe(0);
    const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "_prisma_migrations"`;
    expect(Number(n)).toBeGreaterThanOrEqual(2);
  });
});
