/**
 * OrientacaoService contra o banco de teste e o Prosio falso:
 * UT-049–UT-060, UT-091, UT-092, UT-095 (máquina de estados com persistência;
 * rodam no projeto de integração porque a regra vive nas transações).
 */
import type { Carteiro, PacoteDia, PontoRetirada } from '@prisma/client';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import {
  codigoS10,
  criarCanal,
  criarCarteiro,
  criarDistrito,
  criarPacote,
  criarUnidade,
  limparBanco,
} from '../../../__tests__/fixtures/entregas';
import { OrientacaoServiceImpl } from '../orientacao.service';
import { hojeBrasilia, somarDias } from '../datas';
import { proximoDiaDeEntrega } from '../calendario';
import { textosCarteiro } from '../textos';
import { AppError } from '../../../shared/middleware/error-handler.middleware';

let prosio: ProsioFake;
const svc = new OrientacaoServiceImpl();
const hoje = hojeBrasilia();

interface Cenario {
  pacote: PacoteDia;
  carteiro: Carteiro;
  unidadeId: string;
  distritoId: string;
}

async function cenario(opcoes: { carteiroSemWhatsapp?: boolean; status?: PacoteDia['status'] } = {}): Promise<Cenario> {
  const { canal } = await criarCanal({ baseUrl: prosio.url });
  const unidade = await criarUnidade({ canalProsioId: canal.id });
  const carteiro = await criarCarteiro({ unidadeId: unidade.id, ...(opcoes.carteiroSemWhatsapp ? { whatsappE164: null } : {}) });
  const distrito = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: carteiro.id });
  const carga = await prisma.cargaDistrito.create({
    data: { distritoId: distrito.id, data: hoje, status: 'EM_ENTREGA', carteiroId: carteiro.id, liberadoEm: new Date() },
  });
  const pacote = await criarPacote({ cargaId: carga.id, data: hoje, status: opcoes.status ?? 'ENVIADO' });
  return { pacote, carteiro, unidadeId: unidade.id, distritoId: distrito.id };
}

async function ponto(unidadeId: string, tipo: 'AGENCIA' | 'LOCKER', nome = 'AC Centro'): Promise<PontoRetirada> {
  return prisma.pontoRetirada.create({ data: { unidadeId, tipo, nome, endereco: 'QNA 30, lote 5', horario: '9h às 17h' } });
}

async function erroDe(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    return err as AppError;
  }
  throw new Error('esperava erro');
}

beforeAll(async () => {
  await limparBanco();
  prosio = await ProsioFake.iniciar();
});

beforeEach(() => prosio.redefinir());

afterAll(async () => {
  await prosio.parar();
  await limparBanco();
  await encerrarRecursos();
});

