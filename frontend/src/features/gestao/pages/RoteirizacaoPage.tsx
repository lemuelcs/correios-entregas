import { useEffect } from 'react';
import { useRoteirizacaoStore } from '@/stores/roteirizacao.store';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  routeOptimizationResults as mockResults,
  routeScenarios as mockScenarios,
} from '../gestao.data';

export function RoteirizacaoPage() {
  const { jobId, jobStatus, resultado, loading, executar, pollJobStatus, fetchResultado, aprovar } = useRoteirizacaoStore();

  // Poll job status when a job is active
  useEffect(() => {
    if (jobId && jobStatus?.status !== 'DONE') {
      const interval = setInterval(() => pollJobStatus(jobId), 3000);
      return () => clearInterval(interval);
    }
  }, [jobId, jobStatus?.status, pollJobStatus]);

  // Fetch resultado when job is done
  useEffect(() => {
    if (jobId && jobStatus?.status === 'DONE') {
      fetchResultado(jobId);
    }
  }, [jobId, jobStatus?.status, fetchResultado]);

  const handleExecutar = () => executar();
  const handleAprovar = () => { if (jobId) aprovar(jobId); };

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const routeScenarios: typeof mockScenarios = resultado?.scenarios ?? mockScenarios;
  const routeOptimizationResults: typeof mockResults = resultado?.routes ?? mockResults;

  if (loading && !resultado) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel title="Cenarios do solver" description="Comparativo rapido entre os cenarios disponiveis para a geracao das rotas.">
          <div className="space-y-3">
            {routeScenarios.map((scenario) => (
              <div key={scenario.name} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{scenario.name}</p>
                    <p className="text-sm text-slate-500">{scenario.solver}</p>
                  </div>
                  <Badge variant={scenario.recommended ? 'success' : 'blue'}>
                    {scenario.recommended ? 'Recomendado' : 'Alternativo'}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ganho</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{scenario.gain}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Compromisso</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{scenario.commitment}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Resultado das rotas" description="Consolidado do processamento atual com ocupacao e horario previsto de saida.">
          <div className="space-y-4">
            {routeOptimizationResults.map((route) => (
              <div key={route.route} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{route.route}</p>
                      <Badge variant="blue">{route.modal}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {route.stops} paradas • {route.objects} objetos
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">Saida {route.departure}</p>
                </div>
                <div className="mt-4">
                  <ProgressBar label="Ocupacao" showPercentage tone={route.occupation > 80 ? 'amber' : 'blue'} value={route.occupation} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExecutar}
          disabled={loading}
          className="rounded-full bg-correios-blue px-5 py-2 text-sm font-semibold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Executar roteirizacao'}
        </button>
        {jobId && jobStatus?.status === 'DONE' && (
          <button
            onClick={handleAprovar}
            disabled={loading}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Aprovar resultado
          </button>
        )}
        {jobId && jobStatus?.status && jobStatus.status !== 'DONE' && (
          <span className="flex items-center rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
            Status: {jobStatus.status}
          </span>
        )}
      </div>

      <Panel title="Parametros ativos" description="Configuracao atual utilizada no processamento da roteirizacao.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Solver principal', 'PyVRP'],
            ['Modo de otimizacao', 'Balanceado'],
            ['Capacidade maxima por rota', '190 objetos'],
            ['Tolerancia de geocode aproximado', '2%'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
              <p className="mt-3 text-lg font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
