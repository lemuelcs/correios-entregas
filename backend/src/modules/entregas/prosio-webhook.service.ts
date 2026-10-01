/**
 * Webhook do canal Prosio (ADR-014): um único endpoint, assinado com o
 * `callbackSecret` do canal (`X-Webhook-Signature: sha256=<HMAC do corpo cru>`),
 * que recebe:
 * - status de mensagem (`MessageStatusCallbackSchema`) → status do pacote e descadastro;
 * - `mediation.outcome` → orientação (`desfecho.mapper.ts`);
 * - `mediation.escalated` (R7) → `escalonado: true`.
 *
 * Idempotente via `WebhookRecebido`: `deliveryId` (mediação) ou `messageId:status`.
 */
import type { Prisma, StatusPacote } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { verificarAssinatura } from '../../integrations/prosio/assinatura';
import { ProsioError, resolverCanal } from '../../integrations/prosio/prosio.client';
import type { CallbackDesfechoMediacao, CallbackStatusMensagem } from '../../integrations/prosio/prosio.types';
import { avancarStatusPacote, type EventoStatusPacote } from './status';
import { mapearDesfecho, lerExternalRef } from './desfecho.mapper';
import { OrientacaoServiceImpl, mascarar, type OrientacaoService } from './orientacao.service';
import { escalonarPacote, registrarEvento, sinalizarOrientacao, sinalizarPacote } from './sinais';
import { aoFalharPorLimiteDoCanal } from './ganchos';
import { webhookTotal } from './metricas';

export type TipoWebhook = 'status' | 'mediation.outcome' | 'mediation.escalated' | 'desconhecido';

export interface ResultadoWebhook {
  status: 204 | 400 | 401 | 503;
  tipo: TipoWebhook;
  resultado: string;
}

