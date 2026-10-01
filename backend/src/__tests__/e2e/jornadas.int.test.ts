/**
 * Jornadas ponta a ponta de API (E2E-001–E2E-004): supertest sobre o `app`,
 * Prosio e Seu Rastreio falsos, worker real da fila `entregas-aviso`. Depois
 * do cenário base (canal, unidade e supervisor), tudo passa pela API pública,
 * pelos webhooks e pelas ações de botão simuladas.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import type { Unidade, Usuario } from '@prisma/client';
import { app } from '../../app';
import { prisma } from '../../shared/utils/prisma';
import { encerrarRecursos } from '../helpers/recursos';
import { ProsioFake, type RequisicaoGravada } from '../fakes/prosio.fake';
import { SeuRastreioFake } from '../fakes/seu-rastreio.fake';
import { brasilia, drenarAvisos, entregasAvisoQueue, esvaziarFilaAviso, noInstante } from '../helpers/avisos';
import { criarCanal, criarSupervisor, criarUnidade, limparBanco, proximo, SENHA_PADRAO, type CanalCriado } from '../fixtures/entregas';
import { formatarData, hojeBrasilia, somarDias } from '../../modules/entregas/datas';
import { proximoDiaDeEntrega } from '../../modules/entregas/calendario';
import { startEntregasAvisoWorker, stopEntregasAvisoWorker } from '../../workers/entregas-aviso.worker';

let prosio: ProsioFake;
let rastreio: SeuRastreioFake;
let servidor: http.Server;
let base: string;

interface Sessao {
  canal: CanalCriado;
  unidade: Unidade;
  supervisor: Usuario;
  auth: { Authorization: string };
}

const api = () => request(base);
const post = (s: Sessao, url: string, corpo: object = {}) => api().post(url).set('Connection', 'close').set(s.auth).send(corpo);
const get = (s: Sessao, url: string) => api().get(url).set('Connection', 'close').set(s.auth);

/** Canal, unidade e supervisor; o supervisor entra pelo login real. */
async function sessao(opcoes: { mediacaoAtiva?: boolean } = {}): Promise<Sessao> {
  const canal = await criarCanal({ baseUrl: prosio.url });
  const unidade = await criarUnidade({ canalProsioId: canal.canal.id, mediacaoAtiva: opcoes.mediacaoAtiva ?? false });
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  const login = await api().post('/api/v1/auth/login').set('Connection', 'close').send({ email: supervisor.email, senha: SENHA_PADRAO });
  expect(login.status).toBe(200);
  return { canal, unidade, supervisor, auth: { Authorization: `Bearer ${login.body.accessToken}` } };
}

/** Novo login (o token emitido no relógio real expira quando o teste avança o relógio). */
async function relogar(s: Sessao): Promise<void> {
  const login = await api().post('/api/v1/auth/login').set('Connection', 'close').send({ email: s.supervisor.email, senha: SENHA_PADRAO });
  expect(login.status).toBe(200);
  s.auth = { Authorization: `Bearer ${login.body.accessToken}` };
}

/**
 * Libera a carga num instante fixo do relógio. O token precisa nascer no mesmo
 * relógio da chamada (expira em 15 min): login dentro do instante e de novo ao
 * sair, senão o resultado depende da hora real em que a suíte roda.
 */
async function liberarNoInstante(s: Sessao, instante: Date, cargaId: string) {
  const r = await noInstante(instante, async () => {
    await relogar(s);
    return post(s, `/api/v1/entregas/cargas/${cargaId}/liberar`);
  });
  await relogar(s);
  return r;
}

/** Cadastro pela API: carteiro, distrito (com o carteiro padrão) e pontos. */
async function cadastrar(s: Sessao, pontos: Array<['AGENCIA' | 'LOCKER', string]> = []) {
  const n = proximo();
  const carteiro = await post(s, '/api/v1/entregas/cadastro/carteiros', {
    nome: `Carteiro Jornada ${n}`,
    matricula: `J${String(n).padStart(7, '0')}`,
    whatsapp: `(61) 97${String(1000000 + n).slice(-7)}`,
  });
  expect(carteiro.status).toBe(201);
  const distrito = await post(s, '/api/v1/entregas/cadastro/distritos', { codigo: `D-${n}`, nome: `Taguatinga ${n}`, carteiroPadraoId: carteiro.body.id });
  expect(distrito.status).toBe(201);
  const criados = [];
  for (const [tipo, nome] of pontos) {
    const p = await post(s, '/api/v1/entregas/cadastro/pontos', { tipo, nome, endereco: `${nome}, QNA 30`, horario: '9h às 17h' });
    expect(p.status).toBe(201);
    criados.push(p.body);
  }
  return { carteiro: carteiro.body as { id: string; whatsapp?: string; whatsappE164?: string }, distrito: distrito.body as { id: string }, pontos: criados as Array<{ id: string; nome: string }> };
}

