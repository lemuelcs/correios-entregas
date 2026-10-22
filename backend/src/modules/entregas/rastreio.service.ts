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
 * O rastreio (SRO) diz o desfecho da orientação, no lugar do "Feito" / "Não foi possível" do
 * carteiro: `ENTREGUE` → FEITA; `INSUCESSO` → NÃO FOI POSSÍVEL (motivo `OUTRO`). Só mexe nas que
 * ainda aguardam resposta (ENVIADA / VISTA); a que o carteiro já respondeu fica como está.
 */
async function fecharOrientacoesPeloRastreio(pacoteId: string, status: StatusPacote): Promise<void> {
  if (status !== 'ENTREGUE' && status !== 'INSUCESSO') return;
  const feita = status === 'ENTREGUE';
  const { count } = await prisma.orientacao.updateMany({
    where: { pacoteId, estado: { in: ['ENVIADA', 'VISTA'] } },
    data: {
      estado: feita ? 'FEITA' : 'NAO_FOI_POSSIVEL',
      respostaCarteiro: feita ? 'FEITO' : 'OUTRO',
      respondidoEm: new Date(),
    },
  });
  if (count > 0) await registrarEvento(pacoteId, 'orientacao_fechada_rastreio', { estado: feita ? 'FEITA' : 'NAO_FOI_POSSIVEL', origem: 'rastreio' });
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
  await fecharOrientacoesPeloRastreio(pacoteId, avanco.status);
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

// ——— Atualização sob demanda (página dos pacotes da rota) ———————————————

export interface ResumoAtualizacaoCarga {
  consultados: number;
  /** Pacotes cujo último evento do rastreio mudou. */
  atualizados: number;
  falhas: number;
  /** Primeiro erro que interrompeu a rodada (`sem_credencial`, `http_402`…), se houve. */
  erro: string | null;
  /** Consulta pulada: outra rodada da mesma carga começou há pouco. */
  recente: boolean;
}

const CONCORRENCIA_ATUALIZACAO = 8;
const INTERVALO_MINIMO_MS = 20_000;
const ERROS_QUE_ENCERRAM = new Set(['sem_credencial', 'nao_autorizado', 'http_402']);
const ultimaRodadaDaCarga = new Map<string, number>();

/**
 * Consulta o rastreio de TODOS os pacotes da carga e grava o último evento
 * (`rastreioDescricao`/`rastreioEm`). Em carga liberada, aplica também o avanço
 * de status da regra normal; em carga ainda não liberada só registra o evento
 * (o status do pacote não muda antes da liberação). Falha não lança.
 */
export async function atualizarRastreioDaCarga(
  carga: { id: string; status: string },
  deps: DepsRastreio = {},
  agora = new Date(),
): Promise<ResumoAtualizacaoCarga> {
  const anterior = ultimaRodadaDaCarga.get(carga.id);
  if (anterior !== undefined && agora.getTime() - anterior < INTERVALO_MINIMO_MS) {
    return { consultados: 0, atualizados: 0, falhas: 0, erro: null, recente: true };
  }
  ultimaRodadaDaCarga.set(carga.id, agora.getTime());

  const cliente = deps.rastreio ?? rastreioPadrao;
  const liberada = carga.status !== 'CARREGADO';
  const pacotes = await prisma.pacoteDia.findMany({
    where: { cargaId: carga.id },
    select: { id: true, codigo: true, rastreioDescricao: true },
    orderBy: { criadoEm: 'asc' },
  });
  const resumo: ResumoAtualizacaoCarga = { consultados: 0, atualizados: 0, falhas: 0, erro: null, recente: false };
  let proximo = 0;

  async function trabalhador(): Promise<void> {
    while (resumo.erro === null) {
      const p = pacotes[proximo];
      proximo += 1;
      if (!p) return;
      resumo.consultados += 1;
      try {
        const resultado = await cliente.consultar(p.codigo);
        rastreioConsultasTotal.inc({ resultado: resultado ? (resultado.classificacao ?? 'sem_classificacao') : 'nao_encontrado' });
        if (!resultado) continue;
        if (liberada) {
          await aplicarResultadoRastreio(p.id, resultado, deps);
        } else {
          const descricao = resultado.eventoMaisRecente?.descricao ?? null;
          if (descricao) {
            await prisma.pacoteDia.update({ where: { id: p.id }, data: { rastreioDescricao: descricao, rastreioEm: instanteDoEvento(resultado) ?? new Date() } });
          }
        }
        if ((resultado.eventoMaisRecente?.descricao ?? null) !== p.rastreioDescricao) resumo.atualizados += 1;
      } catch (err) {
        const codigo = err instanceof RastreioError ? err.code : (err as Error).message;
        resumo.falhas += 1;
        rastreioConsultasTotal.inc({ resultado: 'erro' });
        if (ERROS_QUE_ENCERRAM.has(codigo)) resumo.erro = codigo;
        logger.warn({ pacoteId: p.id, erro: codigo }, 'entregas.rastreio atualização da carga falhou');
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ATUALIZACAO, pacotes.length) }, () => trabalhador()));
  logger.info({ cargaId: carga.id, ...resumo }, 'entregas.rastreio atualização da carga');
  return resumo;
}
