/**
 * Rastreio adaptativo (ADR-016) e aplicação do resultado ao pacote.
 *
 * - De hora em hora, das 7h às 20h (Brasília): só pacotes do dia em `LIDO` ou
 *   `INTERAGINDO` de cargas liberadas.
 * - Varredura às 20h: todos os pacotes de cargas liberadas do dia que ainda não
 *   chegaram a um estado final (`ENTREGUE`, `INSUCESSO`).
 * - `ENTREGUE` cancela o caso de mediação aberto (`cancelarCaso`), uma vez.
 *
 * Também usado de forma síncrona pela resposta tardia (ações de botão).
 */
import type { Prisma, StatusPacote } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import logger from '../../shared/utils/logger';
import { prosioClient as prosioPadrao, type ProsioClient } from '../../integrations/prosio/prosio.client';
import {
  rastreioClient as rastreioPadrao,
  RastreioError,
  type RastreioClient,
  type ResultadoRastreio,
} from '../../integrations/seu-rastreio/rastreio.client';
import { VERSAO_PADROES_RASTREIO } from '../../integrations/seu-rastreio/classificacao';
import { hojeBrasilia } from './datas';
import { horaBrasiliaDe } from './calendario';
import { avancarStatusPacote } from './status';
import { canalDoPacote, carregarPacote } from './orientacao.service';
import { registrarEvento } from './sinais';
import { rastreioConsultasTotal } from './metricas';

export const HORA_INICIO_RASTREIO = 7;
export const HORA_VARREDURA = 20;

const ADAPTATIVOS: readonly StatusPacote[] = ['LIDO', 'INTERAGINDO'];
const FINAIS: readonly StatusPacote[] = ['ENTREGUE', 'INSUCESSO'];

export interface JanelaConsulta {
  /** Hora de Brasília (0–23). */
  hora: number;
  varredura?: boolean;
}

export interface PacoteParaSelecao {
  status: StatusPacote;
  data: Date;
  carga: { status: string; data: Date };
}

/** Regra de seleção (pura): o pacote entra nesta rodada? */
export function deveConsultar(p: PacoteParaSelecao, janela: JanelaConsulta, hoje: Date): boolean {
  if (p.data.getTime() !== hoje.getTime() || p.carga.data.getTime() !== hoje.getTime()) return false;
  if (p.carga.status === 'CARREGADO') return false;
  if (FINAIS.includes(p.status)) return false;
  if (janela.varredura) return true;
  if (janela.hora < HORA_INICIO_RASTREIO || janela.hora > HORA_VARREDURA) return false;
  return ADAPTATIVOS.includes(p.status);
}

/** Mesma regra como filtro do Prisma. Fora da janela (e sem varredura) → nenhum pacote. */
export function selecionarParaConsulta(janela: JanelaConsulta, hoje: Date): Prisma.PacoteDiaWhereInput | null {
  const base: Prisma.PacoteDiaWhereInput = { data: hoje, carga: { data: hoje, status: { not: 'CARREGADO' } } };
  if (janela.varredura) return { ...base, status: { notIn: [...FINAIS] } };
  if (janela.hora < HORA_INICIO_RASTREIO || janela.hora > HORA_VARREDURA) return null;
  return { ...base, status: { in: [...ADAPTATIVOS] } };
}

export interface DepsRastreio {
  rastreio?: RastreioClient;
  prosio?: ProsioClient;
}

