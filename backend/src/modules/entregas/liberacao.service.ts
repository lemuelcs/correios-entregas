/**
 * Liberação do distrito (US-011, US-023, US-040; TechSpec › Liberação e
 * AvisoWorker; ADR-001, ADR-011, ADR-012).
 *
 * - `liberar`: bloqueios, snapshot do carteiro, enfileira os avisos (com
 *   adiamento noturno) e o resumo ao carteiro. Idempotente: a carga só sai de
 *   `CARREGADO` uma vez, e cada pacote só passa de `AGUARDANDO_LIBERACAO` a
 *   `AGENDADO` uma vez.
 * - `enviarAviso` / `enviarResumo`: o trabalho de cada job da fila
 *   `entregas-aviso` (o worker só faz a ponte com o BullMQ). O aviso abre antes
 *   o caso de mediação do pacote quando a unidade tem `mediacaoAtiva`.
 * - Ganchos das tasks 03–05 (`registrarGanchosLiberacao`): pacote novo em carga
 *   liberada, troca de carteiro e reenvio por limite do canal.
 */
import type { Carteiro, Orientacao, Prisma } from '@prisma/client';
import type { JobsOptions, Queue } from 'bullmq';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { entregasAvisoQueue } from '../../queue';
import {
  ProsioError,
  prosioClient as prosioPadrao,
  resolverCanal,
  type CanalResolvido,
  type ProsioClient,
} from '../../integrations/prosio/prosio.client';
import { garantirUnidadeAtiva } from './cadastro.service';
import { hojeBrasilia, horaDeBrasilia } from './datas';
import { HORA_FIM_ENVIO, avancarStatusPacote } from './status';
import { registrarEvento, sinalizarOrientacao, sinalizarPacote } from './sinais';
import { avisosTotal } from './metricas';
import { carregarPacote, carteiroDoDia, mascarar, orientacaoService, type PacoteComContexto } from './orientacao.service';
import {
  registrarGanchoLimiteCanal,
  registrarGanchoPacotesEmCargaLiberada,
  registrarGanchoTrocaCarteiro,
} from './ganchos';
import {
  atrasoNoturno,
  chaveIdempotenciaAviso,
  externalRefDoCaso,
  fimDoDiaDeEntrega,
  idAviso,
  idJobFila,
  idResumo,
  jobsDaLiberacao,
  montarAviso,
  montarResumoCarteiro,
  resumoDoCaso,
  type DadosJobAviso,
  type DadosJobResumo,
  type JobEntregas,
} from './aviso.builder';

const MINUTO_MS = 60_000;
/** Reenvio por limite do canal: 30 min depois, até as 20h (US-011.EC-3). */
export const ATRASO_REENVIO_MS = 30 * MINUTO_MS;
export const TENTATIVAS_AVISO = 5;

/** Backoff exponencial base dos jobs (ms). Configurável para os testes. */
function backoffBaseMs(): number {
  const v = Number(process.env.ENTREGAS_AVISO_BACKOFF_MS);
  return Number.isFinite(v) && v > 0 ? v : 30_000;
}

/** Estados em que o aviso ainda pode sair. */
const ENVIAVEIS = ['AGENDADO', 'AGUARDANDO_LIBERACAO', 'NAO_ENVIADO'] as const;

export interface RespostaLiberacao {
  avisosAgendados: number;
  semWhatsapp: number;
  descadastrados: number;
  agendadoPara?: string;
  /** A carga já estava liberada: nada novo foi enfileirado. */
  jaLiberada?: boolean;
}

export interface OpcoesLiberar {
  usuarioId?: string;
  confirmarSemAvisos?: boolean;
}

/** Contexto do job no worker: reserva de taxa por canal (pode adiar o job). */
export interface ContextoEnvio {
  reservarEnvio?: (canalId: string) => Promise<void>;
}

export interface DepsLiberacao {
  prosio?: ProsioClient;
  agora?: () => Date;
  fila?: Queue;
}

type UnidadeComCanal = Prisma.UnidadeGetPayload<{ include: { canalProsio: true } }>;

