/**
 * Entrada do Prosio (ADR-014) e orientação manual, pela API real com os
 * servidores falsos: IT-033–IT-044, IT-046, IT-051, IT-064–IT-069.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import type { Carteiro, PacoteDia, PontoRetirada, Unidade, Usuario } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import { SeuRastreioFake } from '../../../__tests__/fakes/seu-rastreio.fake';
import {
  codigoS10,
  criarCanal,
  criarCarteiro,
  criarDistrito,
  criarGestor,
  criarPacote,
  criarSupervisor,
  criarUnidade,
  limparBanco,
  whatsappUnico,
  type CanalCriado,
} from '../../../__tests__/fixtures/entregas';
import { formatarData, hojeBrasilia, somarDias } from '../datas';
import { orientacaoService } from '../orientacao.service';
import { textosCarteiro, textosDestinatario } from '../textos';

let prosio: ProsioFake;
let rastreio: SeuRastreioFake;
let servidor: http.Server;
let base: string;

interface Cenario {
  canal: CanalCriado;
  unidade: Unidade;
  supervisor: Usuario;
  carteiro: Carteiro;
  distritoId: string;
  cargaId: string;
  pacotes: PacoteDia[];
  pontos: PontoRetirada[];
}

async function cenario(opcoes: {
  pacotes?: number;
  mediacaoAtiva?: boolean;
  pontos?: Array<['AGENCIA' | 'LOCKER', string]>;
  data?: Date;
  mesmoTelefone?: boolean;
} = {}): Promise<Cenario> {
  const data = opcoes.data ?? hojeBrasilia();
  const canal = await criarCanal({ baseUrl: prosio.url });
  const unidade = await criarUnidade({ canalProsioId: canal.canal.id, mediacaoAtiva: opcoes.mediacaoAtiva ?? false });
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  const carteiro = await criarCarteiro({ unidadeId: unidade.id });
  const distrito = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: carteiro.id });
  const carga = await prisma.cargaDistrito.create({
    data: { distritoId: distrito.id, data, status: 'EM_ENTREGA', carteiroId: carteiro.id, liberadoEm: new Date() },
  });
  const telefone = whatsappUnico();
  const pacotes: PacoteDia[] = [];
  for (let i = 0; i < (opcoes.pacotes ?? 1); i += 1) {
    pacotes.push(await criarPacote({ cargaId: carga.id, data, status: 'ENVIADO', ...(opcoes.mesmoTelefone ? { whatsappE164: telefone } : {}) }));
  }
  const pontos: PontoRetirada[] = [];
  for (const [tipo, nome] of opcoes.pontos ?? []) {
    pontos.push(await prisma.pontoRetirada.create({ data: { unidadeId: unidade.id, tipo, nome, endereco: `${nome}, QNA 30`, horario: '9h às 17h' } }));
  }
  return { canal, unidade, supervisor, carteiro, distritoId: distrito.id, cargaId: carga.id, pacotes, pontos };
}

const urlAcao = (c: Cenario, prefixo: string) => `${base}/api/v1/entregas/prosio/${c.canal.canal.id}/acao/${prefixo}`;
const urlWebhook = (c: Cenario) => `${base}/api/v1/entregas/prosio/${c.canal.canal.id}/webhook`;

async function tocar(c: Cenario, prefixo: string, acao: string, telefone: string): Promise<{ status: number; mensagem: string }> {
  const r = await prosio.acionarBotao(urlAcao(c, prefixo), { token: c.canal.tokenEntrada, acao, telefone });
  return { status: r.status, mensagem: (r.corpo as { mensagem?: string } | undefined)?.mensagem ?? '' };
}

const recarregar = (id: string) => prisma.pacoteDia.findUniqueOrThrow({ where: { id } });
const orientacoesDe = (pacoteId: string) => prisma.orientacao.findMany({ where: { pacoteId }, orderBy: { criadaEm: 'asc' } });
const paraCarteiro = (c: Cenario) => prosio.mensagens().filter((m) => m.corpo.to === c.carteiro.whatsappE164);
const paraDestinatario = (p: PacoteDia) => prosio.mensagens().filter((m) => m.corpo.to === p.whatsappE164);
const idsBotoes = (m: { corpo: { buttons?: Array<{ id: string }> } }) => (m.corpo.buttons ?? []).map((b) => b.id);
const brasilia = (dia: Date, hhmm: string) => new Date(`${formatarData(dia)}T${hhmm}:00.000-03:00`);

beforeAll(async () => {
  await limparBanco();
  prosio = await ProsioFake.iniciar();
  rastreio = await SeuRastreioFake.iniciar();
  process.env.SEU_RASTREIO_URL = rastreio.url;
  process.env.SEU_RASTREIO_TOKEN = 'token-rastreio-teste';
  servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((ok) => servidor.once('listening', () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

beforeEach(() => {
  prosio.redefinir();
  rastreio.redefinir();
  delete process.env.PROSIO_MEDIACAO_EXTENSOES;
});

afterAll(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
  await prosio.parar();
  await rastreio.parar();
  await limparBanco();
  await encerrarRecursos();
});

describe('Webhook do canal', () => {
  it('IT-033 status read assinado → 204 e LIDO; assinatura inválida → 401; repetido → sem novo evento', async () => {
    const c = await cenario();
    const p = c.pacotes[0];
    const payload = { messageId: 'msg_it033', status: 'read' as const, reference: p.id };

    const invalida = await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, payload, { assinatura: 'sha256=' + '0'.repeat(64) });
    expect(invalida.status).toBe(401);
    expect((await recarregar(p.id)).status).toBe('ENVIADO');

    expect((await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, payload)).status).toBe(204);
    expect((await recarregar(p.id)).status).toBe('LIDO');
    const eventos = await prisma.eventoPacote.count({ where: { pacoteId: p.id } });

    expect((await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, payload)).status).toBe(204);
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id } })).toBe(eventos);

    // Assinado com o segredo de outro canal → 401.
    const outro = await criarCanal();
    expect((await prosio.enviarCallbackStatus(urlWebhook(c), outro.callbackSecret, { ...payload, messageId: 'msg_x' })).status).toBe(401);
  });

  it('IT-034 recipientOptOut → DescadastroWhatsapp; a próxima prévia marca o telefone como descadastrado', async () => {
    const c = await cenario();
    const p = c.pacotes[0];
    const r = await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, {
      messageId: 'msg_it034',
      status: 'delivered',
      reference: p.id,
      recipientOptOut: { optedOut: true, at: new Date().toISOString() },
    });
    expect(r.status).toBe(204);
    expect(await prisma.descadastroWhatsapp.findUnique({ where: { whatsappE164: p.whatsappE164! } })).not.toBeNull();

    const previa = await request(app)
      .post(`/api/v1/entregas/cargas/${c.distritoId}/previa`)
      .set('Connection', 'close')
      .set(authHeader(c.supervisor))
      .send({ linhas: [{ n: 1, codigo: codigoS10(), nome: 'Maria Teste', whatsapp: p.whatsappE164 }] });
    expect(previa.status).toBe(200);
    expect(previa.body.linhas[0].descadastrado).toBe(true);
  });

  it('IT-051 corpo cru do webhook (204) e JSON do resto da API na mesma instância do app', async () => {
    const c = await cenario();
    expect((await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, { messageId: 'msg_it051', status: 'sent', reference: c.pacotes[0].id })).status).toBe(204);

    const gestor = await criarGestor();
    const r = await request(app)
      .post('/api/v1/gestao/unidades')
      .set('Connection', 'close')
      .set(authHeader(gestor))
      .send({ codigo: 'CDD-IT051', nome: 'x', tipo: 'CDD', logradouro: 'SQN 308', numero: '1', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70747090', latitude: -15.7, longitude: -47.8 });
    expect(r.status).toBe(400);
    // O corpo foi interpretado: o erro aponta só o campo `nome`, não "corpo ausente".
    const caminhos = (r.body.details as Array<{ path: string[] }>).map((d) => d.path.join('.'));
    expect(caminhos).toContain('nome');
    expect(caminhos).not.toContain('');
  });

  it('IT-043 mediation.outcome (entrega_indireta, com CPF) → VIZINHO ENVIADA sem o CPF e mensagem ao carteiro; repetido → sem efeito', async () => {
    const c = await cenario({ mediacaoAtiva: true });
    const p = await prisma.pacoteDia.update({ where: { id: c.pacotes[0].id }, data: { mediacaoCaseId: 'caso_it043' } });
    const dados = {
      caseId: 'caso_it043',
      externalRef: `${p.codigo}@${formatarData(p.data)}`,
      deliveryId: 'dlv_it043',
      outcome: { motivo: 'entrega_indireta' as const, condicao: { local: 'Dona Célia, casa 47, CPF 123.456.789-09' } },
    };
    expect((await prosio.enviarCallbackDesfecho(urlWebhook(c), c.canal.callbackSecret, dados)).status).toBe(204);

    const [o] = await orientacoesDe(p.id);
    expect(o).toEqual(expect.objectContaining({ tipo: 'VIZINHO', estado: 'ENVIADA', origem: 'MEDIACAO' }));
    expect(o.texto).toContain('Deixar com Dona Célia, casa 47');
    expect(o.texto).not.toContain('123.456');
    const msgs = paraCarteiro(c);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].corpo.body).toContain('Deixar com Dona Célia, casa 47');
    expect(idsBotoes(msgs[0])).toContain(`CE_CT:${o.id}.VI`);

    expect((await prosio.enviarCallbackDesfecho(urlWebhook(c), c.canal.callbackSecret, dados)).status).toBe(204);
    expect(await prisma.orientacao.count({ where: { pacoteId: p.id } })).toBe(1);
    expect(paraCarteiro(c)).toHaveLength(1);
  });

  it('IT-044 mediation.outcome de pacote ENTREGUE → sem orientação e evento desfecho_ignorado', async () => {
    const c = await cenario();
    const p = await prisma.pacoteDia.update({ where: { id: c.pacotes[0].id }, data: { status: 'ENTREGUE', mediacaoCaseId: 'caso_it044' } });
    const r = await prosio.enviarCallbackDesfecho(urlWebhook(c), c.canal.callbackSecret, {
      caseId: 'caso_it044',
      externalRef: `${p.codigo}@${formatarData(p.data)}`,
      outcome: { motivo: 'outro', condicao: { local: 'portaria' } },
    });
    expect(r.status).toBe(204);
    expect(await prisma.orientacao.count({ where: { pacoteId: p.id } })).toBe(0);
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'desfecho_ignorado' } })).toBe(1);
  });

  it('IT-065 mediation.escalated (R7) → escalonado e sinal no quadro; repetido → sem efeito', async () => {
    const c = await cenario({ mediacaoAtiva: true });
    const p = await prisma.pacoteDia.update({ where: { id: c.pacotes[0].id }, data: { mediacaoCaseId: 'caso_it065' } });
    const payload = { event: 'mediation.escalated', deliveryId: 'dlv_esc_it065', caseId: 'caso_it065', externalRef: `${p.codigo}@${formatarData(p.data)}`, motivo: 'nao_entendeu' };
    expect((await prosio.enviarCallback(urlWebhook(c), payload, c.canal.callbackSecret)).status).toBe(204);
    expect((await recarregar(p.id)).escalonado).toBe(true);

    const quadro = await request(app).get('/api/v1/entregas/quadro').set('Connection', 'close').set(authHeader(c.supervisor));
    expect(quadro.status).toBe(200);
    expect(quadro.body.distritos.find((d: { distritoId: string }) => d.distritoId === c.distritoId).escalonamentos).toBe(1);

    expect((await prosio.enviarCallback(urlWebhook(c), payload, c.canal.callbackSecret)).status).toBe(204);
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'escalonado' } })).toBe(1);
  });

  it('IT-066 caso expirado sem desfecho (nenhum callback) → o pacote segue sem orientação', async () => {
    const c = await cenario({ mediacaoAtiva: true });
    await prisma.pacoteDia.update({ where: { id: c.pacotes[0].id }, data: { mediacaoCaseId: 'caso_it066' } });
    const { processarRastreio } = await import('../rastreio.service');
    await processarRastreio({ agora: brasilia(hojeBrasilia(), '20:00'), varredura: true });
    expect(await prisma.orientacao.count({ where: { pacoteId: c.pacotes[0].id } })).toBe(0);
    expect((await recarregar(c.pacotes[0].id)).escalonado).toBe(false);
  });
});

describe('Ações de botão', () => {
  it('IT-035 sem Authorization → 401; com o token de outro canal → 401', async () => {
    const c = await cenario();
    const semToken = await fetch(urlAcao(c, 'CE_OP'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-phone': c.pacotes[0].whatsappE164!, connection: 'close' },
      body: JSON.stringify({ acao: `${c.pacotes[0].id}.AMANHA` }),
    });
    expect(semToken.status).toBe(401);
    const outro = await criarCanal();
    const r = await prosio.acionarBotao(urlAcao(c, 'CE_OP'), { token: outro.tokenEntrada, acao: `${c.pacotes[0].id}.AMANHA`, telefone: c.pacotes[0].whatsappE164! });
    expect(r.status).toBe(401);
    expect(await prisma.orientacao.count({ where: { pacoteId: c.pacotes[0].id } })).toBe(0);
  });

  it('IT-036 CE_OP AMANHA numa quinta → "sexta-feira (02/10)", GUARDADA, carteiro "Não tentar hoje" e INTERAGINDO', async () => {
    jest.useFakeTimers({
      now: new Date('2026-10-01T13:00:00.000Z'),
      doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    try {
      const c = await cenario({ data: new Date('2026-10-01T00:00:00.000Z') });
      const p = c.pacotes[0];
      const r = await tocar(c, 'CE_OP', `${p.id}.AMANHA`, p.whatsappE164!);
      expect(r.status).toBe(200);
      expect(r.mensagem).toContain('sexta-feira (02/10)');
      const [o] = await orientacoesDe(p.id);
      expect(o).toEqual(expect.objectContaining({ tipo: 'AMANHA', estado: 'GUARDADA' }));
      expect(formatarData(o.valeAPartirDe!)).toBe('2026-10-02');
      const msgs = paraCarteiro(c);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].corpo.body).toContain(`Não tentar hoje: ${p.codigo}`);
      expect((await recarregar(p.id)).status).toBe('INTERAGINDO');

      // US-013.EC-1: a mesma escolha de novo não gera nova orientação.
      const de2 = await tocar(c, 'CE_OP', `${p.id}.AMANHA`, p.whatsappE164!);
      expect(de2.mensagem).toContain('sexta-feira (02/10)');
      expect(await prisma.orientacao.count({ where: { pacoteId: p.id } })).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('IT-037 AGENCIA → sub-lista CE_PT; CE_PT → ENVIADA e carteiro; ponto desativado depois → pontoDesativado; CE_PT inativo → sub-lista reenviada', async () => {
    const c = await cenario({ pacotes: 2, pontos: [['AGENCIA', 'AC Centro'], ['AGENCIA', 'AC Norte'], ['LOCKER', 'Locker 1']] });
    const [p1, p2] = c.pacotes;
    const [acCentro, acNorte] = c.pontos;

    const r = await tocar(c, 'CE_OP', `${p1.id}.AGENCIA`, p1.whatsappE164!);
    expect(r.status).toBe(200);
    const sub = paraDestinatario(p1);
    expect(sub).toHaveLength(1);
    expect(idsBotoes(sub[0]).sort()).toEqual([`CE_PT:${p1.id}.${acCentro.id}`, `CE_PT:${p1.id}.${acNorte.id}`].sort());

    const escolha = await tocar(c, 'CE_PT', `${p1.id}.${acCentro.id}`, p1.whatsappE164!);
    expect(escolha.mensagem).toContain('AC Centro');
    expect(escolha.mensagem).toContain('9h às 17h');
    const [o] = await orientacoesDe(p1.id);
    expect(o).toEqual(expect.objectContaining({ tipo: 'AGENCIA', estado: 'ENVIADA', pontoRetiradaId: acCentro.id }));
    expect(paraCarteiro(c)).toHaveLength(1);

    await prisma.pontoRetirada.update({ where: { id: acCentro.id }, data: { ativo: false } });
    const lista = await request(app).get(`/api/v1/entregas/cargas/${c.cargaId}/pacotes`).set('Connection', 'close').set(authHeader(c.supervisor));
    const linha = lista.body.pacotes.find((x: { id: string }) => x.id === p1.id);
    expect(linha.orientacaoVigente).toEqual(expect.objectContaining({ id: o.id, pontoDesativado: true, pontoRetiradaId: acCentro.id }));

    const inativo = await tocar(c, 'CE_PT', `${p2.id}.${acCentro.id}`, p2.whatsappE164!);
    expect(inativo.mensagem).toContain('Essa agência não está mais disponível');
    const reenviada = paraDestinatario(p2);
    expect(reenviada).toHaveLength(1);
    expect(idsBotoes(reenviada[0])).toEqual([`CE_PT:${p2.id}.${acNorte.id}`]);
    expect(await prisma.orientacao.count({ where: { pacoteId: p2.id } })).toBe(0);
  });

  it('IT-038 x-actor-phone diferente do pacote → mensagem neutra, sem orientação', async () => {
    const c = await cenario({ pontos: [['AGENCIA', 'AC Centro']] });
    const p = c.pacotes[0];
    for (const [prefixo, acao] of [['CE_OP', `${p.id}.AMANHA`], ['CE_PT', `${p.id}.${c.pontos[0].id}`]]) {
      const r = await tocar(c, prefixo, acao, '+5561988880000');
      expect(r).toEqual({ status: 200, mensagem: textosDestinatario.neutra });
    }
    expect(await prisma.orientacao.count({ where: { pacoteId: p.id } })).toBe(0);
    expect(prosio.mensagens()).toHaveLength(0);
    expect((await recarregar(p.id)).status).toBe('ENVIADO');
  });

  it('IT-039 CE_OP AGENCIA duas vezes → uma única sub-lista', async () => {
    const c = await cenario({ pontos: [['AGENCIA', 'AC Centro'], ['AGENCIA', 'AC Norte']] });
    const p = c.pacotes[0];
    await tocar(c, 'CE_OP', `${p.id}.AGENCIA`, p.whatsappE164!);
    await tocar(c, 'CE_OP', `${p.id}.AGENCIA`, p.whatsappE164!);
    expect(paraDestinatario(p)).toHaveLength(1);
  });

  it('IT-040 resposta tardia: CE_SN; SIM → GUARDADA sem carteiro; NAO → nada; rastreio esgotado + NAO_ATENDEU → mesmo fluxo', async () => {
    const hoje = hojeBrasilia();
    const c = await cenario({ pacotes: 3 });
    const [a, b, t] = c.pacotes;
    for (const p of [a, b]) rastreio.definirEvento(p.codigo, 'Carteiro não atendido', { data: brasilia(hoje, '11:20').toISOString() });

    const ra = await tocar(c, 'CE_OP', `${a.id}.AMANHA`, a.whatsappE164!);
    expect(ra.mensagem).toMatch(/^Hoje já tentamos entregar às 11h20, sem sucesso\./);
    const confirmar = paraDestinatario(a).at(-1)!;
    const [sim, nao] = idsBotoes(confirmar);
    expect(sim).toMatch(/^CE_SN:[0-9a-f-]{36}\.SIM$/);
    expect(nao).toBe(sim.replace('.SIM', '.NAO'));
    const sa = await tocar(c, 'CE_SN', sim.slice('CE_SN:'.length), a.whatsappE164!);
    expect(sa.status).toBe(200);
    const [oa] = await orientacoesDe(a.id);
    expect(oa).toEqual(expect.objectContaining({ estado: 'GUARDADA', tipo: 'AMANHA' }));
    expect(paraCarteiro(c)).toHaveLength(0);

    await tocar(c, 'CE_OP', `${b.id}.AMANHA`, b.whatsappE164!);
    const naoB = idsBotoes(paraDestinatario(b).at(-1)!)[1];
    const rb = await tocar(c, 'CE_SN', naoB.slice('CE_SN:'.length), b.whatsappE164!);
    expect(rb.mensagem).toBe(textosDestinatario.negouConfirmacao);
    expect(await prisma.orientacao.count({ where: { pacoteId: b.id } })).toBe(0);

    // Rastreio em tempo esgotado + última resposta do carteiro NAO_ATENDEU hoje.
    rastreio.definirResposta(t.codigo, { status: 200, corpo: { status: 'x', eventoMaisRecente: null }, atrasoMs: 3_500 });
    await prisma.orientacao.create({
      data: { codigo: t.codigo, pacoteId: t.id, tipo: 'OUTRA', texto: 'Deixar na portaria', estado: 'NAO_FOI_POSSIVEL', origem: 'BOTAO', respostaCarteiro: 'NAO_ATENDEU', respondidoEm: brasilia(hoje, '11:20') },
    });
    const inicio = Date.now();
    const rt = await tocar(c, 'CE_OP', `${t.id}.AMANHA`, t.whatsappE164!);
    expect(Date.now() - inicio).toBeLessThan(4_000);
    expect(rt.mensagem).toMatch(/^Hoje já tentamos entregar às 11h20, sem sucesso\./);
    expect(idsBotoes(paraDestinatario(t).at(-1)!)[0]).toMatch(/^CE_SN:.*\.SIM$/);
  }, 20_000);

  it('IT-041 VIZINHO: com mediação → fatos do caso e a pergunta; sem a extensão (501) ou sem mediação → atendimento humano e escalonado', async () => {
    const c = await cenario({ mediacaoAtiva: true, pacotes: 2 });
    const [p, q] = await Promise.all(c.pacotes.map((x, i) => prisma.pacoteDia.update({ where: { id: x.id }, data: { mediacaoCaseId: `caso_it041_${i}` } })));

    process.env.PROSIO_MEDIACAO_EXTENSOES = 'true';
    const r = await tocar(c, 'CE_OP', `${p.id}.VIZINHO`, p.whatsappE164!);
    expect(r.mensagem).toBe('Qual o nome do vizinho e o número da casa ou apartamento?');
    const [fatos] = prosio.atualizacoesDeFatos();
    expect(fatos.caminho).toBe('/api/v1/mediation/cases/caso_it041_0/facts');
    expect(fatos.corpo).toEqual({ motivoRelatado: 'entrega_indireta', perguntaAberta: 'Qual o nome do vizinho e o número da casa ou apartamento?' });
    expect((await recarregar(p.id)).escalonado).toBe(false);

    // O Prosio real ainda não tem a rota de fatos (R2): sem a extensão, o cliente recusa com 501 → atendimento humano.
    delete process.env.PROSIO_MEDIACAO_EXTENSOES;
    const r2 = await tocar(c, 'CE_OP', `${q.id}.OUTRA`, q.whatsappE164!);
    expect(r2.mensagem).toBe(textosDestinatario.atendimentoHumano);
    expect((await recarregar(q.id)).escalonado).toBe(true);
    expect(prosio.atualizacoesDeFatos()).toHaveLength(1);

    const semMediacao = await cenario();
    const s = semMediacao.pacotes[0];
    const r3 = await tocar(semMediacao, 'CE_OP', `${s.id}.VIZINHO`, s.whatsappE164!);
    expect(r3.mensagem).toBe(textosDestinatario.atendimentoHumano);
    expect((await recarregar(s.id)).escalonado).toBe(true);
    expect(await prisma.orientacao.count({ where: { pacoteId: { in: [p.id, q.id, s.id] } } })).toBe(0);
  });

  it('IT-042 CE_CT: VI → VISTA → FEITA; FEITO repetido sem evento; NAO → motivos; FECHADO em LOCKER → destinatário e escalonado; outro número → sem efeito', async () => {
    const c = await cenario({ pacotes: 2, pontos: [['LOCKER', 'Locker Shopping']] });
    const [p, q] = c.pacotes;
    const tel = c.carteiro.whatsappE164!;
    const o = await orientacaoService.registrar({ pacoteId: p.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });

    expect((await tocar(c, 'CE_CT', `${o.id}.VI`, '+5561977776666')).mensagem).toBe(textosCarteiro.neutra);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } })).estado).toBe('ENVIADA');

    expect((await tocar(c, 'CE_CT', `${o.id}.VI`, tel)).mensagem).toBe(textosCarteiro.vista);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } })).estado).toBe('VISTA');
    expect((await tocar(c, 'CE_CT', `${o.id}.FEITO`, tel)).mensagem).toBe(textosCarteiro.feita);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } })).estado).toBe('FEITA');
    await tocar(c, 'CE_CT', `${o.id}.FEITO`, tel);
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'resposta_carteiro' } })).toBe(2);

    const locker = await orientacaoService.registrar({ pacoteId: q.id, tipo: 'LOCKER', texto: 'Deixar no locker Locker Shopping', pontoRetiradaId: c.pontos[0].id, origem: 'BOTAO' });
    expect((await tocar(c, 'CE_CT', `${locker.id}.NAO`, tel)).mensagem).toBe(textosCarteiro.perguntaMotivo);
    expect(idsBotoes(paraCarteiro(c).at(-1)!)).toContain(`CE_CT:${locker.id}.FECHADO`);
    await tocar(c, 'CE_CT', `${locker.id}.FECHADO`, tel);
    expect(paraDestinatario(q).at(-1)!.corpo.body).toContain('seguirá para a unidade');
    expect((await recarregar(q.id)).escalonado).toBe(true);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: locker.id } })).respostaCarteiro).toBe('FECHADO');
  });

  it('IT-064 AMANHA com 2 cargas anteriores em INSUCESSO → "disponível na unidade", escalonado, sem orientação', async () => {
    const hoje = hojeBrasilia();
    const c = await cenario();
    const p = c.pacotes[0];
    for (const dias of [1, 2]) {
      const data = somarDias(hoje, -dias);
      const carga = await prisma.cargaDistrito.create({ data: { distritoId: c.distritoId, data, status: 'CONCLUIDO', carteiroId: c.carteiro.id } });
      await criarPacote({ cargaId: carga.id, data, codigo: p.codigo, status: 'INSUCESSO' });
    }
    const r = await tocar(c, 'CE_OP', `${p.id}.AMANHA`, p.whatsappE164!);
    expect(r.mensagem).toContain('disponível na unidade');
    expect((await recarregar(p.id)).escalonado).toBe(true);
    expect(await prisma.orientacao.count({ where: { codigo: p.codigo } })).toBe(0);
  });

  it('IT-067 uma só agência → confirmação CE_SN com o nome; SIM → orientação AGENCIA', async () => {
    const c = await cenario({ pontos: [['AGENCIA', 'AC Única']] });
    const p = c.pacotes[0];
    await tocar(c, 'CE_OP', `${p.id}.AGENCIA`, p.whatsappE164!);
    const conf = paraDestinatario(p);
    expect(conf).toHaveLength(1);
    expect(conf[0].corpo.body).toContain('AC Única');
    const [sim] = idsBotoes(conf[0]);
    expect(sim).toMatch(/^CE_SN:.*\.SIM$/);

    const r = await tocar(c, 'CE_SN', sim.slice('CE_SN:'.length), p.whatsappE164!);
    expect(r.mensagem).toContain('AC Única');
    const vigentes = await prisma.orientacao.findMany({ where: { pacoteId: p.id } });
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0]).toEqual(expect.objectContaining({ tipo: 'AGENCIA', estado: 'ENVIADA', pontoRetiradaId: c.pontos[0].id }));
    expect(paraCarteiro(c)).toHaveLength(1);
  });

  it('IT-068 linha de sub-lista antiga vale para a encomenda dela', async () => {
    const c = await cenario({ pacotes: 2, mesmoTelefone: true, pontos: [['AGENCIA', 'AC Centro'], ['AGENCIA', 'AC Norte']] });
    const [a, b] = c.pacotes;
    const tel = a.whatsappE164!;
    await tocar(c, 'CE_OP', `${a.id}.AGENCIA`, tel);
    await tocar(c, 'CE_OP', `${b.id}.AGENCIA`, tel);
    expect(prosio.mensagens()).toHaveLength(2);
    const linhaDeA = idsBotoes(prosio.mensagens()[0]).find((id) => id.endsWith(c.pontos[1].id))!;
    await tocar(c, 'CE_PT', linhaDeA.slice('CE_PT:'.length), tel);
    expect(await prisma.orientacao.count({ where: { pacoteId: a.id } })).toBe(1);
    expect(await prisma.orientacao.count({ where: { pacoteId: b.id } })).toBe(0);
  });

  it('IT-069 três orientações confirmadas em sequência → três mensagens ao carteiro, na ordem', async () => {
    const c = await cenario({ pacotes: 3, pontos: [['AGENCIA', 'AC Centro'], ['AGENCIA', 'AC Norte']] });
    for (const p of c.pacotes) await tocar(c, 'CE_PT', `${p.id}.${c.pontos[0].id}`, p.whatsappE164!);
    const ordem = (await prisma.orientacao.findMany({ where: { pacoteId: { in: c.pacotes.map((p) => p.id) } }, orderBy: { criadaEm: 'asc' } })).map((o) => `o:${o.id}`);
    expect(ordem).toHaveLength(3);
    expect(paraCarteiro(c).map((m) => m.corpo.reference)).toEqual(ordem);
  });
});

describe('Orientação manual (US-026)', () => {
  const postar = (c: Cenario, pacoteId: string, corpo: unknown) =>
    request(app).post(`/api/v1/entregas/pacotes/${pacoteId}/orientacao`).set('Connection', 'close').set(authHeader(c.supervisor)).send(corpo as object);

  it('IT-046 201 e mensagem ao carteiro; ENTREGUE → 409; 301 caracteres → 400; simultâneas → a mais recente vale', async () => {
    const c = await cenario({ pacotes: 3 });
    const [p, entregue, q] = c.pacotes;

    const r = await postar(c, p.id, { texto: 'Deixar na portaria', valeParaAmanha: false });
    expect(r.status).toBe(201);
    expect(r.body.data).toEqual(expect.objectContaining({ tipo: 'MANUAL', origem: 'SUPERVISOR', estado: 'ENVIADA', criadaPorId: c.supervisor.id }));
    expect(paraCarteiro(c)).toHaveLength(1);

    await prisma.pacoteDia.update({ where: { id: entregue.id }, data: { status: 'ENTREGUE' } });
    expect((await postar(c, entregue.id, { texto: 'Deixar na portaria' })).status).toBe(409);
    const longa = await postar(c, q.id, { texto: 'x'.repeat(301) });
    expect(longa.status).toBe(400);
    expect(longa.body.error).toBe('orientacao_longa');

    const [r1, r2] = await Promise.all([postar(c, q.id, { texto: 'Primeira' }), postar(c, q.id, { texto: 'Segunda' })]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const todas = await prisma.orientacao.findMany({ where: { pacoteId: q.id }, orderBy: { criadaEm: 'asc' } });
    expect(todas).toHaveLength(2);
    expect(todas.map((o) => o.estado)).toEqual(['SUBSTITUIDA', 'ENVIADA']);

    // Outra unidade → 404.
    const outra = await cenario();
    expect((await request(app).post(`/api/v1/entregas/pacotes/${outra.pacotes[0].id}/orientacao`).set('Connection', 'close').set(authHeader(c.supervisor)).send({ texto: 'x' })).status).toBe(404);
  });
});
