/**
 * Métricas das entregas mediadas (TechSpec › Monitoring and Observability),
 * expostas em `/metrics` pelo registro do backend.
 */
import client from 'prom-client';
import { metricsRegistry } from '../../shared/middleware/metrics.middleware';

function contador<L extends string>(name: string, help: string, labelNames: readonly L[]): client.Counter<L> {
  const existente = metricsRegistry.getSingleMetric(name);
  if (existente) return existente as client.Counter<L>;
  return new client.Counter({ name, help, labelNames, registers: [metricsRegistry] });
}

export const avisosTotal = contador('entregas_avisos_total', 'Avisos e resumos enviados ao Prosio', ['resultado'] as const);
export const acoesTotal = contador('entregas_acoes_total', 'Ações de botão recebidas do Prosio', ['prefixo', 'valor'] as const);
export const webhookTotal = contador('entregas_webhook_total', 'Callbacks recebidos do Prosio', ['tipo', 'resultado'] as const);
export const orientacoesTotal = contador('entregas_orientacoes_total', 'Orientações registradas', ['tipo', 'origem'] as const);
export const rastreioConsultasTotal = contador('entregas_rastreio_consultas_total', 'Consultas ao Seu Rastreio', ['resultado'] as const);

export const acaoDuracao: client.Histogram<'prefixo'> =
  (metricsRegistry.getSingleMetric('entregas_acao_duracao_seconds') as client.Histogram<'prefixo'> | undefined) ??
  new client.Histogram({
    name: 'entregas_acao_duracao_seconds',
    help: 'Duração das ações de botão (inclui a consulta ao rastreio)',
    labelNames: ['prefixo'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 4, 6, 10],
    registers: [metricsRegistry],
  });