/** Canal da unidade (credenciais decifradas) e a `unidadeRef` quando o canal é compartilhado. */
function canalDaUnidade(unidade: UnidadeComCanal): { canal: CanalResolvido; unidadeRef?: string } | null {
  const c = unidade.canalProsio;
  if (!c || !c.ativo) return null;
  const canal = resolverCanal(c);
  return { canal, ...(canal.compartilhado && unidade.prosioUnidadeRef ? { unidadeRef: unidade.prosioUnidadeRef } : {}) };
}

export class LiberacaoService {
  private readonly prosio: ProsioClient;
  private readonly agora: () => Date;
  private readonly filaFixa?: Queue;

  constructor(deps: DepsLiberacao = {}) {
    this.prosio = deps.prosio ?? prosioPadrao;
    this.agora = deps.agora ?? (() => new Date());
    this.filaFixa = deps.fila;
  }

  private get fila(): Queue {
    return this.filaFixa ?? entregasAvisoQueue;
  }

  // ——— Liberação ——————————————————————————————————————————————————————

  async liberar(cargaId: string, opcoes: OpcoesLiberar = {}): Promise<RespostaLiberacao> {
    const carga = await prisma.cargaDistrito.findUnique({
      where: { id: cargaId },
      include: { distrito: { include: { unidade: { include: { canalProsio: true } }, carteiroPadrao: true } } },
    });
    if (!carga) throw new AppError(404, 'nao_encontrado');
    const unidade = carga.distrito.unidade;
    await garantirUnidadeAtiva(unidade.id);

    const agora = this.agora();
    if (carga.data.getTime() < hojeBrasilia(agora).getTime()) throw new AppError(409, 'somente_leitura');

    const pacotes = await prisma.pacoteDia.findMany({
      where: { cargaId },
      select: { id: true, status: true, whatsappE164: true },
    });
    if (pacotes.length === 0) throw new AppError(409, 'carga_vazia', { mensagem: 'Distrito sem encomendas' });
    const semWhatsapp = pacotes.filter((p) => !p.whatsappE164).length;

    if (carga.status !== 'CARREGADO') return { avisosAgendados: 0, semWhatsapp, descadastrados: 0, jaLiberada: true };

    const carteiro = await this.carteiroParaLiberar(carga.distritoId, carga.data, carga.distrito.carteiroPadrao);
    if (!carteiro) throw new AppError(409, 'sem_carteiro', { mensagem: 'Distrito sem carteiro no dia' });

    const aguardando = pacotes.filter((p) => p.whatsappE164 && p.status === 'AGUARDANDO_LIBERACAO');
    const descadastrados = await this.descadastrados(aguardando.map((p) => p.whatsappE164!));
    const avisaveis = aguardando.filter((p) => !descadastrados.has(p.whatsappE164!));
    const bloqueados = aguardando.filter((p) => descadastrados.has(p.whatsappE164!));

    if (avisaveis.length === 0 && !opcoes.confirmarSemAvisos) {
      throw new AppError(409, 'nenhum_destinatario', {
        mensagem: 'Nenhum destinatário será avisado',
        semWhatsapp,
        descadastrados: bloqueados.length,
      });
    }
    if (avisaveis.length > 0 && !canalDaUnidade(unidade)) throw new AppError(409, 'canal_indisponivel');

    // Orientações guardadas que chegaram depois da confirmação da lista.
    await orientacaoService.reaplicarGuardadas(carga.id);

    const liberou = await prisma.$transaction(async (tx) => {
      const { count } = await tx.cargaDistrito.updateMany({
        where: { id: carga.id, status: 'CARREGADO' },
        data: { status: 'LIBERADO', carteiroId: carteiro.id, liberadoEm: agora, liberadoPorId: opcoes.usuarioId ?? null },
      });
      if (count === 0) return null;
      // Orientações guardadas que valem hoje passam ao carteiro do dia (vão no resumo).
      const guardadas = await tx.orientacao.findMany({
        where: {
          pacote: { cargaId: carga.id },
          estado: 'GUARDADA',
          OR: [{ valeAPartirDe: null }, { valeAPartirDe: { lte: carga.data } }],
        },
        select: { id: true },
        orderBy: { criadaEm: 'asc' },
      });
      if (guardadas.length > 0) {
        await tx.orientacao.updateMany({
          where: { id: { in: guardadas.map((g) => g.id) } },
          data: { estado: 'ENVIADA', carteiroId: carteiro.id },
        });
      }
      return { orientacaoIds: guardadas.map((g) => g.id) };
    });
    if (!liberou) return { avisosAgendados: 0, semWhatsapp, descadastrados: 0, jaLiberada: true };

    for (const p of bloqueados) await this.marcarDescadastrado(p.id);

    const agendamento = await this.agendarAvisos(avisaveis.map((p) => p.id), agora);

    if (liberou.orientacaoIds.length > 0) {
      if (carteiro.whatsappE164) {
        await this.enfileirar(
          jobsDaLiberacao({ cargaId: carga.id, carteiroId: carteiro.id, pacoteIds: [], orientacaoIds: liberou.orientacaoIds }),
          atrasoNoturno(agora).atrasoMs,
        );
      } else {
        await this.sinalizarCarteiroSemWhatsapp(liberou.orientacaoIds, carteiro.id);
      }
    }

    logger.info(
      {
        unidadeId: unidade.id,
        cargaId: carga.id,
        carteiroId: carteiro.id,
        avisos: agendamento.agendados,
        semWhatsapp,
        descadastrados: bloqueados.length,
        orientacoes: liberou.orientacaoIds.length,
        agendadoPara: agendamento.agendadoPara?.toISOString() ?? null,
      },
      'entregas.liberacao',
    );

    return {
      avisosAgendados: agendamento.agendados,
      semWhatsapp,
      descadastrados: bloqueados.length,
      ...(agendamento.agendadoPara ? { agendadoPara: agendamento.agendadoPara.toISOString() } : {}),
    };
  }

