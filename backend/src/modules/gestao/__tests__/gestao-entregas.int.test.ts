/**
 * Gestão estendida para as entregas mediadas: canais Prosio, unidades com canal,
 * permissões, concorrência, unidade inativa, usuário desativado e supervisores.
 * IT-001..IT-006, IT-061..IT-063.
 */
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { decifrar } from '../../../shared/utils/cripto';
import { invalidarCacheUsuario } from '../../../shared/middleware/auth.middleware';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import {
  criarCanal,
  criarCarteiro,
  criarDistrito,
  criarGestor,
  criarSupervisor,
  criarUnidade,
  limparBanco,
} from '../../../__tests__/fixtures/entregas';
import { garantirUnidadeAtiva } from '../../entregas/cadastro.service';

type Auth = Record<string, string>;
const req = {
  get: (url: string, auth: Auth) => request(app).get(url).set('Connection', 'close').set(auth),
  post: (url: string, auth: Auth, body?: object) => request(app).post(url).set('Connection', 'close').set(auth).send(body ?? {}),
  put: (url: string, auth: Auth, body: object) => request(app).put(url).set('Connection', 'close').set(auth).send(body),
};

function corpoUnidade(extra: Record<string, unknown> = {}) {
  const n = Math.floor(Math.random() * 1e8);
  return {
    codigo: `CDD${n}`,
    nome: `CDD Norte ${n}`,
    tipo: 'CDD',
    logradouro: 'SQN 308 Bloco A',
    numero: '1',
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    uf: 'DF',
    cep: '70747090',
    latitude: -15.76,
    longitude: -47.88,
    ...extra,
  };
}

let gestao: Auth;

beforeEach(async () => {
  await limparBanco();
  invalidarCacheUsuario();
  gestao = authHeader(await criarGestor());
});

afterAll(async () => {
  await encerrarRecursos();
});

describe('Canais Prosio', () => {
  it('IT-001 POST devolve o tokenEntrada uma vez; GET não devolve segredos; apiKey cifrada no banco', async () => {
    const apiKey = 'psk_live_abcdef123456';
    const callbackSecret = 'segredo-de-callback-123';
    const criar = await req.post('/api/v1/gestao/canais-prosio', gestao, {
      nome: 'Prosio Correios DF', baseUrl: 'https://prosio.com.br/qualquer', apiKey, callbackSecret, tipo: 'WAHA', compartilhado: true,
    });
    expect(criar.status).toBe(201);
    expect(typeof criar.body.tokenEntrada).toBe('string');
    expect(criar.body.tokenEntrada.length).toBeGreaterThan(30);
    expect(criar.body.baseUrl).toBe('https://prosio.com.br');
    expect(JSON.stringify(criar.body)).not.toContain(apiKey);
    expect(JSON.stringify(criar.body)).not.toContain(callbackSecret);

    const lista = await req.get('/api/v1/gestao/canais-prosio', gestao);
    const um = await req.get(`/api/v1/gestao/canais-prosio/${criar.body.id}`, gestao);
    for (const r of [lista, um]) {
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      for (const proibido of ['apiKey', 'callbackSecret', 'tokenEntrada', apiKey, callbackSecret, criar.body.tokenEntrada]) {
        expect(texto).not.toContain(proibido);
      }
    }

    const noBanco = await prisma.canalProsio.findUniqueOrThrow({ where: { id: criar.body.id } });
    expect(noBanco.apiKeyCifrada).not.toBe(apiKey);
    expect(decifrar(noBanco.apiKeyCifrada)).toBe(apiKey);
    expect(noBanco.tokenEntradaHash).not.toBe(criar.body.tokenEntrada);
    expect(noBanco.tokenEntradaHash).toMatch(/^[0-9a-f]{64}$/);

    // PUT sem regenerar não devolve token; com regenerar devolve um novo.
    const editar = await req.put(`/api/v1/gestao/canais-prosio/${criar.body.id}`, gestao, { nome: 'Prosio DF' });
    expect(editar.status).toBe(200);
    expect(editar.body.tokenEntrada).toBeUndefined();
    const regenerar = await req.put(`/api/v1/gestao/canais-prosio/${criar.body.id}`, gestao, { regenerarTokenEntrada: true });
    expect(regenerar.body.tokenEntrada).toBeDefined();
    expect(regenerar.body.tokenEntrada).not.toBe(criar.body.tokenEntrada);
  });
});

