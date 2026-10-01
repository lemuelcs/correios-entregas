/**
 * Métricas da captura (TechSpec › Monitoring), no mesmo registro do `/metrics`.
 */
import client from 'prom-client';
import { register } from '../../shared/middleware/metrics.middleware';

function contador<T extends string>(name: string, help: string, labelNames: readonly T[] = []) {
  return (register.getSingleMetric(name) as client.Counter<T> | undefined)
    ?? new client.Counter<T>({ name, help, labelNames, registers: [register] });
}

export const capturaProcessadas = contador('captura_processadas_total', 'Capturas processadas por resultado', ['resultado'] as const);

export const capturaDuracao = (register.getSingleMetric('captura_duracao_segundos') as client.Histogram<'etapa'> | undefined)
  ?? new client.Histogram({
    name: 'captura_duracao_segundos',
    help: 'Duração das etapas do processamento de uma captura',
    labelNames: ['etapa'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 20],
    registers: [register],
  });

export const capturaLlmTokens = contador('captura_llm_tokens_total', 'Tokens do LLM na extração do rótulo', ['tipo'] as const);
export const capturaLlmFalhas = contador('captura_llm_falhas_total', 'Falhas da extração do rótulo', ['motivo'] as const);
export const cepLookup = contador('cep_lookup_total', 'Consultas de CEP por fonte e resultado', ['fonte', 'resultado'] as const);
export const capturaGanchoAvisoFalhas = contador('captura_gancho_aviso_falhas_total', 'Falhas ao chamar o gancho de aviso do monitoramento');
export const fotosExcluidas = contador('fotos_excluidas_total', 'Fotos de rótulo excluídas por motivo', ['motivo'] as const);

export const fotosArmazenadasBytes = (register.getSingleMetric('fotos_armazenadas_bytes') as client.Gauge | undefined)
  ?? new client.Gauge({
    name: 'fotos_armazenadas_bytes',
    help: 'Bytes de fotos de rótulo gravados (variação desde o início do processo)',
    registers: [register],
  });

/** Mede uma etapa em segundos. */
export async function medir<T>(etapa: string, fn: () => Promise<T>): Promise<T> {
  const fim = capturaDuracao.startTimer({ etapa });
  try {
    return await fn();
  } finally {
    fim();
  }
}
