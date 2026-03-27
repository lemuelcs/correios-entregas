import { useEffect } from 'react';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { Badge } from '@/shared/ui/Badge';
import { historyData } from '../carteiro.data';

export function HistoricoPage() {
  const { historico, loading, fetchHistorico } = useCarteiroAppStore();

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  // Map store data to display rows, falling back to mock
  const hasStoreData = historico.length > 0;

  const displayEntries = hasStoreData
    ? historico.map((rota) => {
        const total = rota.totalObjetos || 1;
        const entregues = rota.totalEntregues ?? 0;
        const successPct = ((entregues / total) * 100).toFixed(1).replace('.', ',');
        const sph = rota.duracaoEstimadaMin && rota.duracaoEstimadaMin > 0
          ? (entregues / (rota.duracaoEstimadaMin / 60)).toFixed(1).replace('.', ',')
          : '--';
        const date = rota.concluidoEm
          ? new Date(rota.concluidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : rota.codigo;

        return {
          key: rota.id,
          date,
          delivered: entregues,
          sph,
          successRate: `${successPct}%`,
          fadr: sph,
          successNum: parseFloat(successPct.replace(',', '.')),
        };
      })
    : historyData.map((entry) => ({
        key: entry.date,
        date: entry.date,
        delivered: entry.delivered,
        sph: entry.sph,
        successRate: entry.successRate,
        fadr: entry.fadr,
        successNum: parseFloat(entry.successRate.replace('%', '').replace(',', '.')),
      }));

  // Compute FADR average
  const avgFadr = displayEntries.length > 0
    ? (displayEntries.reduce((sum, e) => sum + parseFloat(String(e.fadr).replace(',', '.') || '0'), 0) / displayEntries.length)
        .toFixed(1)
        .replace('.', ',')
    : '17,8';

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <div className="rounded-[26px] bg-correios-blue p-5 text-center shadow-[0_20px_44px_rgba(0,51,153,0.18)]">
        <p className="text-xs text-white/70">FADR - Fator de Aproveitamento da Distribuicao</p>
        <p className="mt-2 text-4xl font-black text-correios-yellow">{avgFadr}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/60">Media 30 dias • Meta 18,0</p>
      </div>

      {loading ? (
        <div className="text-center">
          <p className="text-sm text-slate-500">Carregando historico...</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        {displayEntries.map((entry) => (
          <div key={entry.key} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{entry.date}</p>
              <Badge size="sm" variant={entry.successNum >= 95 ? 'success' : entry.successNum >= 90 ? 'info' : 'warning'}>
                {entry.successRate}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span>Entregues {entry.delivered}</span>
              <span>SPH {entry.sph}</span>
              <span>FADR {entry.fadr}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