describe('Unidades', () => {
  it('IT-002 validações do POST /gestao/unidades', async () => {
    const semNome = await req.post('/api/v1/gestao/unidades', gestao, { ...corpoUnidade(), nome: undefined });
    expect(semNome.status).toBe(400);
    expect(JSON.stringify(semNome.body.details)).toContain('nome');

    const compartilhado = await criarCanal({ compartilhado: true });
    const semRef = await req.post('/api/v1/gestao/unidades', gestao, corpoUnidade({ canalProsioId: compartilhado.canal.id }));
    expect(semRef.status).toBe(400);
    expect(semRef.body.error).toBe('unidade_ref_obrigatoria');

    const wabaInexistente = await req.post('/api/v1/gestao/unidades', gestao, corpoUnidade({ canal: 'WABA' }));
    expect(wabaInexistente.status).toBe(400);
    expect(wabaInexistente.body.error).toBe('canal_indisponivel');

    const waha = await criarCanal({ tipo: 'WAHA' });
    const wabaNoWaha = await req.post('/api/v1/gestao/unidades', gestao, corpoUnidade({ canal: 'WABA', canalProsioId: waha.canal.id }));
    expect(wabaNoWaha.status).toBe(400);
    expect(wabaNoWaha.body.error).toBe('canal_indisponivel');

    const ok = await req.post('/api/v1/gestao/unidades', gestao, corpoUnidade({
      canalProsioId: compartilhado.canal.id, prosioUnidadeRef: 'cdd-norte', mediacaoAtiva: true,
    }));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ prosioUnidadeRef: 'cdd-norte', mediacaoAtiva: true, canalProsio: { id: compartilhado.canal.id } });
    expect(JSON.stringify(ok.body)).not.toContain('Cifrad');
  });

  it('IT-003 supervisor em GET /gestao/unidades → 403', async () => {
    const unidade = await criarUnidade();
    const sup = await criarSupervisor({ unidadeId: unidade.id });
    const r = await req.get('/api/v1/gestao/unidades', authHeader(sup));
    expect(r.status).toBe(403);
  });

  it('IT-004 dois PUT com o mesmo atualizadoEm → 200 e 409 alterado_por_outro com os dados atuais', async () => {
    const unidade = await criarUnidade();
    const lida = await req.get(`/api/v1/gestao/unidades/${unidade.id}`, gestao);
    const versao = lida.body.atualizadoEm;

    const primeiro = await req.put(`/api/v1/gestao/unidades/${unidade.id}`, gestao, { nome: 'CDD Primeiro', atualizadoEm: versao });
    expect(primeiro.status).toBe(200);
    const segundo = await req.put(`/api/v1/gestao/unidades/${unidade.id}`, gestao, { nome: 'CDD Segundo', atualizadoEm: versao });
    expect(segundo.status).toBe(409);
    expect(segundo.body.error).toBe('alterado_por_outro');
    expect(segundo.body.details.atual).toMatchObject({ id: unidade.id, nome: 'CDD Primeiro' });
    expect(segundo.body.details.atual.atualizadoEm).not.toBe(versao);
    expect((await prisma.unidade.findUniqueOrThrow({ where: { id: unidade.id } })).nome).toBe('CDD Primeiro');
  });

  it('IT-005 unidade ativa=false → a liberação recusa com 409 unidade_inativa', async () => {
    const unidade = await criarUnidade();
    await expect(garantirUnidadeAtiva(unidade.id)).resolves.toBeUndefined();
    const desativar = await req.put(`/api/v1/gestao/unidades/${unidade.id}`, gestao, { ativa: false });
    expect(desativar.status).toBe(200);
    await expect(garantirUnidadeAtiva(unidade.id)).rejects.toMatchObject({ statusCode: 409, message: 'unidade_inativa' });
  });
});