function linha(codigo: string, whatsapp: string, nome = 'MARIA APARECIDA') {
  return { n: 1, codigo, nome, whatsapp, logradouro: 'QNA 12', numero: 'Casa 45', bairro: 'Taguatinga', cidade: 'Brasília', uf: 'DF', cep: '72110120' };
}

/** Prévia + confirmação da planilha no `dia`. */
async function carregar(s: Sessao, distritoId: string, dia: Date, linhas: object[]) {
  const previa = await post(s, `/api/v1/entregas/cargas/${distritoId}/previa`, { data: formatarData(dia), linhas });
  expect(previa.status).toBe(200);
  const confirmar = await post(s, `/api/v1/entregas/cargas/${distritoId}/confirmar`, { data: formatarData(dia), linhas });
  expect(confirmar.status).toBe(200);
  return { previa: previa.body, cargaId: confirmar.body.cargaId as string };
}

const urlAcao = (s: Sessao, prefixo: string) => `${base}/api/v1/entregas/prosio/${s.canal.canal.id}/acao/${prefixo}`;
const urlWebhook = (s: Sessao) => `${base}/api/v1/entregas/prosio/${s.canal.canal.id}/webhook`;
async function tocar(s: Sessao, prefixo: string, acao: string, telefone: string) {
  const r = await prosio.acionarBotao(urlAcao(s, prefixo), { token: s.canal.tokenEntrada, acao, telefone });
  expect(r.status).toBe(200);
  return (r.corpo as { mensagem: string }).mensagem;
}
const para = (telefone: string) => prosio.mensagens().filter((m) => m.corpo.to === telefone);
const ids = (m: RequisicaoGravada) => ((m.corpo.buttons ?? []) as Array<{ id: string }>).map((b) => b.id);
const telefoneDe = async (carteiroId: string) => (await prisma.carteiro.findUniqueOrThrow({ where: { id: carteiroId } })).whatsappE164!;

