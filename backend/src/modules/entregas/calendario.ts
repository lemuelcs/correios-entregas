/**
 * Calendário dos dias de entrega (TechSpec › Convenções: "próximo dia de
 * entrega" = segunda a sexta; sexta → segunda). Os dias da unidade serão
 * configuráveis numa versão futura; por ora a regra é fixa.
 *
 * Dias são meia-noite UTC representando a data de Brasília (ver `datas.ts`).
 */
import { hojeBrasilia, somarDias } from './datas';

const FUSO_BRASILIA_MS = -3 * 60 * 60 * 1000;

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** Segunda a sexta. */
export function ehDiaDeEntrega(dia: Date): boolean {
  const d = dia.getUTCDay();
  return d >= 1 && d <= 5;
}

/** Primeiro dia de entrega DEPOIS de `dia` (sexta, sábado ou domingo → segunda). */
export function proximoDiaDeEntrega(dia: Date = hojeBrasilia()): Date {
  let d = somarDias(dia, 1);
  while (!ehDiaDeEntrega(d)) d = somarDias(d, 1);
  return d;
}

/** `sexta-feira (02/10)`. */
export function formatarDiaDeEntrega(dia: Date): string {
  const dd = String(dia.getUTCDate()).padStart(2, '0');
  const mm = String(dia.getUTCMonth() + 1).padStart(2, '0');
  return `${DIAS_SEMANA[dia.getUTCDay()]} (${dd}/${mm})`;
}

/** Hora de Brasília de um instante: `11h20`, `10h05`, `18h`. */
export function formatarHora(instante: Date): string {
  const local = new Date(instante.getTime() + FUSO_BRASILIA_MS);
  const h = local.getUTCHours();
  const m = local.getUTCMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Hora (0–23) de Brasília de um instante. */
export function horaBrasiliaDe(instante: Date): number {
  return new Date(instante.getTime() + FUSO_BRASILIA_MS).getUTCHours();
}

/** O instante cai no dia `dia` (Brasília)? */
export function mesmoDiaBrasilia(instante: Date, dia: Date): boolean {
  return hojeBrasilia(instante).getTime() === dia.getTime();
}