describe('Usuários e supervisores', () => {
  it('IT-006 usuário desativado com token válido → 401 depois do cache de 60 s', async () => {
    const unidade = await criarUnidade();
    const sup = await criarSupervisor({ unidadeId: unidade.id });
    const auth = authHeader(sup);
    expect((await req.get('/api/v1/entregas/quadro', auth)).status).toBe(200);

    // Desativado direto no banco (outra instância da API): vale ao expirar o cache.
    await prisma.usuario.update({ where: { id: sup.id }, data: { ativo: false } });
    expect((await req.get('/api/v1/entregas/quadro', auth)).status).toBe(200);

    const agora = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(agora + 61_000);
    try {
      expect((await req.get('/api/v1/entregas/quadro', auth)).status).toBe(401);
    } finally {
      relogio.mockRestore();
    }

    // Desativado pela Gestão: vale na hora.
    const outro = await criarSupervisor({ unidadeId: unidade.id });
    const authOutro = authHeader(outro);
    expect((await req.get('/api/v1/entregas/quadro', authOutro)).status).toBe(200);
    expect((await req.put(`/api/v1/gestao/usuarios/${outro.id}`, gestao, { ativo: false })).status).toBe(200);
    expect((await req.get('/api/v1/entregas/quadro', authOutro)).status).toBe(401);
  });

  it('IT-061 supervisor criado pela Gestão entra e vê só a própria unidade; matrícula de carteiro → 409; telefone inválido → 400', async () => {
    const a = await criarUnidade();
    const b = await criarUnidade();
    await criarDistrito({ unidadeId: a.id, codigo: 'A-01' });
    await criarDistrito({ unidadeId: b.id, codigo: 'B-01' });
    await criarCarteiro({ unidadeId: a.id, matricula: '83015520' });

    const base = { nome: 'Supervisora Ana', senha: 'senha-forte-1', role: 'UNIDADE', unidadeId: a.id, telefoneCelular: '(61) 99812-4412' };
    const criar = await req.post('/api/v1/gestao/usuarios', gestao, { ...base, matricula: '8.301.553-9' });
    expect(criar.status).toBe(201);
    expect(criar.body).toMatchObject({ matricula: '83015539', telefoneCelular: '+5561998124412', unidadeId: a.id });

    const login = await request(app).post('/api/v1/auth/login').set('Connection', 'close').send({ matricula: '83015539', senha: 'senha-forte-1' });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const quadro = await req.get('/api/v1/entregas/quadro', auth);
    expect(quadro.status).toBe(200);
    expect(quadro.body.distritos.map((d: { codigo: string }) => d.codigo)).toEqual(['A-01']);
    expect((await req.get(`/api/v1/entregas/quadro?unidadeId=${b.id}`, auth)).status).toBe(404);

    const matriculaDeCarteiro = await req.post('/api/v1/gestao/usuarios', gestao, { ...base, matricula: '8.301.552-0', telefoneCelular: '61998124413' });
    expect(matriculaDeCarteiro.status).toBe(409);
    expect(matriculaDeCarteiro.body.error).toBe('matricula_em_uso');

    const telefoneInvalido = await req.post('/api/v1/gestao/usuarios', gestao, { ...base, matricula: '83015547', telefoneCelular: '9981-24AB' });
    expect(telefoneInvalido.status).toBe(400);
    expect(telefoneInvalido.body.error).toBe('telefone_invalido');
  });

  it('IT-062 GET /gestao/unidades marca semSupervisor na unidade sem supervisor ativo', async () => {
    const comSup = await criarUnidade();
    const semSup = await criarUnidade();
    const soInativo = await criarUnidade();
    await criarSupervisor({ unidadeId: comSup.id });
    await criarSupervisor({ unidadeId: soInativo.id, ativo: false });

    const r = await req.get('/api/v1/gestao/unidades', gestao);
    expect(r.status).toBe(200);
    const por = new Map(r.body.map((u: { id: string; semSupervisor: boolean }) => [u.id, u.semSupervisor]));
    expect(por.get(comSup.id)).toBe(false);
    expect(por.get(semSup.id)).toBe(true);
    expect(por.get(soInativo.id)).toBe(true);
  });

  it('IT-063 supervisor movido de A para B → rotas entregas e atendimento só de B', async () => {
    const prosio = await ProsioFake.iniciar();
    try {
      const canal = await criarCanal({ compartilhado: true, baseUrl: prosio.url });
      const a = await criarUnidade({ canalProsioId: canal.canal.id, prosioUnidadeRef: 'cdd-a' });
      const b = await criarUnidade({ canalProsioId: canal.canal.id, prosioUnidadeRef: 'cdd-b' });
      const da = await criarDistrito({ unidadeId: a.id, codigo: 'A-01' });
      const db = await criarDistrito({ unidadeId: b.id, codigo: 'B-01' });
      const sup = await criarSupervisor({ unidadeId: a.id });
      const auth = authHeader(sup); // token emitido quando ele era de A

      expect((await req.get(`/api/v1/entregas/cadastro/distritos/${da.id}`, auth)).status).toBe(200);

      const mover = await req.put(`/api/v1/gestao/usuarios/${sup.id}`, gestao, { unidadeId: b.id });
      expect(mover.status).toBe(200);

      expect((await req.get(`/api/v1/entregas/cadastro/distritos/${da.id}`, auth)).status).toBe(404);
      expect((await req.get(`/api/v1/entregas/cadastro/distritos/${db.id}`, auth)).status).toBe(200);
      const quadro = await req.get('/api/v1/entregas/quadro', auth);
      expect(quadro.body.distritos.map((d: { codigo: string }) => d.codigo)).toEqual(['B-01']);

      const sessao = await req.post('/api/v1/entregas/atendimento/sessao', auth);
      expect(sessao.status).toBe(200);
      const enviada = prosio.sessoes().at(-1)!;
      expect(enviada.corpo).toMatchObject({ unidadeRef: 'cdd-b', usuario: { papel: 'agente', idExterno: sup.id } });
    } finally {
      await prosio.parar();
    }
  });
});