describe('OrientacaoService', () => {
  it('UT-049 AGENCIA com pacote em rota → ENVIADA e mensagem ao carteiro com CE_CT VI/FEITO/NAO', async () => {
    const c = await cenario();
    const p = await ponto(c.unidadeId, 'AGENCIA');
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'AGENCIA', texto: 'Deixar na agência AC Centro', pontoRetiradaId: p.id, origem: 'BOTAO' });

    expect(o.estado).toBe('ENVIADA');
    expect(o.carteiroId).toBe(c.carteiro.id);
    const [m] = prosio.mensagens();
    expect(prosio.mensagens()).toHaveLength(1);
    expect(m.corpo.to).toBe(c.carteiro.whatsappE164);
    expect(m.corpo.reference).toBe(`o:${o.id}`);
    expect(m.headers['idempotency-key']).toBe(`orient:${o.id}`);
    expect(m.corpo.buttons.map((b: { id: string }) => b.id)).toEqual([`CE_CT:${o.id}.VI`, `CE_CT:${o.id}.FEITO`, `CE_CT:${o.id}.NAO`]);
    expect(m.corpo.body).toContain(c.pacote.codigo);
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: c.pacote.id } })).status).toBe('INTERAGINDO');
  });

  it('UT-050 nova orientação do mesmo código → anterior SUBSTITUIDA e mensagem "ATUALIZADA:"', async () => {
    const c = await cenario();
    const a = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'MEDIACAO' });
    const b = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar com o Zé do 12', origem: 'MEDIACAO' });

    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: a.id } })).estado).toBe('SUBSTITUIDA');
    expect(b.estado).toBe('ENVIADA');
    const msgs = prosio.mensagens();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].corpo.body.startsWith('ATUALIZADA:')).toBe(false);
    expect(msgs[1].corpo.body.startsWith('ATUALIZADA:')).toBe(true);
    expect(await prisma.orientacao.count({ where: { codigo: c.pacote.codigo, estado: { not: 'SUBSTITUIDA' } } })).toBe(1);
  });

  it('UT-051 valeParaAmanha → GUARDADA com valeAPartirDe = próximo dia útil, sem mensagem ao carteiro', async () => {
    const c = await cenario();
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'MANUAL', texto: 'Deixar na portaria', origem: 'SUPERVISOR', valeParaAmanha: true });
    expect(o.estado).toBe('GUARDADA');
    expect(o.valeAPartirDe?.toISOString()).toBe(proximoDiaDeEntrega(hoje).toISOString());
    expect(prosio.mensagens()).toHaveLength(0);
  });

  it('UT-052 reaplicarGuardadas liga a GUARDADA do código à nova carga (outro distrito) e devolve 1', async () => {
    const c = await cenario();
    const codigo = codigoS10();
    const outroDistrito = await criarDistrito({ unidadeId: c.unidadeId });
    const cargaNova = await prisma.cargaDistrito.create({ data: { distritoId: outroDistrito.id, data: somarDias(hoje, 1) } });
    const pacoteNovo = await criarPacote({ cargaId: cargaNova.id, codigo });
    const guardada = await prisma.orientacao.create({
      data: { codigo, tipo: 'VIZINHO', texto: 'Deixar com Dona Célia, casa 47', estado: 'GUARDADA', origem: 'MEDIACAO', valeAPartirDe: somarDias(hoje, 1) },
    });

    expect(await svc.reaplicarGuardadas(cargaNova.id)).toBe(1);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: guardada.id } })).pacoteId).toBe(pacoteNovo.id);
  });

  it('UT-053 texto com 301 caracteres → orientacao_longa; vazio → orientacao_vazia', async () => {
    const c = await cenario();
    const longa = await erroDe(svc.registrar({ pacoteId: c.pacote.id, tipo: 'MANUAL', texto: 'x'.repeat(301), origem: 'SUPERVISOR' }));
    expect(longa).toBeInstanceOf(AppError);
    expect([longa.statusCode, longa.message]).toEqual([400, 'orientacao_longa']);
    const vazia = await erroDe(svc.registrar({ pacoteId: c.pacote.id, tipo: 'MANUAL', texto: '   ', origem: 'SUPERVISOR' }));
    expect([vazia.statusCode, vazia.message]).toEqual([400, 'orientacao_vazia']);
    expect(await prisma.orientacao.count({ where: { pacoteId: c.pacote.id } })).toBe(0);
  });

  it('UT-054 pacote ENTREGUE → 409 pacote_entregue', async () => {
    const c = await cenario({ status: 'ENTREGUE' });
    const e = await erroDe(svc.registrar({ pacoteId: c.pacote.id, tipo: 'MANUAL', texto: 'Deixar na portaria', origem: 'SUPERVISOR' }));
    expect([e.statusCode, e.message]).toEqual([409, 'pacote_entregue']);
  });

  it('UT-055 FEITO do carteiro → FEITA com respondidoEm', async () => {
    const c = await cenario();
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });
    const msg = await svc.registrarRespostaCarteiro(o.id, c.carteiro.whatsappE164!, 'FEITO');
    const depois = await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } });
    expect(msg).toBe(textosCarteiro.feita);
    expect(depois.estado).toBe('FEITA');
    expect(depois.respostaCarteiro).toBe('FEITO');
    expect(depois.respondidoEm).toBeInstanceOf(Date);
  });

  it('UT-056 resposta de outro telefone → estado inalterado e mensagem neutra', async () => {
    const c = await cenario();
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });
    expect(await svc.registrarRespostaCarteiro(o.id, '+5561988887777', 'FEITO')).toBe(textosCarteiro.neutra);
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } })).estado).toBe('ENVIADA');
  });

  it('UT-057 VI duas vezes → uma transição e um evento', async () => {
    const c = await cenario();
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });
    // Telefone com máscara e sem o +55: o jid do WhatsApp não chega em E.164.
    const tel = c.carteiro.whatsappE164!.replace('+55', '');
    await svc.registrarRespostaCarteiro(o.id, tel, 'VI');
    await svc.registrarRespostaCarteiro(o.id, tel, 'VI');
    expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: o.id } })).estado).toBe('VISTA');
    expect(await prisma.eventoPacote.count({ where: { pacoteId: c.pacote.id, tipo: 'resposta_carteiro' } })).toBe(1);
  });

  it('UT-058 NAO → mensagem de motivos com 5 botões; o motivo → NAO_FOI_POSSIVEL com respostaCarteiro', async () => {
    const c = await cenario();
    const o = await svc.registrarRespostaCarteiro(
      (await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' })).id,
      c.carteiro.whatsappE164!,
      'NAO',
    );
    expect(o).toBe(textosCarteiro.perguntaMotivo);
    const motivos = prosio.mensagens().at(-1)!;
    const id = (motivos.corpo.reference as string).slice(2);
    expect(motivos.corpo.buttons.map((b: { id: string }) => b.id)).toEqual(
      ['NAO_ATENDEU', 'ENDERECO', 'RECUSOU', 'FECHADO', 'OUTRO'].map((m) => `CE_CT:${id}.${m}`),
    );
    await svc.registrarRespostaCarteiro(id, c.carteiro.whatsappE164!, 'ENDERECO');
    const depois = await prisma.orientacao.findUniqueOrThrow({ where: { id } });
    expect(depois.estado).toBe('NAO_FOI_POSSIVEL');
    expect(depois.respostaCarteiro).toBe('ENDERECO');
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: c.pacote.id } })).sinais).toContain('nao_foi_possivel');
  });

  it('UT-059 FEITO com último rastreio de insucesso → evento divergencia e sinal no pacote', async () => {
    const c = await cenario();
    await prisma.pacoteDia.update({ where: { id: c.pacote.id }, data: { rastreioDescricao: 'Carteiro não atendido - Entrega não realizada', rastreioEm: new Date() } });
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });
    await svc.registrarRespostaCarteiro(o.id, c.carteiro.whatsappE164!, 'FEITO');
    expect(await prisma.eventoPacote.count({ where: { pacoteId: c.pacote.id, tipo: 'divergencia' } })).toBe(1);
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: c.pacote.id } })).sinais).toContain('divergencia');
  });

  it('UT-060 carteiro sem WhatsApp → ENVIADA com sinal nao_entregue_carteiro e nenhuma chamada ao Prosio', async () => {
    const c = await cenario({ carteiroSemWhatsapp: true });
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'OUTRA', texto: 'Deixar na portaria', origem: 'BOTAO' });
    expect(o.estado).toBe('ENVIADA');
    expect(o.sinais).toContain('nao_entregue_carteiro');
    expect(prosio.requisicoes).toHaveLength(0);
  });

  it('UT-091 ponto desativado depois → mantém pontoRetiradaId e a leitura devolve pontoDesativado', async () => {
    const c = await cenario();
    const p = await ponto(c.unidadeId, 'AGENCIA');
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'AGENCIA', texto: 'Deixar na agência AC Centro', pontoRetiradaId: p.id, origem: 'BOTAO' });
    await prisma.pontoRetirada.update({ where: { id: p.id }, data: { ativo: false } });
    const lida = await svc.obter(o.id);
    expect(lida?.pontoRetiradaId).toBe(p.id);
    expect(lida?.pontoDesativado).toBe(true);
  });

  it('UT-092 GUARDADA criada há 5 dias continua vigente sem ENTREGUE do código', async () => {
    const codigo = codigoS10();
    const guardada = await prisma.orientacao.create({
      data: { codigo, tipo: 'AMANHA', texto: 'Nova tentativa', estado: 'GUARDADA', origem: 'BOTAO', valeAPartirDe: somarDias(hoje, -4), criadaEm: somarDias(new Date(), -5) },
    });
    expect((await svc.vigentePorCodigo(codigo))?.id).toBe(guardada.id);

    const c = await cenario({ status: 'ENTREGUE' });
    await prisma.pacoteDia.update({ where: { id: c.pacote.id }, data: { codigo } });
    expect(await svc.vigentePorCodigo(codigo)).toBeNull();
  });

  it('UT-095 NAO + FECHADO numa orientação LOCKER → destinatário avisado ("seguirá para a unidade") e escalonado', async () => {
    const c = await cenario();
    const p = await ponto(c.unidadeId, 'LOCKER', 'Locker Shopping');
    const o = await svc.registrar({ pacoteId: c.pacote.id, tipo: 'LOCKER', texto: 'Deixar no locker Locker Shopping', pontoRetiradaId: p.id, origem: 'BOTAO' });
    await svc.registrarRespostaCarteiro(o.id, c.carteiro.whatsappE164!, 'NAO');
    await svc.registrarRespostaCarteiro(o.id, c.carteiro.whatsappE164!, 'FECHADO');

    const aoDestinatario = prosio.mensagens().filter((m) => m.corpo.to === c.pacote.whatsappE164);
    expect(aoDestinatario).toHaveLength(1);
    expect(aoDestinatario[0].corpo.body).toContain('seguirá para a unidade');
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: c.pacote.id } })).escalonado).toBe(true);
  });
});