  /** Carteiro do dia para a liberação: troca do dia, senão o padrão; precisa estar ativo. */
  private async carteiroParaLiberar(distritoId: string, data: Date, padrao: Carteiro | null): Promise<Carteiro | null> {
    const escala = await prisma.escalaDistrito.findUnique({
      where: { distritoId_data: { distritoId, data } },
      include: { carteiro: true },
    });
    const c = escala?.carteiro ?? padrao;
    return c && c.ativo ? c : null;
  }

  private async descadastrados(numeros: string[]): Promise<Set<string>> {
    if (numeros.length === 0) return new Set();
    const rows = await prisma.descadastroWhatsapp.findMany({ where: { whatsappE164: { in: numeros } } });
    return new Set(rows.map((r) => r.whatsappE164));
  }

  private async marcarDescadastrado(pacoteId: string): Promise<void> {
    await prisma.pacoteDia.updateMany({
      where: { id: pacoteId, status: { in: [...ENVIAVEIS] } },
      data: { status: 'NAO_ENVIADO', naoEnviadoMotivo: 'descadastrado' },
    });
    await sinalizarPacote(pacoteId, 'descadastrado');
    await registrarEvento(pacoteId, 'aviso_nao_enviado', { motivo: 'descadastrado' });
    avisosTotal.inc({ resultado: 'descadastrado' });
  }

  private async sinalizarCarteiroSemWhatsapp(orientacaoIds: string[], carteiroId: string): Promise<void> {
    const orientacoes = await prisma.orientacao.findMany({ where: { id: { in: orientacaoIds } }, select: { id: true, pacoteId: true } });
    for (const o of orientacoes) {
      await sinalizarOrientacao(o.id, 'nao_entregue_carteiro');
      if (o.pacoteId) await sinalizarPacote(o.pacoteId, 'nao_entregue_carteiro');
    }
    logger.warn({ carteiroId, orientacoes: orientacoes.length }, 'entregas.liberacao carteiro sem WhatsApp: resumo não enviado');
  }

  // ——— Agendamento ————————————————————————————————————————————————————

