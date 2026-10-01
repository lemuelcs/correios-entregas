/**
 * Liberação do distrito, AvisoWorker, resumo ao carteiro, casos de mediação e
 * ganchos, pela API real com o Prosio falso e o worker real da fila:
 * IT-014, IT-024–IT-032, IT-054, IT-055, IT-057, IT-070–IT-073.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import type { Carteiro, CargaDistrito, Distrito, PacoteDia, Unidade, Usuario } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import {
  aguardar,
  brasilia,
  drenarAvisos,
  entregasAvisoQueue,
  esvaziarFilaAviso,
  noInstante,
} from '../../../__tests__/helpers/avisos';
import {
  codigoS10,
  criarCanal,
  criarCarteiro,
  criarDistrito,
  criarPacote,
  criarSupervisor,
  criarUnidade,
  limparBanco,
  whatsappUnico,
  type CanalCriado,
} from '../../../__tests__/fixtures/entregas';
import { formatarData, hojeBrasilia, somarDias } from '../datas';
import { liberacaoService } from '../liberacao.service';
import { startEntregasAvisoWorker, stopEntregasAvisoWorker } from '../../../workers/entregas-aviso.worker';

let prosio: ProsioFake;
let servidor: http.Server;
let base: string;

interface Cenario {
  canal: CanalCriado;
  unidade: Unidade;
  supervisor: Usuario;
  carteiro: Carteiro;
  distrito: Distrito;
  carga: CargaDistrito;
  pacotes: PacoteDia[];
  semWhatsapp: PacoteDia[];
}

async function cenario(opcoes: {
  pacotes?: number;
  semWhatsapp?: number;
  mediacaoAtiva?: boolean;
  pontos?: Array<'AGENCIA' | 'LOCKER'>;
  carteiroSemWhatsapp?: boolean;
  semCarteiro?: boolean;
  mesmoTelefone?: boolean;
  data?: Date;
} = {}): Promise<Cenario> {
  const data = opcoes.data ?? hojeBrasilia();
  const canal = await criarCanal({ baseUrl: prosio.url });
  const unidade = await criarUnidade({ canalProsioId: canal.canal.id, mediacaoAtiva: opcoes.mediacaoAtiva ?? false });
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  const carteiro = await criarCarteiro({ unidadeId: unidade.id, ...(opcoes.carteiroSemWhatsapp ? { whatsappE164: null } : {}) });
  const distrito = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: opcoes.semCarteiro ? null : carteiro.id });
  const carga = await prisma.cargaDistrito.create({ data: { distritoId: distrito.id, data } });
  const telefone = whatsappUnico();
  const pacotes: PacoteDia[] = [];
  for (let i = 0; i < (opcoes.pacotes ?? 3); i += 1) {
    pacotes.push(await criarPacote({ cargaId: carga.id, data, ...(opcoes.mesmoTelefone ? { whatsappE164: telefone } : {}) }));
  }
  const semWhatsapp: PacoteDia[] = [];
  for (let i = 0; i < (opcoes.semWhatsapp ?? 0); i += 1) semWhatsapp.push(await criarPacote({ cargaId: carga.id, data, whatsappE164: null }));
  for (const tipo of opcoes.pontos ?? []) {
    await prisma.pontoRetirada.create({ data: { unidadeId: unidade.id, tipo, nome: `${tipo} 1`, endereco: 'QNA 30', horario: '9h às 17h' } });
  }
  return { canal, unidade, supervisor, carteiro, distrito, carga, pacotes, semWhatsapp };
}

const api = () => request(base);

/** Roda `fn` com o relógio de Brasília parado em `instante` (só `Date`). */
const comRelogio = noInstante;

/** `POST liberar` com o relógio de Brasília em `hhmm` do dia da carga. */
function liberar(c: Cenario, corpo: Record<string, unknown> = {}, hhmm = '10:00', carga: CargaDistrito = c.carga) {
  return comRelogio(brasilia(carga.data, hhmm), async () =>
    api().post(`/api/v1/entregas/cargas/${carga.id}/liberar`).set('Connection', 'close').set(authHeader(c.supervisor)).send(corpo),
  );
}

