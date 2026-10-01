/**
 * Cadastro da unidade: distritos, carteiros, carteiro do dia e pontos de retirada.
 * IT-007..IT-013, IT-015.
 */
import request from 'supertest';
import type { Unidade } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import {
  criarCarga,
  criarCarteiro,
  criarDistrito,
  criarGestor,
  criarSupervisor,
  criarUnidade,
  limparBanco,
} from '../../../__tests__/fixtures/entregas';
import { formatarData, hojeBrasilia, somarDias } from '../datas';
import { registrarGanchoTrocaCarteiro } from '../ganchos';

type Auth = Record<string, string>;
const get = (url: string, auth: Auth) => request(app).get(url).set('Connection', 'close').set(auth);
const post = (url: string, auth: Auth, body: object) => request(app).post(url).set('Connection', 'close').set(auth).send(body);
const put = (url: string, auth: Auth, body: object) => request(app).put(url).set('Connection', 'close').set(auth).send(body);

const hoje = hojeBrasilia();
const amanha = somarDias(hoje, 1);

interface Cenario { unidade: Unidade; auth: Auth }

async function cenario(): Promise<Cenario> {
  const unidade = await criarUnidade();
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  return { unidade, auth: authHeader(supervisor) };
}

async function cartaoDoQuadro(auth: Auth, distritoId: string, data = hoje) {
  const r = await get(`/api/v1/entregas/quadro?data=${formatarData(data)}`, auth);
  expect(r.status).toBe(200);
  return r.body.distritos.find((d: { distritoId: string }) => d.distritoId === distritoId);
}

beforeEach(async () => {
  await limparBanco();
});

afterEach(() => {
  registrarGanchoTrocaCarteiro(null);
});

afterAll(async () => {
  await encerrarRecursos();
});

describe('Distritos', () => {
  it('IT-007 código repetido na mesma unidade → 409; em outra unidade → 201', async () => {
    const a = await cenario();
    const b = await cenario();
    const primeiro = await post('/api/v1/entregas/cadastro/distritos', a.auth, { codigo: 'D-01', nome: 'Asa Norte' });
    expect(primeiro.status).toBe(201);
    expect(primeiro.body).toMatchObject({ codigo: 'D-01', nome: 'Asa Norte', ativo: true, unidadeId: a.unidade.id });

    const repetido = await post('/api/v1/entregas/cadastro/distritos', a.auth, { codigo: 'D-01', nome: 'Outro' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toBe('codigo_em_uso');

    const outraUnidade = await post('/api/v1/entregas/cadastro/distritos', b.auth, { codigo: 'D-01', nome: 'Taguatinga' });
    expect(outraUnidade.status).toBe(201);
  });

  it('IT-008 supervisor da unidade A → distrito da unidade B → 404', async () => {
    const a = await cenario();
    const b = await cenario();
    const deB = await criarDistrito({ unidadeId: b.unidade.id });
    expect((await get(`/api/v1/entregas/cadastro/distritos/${deB.id}`, a.auth)).status).toBe(404);
    expect((await put(`/api/v1/entregas/cadastro/distritos/${deB.id}`, a.auth, { nome: 'X' })).status).toBe(404);
    expect((await get(`/api/v1/entregas/cadastro/distritos?unidadeId=${b.unidade.id}`, a.auth)).status).toBe(404);
    expect((await get(`/api/v1/entregas/cadastro/distritos/${deB.id}`, b.auth)).status).toBe(200);

    // A Gestão escolhe a unidade com ?unidadeId=.
    const gestao = authHeader(await criarGestor());
    const lista = await get(`/api/v1/entregas/cadastro/distritos?unidadeId=${b.unidade.id}`, gestao);
    expect(lista.status).toBe(200);
    expect(lista.body.itens.map((d: { id: string }) => d.id)).toEqual([deB.id]);
  });

  it('IT-009 distrito com carga liberada hoje → PUT ativo:false → 409 distrito_em_operacao', async () => {
    const c = await cenario();
    const d = await criarDistrito({ unidadeId: c.unidade.id });
    await criarCarga({ distritoId: d.id, data: hoje, status: 'LIBERADO', liberadoEm: new Date() });
    const r = await put(`/api/v1/entregas/cadastro/distritos/${d.id}`, c.auth, { ativo: false });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('distrito_em_operacao');

    // Carga só carregada (não liberada) não bloqueia.
    const outro = await criarDistrito({ unidadeId: c.unidade.id });
    await criarCarga({ distritoId: outro.id, data: hoje });
    const ok = await put(`/api/v1/entregas/cadastro/distritos/${outro.id}`, c.auth, { ativo: false });
    expect(ok.status).toBe(200);
    expect(ok.body.ativo).toBe(false);
  });

  it('IT-010 100 distritos → página 2 de 50; busca por nome', async () => {
    const c = await cenario();
    await prisma.distrito.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        unidadeId: c.unidade.id,
        codigo: `D-${String(i + 1).padStart(3, '0')}`,
        nome: i < 7 ? `Setor Norte ${i}` : `Setor Sul ${i}`,
      })),
    });
    const p2 = await get('/api/v1/entregas/cadastro/distritos?pagina=2&tamanho=50', c.auth);
    expect(p2.status).toBe(200);
    expect(p2.body.itens).toHaveLength(50);
    expect(p2.body).toMatchObject({ total: 100, pagina: 2, tamanho: 50, totalPaginas: 2 });
    expect(p2.body.itens[0].codigo).toBe('D-051');

    const busca = await get('/api/v1/entregas/cadastro/distritos?busca=Norte', c.auth);
    expect(busca.body.total).toBe(7);
    expect(busca.body.itens.every((d: { nome: string }) => d.nome.includes('Norte'))).toBe(true);
  });

  it('versão divergente no PUT → 409 alterado_por_outro', async () => {
    const c = await cenario();
    const d = await criarDistrito({ unidadeId: c.unidade.id });
    const versao = d.atualizadoEm.toISOString();
    expect((await put(`/api/v1/entregas/cadastro/distritos/${d.id}`, c.auth, { nome: 'Um', atualizadoEm: versao })).status).toBe(200);
    const r = await put(`/api/v1/entregas/cadastro/distritos/${d.id}`, c.auth, { nome: 'Dois', atualizadoEm: versao });
    expect(r.status).toBe(409);
    expect(r.body.details.atual.nome).toBe('Um');
  });
});

