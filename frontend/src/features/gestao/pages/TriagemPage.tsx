import { useEffect } from 'react';
import { useTriagemStore } from '@/stores/triagem.store';
import { AlertBanner } from '@/shared/ui/AlertBanner';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  triageLanes as mockLanes,
  triageModes as mockModes,
  triagePlan as mockPlan,
} from '../gestao.data';

export function TriagemPage() {
  const { status, sortPlan, loading, fetchStatus } = useTriagemStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const triageLanes: typeof mockLanes = status?.lanes ?? mockLanes;
  const triageModes: typeof mockModes = status?.modes ?? mockModes;
  const triagePlan: typeof mockPlan = (sortPlan as any)?.waves ?? status?.plan ?? mockPlan;

  if (loading && !status) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <AlertBanner title="Esteira C acima do patamar ideal" variant="warning">
        A carga do corredor leste exige redistribuicao de operadores para evitar atraso no despacho da terceira onda.
      </AlertBanner>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Sort wall" description="Leitura visual das frentes de triagem e nivel de backlog por esteira.">
          <div className="grid gap-4 md:grid-cols-2">
            {triageLanes.map((lane) => (
              <div key={lane.lane} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{lane.lane}</p>
                    <p className="text-sm text-slate-500">{lane.route}</p>
                  </div>
                  <Badge variant={lane.tone === 'red' ? 'danger' : lane.tone === 'amber' ? 'warning' : lane.tone === 'green' ? 'success' : 'blue'}>
                    {lane.backlog}
                  </Badge>
                </div>
                <div className="mt-4">
                  <ProgressBar label="Utilizacao" showPercentage tone={lane.tone} value={lane.utilization} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Modos de triagem" description="Politicas ativas e criterios para comutacao operacional.">
          <div className="space-y-3">
            {triageModes.map((mode) => (
              <div key={mode.label} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{mode.label}</p>
                  <Badge variant="yellow">{mode.badge}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{mode.description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Plano de ondas" description="Sequenciamento da triagem para garantir o despacho dentro da janela da unidade.">
        <div className="grid gap-4 md:grid-cols-3">
          {triagePlan.map((wave) => (
            <div key={wave.wave} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{wave.slot}</p>
              <p className="mt-3 text-lg font-bold text-slate-950">{wave.wave}</p>
              <p className="mt-2 text-sm font-medium text-slate-600">{wave.team}</p>
              <p className="mt-1 text-sm text-slate-500">{wave.focus}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