  /**
   * Agenda o aviso dos pacotes que ainda aguardam liberação numa carga já
   * liberada. Idempotente: só os pacotes que passam agora de
   * `AGUARDANDO_LIBERACAO` a `AGENDADO` ganham job. Descadastrados são
   * marcados e não avisados. Usado pela liberação e pelo gancho
   * `aoAdicionarPacotesEmCargaLiberada` (confirmação, edição, app de etiquetas).
   */
  async agendarAvisos(pacoteIds: readonly string[], agora: Date = this.agora()): Promise<{ agendados: number; agendadoPara: Date | null }> {
    const ids = [...new Set(pacoteIds)];
    if (ids.length === 0) return { agendados: 0, agendadoPara: null };
    const candidatos = await prisma.pacoteDia.findMany({
      where: { id: { in: ids }, status: 'AGUARDANDO_LIBERACAO', whatsappE164: { not: null }, carga: { status: { not: 'CARREGADO' } } },
      select: { id: true, whatsappE164: true },
    });
    const descad = await this.descadastrados(candidatos.map((p) => p.whatsappE164!));
    for (const p of candidatos.filter((c) => descad.has(c.whatsappE164!))) await this.marcarDescadastrado(p.id);
    const alvo = candidatos.filter((c) => !descad.has(c.whatsappE164!)).map((c) => c.id);
    if (alvo.length === 0) return { agendados: 0, agendadoPara: null };

    const reivindicados = await prisma.pacoteDia.updateManyAndReturn({
      where: { id: { in: alvo }, status: 'AGUARDANDO_LIBERACAO' },
      data: { status: avancarStatusPacote('AGUARDANDO_LIBERACAO', { tipo: 'agendado' }).status, naoEnviadoMotivo: null },
      select: { id: true },
    });
    if (reivindicados.length === 0) return { agendados: 0, agendadoPara: null };

    const { atrasoMs, agendadoPara } = atrasoNoturno(agora);
    await this.enfileirar(jobsDaLiberacao({ cargaId: '', carteiroId: null, pacoteIds: reivindicados.map((r) => r.id) }), atrasoMs);
    for (const r of reivindicados) {
      await registrarEvento(r.id, 'aviso_agendado', { para: agendadoPara?.toISOString() ?? null });
    }
    return { agendados: reivindicados.length, agendadoPara };
  }

  /** Enfileira os jobs. Um job terminado com o mesmo id é removido antes (senão o BullMQ ignoraria o novo). */
  private async enfileirar(jobs: JobEntregas[], atrasoMs: number, extras: JobsOptions = {}): Promise<void> {
    if (jobs.length === 0) return;
    for (const j of jobs) {
      const existente = await this.fila.getJob(idJobFila(j.id));
      if (existente && ((await existente.isCompleted()) || (await existente.isFailed()))) await existente.remove();
    }
    await this.fila.addBulk(
      jobs.map((j) => ({
        name: j.nome,
        data: j.dados,
        opts: {
          jobId: idJobFila(j.id),
          delay: Math.max(0, atrasoMs),
          attempts: TENTATIVAS_AVISO,
          backoff: { type: 'exponential', delay: backoffBaseMs() },
          removeOnComplete: { age: 3 * 24 * 3600 },
          removeOnFail: { age: 7 * 24 * 3600 },
          ...extras,
        },
      })),
    );
  }

  // ——— Envio do aviso (job) ——————————————————————————————————————————————