const urlWebhook = (c: Cenario) => `${base}/api/v1/entregas/prosio/${c.canal.canal.id}/webhook`;
const recarregar = (id: string) => prisma.pacoteDia.findUniqueOrThrow({ where: { id } });
const avisos = () => prosio.mensagens().filter((m) => String(m.corpo.idempotencyKey ?? '').startsWith('aviso:'));
const paraCarteiro = (c: Cenario | Carteiro) => {
  const tel = 'carteiro' in c ? c.carteiro.whatsappE164 : c.whatsappE164;
  return prosio.mensagens().filter((m) => m.corpo.to === tel);
};

async function guardada(p: PacoteDia, texto: string) {
  return prisma.orientacao.create({
    data: { codigo: p.codigo, pacoteId: p.id, tipo: 'VIZINHO', texto, estado: 'GUARDADA', origem: 'BOTAO', valeAPartirDe: p.data, criadaEm: new Date() },
  });
}

beforeAll(async () => {
  process.env.ENTREGAS_AVISO_BACKOFF_MS = '5';
  process.env.ENTREGAS_AVISO_LIMITE_MIN = '1000';
  await limparBanco();
  await entregasAvisoQueue.obliterate({ force: true });
  prosio = await ProsioFake.iniciar();
  servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((ok) => servidor.once('listening', () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  startEntregasAvisoWorker();
});

beforeEach(async () => {
  await esvaziarFilaAviso();
  prosio.redefinir();
  prosio.primeiroContato = 'queued';
  delete process.env.PROSIO_MEDIACAO_EXTENSOES;
  process.env.ENTREGAS_AVISO_LIMITE_MIN = '1000';
});

afterAll(async () => {
  await stopEntregasAvisoWorker();
  await new Promise<void>((ok) => servidor.close(() => ok()));
  await prosio.parar();
  await limparBanco();
  await encerrarRecursos();
});

describe('Liberação e envio', () => {
  it('IT-024 3 com WhatsApp (mesmo destinatário), 1 sem, sem agência → 3 avisos com botões sem AGENCIA', async () => {
    const c = await cenario({ pacotes: 3, semWhatsapp: 1, mesmoTelefone: true, pontos: ['LOCKER'] });
    const r = await liberar(c);
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ avisosAgendados: 3, semWhatsapp: 1, descadastrados: 0 });

    await drenarAvisos();
    const msgs = avisos();
    expect(msgs).toHaveLength(3);
    for (const p of c.pacotes) {
      const m = msgs.find((x) => x.corpo.reference === p.id)!;
      expect(m).toBeDefined();
      expect(m.headers['idempotency-key']).toBe(`aviso:${p.id}`);
      expect(m.corpo.to).toBe(p.whatsappE164);
      expect(m.corpo.body).toContain(`sua encomenda ${p.codigo} já saiu para entrega`);
      expect(m.corpo.buttons.map((b: { id: string }) => b.id)).toEqual(
        ['AMANHA', 'VIZINHO', 'LOCKER', 'OUTRA'].map((o) => `CE_OP:${p.id}.${o}`),
      );
      const atual = await recarregar(p.id);
      expect(atual.status).toBe('AGENDADO');
      expect(atual.prosioMessageId).toBe(prosio.messageIdDe(m));
    }
    expect((await recarregar(c.semWhatsapp[0].id)).status).toBe('SEM_WHATSAPP');
    const carga = await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: c.carga.id } });
    expect(carga).toEqual(expect.objectContaining({ status: 'LIBERADO', carteiroId: c.carteiro.id, liberadoPorId: c.supervisor.id }));
    expect(carga.liberadoEm).not.toBeNull();

    // US-012.EC-5: sem resposta, nada mais sai.
    await new Promise((ok) => setTimeout(ok, 300));
    expect(prosio.mensagens()).toHaveLength(3);
  });

  it('IT-025 liberar duas vezes (e em paralelo) → 3 mensagens, não 6', async () => {
    const c = await cenario({ pacotes: 3 });
    expect((await liberar(c)).status).toBe(202);
    const de2 = await liberar(c);
    expect(de2.status).toBe(202);
    expect(de2.body).toEqual(expect.objectContaining({ avisosAgendados: 0, jaLiberada: true }));
    await drenarAvisos();
    expect(avisos()).toHaveLength(3);

    prosio.redefinir();
    const d = await cenario({ pacotes: 3 });
    const [a, b] = await Promise.all([liberar(d), liberar(d)]);
    expect([a.status, b.status]).toEqual([202, 202]);
    expect(a.body.avisosAgendados + b.body.avisosAgendados).toBe(3);
    await drenarAvisos();
    expect(avisos()).toHaveLength(3);
  });

  it('IT-026 sem carteiro → 409 sem_carteiro; sem pacotes → 409 carga_vazia', async () => {
    const semCarteiro = await cenario({ semCarteiro: true });
    const r1 = await liberar(semCarteiro);
    expect(r1.status).toBe(409);
    expect(r1.body.error).toBe('sem_carteiro');

    // Carteiro padrão desativado também não libera.
    const inativo = await cenario();
    await prisma.carteiro.update({ where: { id: inativo.carteiro.id }, data: { ativo: false } });
    expect((await liberar(inativo)).body.error).toBe('sem_carteiro');

    const vazia = await cenario({ pacotes: 0 });
    const r2 = await liberar(vazia);
    expect(r2.status).toBe(409);
    expect(r2.body.error).toBe('carga_vazia');
    expect(prosio.requisicoes).toHaveLength(0);
    expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: vazia.carga.id } })).status).toBe('CARREGADO');
  });

  it('IT-027 às 03:00 → AGENDADO e nada enviado; às 06:05 → envios feitos', async () => {
    // Carga de amanhã: o horário agendado fica no futuro também para o relógio real do Redis.
    const c = await cenario({ pacotes: 3, data: somarDias(hojeBrasilia(), 1) });
    const r = await liberar(c, {}, '03:00');
    expect(r.status).toBe(202);
    expect(r.body.agendadoPara).toBe(brasilia(c.carga.data, '06:05').toISOString());
    for (const p of c.pacotes) expect((await recarregar(p.id)).status).toBe('AGENDADO');

    await new Promise((ok) => setTimeout(ok, 300));
    expect(prosio.mensagens()).toHaveLength(0);
    const atrasados = await entregasAvisoQueue.getDelayed();
    const daCarga = atrasados.filter((j) => c.pacotes.some((p) => p.id === (j.data as { pacoteId?: string }).pacoteId));
    expect(daCarga).toHaveLength(3);
    for (const j of daCarga) expect(j.opts.delay).toBe((3 * 60 + 5) * 60_000);

    // O relógio chega às 06:05: os jobs atrasados vencem.
    for (const j of daCarga) await j.promote();
    await drenarAvisos();
    expect(avisos()).toHaveLength(3);
  });

  it('IT-028 callback failed daily_cap → NAO_ENVIADO limite_canal e reenvio em 30 min; às 20h01 não reagenda', async () => {
    const c = await cenario({ pacotes: 1, data: somarDias(hojeBrasilia(), 1) });
    const p = c.pacotes[0];
    await liberar(c);
    await drenarAvisos();
    const [aviso] = avisos();
    const messageId = prosio.messageIdDe(aviso)!;

    const cb = await comRelogio(brasilia(c.carga.data, '10:05'), () =>
      prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, { messageId, status: 'failed', reference: p.id, failureReason: 'daily_cap' }),
    );
    expect(cb.status).toBe(204);
    const falhou = await recarregar(p.id);
    expect(falhou).toEqual(expect.objectContaining({ status: 'NAO_ENVIADO', naoEnviadoMotivo: 'limite_canal' }));
    const reenvio = await entregasAvisoQueue.getJob(`aviso_${p.id}_r1`);
    expect(reenvio).toBeDefined();
    expect(await reenvio!.getState()).toBe('delayed');
    expect(reenvio!.opts.delay).toBe(30 * 60_000);
    expect(reenvio!.data).toEqual({ pacoteId: p.id, reenvio: 1 });

    // O reenvio (às 10:35) usa uma Idempotency-Key própria.
    await reenvio!.remove();
    expect(await comRelogio(brasilia(c.carga.data, '10:35'), () => liberacaoService.enviarAviso({ pacoteId: p.id, reenvio: 1 }))).toBe('enviado');
    const ultimo = avisos().at(-1)!;
    expect(ultimo.headers['idempotency-key']).toBe(`aviso:${p.id}:r1`);

    // Nova recusa às 20h01: não reagenda.
    const cb2 = await comRelogio(brasilia(c.carga.data, '20:01'), () =>
      prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, { messageId: prosio.messageIdDe(ultimo)!, status: 'failed', reference: p.id, failureReason: 'daily_cap' }),
    );
    expect(cb2.status).toBe(204);
    expect(await entregasAvisoQueue.getJob(`aviso_${p.id}_r2`)).toBeUndefined();
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'reenvio_encerrado' } })).toBe(1);
    expect((await recarregar(p.id)).naoEnviadoMotivo).toBe('limite_canal');
  });

  it('IT-029 Prosio 500 em todas as tentativas → 5 tentativas e NAO_ENVIADO falha_envio', async () => {
    const c = await cenario({ pacotes: 1 });
    const p = c.pacotes[0];
    prosio.roteirizar('POST', '/api/v1/messages', { status: 500, corpo: { error: 'Internal' } });
    await liberar(c);
    await aguardar(async () => (await recarregar(p.id)).status === 'NAO_ENVIADO', { descricao: 'NAO_ENVIADO' });
    expect((await recarregar(p.id)).naoEnviadoMotivo).toBe('falha_envio');
    expect(prosio.mensagens()).toHaveLength(5);
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'aviso_falhou' } })).toBe(1);
  });

  it('IT-030 telefone descadastrado → nenhum envio; pacote sinalizado descadastrado', async () => {
    const c = await cenario({ pacotes: 2 });
    const [desc, ok] = c.pacotes;
    await prisma.descadastroWhatsapp.create({ data: { whatsappE164: desc.whatsappE164! } });
    const r = await liberar(c);
    expect(r.body).toEqual(expect.objectContaining({ avisosAgendados: 1, descadastrados: 1 }));
    await drenarAvisos();
    expect(prosio.mensagens().map((m) => m.corpo.to)).toEqual([ok.whatsappE164]);
    const d = await recarregar(desc.id);
    expect(d.sinais).toContain('descadastrado');
    expect(d).toEqual(expect.objectContaining({ status: 'NAO_ENVIADO', naoEnviadoMotivo: 'descadastrado' }));

    // Descadastrado depois de agendado: o worker confere de novo antes de enviar.
    const e = await cenario({ pacotes: 1 });
    await prisma.cargaDistrito.update({ where: { id: e.carga.id }, data: { status: 'LIBERADO', carteiroId: e.carteiro.id } });
    await prisma.pacoteDia.update({ where: { id: e.pacotes[0].id }, data: { status: 'AGENDADO' } });
    await prisma.descadastroWhatsapp.create({ data: { whatsappE164: e.pacotes[0].whatsappE164! } });
    expect(await liberacaoService.enviarAviso({ pacoteId: e.pacotes[0].id })).toBe('descadastrado');
    expect(prosio.mensagens()).toHaveLength(1);
    expect((await recarregar(e.pacotes[0].id)).sinais).toContain('descadastrado');
  });

  it('IT-031 confirmar numa carga liberada com 2 pacotes novos com WhatsApp → 2 avisos na hora', async () => {
    const c = await cenario({ pacotes: 1 });
    await liberar(c);
    await drenarAvisos();
    expect(avisos()).toHaveLength(1);

    const novos = [1, 2].map((n) => ({
      n, codigo: codigoS10(), nome: `Pessoa ${n}`, whatsapp: whatsappUnico(), logradouro: 'QNA 12', numero: String(n), bairro: 'Taguatinga', cidade: 'Brasília', uf: 'DF', cep: '72110120',
    }));
    const r = await api().post(`/api/v1/entregas/cargas/${c.distrito.id}/confirmar`).set('Connection', 'close').set(authHeader(c.supervisor))
      .send({ data: formatarData(c.carga.data), linhas: novos });
    expect(r.status).toBe(200);
    expect(r.body).toEqual(expect.objectContaining({ aceitos: 2, avisadosNaHora: 2 }));
    await drenarAvisos();
    expect(avisos()).toHaveLength(3);
    expect(avisos().slice(1).map((m) => m.corpo.to).sort()).toEqual(novos.map((n) => n.whatsapp).sort());

    // O gancho é idempotente: chamar de novo não reenvia.
    const ids = (await prisma.pacoteDia.findMany({ where: { cargaId: c.carga.id }, select: { id: true } })).map((p) => p.id);
    expect(await liberacaoService.agendarAvisos(ids)).toEqual({ agendados: 0, agendadoPara: null });
    await drenarAvisos();
    expect(avisos()).toHaveLength(3);
  });

  it('IT-032 PATCH {whatsapp} em pacote SEM_WHATSAPP de carga liberada → 1 aviso; AGENDADO, depois ENVIADO', async () => {
    const c = await cenario({ pacotes: 1, semWhatsapp: 1 });
    await liberar(c);
    await drenarAvisos();
    prosio.redefinir();

    const alvo = c.semWhatsapp[0];
    const novo = whatsappUnico();
    const r = await api().patch(`/api/v1/entregas/pacotes/${alvo.id}`).set('Connection', 'close').set(authHeader(c.supervisor)).send({ whatsapp: novo });
    expect(r.status).toBe(200);
    expect(r.body.avisoSolicitado).toBe(true);
    expect((await recarregar(alvo.id)).status).toBe('AGENDADO');
    await drenarAvisos();
    expect(avisos()).toHaveLength(1);
    expect(avisos()[0].corpo).toEqual(expect.objectContaining({ to: novo, reference: alvo.id }));

    const cb = await prosio.enviarCallbackStatus(urlWebhook(c), c.canal.callbackSecret, { messageId: prosio.messageIdDe(avisos()[0])!, status: 'sent', reference: alvo.id });
    expect(cb.status).toBe(204);
    expect((await recarregar(alvo.id)).status).toBe('ENVIADO');
  });

  it('IT-073 nenhum WhatsApp sem confirmarSemAvisos → 409 nenhum_destinatario; com a flag → 202 com 0 avisos', async () => {
    const c = await cenario({ pacotes: 0, semWhatsapp: 2 });
    const r = await liberar(c);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('nenhum_destinatario');
    expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: c.carga.id } })).status).toBe('CARREGADO');

    const ok = await liberar(c, { confirmarSemAvisos: true });
    expect(ok.status).toBe(202);
    expect(ok.body).toEqual({ avisosAgendados: 0, semWhatsapp: 2, descadastrados: 0 });
    await drenarAvisos();
    expect(prosio.mensagens()).toHaveLength(0);
  });

  it('limite por canal: acima de N/min o excedente espera o próximo minuto', async () => {
    process.env.ENTREGAS_AVISO_LIMITE_MIN = '2';
    const c = await cenario({ pacotes: 3 });
    await liberar(c);
    await aguardar(() => avisos().length >= 2, { descricao: '2 avisos' });
    await aguardar(async () => (await entregasAvisoQueue.getDelayed()).some((j) => (j.data as { pacoteId?: string }).pacoteId && c.pacotes.some((p) => p.id === (j.data as { pacoteId: string }).pacoteId)), { descricao: 'job adiado' });
    expect(avisos()).toHaveLength(2);
    const adiado = (await entregasAvisoQueue.getDelayed()).find((j) => c.pacotes.some((p) => p.id === (j.data as { pacoteId?: string }).pacoteId))!;
    expect(adiado.attemptsMade).toBe(0);
    await adiado.remove();
  });
});