describe('Carteiros', () => {
  it('IT-011 WhatsApp inválido → 400; matrícula repetida → 409; WhatsApp repetido → 409; outra unidade → 409 detalhe unidade', async () => {
    const a = await cenario();
    const b = await cenario();
    const url = '/api/v1/entregas/cadastro/carteiros';

    const semDdd = await post(url, a.auth, { nome: 'João', matricula: '8.301.552-0', whatsapp: '98876-1102' });
    expect(semDdd.status).toBe(400);
    expect(semDdd.body.error).toBe('whatsapp_invalido');

    const ok = await post(url, a.auth, { nome: 'João', matricula: '8.301.552-0', whatsapp: '(61) 98876-1102' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ matricula: '83015520', whatsapp: '+5561988761102', ativo: true, possuiLogin: false });

    const matricula = await post(url, a.auth, { nome: 'Pedro', matricula: '83015520', whatsapp: '(61) 98876-1103' });
    expect(matricula.status).toBe(409);
    expect(matricula.body.error).toBe('matricula_em_uso');

    const whatsapp = await post(url, a.auth, { nome: 'Pedro', matricula: '83015521', whatsapp: '+55 61 98876-1102' });
    expect(whatsapp.status).toBe(409);
    expect(whatsapp.body.error).toBe('whatsapp_em_uso');

    const outraUnidade = await post(url, b.auth, { nome: 'João', matricula: '83015520', whatsapp: '(61) 98876-1109' });
    expect(outraUnidade.status).toBe(409);
    expect(outraUnidade.body.details).toMatchObject({ detalhe: 'unidade', unidade: a.unidade.nome });

    // Matrícula de supervisor também conflita.
    await criarSupervisor({ unidadeId: a.unidade.id, matricula: '83015599' });
    const deUsuario = await post(url, a.auth, { nome: 'Ana', matricula: '8.301.559-9', whatsapp: '(61) 98876-1110' });
    expect(deUsuario.status).toBe(409);

    // Carteiro de outra unidade → 404; lista só da própria.
    const deB = await criarCarteiro({ unidadeId: b.unidade.id });
    expect((await put(`${url}/${deB.id}`, a.auth, { nome: 'X' })).status).toBe(404);
    const lista = await get(url, a.auth);
    expect(lista.body.itens.map((c: { id: string }) => c.id)).toEqual([ok.body.id]);
  });

  it('IT-012 desativar carteiro escalado em distrito liberado hoje → 409; só padrão de distrito não liberado → 200 e "Sem carteiro"', async () => {
    const c = await cenario();
    const escalado = await criarCarteiro({ unidadeId: c.unidade.id });
    const liberado = await criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: escalado.id });
    await criarCarga({ distritoId: liberado.id, data: hoje, status: 'LIBERADO', carteiroId: escalado.id, liberadoEm: new Date() });
    const bloqueado = await put(`/api/v1/entregas/cadastro/carteiros/${escalado.id}`, c.auth, { ativo: false });
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error).toBe('carteiro_em_operacao');

    const soPadrao = await criarCarteiro({ unidadeId: c.unidade.id });
    const naoLiberado = await criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: soPadrao.id });
    const ok = await put(`/api/v1/entregas/cadastro/carteiros/${soPadrao.id}`, c.auth, { ativo: false });
    expect(ok.status).toBe(200);
    expect(ok.body.ativo).toBe(false);
    const cartao = await cartaoDoQuadro(c.auth, naoLiberado.id);
    expect(cartao).toMatchObject({ carteiro: null, semCarteiro: true });
  });

  it('distritoPadraoId define o carteiro padrão do distrito', async () => {
    const c = await cenario();
    const d = await criarDistrito({ unidadeId: c.unidade.id });
    const r = await post('/api/v1/entregas/cadastro/carteiros', c.auth, {
      nome: 'Maria', matricula: '83015600', whatsapp: '(61) 98876-2000', distritoPadraoId: d.id,
    });
    expect(r.status).toBe(201);
    expect(r.body.distritosPadrao.map((x: { id: string }) => x.id)).toEqual([d.id]);
    expect((await prisma.distrito.findUniqueOrThrow({ where: { id: d.id } })).carteiroPadraoId).toBe(r.body.id);
  });
});