  /** Envia o aviso de um pacote (e antes abre o caso de mediação). Devolve o resultado para o log. */
  async enviarAviso(dados: DadosJobAviso, ctx: ContextoEnvio = {}): Promise<string> {
    const pacote = await carregarPacote(dados.pacoteId);
    if (!pacote) return 'pacote_inexistente';
    if (!(ENVIAVEIS as readonly string[]).includes(pacote.status)) return 'ja_enviado';
    if (pacote.carga.status === 'CARREGADO') return 'carga_nao_liberada';
    if (!pacote.whatsappE164) return 'sem_whatsapp';
    if (pacote.status === 'NAO_ENVIADO' && !dados.reenvio) return 'nao_enviado';

    const agora = this.agora();
    if (dados.reenvio && agora.getTime() > horaDeBrasilia(pacote.carga.data, HORA_FIM_ENVIO).getTime()) {
      await registrarEvento(pacote.id, 'reenvio_encerrado', { reenvio: dados.reenvio });
      return 'fim_do_dia';
    }
    if (await prisma.descadastroWhatsapp.findUnique({ where: { whatsappE164: pacote.whatsappE164 } })) {
      await this.marcarDescadastrado(pacote.id);
      return 'descadastrado';
    }

    const unidade = pacote.carga.distrito.unidade;
    const alvo = canalDaUnidade(unidade);
    if (!alvo) {
      await prisma.pacoteDia.updateMany({ where: { id: pacote.id, status: { in: [...ENVIAVEIS] } }, data: { status: 'NAO_ENVIADO', naoEnviadoMotivo: 'sem_canal' } });
      await registrarEvento(pacote.id, 'aviso_nao_enviado', { motivo: 'sem_canal' });
      avisosTotal.inc({ resultado: 'sem_canal' });
      return 'sem_canal';
    }

    if (unidade.mediacaoAtiva && !pacote.mediacaoCaseId && !pacote.sinais.some((s) => s.startsWith('caso_recusado'))) {
      await this.abrirCaso(pacote, alvo);
    }

    await ctx.reservarEnvio?.(alvo.canal.id);

    const [orientacao, pontos] = await Promise.all([
      this.orientacaoGuardadaDoPacote(pacote.id),
      prisma.pontoRetirada.groupBy({ by: ['tipo'], where: { unidadeId: unidade.id, ativo: true }, _count: { _all: true } }),
    ]);
    const aviso = montarAviso({
      pacoteId: pacote.id,
      nome: pacote.nome,
      codigo: pacote.codigo,
      pontosAtivos: { agencia: pontos.some((p) => p.tipo === 'AGENCIA'), locker: pontos.some((p) => p.tipo === 'LOCKER') },
      orientacao: orientacao?.texto ?? null,
    });

    try {
      const { messageId } = await this.prosio.enviarMensagem(alvo.canal, {
        to: pacote.whatsappE164,
        body: aviso.body,
        buttons: aviso.buttons,
        reference: pacote.id,
        idempotencyKey: chaveIdempotenciaAviso(pacote.id, dados.reenvio),
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
      await prisma.pacoteDia.update({ where: { id: pacote.id }, data: { prosioMessageId: messageId } });
      await registrarEvento(pacote.id, 'aviso_enviado', { messageId, reenvio: dados.reenvio ?? 0 });
      avisosTotal.inc({ resultado: 'enviado' });
      logger.info(
        { unidadeId: unidade.id, cargaId: pacote.cargaId, pacoteId: pacote.id, canalId: alvo.canal.id, telefone: mascarar(pacote.whatsappE164) },
        'entregas.aviso.enviado',
      );
      return 'enviado';
    } catch (err) {
      const code = err instanceof ProsioError ? err.code : 'erro';
      logger.warn(
        { cargaId: pacote.cargaId, pacoteId: pacote.id, canalId: alvo.canal.id, code, telefone: mascarar(pacote.whatsappE164) },
        'entregas.aviso.falhou',
      );
      if (err instanceof ProsioError && !err.tentavel) {
        await this.marcarFalhaEnvio(pacote.id, code);
        return 'falha_envio';
      }
      throw err;
    }
  }

  /** Orientação guardada de outro dia (vigente, do próprio destinatário ou da mediação) para citar no aviso. */
  private async orientacaoGuardadaDoPacote(pacoteId: string): Promise<Orientacao | null> {
    return prisma.orientacao.findFirst({
      where: {
        pacoteId,
        valeAPartirDe: { not: null },
        origem: { in: ['BOTAO', 'MEDIACAO'] },
        estado: { in: ['ENVIADA', 'VISTA', 'GUARDADA'] },
      },
      orderBy: { criadaEm: 'desc' },
    });
  }

  /** Esgotadas as tentativas (ou erro não tentável): `NAO_ENVIADO` com `falha_envio` (US-011.EC-7). */
  async marcarFalhaEnvio(pacoteId: string, code = 'falha_envio'): Promise<void> {
    // Status e evento na mesma transação: quem vê `NAO_ENVIADO` vê também o
    // `aviso_falhou` (antes eram dois comandos, e havia uma janela sem o evento).
    const count = await prisma.$transaction(async (tx) => {
      const { count: n } = await tx.pacoteDia.updateMany({
        where: { id: pacoteId, status: { in: [...ENVIAVEIS] } },
        data: { status: 'NAO_ENVIADO', naoEnviadoMotivo: 'falha_envio' },
      });
      if (n > 0) await registrarEvento(pacoteId, 'aviso_falhou', { code }, tx);
      return n;
    });
    if (count > 0) avisosTotal.inc({ resultado: 'falha_envio' });
  }

  // ——— Caso de mediação ——————————————————————————————————————————————————

  /**
   * Abre o caso do pacote (ADR-008/011). Nunca interrompe o aviso:
   * - `firstContact: 'blocked'` (tenant sem declaração) → sinal `retido_consentimento`;
   * - 422 → sinal `caso_recusado:<motivo>`;
   * - outras falhas → só o evento (o próximo retry do job tenta de novo).
   */
  private async abrirCaso(pacote: PacoteComContexto, alvo: { canal: CanalResolvido; unidadeRef?: string }): Promise<void> {
    const carteiro = await carteiroDoDia(pacote);
    if (!carteiro?.whatsappE164 || !pacote.whatsappE164) {
      await registrarEvento(pacote.id, 'caso_nao_aberto', { motivo: 'carteiro_sem_whatsapp' });
      return;
    }
    const externalRef = externalRefDoCaso(pacote.codigo, pacote.data);
    try {
      const caso = await this.prosio.abrirCaso(alvo.canal, {
        externalRef,
        providerPhone: carteiro.whatsappE164,
        recipientPhone: pacote.whatsappE164,
        resumo: resumoDoCaso(pacote),
        respondBy: fimDoDiaDeEntrega(pacote.data),
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
      await prisma.pacoteDia.update({ where: { id: pacote.id }, data: { mediacaoCaseId: caso.caseId } });
      await registrarEvento(pacote.id, 'caso_aberto', { caseId: caso.caseId, created: caso.created, firstContact: caso.firstContact ?? null });
      if (caso.firstContact === 'blocked') await sinalizarPacote(pacote.id, 'retido_consentimento');
    } catch (err) {
      const code = err instanceof ProsioError ? err.code : 'erro';
      if (err instanceof ProsioError && err.status === 422) {
        await sinalizarPacote(pacote.id, `caso_recusado:${code}`);
      }
      await registrarEvento(pacote.id, 'caso_nao_aberto', { code, status: err instanceof ProsioError ? err.status : null });
      logger.warn({ pacoteId: pacote.id, canalId: alvo.canal.id, code }, 'entregas.liberacao caso de mediação não aberto');
    }
  }

  // ——— Resumo ao carteiro (job) ——————————————————————————————————————————

  async enviarResumo(dados: DadosJobResumo, ctx: ContextoEnvio = {}): Promise<string> {
    const [carga, carteiro, orientacoes] = await Promise.all([
      prisma.cargaDistrito.findUnique({ where: { id: dados.cargaId }, include: { distrito: { include: { unidade: { include: { canalProsio: true } } } } } }),
      prisma.carteiro.findUnique({ where: { id: dados.carteiroId } }),
      prisma.orientacao.findMany({
        where: { id: { in: dados.orientacaoIds }, estado: { not: 'SUBSTITUIDA' } },
        include: { pacote: { select: { nome: true } } },
        orderBy: { criadaEm: 'asc' },
      }),
    ]);
    if (!carga || orientacoes.length === 0) return 'sem_orientacoes';
    if (!carteiro?.whatsappE164) {
      await this.sinalizarCarteiroSemWhatsapp(orientacoes.map((o) => o.id), dados.carteiroId);
      return 'carteiro_sem_whatsapp';
    }
    const alvo = canalDaUnidade(carga.distrito.unidade);
    if (!alvo) {
      for (const o of orientacoes) await sinalizarOrientacao(o.id, 'falha_envio_carteiro');
      return 'sem_canal';
    }
    const mensagens = montarResumoCarteiro(
      orientacoes.map((o) => ({ codigo: o.codigo, nomeDestinatario: o.pacote?.nome ?? '', texto: o.texto })),
      { troca: dados.troca },
    );
    const base = idResumo(dados.cargaId, dados.carteiroId);
    for (let i = 0; i < mensagens.length; i += 1) {
      await ctx.reservarEnvio?.(alvo.canal.id);
      await this.prosio.enviarMensagem(alvo.canal, {
        to: carteiro.whatsappE164,
        body: mensagens[i],
        reference: `resumo:${dados.cargaId}`,
        idempotencyKey: mensagens.length > 1 ? `${base}:${i + 1}` : base,
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
    }
    avisosTotal.inc({ resultado: 'resumo' }, mensagens.length);
    logger.info({ cargaId: dados.cargaId, carteiroId: dados.carteiroId, orientacoes: orientacoes.length, mensagens: mensagens.length, troca: !!dados.troca }, 'entregas.liberacao resumo enviado');
    return 'resumo_enviado';
  }

  /** Esgotadas as tentativas do resumo: as orientações ficam sinalizadas. */
  async marcarFalhaResumo(dados: DadosJobResumo): Promise<void> {
    for (const id of dados.orientacaoIds) await sinalizarOrientacao(id, 'falha_envio_carteiro');
  }

  // ——— Ganchos ————————————————————————————————————————————————————————

  /**
   * Troca de carteiro depois da liberação (US-005.AC-3, EC-4): reenvia ao novo
   * carteiro o resumo das orientações pendentes da carga. As orientações já
   * criadas mantêm o carteiro de quando foram enviadas.
   */
  async notificarTrocaCarteiro(distritoId: string, data: Date, carteiroNovoId: string): Promise<void> {
    const carga = await prisma.cargaDistrito.findUnique({ where: { distritoId_data: { distritoId, data } } });
    if (!carga || carga.status === 'CARREGADO') return;
    const pendentes = await prisma.orientacao.findMany({
      where: { pacote: { cargaId: carga.id }, estado: { in: ['ENVIADA', 'VISTA'] } },
      select: { id: true },
      orderBy: { criadaEm: 'asc' },
    });
    if (pendentes.length === 0) return;
    const job: JobEntregas = {
      nome: 'resumo',
      id: idResumo(carga.id, carteiroNovoId),
      dados: { cargaId: carga.id, carteiroId: carteiroNovoId, orientacaoIds: pendentes.map((p) => p.id), troca: true },
    };
    await this.enfileirar([job], atrasoNoturno(this.agora()).atrasoMs);
    logger.info({ cargaId: carga.id, carteiroId: carteiroNovoId, orientacoes: pendentes.length }, 'entregas.liberacao resumo reenviado ao novo carteiro');
  }

  /**
   * Limite do canal (callback `failed` de cota/aquecimento): novo job 30 min
   * depois, com `Idempotency-Key` própria, enquanto couber até as 20h.
   */
  async reenfileirarPorLimite(pacoteId: string): Promise<boolean> {
    const pacote = await prisma.pacoteDia.findUnique({ where: { id: pacoteId }, include: { carga: true } });
    if (!pacote || pacote.status !== 'NAO_ENVIADO' || pacote.naoEnviadoMotivo !== 'limite_canal') return false;
    const agora = this.agora();
    const quando = new Date(agora.getTime() + ATRASO_REENVIO_MS);
    if (quando.getTime() > horaDeBrasilia(pacote.carga.data, HORA_FIM_ENVIO).getTime()) {
      await registrarEvento(pacote.id, 'reenvio_encerrado', { motivo: 'fim_do_dia' });
      logger.info({ pacoteId, cargaId: pacote.cargaId }, 'entregas.aviso reenvio encerrado (fim do dia)');
      return false;
    }
    const n = (await prisma.eventoPacote.count({ where: { pacoteId, tipo: 'aviso_reenfileirado' } })) + 1;
    await this.enfileirar([{ nome: 'aviso', id: `${idAviso(pacoteId)}:r${n}`, dados: { pacoteId, reenvio: n } }], ATRASO_REENVIO_MS);
    await registrarEvento(pacote.id, 'aviso_reenfileirado', { reenvio: n, para: quando.toISOString() });
    logger.info({ pacoteId, cargaId: pacote.cargaId, reenvio: n }, 'entregas.aviso reenfileirado (limite do canal)');
    return true;
  }
}

export const liberacaoService = new LiberacaoService();

/**
 * Registra as implementações dos ganchos das tasks 03–05. Chamado uma vez, no
 * carregamento do `app` (API e workers rodam no mesmo processo).
 */
export function registrarGanchosLiberacao(servico: LiberacaoService = liberacaoService): void {
  registrarGanchoPacotesEmCargaLiberada(async (ids) => {
    await servico.agendarAvisos(ids);
  });
  registrarGanchoTrocaCarteiro((distritoId, data, carteiroId) => servico.notificarTrocaCarteiro(distritoId, data, carteiroId));
  registrarGanchoLimiteCanal(async (pacoteId) => {
    await servico.reenfileirarPorLimite(pacoteId);
  });
}