/** Instante do evento do rastreio, ou `null` se ausente ou ilegível. */
export function instanteDoEvento(r: ResultadoRastreio | null): Date | null {
  const d = r?.eventoMaisRecente?.data ? new Date(r.eventoMaisRecente.data) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Grava o resultado no pacote (`rastreioDescricao`, `rastreioEm`) e avança o
 * status. Em `ENTREGUE` (transição nova), cancela o caso de mediação.
 */
export async function aplicarResultadoRastreio(
  pacoteId: string,
  resultado: ResultadoRastreio | null,
  deps: DepsRastreio = {},
): Promise<{ status: StatusPacote; mudou: boolean }> {
  const pacote = await carregarPacote(pacoteId);
  if (!pacote) return { status: 'AGUARDANDO_LIBERACAO', mudou: false };
  const descricao = resultado?.eventoMaisRecente?.descricao ?? null;
  const classificacao = resultado?.classificacao ?? null;

  if (!classificacao) {
    if (descricao) {
      logger.info(
        { pacoteId, cargaId: pacote.cargaId, versaoPadroes: VERSAO_PADROES_RASTREIO, descricao },
        'entregas.rastreio.nao_mapeado',
      );
    }
    if (descricao && descricao !== pacote.rastreioDescricao) {
      await prisma.pacoteDia.update({ where: { id: pacoteId }, data: { rastreioDescricao: descricao, rastreioEm: instanteDoEvento(resultado) ?? new Date() } });
    }
    return { status: pacote.status, mudou: false };
  }

  const avanco = avancarStatusPacote(pacote.status, { tipo: 'rastreio', resultado: classificacao });
  // Só avança a partir do estado lido: evita duas rodadas concorrentes cancelarem o caso duas vezes.
  const { count } = await prisma.pacoteDia.updateMany({
    where: { id: pacoteId, status: pacote.status },
    data: {
      rastreioDescricao: descricao,
      rastreioEm: instanteDoEvento(resultado) ?? new Date(),
      ...(avanco.mudou ? { status: avanco.status } : {}),
    },
  });
  const mudou = avanco.mudou && count > 0;
  logger.info({ pacoteId, cargaId: pacote.cargaId, classificacao, de: pacote.status, para: avanco.status, mudou }, 'entregas.rastreio');
  if (!mudou) return { status: pacote.status, mudou: false };

  await registrarEvento(pacoteId, 'rastreio', { classificacao, descricao, status: avanco.status });
  if (avanco.status === 'ENTREGUE' && pacote.mediacaoCaseId) {
    const alvo = canalDoPacote(pacote);
    if (alvo) {
      try {
        await (deps.prosio ?? prosioPadrao).cancelarCaso(alvo.canal, pacote.mediacaoCaseId);
        await registrarEvento(pacoteId, 'caso_cancelado', { caseId: pacote.mediacaoCaseId, motivo: 'entregue' });
      } catch (err) {
        logger.error({ pacoteId, canalId: alvo.canal.id, erro: (err as Error).message }, 'entregas.rastreio falha ao cancelar o caso de mediação');
      }
    }
  }
  return { status: avanco.status, mudou: true };
}

export type ConsultaRastreio =
  | { ok: true; resultado: ResultadoRastreio | null }
  | { ok: false; erro: string };

/** Consulta o rastreio (3 s, sem retry) e aplica ao pacote. Falha não lança. */
export async function consultarEAplicar(
  pacote: { id: string; codigo: string },
  deps: DepsRastreio = {},
  opcoes: { tentativas?: number } = {},
): Promise<ConsultaRastreio> {
  const cliente = deps.rastreio ?? rastreioPadrao;
  const tentativas = Math.max(1, opcoes.tentativas ?? 1);
  let ultimoErro = 'desconhecido';
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const resultado = await cliente.consultar(pacote.codigo);
      rastreioConsultasTotal.inc({ resultado: resultado ? (resultado.classificacao ?? 'sem_classificacao') : 'nao_encontrado' });
      await aplicarResultadoRastreio(pacote.id, resultado, deps);
      return { ok: true, resultado };
    } catch (err) {
      ultimoErro = err instanceof RastreioError ? err.code : (err as Error).message;
      const tentavel = err instanceof RastreioError ? err.tentavel : false;
      if (!tentavel || i === tentativas - 1) break;
    }
  }
  rastreioConsultasTotal.inc({ resultado: 'erro' });
  logger.warn({ pacoteId: pacote.id, erro: ultimoErro }, 'entregas.rastreio consulta falhou');
  return { ok: false, erro: ultimoErro };
}

export interface ResumoRodada {
  consultados: number;
  alterados: number;
  falhas: number;
}

/** Uma rodada do worker (hora em hora ou varredura das 20h). */
export async function processarRastreio(
  janela: { agora: Date; varredura?: boolean },
  deps: DepsRastreio = {},
): Promise<ResumoRodada> {
  const hoje = hojeBrasilia(janela.agora);
  const where = selecionarParaConsulta({ hora: horaBrasiliaDe(janela.agora), varredura: janela.varredura }, hoje);
  if (!where) return { consultados: 0, alterados: 0, falhas: 0 };
  const pacotes = await prisma.pacoteDia.findMany({ where, select: { id: true, codigo: true, status: true }, orderBy: { criadoEm: 'asc' } });
  const resumo: ResumoRodada = { consultados: 0, alterados: 0, falhas: 0 };
  for (const p of pacotes) {
    resumo.consultados += 1;
    const r = await consultarEAplicar(p, deps, { tentativas: 3 });
    if (!r.ok) resumo.falhas += 1;
    else {
      const depois = await prisma.pacoteDia.findUnique({ where: { id: p.id }, select: { status: true } });
      if (depois && depois.status !== p.status) resumo.alterados += 1;
    }
  }
  logger.info({ ...resumo, varredura: !!janela.varredura }, 'entregas.rastreio rodada');
  return resumo;
}