describe('Carteiro do dia', () => {
  it('IT-013 troca só na data; o dia seguinte volta ao padrão; carteiro em dois distritos → aviso', async () => {
    const c = await cenario();
    const padrao = await criarCarteiro({ unidadeId: c.unidade.id });
    const substituto = await criarCarteiro({ unidadeId: c.unidade.id });
    const d1 = await criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: padrao.id });

    const troca = await put(`/api/v1/entregas/cadastro/distritos/${d1.id}/escala/${formatarData(hoje)}`, c.auth, { carteiroId: substituto.id });
    expect(troca.status).toBe(200);
    expect(troca.body).toMatchObject({ carteiro: { id: substituto.id }, avisos: [] });

    expect((await cartaoDoQuadro(c.auth, d1.id, hoje)).carteiro.id).toBe(substituto.id);
    expect((await cartaoDoQuadro(c.auth, d1.id, amanha)).carteiro.id).toBe(padrao.id);

    // Substituto já é o padrão de outro distrito → dobra, com aviso.
    const d2 = await criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: padrao.id });
    const dobra = await put(`/api/v1/entregas/cadastro/distritos/${d2.id}/escala/${formatarData(hoje)}`, c.auth, { carteiroId: substituto.id });
    expect(dobra.status).toBe(200);
    expect(dobra.body.avisos).toEqual(['carteiro_em_dois_distritos']);

    // Data passada → 400; carteiro de outra unidade → 400.
    expect((await put(`/api/v1/entregas/cadastro/distritos/${d1.id}/escala/${formatarData(somarDias(hoje, -1))}`, c.auth, { carteiroId: substituto.id })).status).toBe(400);
    const outra = await cenario();
    const alheio = await criarCarteiro({ unidadeId: outra.unidade.id });
    expect((await put(`/api/v1/entregas/cadastro/distritos/${d1.id}/escala/${formatarData(hoje)}`, c.auth, { carteiroId: alheio.id })).status).toBe(400);
  });

  it('troca em distrito liberado atualiza o snapshot da carga e chama o gancho notificarTrocaCarteiro', async () => {
    const c = await cenario();
    const padrao = await criarCarteiro({ unidadeId: c.unidade.id });
    const novo = await criarCarteiro({ unidadeId: c.unidade.id });
    const d = await criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: padrao.id });
    const carga = await criarCarga({ distritoId: d.id, data: hoje, status: 'LIBERADO', carteiroId: padrao.id, liberadoEm: new Date() });

    const chamadas: [string, string, string][] = [];
    registrarGanchoTrocaCarteiro(async (distritoId, data, carteiroNovoId) => {
      chamadas.push([distritoId, formatarData(data), carteiroNovoId]);
    });
    const r = await put(`/api/v1/entregas/cadastro/distritos/${d.id}/escala/${formatarData(hoje)}`, c.auth, { carteiroId: novo.id });
    expect(r.status).toBe(200);
    expect(chamadas).toEqual([[d.id, formatarData(hoje), novo.id]]);
    expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: carga.id } })).carteiroId).toBe(novo.id);
    expect((await cartaoDoQuadro(c.auth, d.id)).carteiro.id).toBe(novo.id);
  });
});

