/**
 * Helpers dos testes da liberação: worker real da fila `entregas-aviso`,
 * drenagem explícita e relógio de Brasília (só `Date` é falsificado; timers,
 * sockets e o BullMQ seguem reais).
 */
import { entregasAvisoQueue } from '../../queue';
import { formatarData } from '../../modules/entregas/datas';

/** Instante `hh:mm` de Brasília no dia `dia` (meia-noite UTC). */
export function brasilia(dia: Date, hhmm: string): Date {
  return new Date(`${formatarData(dia)}T${hhmm}:00.000-03:00`);
}

const NAO_FALSIFICAR = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate',
  'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
] as const;

/** Roda `fn` com `Date` parado em `instante` (o resto do relógio segue real). */
export async function noInstante<T>(instante: Date, fn: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({ now: instante, doNotFake: [...NAO_FALSIFICAR] });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

export async function aguardar(
  condicao: () => Promise<boolean> | boolean,
  { timeoutMs = 10_000, intervaloMs = 40, descricao = 'condição' }: { timeoutMs?: number; intervaloMs?: number; descricao?: string } = {},
): Promise<void> {
  const fim = Date.now() + timeoutMs;
  for (;;) {
    if (await condicao()) return;
    if (Date.now() > fim) throw new Error(`tempo esgotado esperando ${descricao}`);
    await new Promise((ok) => setTimeout(ok, intervaloMs));
  }
}

/**
 * Espera a fila esvaziar: nada aguardando nem ativo, e nenhum job atrasado por
 * menos de 1 min (backoff, limite por minuto). Os adiados para 06:05 e os
 * reenvios de 30 min ficam de fora.
 */
export async function drenarAvisos(timeoutMs = 10_000): Promise<void> {
  let estavel = 0;
  await aguardar(async () => {
    const c = await entregasAvisoQueue.getJobCounts('waiting', 'active', 'prioritized', 'paused');
    const atrasados = (await entregasAvisoQueue.getDelayed()).filter((j) => (j.opts.delay ?? 0) < 60_000);
    const vazia = c.waiting + c.active + c.prioritized + c.paused === 0 && atrasados.length === 0;
    estavel = vazia ? estavel + 1 : 0;
    return estavel >= 3;
  }, { timeoutMs, descricao: 'a fila entregas-aviso esvaziar' });
}

/** Esvazia a fila (aguardando e atrasados) entre os testes. */
export async function esvaziarFilaAviso(): Promise<void> {
  await entregasAvisoQueue.drain(true);
}

export { entregasAvisoQueue };
