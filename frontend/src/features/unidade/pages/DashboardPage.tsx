import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useUnidadeStore } from '@/stores/unidade.store';
import { useMonitoramentoStore } from '@/stores/monitoramento.store';
import { AlertBanner } from '@/shared/ui/AlertBanner';
import { Badge } from '@/shared/ui/Badge';
import { KpiCard } from '@/shared/ui/KpiCard';
import { Panel } from '@/shared/ui/Panel';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  dashboardAlerts as mockAlerts,
  dashboardKpis as mockKpis,
  incomingUnitizers as mockUnitizers,
  routePulse as mockPulse,
  routeSnapshots as mockSnapshots,
  type DashboardKpi,
} from '../unidade.data';

export function DashboardPage() {
  const unidadeId = useAuthStore((s) => s.user?.unidadeId);
  const { dashboard, loading: dashLoading, fetchDashboard } = useUnidadeStore();
  const { rotasAtivas, loading: monLoading, fetchRotasAtivas, fetchKpis } = useMonitoramentoStore();

  useEffect(() => {
    if (unidadeId) {
      fetchDashboard(unidadeId);
      fetchKpis(unidadeId);
    }
    fetchRotasAtivas();
  }, [unidadeId, fetchDashboard, fetchKpis, fetchRotasAtivas]);

  const loading = dashLoading || monLoading;

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches — DashboardData shape differs from mock
  const dashData = dashboard as any;
  const dashboardAlerts: typeof mockAlerts = dashData?.alerts ?? mockAlerts;
  const dashboardKpis: DashboardKpi[] = dashData?.kpis ?? mockKpis;
  const routePulse: typeof mockPulse = dashData?.routePulse ?? mockPulse;
  const incomingUnitizers: typeof mockUnitizers = dashData?.incomingUnitizers ?? mockUnitizers;
  const routeSnapshots: typeof mockSnapshots = (rotasAtivas.length > 0
    ? rotasAtivas.map((r: any) => ({
        route: r.codigo ?? r.route,
        district: r.bairro ?? r.district ?? '',
        carteiro: r.carteiro ?? '',
        progress: r.progresso ?? r.progress ?? 0,
        objects: r.objetos ?? r.objects ?? 0,
        prediction: r.previsao ?? r.prediction ?? '',
      }))
    : mockSnapshots);

  if (loading) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {dashboardAlerts.map((alert) => (
          <AlertBanner key={alert.title} title={alert.title} variant={alert.variant}>
            {alert.description}
          </AlertBanner>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            accent={kpi.accent}
            delta={kpi.delta}
            deltaPositive={kpi.deltaPositive}
            label={kpi.label}
            unit={kpi.unit}
            value={kpi.value}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Panel
          title="Pulso operacional"
          description="Acompanhamento sintetico da operacao desde o recebimento ate a entrega confirmada."
        >
          <div className="space-y-4">
            {routePulse.map((item) => (
              <ProgressBar
                key={item.label}
                label={item.label}
                showPercentage
                tone={item.tone}
                value={item.value}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Cobertura da unidade', value: '96%' },
              { label: 'Capacidade em uso', value: '78%' },
              { label: 'Meta de expedicao', value: '09:40' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                <p className="mt-2 text-xl font-bold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Chegadas previstas"
          description="Unitizadores esperados para a proxima hora com status da conferencia."
          actions={<Badge variant="yellow">Proxima janela 08:20</Badge>}
        >
          <div className="space-y-3">
            {incomingUnitizers.map((unitizer) => (
              <div
                key={unitizer.code}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{unitizer.code}</p>
                  <p className="text-sm text-slate-500">
                    {unitizer.origin} • ETA {unitizer.eta}
                  </p>
                </div>
                <Badge variant={unitizer.statusVariant}>{unitizer.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Mapa operacional"
          description="Visao simplificada das zonas da unidade, consolidando rotas com risco de atraso."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { name: 'Zona Central', detail: '18 rotas ativas', tone: 'bg-correios-blue/12 text-correios-blue' },
              { name: 'Corredor Sul', detail: '2 desvios monitorados', tone: 'bg-amber-100 text-amber-700' },
              { name: 'Corredor Leste', detail: 'Operacao estavel', tone: 'bg-emerald-100 text-emerald-700' },
              { name: 'Reserva tecnica', detail: '3 modais disponiveis', tone: 'bg-slate-100 text-slate-700' },
            ].map((zone) => (
              <div
                key={zone.name}
                className={['min-h-32 rounded-[24px] border border-white/40 p-5 shadow-inner', zone.tone].join(' ')}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">{zone.name}</p>
                <p className="mt-3 max-w-48 text-lg font-bold leading-tight">{zone.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Rotas do dia" description="Monitor de progresso das principais rotas em execucao.">
          <div className="space-y-4">
            {routeSnapshots.map((route) => (
              <div key={route.route} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{route.route}</p>
                      <Badge variant="blue">{route.district}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {route.carteiro} • {route.objects} objetos
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{route.prediction}</p>
                </div>
                <div className="mt-4">
                  <ProgressBar showPercentage tone="blue" value={route.progress} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