describe('Resumo ao carteiro e troca de carteiro', () => {
  it('IT-054 25 orientações guardadas → 2 mensagens de resumo (20 + 5); sem orientações → nenhuma', async () => {
    const c = await cenario({ pacotes: 25 });
    for (const p of c.pacotes) await guardada(p, `Deixar com Dona Célia, casa ${p.numero}`);
    await liberar(c);
    await drenarAvisos();
    const resumos = paraCarteiro(c);
    expect(resumos).toHaveLength(2);
    expect(resumos.map((m) => m.corpo.body.split('\n').length - 1).sort((a, b) => b - a)).toEqual([20, 5]);
    expect(resumos.map((m) => m.corpo.body.split('\n')[0])).toEqual(expect.arrayContaining([expect.stringContaining('1/2'), expect.stringContaining('2/2')]));
    expect(resumos.every((m) => !m.corpo.buttons)).toBe(true);
    const orientacoes = await prisma.orientacao.findMany({ where: { pacote: { cargaId: c.carga.id } } });
    expect(orientacoes.every((o) => o.estado === 'ENVIADA' && o.carteiroId === c.carteiro.id)).toBe(true);
    // O aviso de cada destinatário cita a orientação guardada (US-012.AC-2).
    expect(avisos().every((m) => /Vamos seguir sua orientação: Deixar com Dona Célia, casa \d+\./.test(m.corpo.body))).toBe(true);

    prosio.redefinir();
    const sem = await cenario({ pacotes: 2 });
    await liberar(sem);
    await drenarAvisos();
    expect(paraCarteiro(sem)).toHaveLength(0);
    expect(avisos()).toHaveLength(2);
  });

  it('IT-055 carteiro sem WhatsApp → liberação procede, sem resumo; orientações com nao_entregue_carteiro', async () => {
    const c = await cenario({ pacotes: 2, carteiroSemWhatsapp: true });
    const o = await guardada(c.pacotes[0], 'Deixar na portaria');
    const r = await liberar(c);
    expect(r.status).toBe(202);
    await drenarAvisos();
    expect(avisos()).toHaveLength(2);
    expect(prosio.mensagens()).toHaveLength(2);
    const depois = await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } });
    expect(depois.sinais).toContain('nao_entregue_carteiro');
    expect((await recarregar(c.pacotes[0].id)).sinais).toContain('nao_entregue_carteiro');
  });

  it('IT-014 troca de carteiro depois da liberação → resumo ao novo; a orientação antiga mantém o carteiro', async () => {
    const c = await cenario({ pacotes: 1 });
    await liberar(c);
    await drenarAvisos();
    const p = c.pacotes[0];
    const manual = await api().post(`/api/v1/entregas/pacotes/${p.id}/orientacao`).set('Connection', 'close').set(authHeader(c.supervisor))
      .send({ texto: 'Deixar na portaria com o zelador', valeParaAmanha: false });
    expect(manual.status).toBeLessThan(300);
    expect(paraCarteiro(c)).toHaveLength(1);

    const novo = await criarCarteiro({ unidadeId: c.unidade.id });
    const troca = await api().put(`/api/v1/entregas/cadastro/distritos/${c.distrito.id}/escala/${formatarData(c.carga.data)}`)
      .set('Connection', 'close').set(authHeader(c.supervisor)).send({ carteiroId: novo.id });
    expect(troca.status).toBe(200);
    await drenarAvisos();
    const resumo = paraCarteiro(novo);
    expect(resumo).toHaveLength(1);
    expect(resumo[0].corpo.body).toContain(p.codigo);
    expect(resumo[0].corpo.body).toContain('Deixar na portaria com o zelador');
    expect(resumo[0].headers['idempotency-key']).toBe(`resumo:${c.carga.id}:${novo.id}`);
    const o = await prisma.orientacao.findFirstOrThrow({ where: { pacoteId: p.id } });
    expect(o.carteiroId).toBe(c.carteiro.id);
    expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: c.carga.id } })).carteiroId).toBe(novo.id);
    expect(paraCarteiro(c)).toHaveLength(1);
  });
});

