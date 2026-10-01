/**
 * Datas do dia operacional das entregas, sempre no horário de Brasília (UTC−3,
 * sem horário de verão desde 2019). As colunas `@db.Date` guardam o dia como
 * meia-noite UTC, e é esse o formato devolvido aqui.
 */
import { AppError } from '../../shared/middleware/error-handler.middleware';

const FUSO_BRASILIA_MS = -3 * 60 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Dia de hoje em Brasília, como meia-noite UTC. */
export function hojeBrasilia(agora: Date = new Date()): Date {
  const local = new Date(agora.getTime() + FUSO_BRASILIA_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Soma dias a uma data de dia (meia-noite UTC). */
export function somarDias(diaBase: Date, dias: number): Date {
  return new Date(diaBase.getTime() + dias * UM_DIA_MS);
}

/** Instante (UTC) em que a data dada chega à hora `hora` de Brasília. */
export function horaDeBrasilia(diaBase: Date, hora: number): Date {
  return new Date(diaBase.getTime() + hora * 60 * 60 * 1000 - FUSO_BRASILIA_MS);
}

/** `YYYY-MM-DD` → meia-noite UTC. Valor ausente → hoje (Brasília). Inválido → 400 `data_invalida`. */
export function lerData(valor: unknown, agora: Date = new Date()): Date {
  if (valor === undefined || valor === null || valor === '') return hojeBrasilia(agora);
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new AppError(400, 'data_invalida');
  }
  const d = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || formatarData(d) !== valor) throw new AppError(400, 'data_invalida');
  return d;
}

/** Meia-noite UTC → `YYYY-MM-DD`. */
export function formatarData(d: Date): string {
  return d.toISOString().slice(0, 10);
}
