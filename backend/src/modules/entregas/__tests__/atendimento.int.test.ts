/** Sessão de atendimento (login único do Chatwoot via Prosio): IT-048. */
import request from 'supertest';
import { app } from '../../../app';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import { criarCanal, criarGestor, criarSupervisor, criarUnidade, limparBanco } from '../../../__tests__/fixtures/entregas';
import { prisma } from '../../../shared/utils/prisma';

const sessao = (auth: Record<string, string>, body: object = {}) =>
  request(app).post('/api/v1/entregas/atendimento/sessao').set('Connection', 'close').set(auth).send(body);

let prosio: ProsioFake;

beforeAll(async () => {
  prosio = await ProsioFake.iniciar();
});

beforeEach(async () => {
  await limparBanco();
  prosio.redefinir();
});

afterAll(async () => {
  await prosio.parar();
  await encerrarRecursos();
});

describe('IT-048 POST /entregas/atendimento/sessao', () => {
  it('UNIDADE em canal compartilhado → agente com unidadeRef; cada chamada gera uma URL nova', async () => {
    const canal = await criarCanal({ compartilhado: true, baseUrl: prosio.url, apiKey: 'psk_test_atendimento' });
    prosio.apiKey = 'psk_test_atendimento';
    const unidade = await criarUnidade({ canalProsioId: canal.canal.id, prosioUnidadeRef: 'cdd-taguatinga' });
    const sup = await criarSupervisor({ unidadeId: unidade.id });

    const r1 = await sessao(authHeader(sup));
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ url: expect.stringContaining('sso_token='), expiraEm: expect.any(String) });
    const enviada = prosio.sessoes()[0];
    expect(enviada.corpo).toMatchObject({
      unidadeRef: 'cdd-taguatinga',
      usuario: { idExterno: sup.id, nome: sup.nome, email: sup.email, papel: 'agente' },
    });
    expect(enviada.headers.authorization).toBe('Bearer psk_test_atendimento');

    const r2 = await sessao(authHeader(sup));
    expect(r2.status).toBe(200);
    expect(r2.body.url).not.toBe(r1.body.url);
    expect(prosio.sessoes()).toHaveLength(2);
    prosio.apiKey = undefined;
  });

  it('GESTAO → administrador sem unidadeRef; canal exclusivo → agente sem unidadeRef', async () => {
    const canal = await criarCanal({ baseUrl: prosio.url });
    const unidade = await criarUnidade({ canalProsioId: canal.canal.id, prosioUnidadeRef: 'cdd-x' });
    const gestor = await criarGestor();
    expect((await sessao(authHeader(gestor), { unidadeId: unidade.id })).status).toBe(200);
    expect((await sessao(authHeader(gestor))).status).toBe(200); // único canal ativo
    const sup = await criarSupervisor({ unidadeId: unidade.id });
    expect((await sessao(authHeader(sup))).status).toBe(200);

    const [g1, g2, s1] = prosio.sessoes().map((s) => s.corpo);
    expect(g1).toMatchObject({ usuario: { papel: 'administrador' } });
    expect(g1.unidadeRef).toBeUndefined();
    expect(g2).toMatchObject({ usuario: { papel: 'administrador' } });
    expect(s1).toMatchObject({ usuario: { papel: 'agente' } });
    expect(s1.unidadeRef).toBeUndefined();
  });

  describe('ATENDIMENTO_DOMINIO', () => {
    const anterior = process.env.ATENDIMENTO_DOMINIO;
    afterEach(() => {
      if (anterior === undefined) delete process.env.ATENDIMENTO_DOMINIO;
      else process.env.ATENDIMENTO_DOMINIO = anterior;
    });

    async function supervisorComCanal() {
      const canal = await criarCanal({ baseUrl: prosio.url });
      const unidade = await criarUnidade({ canalProsioId: canal.canal.id });
      return criarSupervisor({ unidadeId: unidade.id });
    }

    it('definida → o pedido ao Prosio leva `dominio`', async () => {
      process.env.ATENDIMENTO_DOMINIO = 'correiosdev.com';
      const sup = await supervisorComCanal();
      expect((await sessao(authHeader(sup))).status).toBe(200);
      expect(prosio.sessoes()).toHaveLength(1);
      expect(prosio.sessoes()[0].corpo).toMatchObject({ dominio: 'correiosdev.com', usuario: { papel: 'agente' } });
    });

    it('ausente ou vazia → o pedido segue sem `dominio`', async () => {
      const sup = await supervisorComCanal();
      delete process.env.ATENDIMENTO_DOMINIO;
      expect((await sessao(authHeader(sup))).status).toBe(200);
      process.env.ATENDIMENTO_DOMINIO = '  ';
      expect((await sessao(authHeader(sup))).status).toBe(200);
      const corpos = prosio.sessoes().map((s) => s.corpo);
      expect(corpos).toHaveLength(2);
      for (const corpo of corpos) expect(corpo).not.toHaveProperty('dominio');
    });
  });

  it('usuário CARTEIRO → 403', async () => {
    const unidade = await criarUnidade();
    const carteiro = await prisma.usuario.create({
      data: { nome: 'Carteiro Login', role: 'CARTEIRO', senha: 'x', unidadeId: unidade.id, matricula: '99887766' },
    });
    const r = await sessao(authHeader(carteiro));
    expect(r.status).toBe(403);
    expect(prosio.sessoes()).toHaveLength(0);
  });

  it('Prosio responde 503 → 503 atendimento_indisponivel', async () => {
    const canal = await criarCanal({ baseUrl: prosio.url });
    const unidade = await criarUnidade({ canalProsioId: canal.canal.id });
    const sup = await criarSupervisor({ unidadeId: unidade.id });
    prosio.roteirizar('POST', '/api/v1/atendimento/sessoes', { status: 503, corpo: { code: 'chatwoot_indisponivel', message: 'fora' } });
    const r = await sessao(authHeader(sup));
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('atendimento_indisponivel');
  });

  it('unidade sem canal → 409 sem_canal', async () => {
    const unidade = await criarUnidade();
    const sup = await criarSupervisor({ unidadeId: unidade.id });
    const r = await sessao(authHeader(sup));
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('sem_canal');
  });
});