describe('Casos de mediação', () => {
  it('IT-057 mediacaoAtiva → um caso por pacote com WhatsApp; caseId gravado; no dia seguinte, caso novo; desligada → nenhum', async () => {
    process.env.PROSIO_MEDIACAO_EXTENSOES = 'true';
    const c = await cenario({ pacotes: 2, semWhatsapp: 1, mediacaoAtiva: true });
    await liberar(c);
    await drenarAvisos();
    const aberturas = prosio.aberturasDeCaso();
    expect(aberturas).toHaveLength(2);
    for (const p of c.pacotes) {
      const ref = `${p.codigo}@${formatarData(c.carga.data)}`;
      const a = aberturas.find((x) => x.corpo.externalRef === ref)!;
      expect(a).toBeDefined();
      expect(a.corpo).toEqual(expect.objectContaining({
        providerPhone: c.carteiro.whatsappE164,
        recipientPhone: p.whatsappE164,
        resumo: `Maria · QNA 12 ${p.numero}`,
      }));
      expect(a.corpo.motivo).toBeUndefined();
      expect((await recarregar(p.id)).mediacaoCaseId).toBe(prosio.caseIdDe(ref));
    }
    expect(avisos()).toHaveLength(2);

    // Dia seguinte: o mesmo código abre um caso novo.
    const amanha = somarDias(c.carga.data, 1);
    const cargaAmanha = await prisma.cargaDistrito.create({ data: { distritoId: c.distrito.id, data: amanha } });
    const repetido = await criarPacote({ cargaId: cargaAmanha.id, data: amanha, codigo: c.pacotes[0].codigo, whatsappE164: c.pacotes[0].whatsappE164 });
    expect((await liberar(c, {}, '10:00', cargaAmanha)).status).toBe(202);
    await drenarAvisos();
    const refAmanha = `${repetido.codigo}@${formatarData(amanha)}`;
    expect(prosio.aberturasDeCaso().map((a) => a.corpo.externalRef)).toContain(refAmanha);
    const novoCaso = (await recarregar(repetido.id)).mediacaoCaseId;
    expect(novoCaso).toBe(prosio.caseIdDe(refAmanha));
    expect(novoCaso).not.toBe((await recarregar(c.pacotes[0].id)).mediacaoCaseId);

    prosio.redefinir();
    const desligada = await cenario({ pacotes: 2, mediacaoAtiva: false });
    await liberar(desligada);
    await drenarAvisos();
    expect(prosio.aberturasDeCaso()).toHaveLength(0);
    expect(avisos()).toHaveLength(2);
  });

  it('IT-057 contrato atual (sem extensões): só os campos do schema estrito do Prosio', async () => {
    prosio.mediacaoEstrita = true;
    try {
      const c = await cenario({ pacotes: 1, mediacaoAtiva: true });
      await liberar(c);
      await drenarAvisos();
      const [a] = prosio.aberturasDeCaso();
      expect(Object.keys(a.corpo).sort()).toEqual(['externalRef', 'providerPhone', 'recipientPhone']);
      expect(a.resposta?.status).toBe(201);
      expect((await recarregar(c.pacotes[0].id)).mediacaoCaseId).toBeTruthy();
    } finally {
      prosio.mediacaoEstrita = false;
    }
  });

  it('IT-070 destinatário descadastrado → nenhum caso aberto para o pacote', async () => {
    const c = await cenario({ pacotes: 2, mediacaoAtiva: true });
    await prisma.descadastroWhatsapp.create({ data: { whatsappE164: c.pacotes[0].whatsappE164! } });
    await liberar(c);
    await drenarAvisos();
    expect(prosio.aberturasDeCaso().map((a) => a.corpo.recipientPhone)).toEqual([c.pacotes[1].whatsappE164]);
    expect((await recarregar(c.pacotes[0].id)).mediacaoCaseId).toBeNull();
  });

  it('IT-071 firstContact blocked → pacote sinalizado retido_consentimento, visível na lista', async () => {
    prosio.primeiroContato = 'blocked';
    const c = await cenario({ pacotes: 1, mediacaoAtiva: true });
    await liberar(c);
    await drenarAvisos();
    const p = await recarregar(c.pacotes[0].id);
    expect(p.sinais).toContain('retido_consentimento');
    expect(p.mediacaoCaseId).toBeTruthy();
    const lista = await api().get(`/api/v1/entregas/cargas/${c.carga.id}/pacotes`).set('Connection', 'close').set(authHeader(c.supervisor));
    expect(lista.status).toBe(200);
    expect(lista.body.pacotes[0].sinais).toContain('retido_consentimento');
  });

  it('IT-072 abertura 422 optin_company_mismatch → avisos seguem e pacotes sinalizados caso_recusado', async () => {
    prosio.roteirizar('POST', '/api/v1/mediation/cases', {
      status: 422,
      corpo: { error: 'Opt-in de outra empresa', details: { reason: 'optin_company_mismatch', detail: 'x' } },
    });
    const c = await cenario({ pacotes: 2, mediacaoAtiva: true });
    const r = await liberar(c);
    expect(r.status).toBe(202);
    await drenarAvisos();
    expect(avisos()).toHaveLength(2);
    for (const p of c.pacotes) {
      const atual = await recarregar(p.id);
      expect(atual.sinais).toContain('caso_recusado:optin_company_mismatch');
      expect(atual.mediacaoCaseId).toBeNull();
    }
    // Retry do job não tenta de novo o caso recusado.
    expect(prosio.aberturasDeCaso()).toHaveLength(2);
  });
});