beforeAll(async () => {
  process.env.ENTREGAS_AVISO_BACKOFF_MS = '5';
  await limparBanco();
  await entregasAvisoQueue.obliterate({ force: true });
  prosio = await ProsioFake.iniciar();
  rastreio = await SeuRastreioFake.iniciar();
  process.env.SEU_RASTREIO_URL = rastreio.url;
  process.env.SEU_RASTREIO_TOKEN = 'token-rastreio-teste';
  servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((ok) => servidor.once('listening', () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  startEntregasAvisoWorker();
});

beforeEach(async () => {
  await esvaziarFilaAviso();
  prosio.redefinir();
  rastreio.redefinir();
  delete process.env.PROSIO_MEDIACAO_EXTENSOES;
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(async () => {
  await stopEntregasAvisoWorker();
  await new Promise<void>((ok) => servidor.close(() => ok()));
  await prosio.parar();
  await rastreio.parar();
  await limparBanco();
  await encerrarRecursos();
});

describe('Jornadas de API', () => {
  it('E2E-001 do cadastro à confirmação do carteiro: aviso, agência, orientação, FEITO e read', async () => {
    const s = await sessao();
    const { carteiro, distrito, pontos } = await cadastrar(s, [['AGENCIA', 'AC Centro'], ['AGENCIA', 'AC Norte']]);
    const hoje = hojeBrasilia();
    const destinatario = '+5561998120001';
    const { cargaId } = await carregar(s, distrito.id, hoje, [linha('OY526018152BR', '(61) 99812-0001')]);

    const lib = await liberarNoInstante(s, brasilia(hoje, '09:00'), cargaId);
    expect(lib.status).toBe(202);
    expect(lib.body.avisosAgendados).toBe(1);
    await drenarAvisos();
    const [aviso] = para(destinatario);
    expect(aviso.corpo.body).toBe(
      'Olá, Maria, sua encomenda OY526018152BR já saiu para entrega. Se tiver alguma dificuldade para receber sua encomenda, nos avise.',
    );
    const pacoteId = aviso.corpo.reference as string;
    expect(ids(aviso)).toContain(`CE_OP:${pacoteId}.AGENCIA`);

    await tocar(s, 'CE_OP', `${pacoteId}.AGENCIA`, destinatario);
    const sub = para(destinatario).at(-1)!;
    expect(ids(sub).sort()).toEqual(pontos.map((p) => `CE_PT:${pacoteId}.${p.id}`).sort());
    const escolha = await tocar(s, 'CE_PT', `${pacoteId}.${pontos[0].id}`, destinatario);
    expect(escolha).toContain('AC Centro');

    const telCarteiro = await telefoneDe(carteiro.id);
    const [orientacao] = para(telCarteiro);
    expect(orientacao.corpo.body).toContain('Orientação para OY526018152BR');
    const feito = ids(orientacao).find((id) => id.endsWith('.FEITO'))!;
    expect(feito).toMatch(/^CE_CT:/);
    await tocar(s, 'CE_CT', feito.slice('CE_CT:'.length), telCarteiro);

    const read = await prosio.enviarCallbackStatus(urlWebhook(s), s.canal.callbackSecret, { messageId: prosio.messageIdDe(aviso)!, status: 'read', reference: pacoteId });
    expect(read.status).toBe(204);

    const lista = await get(s, `/api/v1/entregas/cargas/${cargaId}/pacotes`);
    expect(lista.status).toBe(200);
    const [p] = lista.body.pacotes;
    expect(p.status).toBe('INTERAGINDO');
    expect(p.orientacaoVigente).toEqual(expect.objectContaining({ tipo: 'AGENCIA', estado: 'FEITA' }));
    expect(p.respostaCarteiro.resposta).toBe('FEITO');
  });

  it('E2E-002 resposta tardia guardada → no próximo dia útil, resumo ao carteiro e aviso com a orientação', async () => {
    const s = await sessao();
    const { carteiro, distrito } = await cadastrar(s);
    const hoje = hojeBrasilia();
    const destinatario = '+5561998120002';
    const planilha = [linha('QB908301669BR', '(61) 99812-0002', 'JOANA SILVA')];
    const { cargaId } = await carregar(s, distrito.id, hoje, planilha);
    await liberarNoInstante(s, brasilia(hoje, '08:00'), cargaId);
    await drenarAvisos();
    const pacoteId = para(destinatario)[0].corpo.reference as string;

    // 1–2. Insucesso às 11:20 no rastreio; o destinatário pede "amanhã" à tarde e confirma.
    rastreio.definirEvento('QB908301669BR', 'Carteiro não atendido', { data: brasilia(hoje, '11:20').toISOString() });
    jest.useFakeTimers({ now: brasilia(hoje, '15:00'), doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    const resposta = await tocar(s, 'CE_OP', `${pacoteId}.AMANHA`, destinatario);
    expect(resposta).toContain('11h20');
    const sim = ids(para(destinatario).at(-1)!).find((id) => id.endsWith('.SIM'))!;
    await tocar(s, 'CE_SN', sim.slice('CE_SN:'.length), destinatario);
    const guardada = await prisma.orientacao.findFirstOrThrow({ where: { codigo: 'QB908301669BR' } });
    expect(guardada.estado).toBe('GUARDADA');

    // 3–5. Próximo dia útil: a mesma planilha, prévia com a orientação guardada, liberação.
    const amanha = proximoDiaDeEntrega(hoje);
    jest.setSystemTime(brasilia(amanha, '07:30'));
    await relogar(s);
    prosio.redefinir();
    const segundo = await carregar(s, distrito.id, amanha, planilha);
    expect(segundo.previa.linhas[0].orientacaoGuardada).toBeTruthy();
    const lib = await post(s, `/api/v1/entregas/cargas/${segundo.cargaId}/liberar`);
    expect(lib.status).toBe(202);
    jest.useRealTimers();
    await drenarAvisos();

    const [resumo] = para(await telefoneDe(carteiro.id));
    expect(resumo).toBeDefined();
    expect(resumo.corpo.body).toContain('QB908301669BR');
    expect(resumo.corpo.body).toContain(guardada.texto);
    const [aviso] = para(destinatario);
    expect(aviso.corpo.body).toContain('Vamos seguir sua orientação');
    expect(aviso.corpo.body).toContain(guardada.texto);
  });

  it('E2E-003 vizinho pela mediação: caso aberto, fatos atualizados, desfecho → orientação ao carteiro', async () => {
    process.env.PROSIO_MEDIACAO_EXTENSOES = 'true';
    const s = await sessao({ mediacaoAtiva: true });
    const { carteiro, distrito } = await cadastrar(s);
    const hoje = hojeBrasilia();
    const destinatario = '+5561998120003';
    const { cargaId } = await carregar(s, distrito.id, hoje, [linha('AA123456785BR', '(61) 99812-0003')]);
    await liberarNoInstante(s, brasilia(hoje, '09:00'), cargaId);
    await drenarAvisos();

    const externalRef = `AA123456785BR@${formatarData(hoje)}`;
    const [abertura] = prosio.aberturasDeCaso();
    expect(abertura.corpo).toEqual(expect.objectContaining({ externalRef, recipientPhone: destinatario, resumo: 'Maria · QNA 12 Casa 45' }));
    const caseId = prosio.caseIdDe(externalRef)!;
    const pacoteId = para(destinatario)[0].corpo.reference as string;

    const pergunta = await tocar(s, 'CE_OP', `${pacoteId}.VIZINHO`, destinatario);
    expect(pergunta).toBe('Qual o nome do vizinho e o número da casa ou apartamento?');
    const [fatos] = prosio.atualizacoesDeFatos();
    expect(fatos.caminho).toBe(`/api/v1/mediation/cases/${caseId}/facts`);
    expect(fatos.corpo.motivoRelatado).toBe('entrega_indireta');

    const desfecho = await prosio.enviarCallbackDesfecho(urlWebhook(s), s.canal.callbackSecret, {
      caseId,
      externalRef,
      outcome: { motivo: 'entrega_indireta', condicao: { local: 'Dona Célia, casa 47' } },
    });
    expect(desfecho.status).toBe(204);

    const [orientacao] = para(await telefoneDe(carteiro.id));
    expect(orientacao.corpo.body).toContain('Deixar com Dona Célia, casa 47');
    expect(ids(orientacao).map((id) => id.split('.').pop())).toEqual(['VI', 'FEITO', 'NAO']);
    expect(ids(orientacao).every((id) => id.startsWith('CE_CT:'))).toBe(true);
  });

  it('E2E-004 descadastro: no dia seguinte a prévia mostra descadastrado e a liberação não avisa o telefone', async () => {
    const s = await sessao();
    const { distrito } = await cadastrar(s);
    const hoje = hojeBrasilia();
    const destinatario = '+5561998120004';
    const { cargaId } = await carregar(s, distrito.id, hoje, [linha('AA100000025BR', '(61) 99812-0004')]);
    await liberarNoInstante(s, brasilia(hoje, '09:00'), cargaId);
    await drenarAvisos();
    const [aviso] = para(destinatario);

    const optOut = await prosio.enviarCallbackStatus(urlWebhook(s), s.canal.callbackSecret, {
      messageId: prosio.messageIdDe(aviso)!,
      status: 'delivered',
      reference: aviso.corpo.reference,
      recipientOptOut: { optedOut: true, at: new Date().toISOString() },
    });
    expect(optOut.status).toBe(204);

    const amanha = somarDias(hoje, 1);
    prosio.redefinir();
    jest.useFakeTimers({ now: brasilia(amanha, '08:00'), doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    await relogar(s);
    const outro = '(61) 99812-0005';
    const planilha = [linha('AA100000025BR', '(61) 99812-0004'), { ...linha('AA100000140BR', outro, 'PEDRO'), n: 2 }];
    const segundo = await carregar(s, distrito.id, amanha, planilha);
    expect(segundo.previa.linhas.find((l: { codigo: string }) => l.codigo === 'AA100000025BR').descadastrado).toBe(true);
    const lib = await post(s, `/api/v1/entregas/cargas/${segundo.cargaId}/liberar`);
    expect(lib.status).toBe(202);
    expect(lib.body).toEqual(expect.objectContaining({ avisosAgendados: 1, descadastrados: 1 }));
    jest.useRealTimers();
    await drenarAvisos();

    expect(para(destinatario)).toHaveLength(0);
    expect(para('+5561998120005')).toHaveLength(1);
  });
});
