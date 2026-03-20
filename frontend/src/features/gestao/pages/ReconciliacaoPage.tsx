import { useEffect, useState } from 'react';
import { useReconciliacaoStore } from '@/stores/reconciliacao.store';
import { Badge } from '@/shared/ui/Badge';
import { KpiCard } from '@/shared/ui/KpiCard';
import { Panel } from '@/shared/ui/Panel';
import {
  reconciliationPending as mockPending,
  reconciliationReturns as mockReturns,
  reconciliationSummary as mockSummary,
} from '../gestao.data';

export function ReconciliacaoPage() {
  const { pendentes, loading, scanRetorno, fetchPendentes, finalizarRota } = useReconciliacaoStore();
  const [scanInput, setScanInput] = useState('');

  useEffect(() => {
    // Fetch pendentes for a default route; in production this would use a selected route
    fetchPendentes('all');
  }, [fetchPendentes]);

  const handleScanRetorno = () => {
    if (scanInput.trim()) {
      scanRetorno(scanInput.trim());
      setScanInput('');
    }
  };

  const handleFinalizarRota = (rotaId: string) => {
    finalizarRota(rotaId).then(() => fetchPendentes('all'));
  };

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const reconciliationSummary = mockSummary;
  const reconciliationReturns = mockReturns;
  const reconciliationPending = pendentes.length > 0
    ? pendentes.map((p: any) => ({
        objectCode: p.codigoRastreio ?? p.objectCode ?? '',
        route: p.rota ?? p.route ?? '',
        reason: p.motivo ?? p.reason ?? '',
        action: p.acao ?? p.action ?? '',
      }))
    : mockPending;

  if (loading && pendentes.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reconciliationSummary.map((item) => (
          <KpiCard key={item.label} accent={item.accent} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel title="Retornos escaneados" description="Leituras de retorno realizadas na unidade durante o fechamento das rotas.">
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanRetorno()}
              placeholder="Escanear codigo de retorno..."
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-correios-blue focus:outline-none focus:ring-1 focus:ring-correios-blue"
            />
            <button
              onClick={handleScanRetorno}
              disabled={loading}
              className="rounded-full bg-correios-blue px-5 py-2 text-sm font-semibold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
            >
              {loading ? 'Lendo...' : 'Escanear'}
            </button>
          </div>
          <div className="space-y-3">
            {reconciliationReturns.map((item) => (
              <div key={item.code} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.code}</p>
                    <p className="text-sm text-slate-500">
                      {item.route} • scan {item.scannedAt}
                    </p>
                  </div>
                  <Badge variant={item.status === 'Conferido' ? 'success' : 'warning'}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pendencias de reconciliacao" description="Objetos e rotas que ainda exigem tratamento para o fechamento do dia.">
          <div className="space-y-3">
            {reconciliationPending.map((item) => (
              <div key={item.objectCode} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{item.objectCode}</p>
                      <Badge variant="warning">{item.route}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{item.reason}</p>
                  </div>
                  <button
                    onClick={() => handleFinalizarRota(item.route)}
                    disabled={loading}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {item.action}
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
