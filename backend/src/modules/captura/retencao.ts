/**
 * Retenção das fotos de rótulo (ADR-006, ADR-010, ADR-014).
 *
 * - Foto de pacote: expira em `PacoteDia.data + FOTO_RETENCAO_DIAS_APOS_FIM` (padrão 30),
 *   à meia-noite de Brasília.
 * - Qualquer foto: expira `FOTO_RETENCAO_MAX_DIAS` (padrão 90) depois da captura
 *   (inclusive capturas sem pacote, como pendências nunca resolvidas).
 */
import { prisma } from '../../shared/utils/prisma';
import logger from '../../shared/utils/logger';
import { horaDeBrasilia, somarDias } from '../entregas/datas';
import { dependenciasCaptura } from './captura.contexto';
import { fotosExcluidas } from './captura.metricas';
import type { PhotoStore } from './captura.types';

export const DIAS_APOS_FIM_PADRAO = 30;
export const MAX_DIAS_PADRAO = 90;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export interface ConfigRetencao {
  diasAposFim: number;
  maxDias: number;
}

function inteiroPositivo(v: string | undefined, padrao: number): number {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : padrao;
}

export function configRetencao(env: NodeJS.ProcessEnv = process.env): ConfigRetencao {
  return {
    diasAposFim: inteiroPositivo(env.FOTO_RETENCAO_DIAS_APOS_FIM, DIAS_APOS_FIM_PADRAO),
    maxDias: inteiroPositivo(env.FOTO_RETENCAO_MAX_DIAS, MAX_DIAS_PADRAO),
  };
}

export type MotivoExpiracao = 'fim_do_fluxo' | 'prazo_maximo';

export interface EntradaExpiracao {
  /** `PacoteDia.data` (meia-noite UTC) ou `null` quando a captura não tem pacote. */
  pacoteData: Date | null;
  capturadoEm: Date;
  agora: Date;
  config?: ConfigRetencao;
}

/** A foto já passou do prazo? Devolve o motivo, ou `null`. */
export function motivoExpiracao({ pacoteData, capturadoEm, agora, config = configRetencao() }: EntradaExpiracao): MotivoExpiracao | null {
  if (agora.getTime() >= capturadoEm.getTime() + config.maxDias * UM_DIA_MS) return 'prazo_maximo';
  if (pacoteData && agora.getTime() >= horaDeBrasilia(somarDias(pacoteData, config.diasAposFim), 0).getTime()) return 'fim_do_fluxo';
  return null;
}

export function fotoExpirada(e: EntradaExpiracao): boolean {
  return motivoExpiracao(e) !== null;
}

export interface ExecucaoRetencao {
  agora?: Date;
  config?: ConfigRetencao;
  photoStore?: PhotoStore;
  lote?: number;
}

/**
 * Uma passada do job: exclui as fotos expiradas e grava `Captura.fotoExcluidaEm`.
 * Só a foto é afetada (o `PacoteDia` fica intacto). Devolve quantas excluiu.
 */
export async function executarRetencao(opcoes: ExecucaoRetencao = {}): Promise<number> {
  const deps = dependenciasCaptura();
  const agora = opcoes.agora ?? deps.now();
  const config = opcoes.config ?? configRetencao();
  const photoStore = opcoes.photoStore ?? deps.photoStore;
  const lote = opcoes.lote ?? 500;

  let excluidas = 0;
  let cursor: string | undefined;
  for (;;) {
    const capturas = await prisma.captura.findMany({
      where: { fotoKey: { not: null }, fotoExcluidaEm: null, resultado: { not: 'PROCESSANDO' } },
      select: { id: true, fotoKey: true, pacoteId: true, capturadoEm: true },
      orderBy: { id: 'asc' },
      take: lote,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (capturas.length === 0) break;
    cursor = capturas[capturas.length - 1].id;

    const ids = [...new Set(capturas.map((c) => c.pacoteId).filter((x): x is string => !!x))];
    const pacotes = await prisma.pacoteDia.findMany({ where: { id: { in: ids } }, select: { id: true, data: true } });
    const dataPorPacote = new Map(pacotes.map((p) => [p.id, p.data]));

    for (const c of capturas) {
      const motivo = motivoExpiracao({
        pacoteData: c.pacoteId ? dataPorPacote.get(c.pacoteId) ?? null : null,
        capturadoEm: c.capturadoEm,
        agora,
        config,
      });
      if (!motivo || !c.fotoKey) continue;
      try {
        await photoStore.delete(c.fotoKey);
        await prisma.captura.update({ where: { id: c.id }, data: { fotoExcluidaEm: agora } });
        fotosExcluidas.inc({ motivo });
        excluidas += 1;
      } catch (err) {
        logger.error({ capturaId: c.id, erro: err instanceof Error ? err.name : 'desconhecido' }, 'foto-retencao: falha ao excluir');
      }
    }
    if (capturas.length < lote) break;
  }
  logger.info({ excluidas }, 'foto-retencao: passada concluída');
  return excluidas;
}
