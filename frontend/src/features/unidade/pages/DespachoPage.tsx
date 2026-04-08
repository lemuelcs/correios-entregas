import { useEffect } from 'react';
import { useDespachoStore } from '@/stores/despacho.store';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import {
  dispatchChecklist as mockChecklist,
  dispatchRoutes as mockRoutes,
} from '../unidade.data';

export function DespachoPage() {
  const { rotasPendentes, loading, fetchRotasPendentes, liberarRota } = useDespachoStore();

  useEffect(() => {
    fetchRotasPendentes();
  }, [fetchRotasPendentes]);

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const dispatchChecklist = mockChecklist;
  const dispatchRoutes = rotasPendentes.length > 0
    ? rotasPendentes.map((r: any) => ({
        route: r.codigo ?? r.route,
        carteiro: r.carteiro ?? '',
        vehicle: r.veiculo ?? r.vehicle ?? '',
        objects: r.objetos ?? r.objects ?? 0,
        window: r.janela ?? r.window ?? '',
        ready: r.pronta ?? r.ready ?? false,
      }))
    : mockRoutes;

  const handleLiberarRota = (routeId: string) => {
    liberarRota(routeId, {}).then(() => fetchRotasPendentes());
  };

  if (loading && rotasPendentes.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Checklist de liberacao" description="Itens obrigatorios antes da expediacao das rotas para campo.">
          <div className="space-y-3">
            {dispatchChecklist.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
                  OK
                </div>
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Rotas prontas para despacho" description="Status de liberacao por rota, carteiro e modal associado.">
          <div className="space-y-4">
            {dispatchRoutes.map((route) => (
              <div key={route.route} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{route.route}</p>
                      <Badge variant={route.ready ? 'success' : 'warning'}>
                        {route.ready ? 'Pronta' : 'Pendencia'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {route.carteiro} • {route.vehicle} • {route.objects} objetos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Saida prevista</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{route.window}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleLiberarRota(route.route)}
                    disabled={loading}
                    className="rounded-full bg-correios-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
                  >
                    {loading ? 'Liberando...' : 'Liberar rota'}
                  </button>
                  <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Ver checklist
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