describe('Pontos de retirada', () => {
  it('IT-015 11º ativo → 409; nome de 25 caracteres → 400; PUT de ponto de outra unidade → 404', async () => {
    const c = await cenario();
    const url = '/api/v1/entregas/cadastro/pontos';
    for (let i = 1; i <= 10; i += 1) {
      const r = await post(url, c.auth, { tipo: 'AGENCIA', nome: `AC Asa Norte ${i}`, endereco: 'SQN 302', horario: 'Seg–Sex 9h–17h' });
      expect(r.status).toBe(201);
    }
    const decimaPrimeira = await post(url, c.auth, { tipo: 'AGENCIA', nome: 'AC Extra', endereco: 'SQN 302', horario: '9h–17h' });
    expect(decimaPrimeira.status).toBe(409);
    expect(decimaPrimeira.body.error).toBe('limite_pontos');

    // O limite é por tipo: um locker passa; um inativo também.
    expect((await post(url, c.auth, { tipo: 'LOCKER', nome: 'Locker Shopping', endereco: 'SCN', horario: '24h' })).status).toBe(201);
    const inativa = await post(url, c.auth, { tipo: 'AGENCIA', nome: 'AC Reserva', endereco: 'SQN', horario: '9h', ativo: false });
    expect(inativa.status).toBe(201);
    // Reativar a 11ª → 409.
    expect((await put(`${url}/${inativa.body.id}`, c.auth, { ativo: true })).status).toBe(409);

    const longo = await post(url, c.auth, { tipo: 'LOCKER', nome: 'L'.repeat(25), endereco: 'SCN', horario: '24h' });
    expect(longo.status).toBe(400);
    expect(longo.body.error).toBe('nome_longo');

    const outra = await cenario();
    const alheio = await prisma.pontoRetirada.create({ data: { unidadeId: outra.unidade.id, tipo: 'AGENCIA', nome: 'AC Alheia', endereco: 'x', horario: 'y' } });
    const r = await put(`${url}/${alheio.id}`, c.auth, { nome: 'Minha' });
    expect(r.status).toBe(404);

    const lista = await get(url, c.auth);
    expect(lista.body.ativosPorTipo).toEqual({ AGENCIA: 10, LOCKER: 1 });
  });

  it('ativações concorrentes não passam de 10', async () => {
    const c = await cenario();
    const url = '/api/v1/entregas/cadastro/pontos';
    const respostas = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      post(url, c.auth, { tipo: 'LOCKER', nome: `Locker ${i}`, endereco: 'SCN', horario: '24h' })));
    expect(respostas.filter((r) => r.status === 201)).toHaveLength(10);
    expect(respostas.filter((r) => r.status === 409)).toHaveLength(2);
  });
});