export interface DepsWebhook {
  orientacoes?: OrientacaoService;
  agora?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CallbackEscalonamento {
  event: 'mediation.escalated';
  deliveryId?: string;
  caseId?: string;
  externalRef?: string;
  motivo?: string;
  reason?: string;
  occurredAt?: string;
}

function registro(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function identificar(p: Record<string, unknown>): TipoWebhook {
  if (p.event === 'mediation.outcome') return 'mediation.outcome';
  if (p.event === 'mediation.escalated') return 'mediation.escalated';
  if (typeof p.messageId === 'string' && typeof p.status === 'string') return 'status';
  return 'desconhecido';
}

function chaveIdempotencia(tipo: TipoWebhook, p: Record<string, unknown>): string | null {
  if (tipo === 'status') return `status:${p.messageId}:${p.status}`;
  if (tipo === 'mediation.outcome' || tipo === 'mediation.escalated') {
    if (typeof p.deliveryId === 'string' && p.deliveryId) return `mediacao:${p.deliveryId}`;
    return `${tipo}:${String(p.caseId ?? '')}:${String(p.sequence ?? p.occurredAt ?? '')}`;
  }
  return null;
}

export class ProsioWebhookService {
  private readonly orientacoes: OrientacaoService;
  private readonly agora: () => Date;

  constructor(deps: DepsWebhook = {}) {
    this.orientacoes = deps.orientacoes ?? new OrientacaoServiceImpl();
    this.agora = deps.agora ?? (() => new Date());
  }

  async processar(canalId: string, corpoCru: Buffer | undefined, assinatura: string | undefined): Promise<ResultadoWebhook> {
    const canalRow = UUID.test(canalId) ? await prisma.canalProsio.findUnique({ where: { id: canalId } }) : null;
    if (!canalRow || !Buffer.isBuffer(corpoCru)) {
      return this.fim(canalId, { status: 401, tipo: 'desconhecido', resultado: 'assinatura_invalida' });
    }
    let segredo: string;
    try {
      segredo = resolverCanal(canalRow).callbackSecret;
    } catch (err) {
      if (err instanceof ProsioError) return this.fim(canalId, { status: 503, tipo: 'desconhecido', resultado: 'credencial_ilegivel' });
      throw err;
    }
    if (!verificarAssinatura(corpoCru, assinatura ?? '', segredo)) {
      return this.fim(canalId, { status: 401, tipo: 'desconhecido', resultado: 'assinatura_invalida' });
    }

    let payload: Record<string, unknown> | null;
    try {
      payload = registro(JSON.parse(corpoCru.toString('utf8')));
    } catch {
      payload = null;
    }
    if (!payload) return this.fim(canalId, { status: 400, tipo: 'desconhecido', resultado: 'corpo_invalido' });

    const tipo = identificar(payload);
    const chave = chaveIdempotencia(tipo, payload);
    if (!chave) return this.fim(canalId, { status: 204, tipo, resultado: 'ignorado' });

    const { count } = await prisma.webhookRecebido.createMany({ data: [{ chave }], skipDuplicates: true });
    if (count === 0) return this.fim(canalId, { status: 204, tipo, resultado: 'repetido' });

    try {
      let resultado: string;
      if (tipo === 'status') resultado = await this.status(canalId, payload as unknown as CallbackStatusMensagem);
      else if (tipo === 'mediation.outcome') resultado = await this.desfecho(canalId, payload as unknown as CallbackDesfechoMediacao);
      else resultado = await this.escalonamento(canalId, payload as unknown as CallbackEscalonamento);
      return this.fim(canalId, { status: 204, tipo, resultado });
    } catch (err) {
      // Libera a chave para o Prosio reenviar.
      await prisma.webhookRecebido.delete({ where: { chave } }).catch(() => undefined);
      logger.error({ canalId, tipo, erro: (err as Error).message }, 'entregas.webhook falha ao processar');
      throw err;
    }
  }

  private fim(canalId: string, r: ResultadoWebhook): ResultadoWebhook {
    webhookTotal.inc({ tipo: r.tipo, resultado: r.resultado });
    const nivel = r.resultado === 'assinatura_invalida' ? 'warn' : 'info';
    logger[nivel]({ canalId, tipo: r.tipo, resultado: r.resultado, repetido: r.resultado === 'repetido' }, 'entregas.webhook');
    return r;
  }

  /** Pacote do canal, ou `null` (id desconhecido ou de outro canal). */
  private async pacoteDoCanal(canalId: string, where: Prisma.PacoteDiaWhereInput) {
    return prisma.pacoteDia.findFirst({
      where: { ...where, carga: { distrito: { unidade: { canalProsioId: canalId } } } },
      orderBy: { data: 'desc' },
    });
  }

  // ——— Status de mensagem ———

  private async status(canalId: string, cb: CallbackStatusMensagem): Promise<string> {
    const ref = typeof cb.reference === 'string' ? cb.reference : '';
    let pacoteId: string | null = null;
    let orientacaoId: string | null = null;
    let aviso = false;
    if (ref.startsWith('o:')) orientacaoId = ref.slice(2);
    else if (ref.startsWith('p:')) pacoteId = ref.split(':')[1] ?? null;
    else if (UUID.test(ref)) {
      pacoteId = ref;
      aviso = true;
    }

    let telefone: string | null = null;
    let resultado = 'sem_referencia';

    if (orientacaoId && UUID.test(orientacaoId)) {
      const o = await prisma.orientacao.findUnique({
        where: { id: orientacaoId },
        include: { carteiro: true, pacote: { include: { carga: { include: { distrito: { include: { unidade: true } } } } } } },
      });
      if (o && o.pacote?.carga.distrito.unidade.canalProsioId === canalId) {
        telefone = o.carteiro?.whatsappE164 ?? null;
        if (cb.status === 'failed') {
          await sinalizarOrientacao(o.id, 'falha_envio_carteiro');
          await sinalizarPacote(o.pacote.id, 'falha_envio_carteiro');
          await registrarEvento(o.pacote.id, 'orientacao_falhou', { orientacaoId: o.id, failureReason: cb.failureReason });
        }
        resultado = `orientacao_${cb.status}`;
      }
    } else if (pacoteId && UUID.test(pacoteId)) {
      const pacote = await this.pacoteDoCanal(canalId, { id: pacoteId });
      if (pacote) {
        telefone = pacote.whatsappE164;
        resultado = aviso ? await this.aplicarStatusAviso(pacote, cb) : `auxiliar_${cb.status}`;
      } else resultado = 'pacote_nao_encontrado';
    }

    if (cb.recipientOptOut && telefone) {
      if (cb.recipientOptOut.optedOut) {
        await prisma.descadastroWhatsapp.upsert({
          where: { whatsappE164: telefone },
          create: { whatsappE164: telefone },
          update: {},
        });
        logger.info({ canalId, telefone: mascarar(telefone) }, 'entregas.webhook descadastro');
      } else {
        await prisma.descadastroWhatsapp.deleteMany({ where: { whatsappE164: telefone } });
        logger.info({ canalId, telefone: mascarar(telefone) }, 'entregas.webhook recadastro');
      }
    }
    return resultado;
  }

  private async aplicarStatusAviso(
    pacote: { id: string; status: StatusPacote; cargaId: string },
    cb: CallbackStatusMensagem,
  ): Promise<string> {
    const evento: EventoStatusPacote | null =
      cb.status === 'failed' ? { tipo: 'failed', failureReason: cb.failureReason }
        : cb.status === 'sent' || cb.status === 'delivered' || cb.status === 'read' ? { tipo: cb.status }
          : null;
    if (!evento) return 'ignorado';
    const avanco = avancarStatusPacote(pacote.status, evento);
    if (avanco.mudou) {
      await prisma.pacoteDia.updateMany({
        where: { id: pacote.id, status: pacote.status },
        data: {
          status: avanco.status,
          prosioMessageId: cb.messageId,
          ...(avanco.naoEnviadoMotivo ? { naoEnviadoMotivo: avanco.naoEnviadoMotivo } : {}),
        },
      });
    }
    await registrarEvento(pacote.id, 'status_mensagem', {
      messageId: cb.messageId,
      status: cb.status,
      failureReason: cb.failureReason ?? null,
      de: pacote.status,
      para: avanco.status,
    });
    logger.info({ pacoteId: pacote.id, cargaId: pacote.cargaId, status: cb.status, para: avanco.status, mudou: avanco.mudou }, 'entregas.webhook status');
    if (avanco.reenfileirar) await aoFalharPorLimiteDoCanal(pacote.id);
    return avanco.mudou ? avanco.status.toLowerCase() : 'sem_mudanca';
  }

  // ——— Mediação ———

  private async pacoteDoCaso(canalId: string, caseId: unknown, externalRef: unknown) {
    if (typeof caseId === 'string' && caseId) {
      const porCaso = await this.pacoteDoCanal(canalId, { mediacaoCaseId: caseId });
      if (porCaso) return porCaso;
    }
    const ref = typeof externalRef === 'string' ? lerExternalRef(externalRef) : null;
    if (!ref) return null;
    return this.pacoteDoCanal(canalId, { codigo: ref.codigo, data: new Date(`${ref.data}T00:00:00.000Z`) });
  }

  private async desfecho(canalId: string, cb: CallbackDesfechoMediacao): Promise<string> {
    const pacote = await this.pacoteDoCaso(canalId, cb.caseId, cb.externalRef);
    if (!pacote) {
      logger.warn({ canalId, caseId: cb.caseId }, 'entregas.webhook desfecho sem pacote');
      return 'pacote_nao_encontrado';
    }
    if (Array.isArray(cb.conhecimento) && cb.conhecimento.length > 0) {
      await registrarEvento(pacote.id, 'conhecimento', { caseId: cb.caseId, propostas: cb.conhecimento as unknown as Prisma.InputJsonValue });
    }
    if (pacote.status === 'ENTREGUE') {
      await registrarEvento(pacote.id, 'desfecho_ignorado', { caseId: cb.caseId, motivo: 'pacote_entregue', deliveryId: cb.deliveryId });
      return 'desfecho_ignorado';
    }

    const r = mapearDesfecho(cb, this.agora());
    if (r.acao === 'proposto') {
      await registrarEvento(pacote.id, 'desfecho_proposto', { caseId: cb.caseId, motivo: cb.outcome?.motivo, deliveryId: cb.deliveryId });
      await escalonarPacote(pacote.id, 'desfecho_proposto', { caseId: cb.caseId });
      return 'desfecho_proposto';
    }
    if (r.acao === 'sem_orientacao') {
      await registrarEvento(pacote.id, 'desfecho_sem_orientacao', { caseId: cb.caseId, motivo: r.motivo });
      return 'sem_orientacao';
    }
    try {
      await this.orientacoes.registrar({ ...r.orientacao, pacoteId: pacote.id });
      return 'orientacao';
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      await registrarEvento(pacote.id, 'desfecho_ignorado', { caseId: cb.caseId, motivo: err.message });
      return 'desfecho_ignorado';
    }
  }

  private async escalonamento(canalId: string, cb: CallbackEscalonamento): Promise<string> {
    const pacote = await this.pacoteDoCaso(canalId, cb.caseId, cb.externalRef);
    if (!pacote) return 'pacote_nao_encontrado';
    await escalonarPacote(pacote.id, 'prosio', { caseId: cb.caseId ?? null, motivoProsio: cb.motivo ?? cb.reason ?? null });
    return 'escalonado';
  }
}

export const prosioWebhookService = new ProsioWebhookService();
