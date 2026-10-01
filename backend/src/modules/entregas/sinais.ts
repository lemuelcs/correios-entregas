/**
 * Sinalizações ao supervisor e eventos do pacote (linha do tempo).
 *
 * `sinais` é um conjunto (sem repetição) em `PacoteDia.sinais` e
 * `Orientacao.sinais`: `divergencia`, `nao_entregue_carteiro`,
 * `falha_envio_carteiro`, `nao_foi_possivel`, `retido_consentimento` (task_06)…
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';

type Cliente = Prisma.TransactionClient | typeof prisma;

export async function sinalizarPacote(pacoteId: string, sinal: string, db: Cliente = prisma): Promise<void> {
  await db.$executeRaw`
    UPDATE "pacotes_dia"
       SET "sinais" = array_append(coalesce("sinais", ARRAY[]::text[]), ${sinal}), "atualizadoEm" = now()
     WHERE "id" = ${pacoteId} AND NOT (${sinal} = ANY(coalesce("sinais", ARRAY[]::text[])))`;
}

export async function sinalizarOrientacao(orientacaoId: string, sinal: string, db: Cliente = prisma): Promise<void> {
  await db.$executeRaw`
    UPDATE "orientacoes"
       SET "sinais" = array_append(coalesce("sinais", ARRAY[]::text[]), ${sinal})
     WHERE "id" = ${orientacaoId} AND NOT (${sinal} = ANY(coalesce("sinais", ARRAY[]::text[])))`;
}

export async function registrarEvento(
  pacoteId: string,
  tipo: string,
  dados: Record<string, unknown> = {},
  db: Cliente = prisma,
): Promise<void> {
  await db.eventoPacote.create({ data: { pacoteId, tipo, dados: dados as Prisma.InputJsonValue } });
}

/** Marca o pacote como escalonado ao supervisor (idempotente) e registra o evento. */
export async function escalonarPacote(pacoteId: string, motivo: string, extras: Record<string, unknown> = {}, db: Cliente = prisma): Promise<boolean> {
  const { count } = await db.pacoteDia.updateMany({ where: { id: pacoteId, escalonado: false }, data: { escalonado: true } });
  await registrarEvento(pacoteId, 'escalonado', { motivo, ...extras }, db);
  return count > 0;
}
