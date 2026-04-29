import { useEffect, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAuthStore } from '@/stores/auth.store';
import { useMonitoramentoStore } from '@/stores/monitoramento.store';
import { useSse } from '@/hooks/useSse';
import type { Rota } from '@/types/api.types';
import { AlertBanner } from '@/shared/ui/AlertBanner';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  liveRoutes as mockLiveRoutes,
  monitoringAlerts as mockAlerts,
} from '../unidade.data';

// ── Demo data for scatter chart when no real API data is available ────
const DEMO_PLANNED = [
  { hora: 9, parada: 1 },
  { hora: 9.5, parada: 5 },
  { hora: 10, parada: 10 },
  { hora: 10.5, parada: 16 },
  { hora: 11, parada: 22 },
  { hora: 11.5, parada: 27 },
  { hora: 12, parada: 33 },
  { hora: 13, parada: 38 },
  { hora: 13.5, parada: 42 },
  { hora: 14, parada: 44 },
];

const DEMO_EXECUTED = [
  { hora: 9, parada: 1 },
  { hora: 9.5, parada: 4 },
  { hora: 10, parada: 9 },
  { hora: 10.5, parada: 14 },
  { hora: 11, parada: 20 },
  { hora: 11.5, parada: 25 },
];

function getCurrentHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

/**
 * Converts route paradas into scatter-plot data points.
 * - Planned series: from estimativaChegada
 * - Executed series: from chegadaReal (status CONCLUIDA)
 */
function buildScatterData(rotasAtivas: Rota[]) {
  const planned: Array<{ hora: number; parada: number }> = [];
  const executed: Array<{ hora: number; parada: number }> = [];

  for (const rota of rotasAtivas) {
    const paradas = rota.paradas ?? [];
    for (const p of paradas) {
      if (p.estimativaChegada) {
        const d = new Date(p.estimativaChegada);
        planned.push({
          hora: d.getHours() + d.getMinutes() / 60,
          parada: p.sequencia,
        });
      }
      if (p.statusAtual === 'CONCLUIDA' && p.estimativaChegada) {
        const d = new Date(p.estimativaChegada);
        executed.push({
          hora: d.getHours() + d.getMinutes() / 60,
          parada: p.sequencia,
        });
      }
    }
  }

  return { planned, executed };
}

export function MonitoramentoPage() {
  const unidadeId = useAuthStore((s) => s.user?.unidadeId);
  const { rotasAtivas, alertas, loading, fetchRotasAtivas, fetchKpis } =
    useMonitoramentoStore();
  const updateRotaFromSse = useMonitoramentoStore((s) => s.updateRotaFromSse);

  // ── SSE real-time updates ────────────────────────────────────────────
  useSse(unidadeId, {
    onRotaUpdate: (data) => updateRotaFromSse(data),
  });

  useEffect(() => {
    fetchRotasAtivas();
    if (unidadeId) fetchKpis(unidadeId);
  }, [unidadeId, fetchRotasAtivas, fetchKpis]);

  // Auto-refresh every 30s for live monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRotasAtivas();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchRotasAtivas]);

  // Use API data when available, fall back to mock data for development/demo
  type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
  const monitoringAlerts =
    alertas.length > 0
      ? alertas.map((a) => ({
          route: a.rota ?? a.route ?? '',
          issue: a.descricao ?? a.issue ?? '',
          severity: (a.severidade ?? a.severity ?? 'warning') as AlertVariant,
        }))
      : mockAlerts;
  const liveRoutes =
    rotasAtivas.length > 0
      ? rotasAtivas.map((r) => ({
          route: r.codigo,
          carteiro: r.carteiro?.usuario?.nome ?? '',
          planned: r.totalParadas,
          actual: r.totalEntregues,
          lastEvent: r.iniciadoEm ?? '',
          incidents: r.totalInsucessos,
        }))
      : mockLiveRoutes;

  // ── Scatter chart data ───────────────────────────────────────────────
  const { planned, executed } = useMemo(() => {
    const fromApi = buildScatterData(rotasAtivas);
    if (fromApi.planned.length > 0 || fromApi.executed.length > 0) {
      return fromApi;
    }
    // Fallback to demo data
    return { planned: DEMO_PLANNED, executed: DEMO_EXECUTED };
  }, [rotasAtivas]);

  const currentHour = getCurrentHour();

  if (loading && rotasAtivas.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        {monitoringAlerts.map((alert) => (
          <AlertBanner
            key={`${alert.route}-${alert.issue}`}
            title={`${alert.route} • ${alert.issue}`}
            variant={alert.severity}
          >
            A acao recomendada para a central e abrir tratativa imediata com a
            equipe de campo.
          </AlertBanner>
        ))}
      </section>

      <Panel
        title="Planejado x executado"
        description="Comparacao da execucao atual frente ao plano de rota e alertas associados."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {liveRoutes.map((route) => (
            <div
              key={route.route}
              className="rounded-[24px] border border-slate-200 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{route.route}</p>
                    <Badge
                      variant={
                        route.actual >= route.planned ? 'success' : 'warning'
                      }
                    >
                      {route.carteiro}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {route.lastEvent}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  {route.incidents} incidentes
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <ProgressBar
                  label="Planejado"
                  showPercentage
                  tone="blue"
                  value={route.planned}
                />
                <ProgressBar
                  label="Executado"
                  showPercentage
                  tone={route.actual >= route.planned ? 'green' : 'amber'}
                  value={route.actual}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Scatter chart: Planejado vs Executado ao longo do dia ─────── */}
      <Panel
        title="Planejado vs Executado — Timeline"
        description="Dispersao de paradas planejadas (cinza) vs executadas (azul) ao longo do dia. A linha vermelha indica o horario atual."
      >
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="hora"
                name="Hora"
                domain={[7, 18]}
                tickCount={12}
                tickFormatter={(v: number) => {
                  const h = Math.floor(v);
                  const m = Math.round((v - h) * 60);
                  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }}
                label={{ value: 'Hora do dia', position: 'insideBottom', offset: -10 }}
              />
              <YAxis
                type="number"
                dataKey="parada"
                name="Parada"
                label={{ value: 'N. da parada', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Hora') {
                    const h = Math.floor(value);
                    const m = Math.round((value - h) * 60);
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  }
                  return value;
                }}
              />
              <Legend />
              <ReferenceLine
                x={currentHour}
                stroke="#DC2626"
                strokeDasharray="4 4"
                label={{ value: 'Agora', position: 'top', fill: '#DC2626', fontSize: 12 }}
              />
              <Scatter
                name="Planejado"
                data={planned}
                fill="#9CA3AF"
                shape="circle"
                legendType="circle"
              />
              <Scatter
                name="Executado"
                data={executed}
                fill="#003399"
                shape="diamond"
                legendType="diamond"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
