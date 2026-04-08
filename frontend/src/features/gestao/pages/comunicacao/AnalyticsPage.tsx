import { useEffect } from 'react';
import { KpiCard } from '@/shared/ui/KpiCard';
// Badge reservado para uso futuro em status indicators
import { useComunicacaoStore } from '@/stores/comunicacao.store';

// ── MiniBar ─────────────────────────────────────────────────────────────────

function MiniBar({ data, maxVal, color = 'bg-[#003399]', height = 64 }: { data: number[]; maxVal: number; color?: string; height?: number }) {
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((v, i) => {
        const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex flex-1 flex-col-reverse">
            <div className={`${color} rounded-t-sm opacity-80 transition-opacity hover:opacity-100`} style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { adminStats, fetchAdminStats, llmAnalytics, fetchLlmAnalytics, loading } = useComunicacaoStore();

  useEffect(() => {
    // Fetch stats for last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    fetchAdminStats(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    fetchLlmAnalytics();
  }, []);

  // Derive chart data from llmAnalytics daily
  const dailyCosts = llmAnalytics?.daily ?? [];
  const costValues = dailyCosts.map((d) => d.costUsd);
  void dailyCosts.map((d) => d.requests); // reservado para chart futuro

  const totalCostUsd = llmAnalytics?.totalCostUsd ?? adminStats?.llmCostUsd ?? 0;
  const taxaBot = adminStats?.taxaBot ?? 0;
  const handoffs = adminStats?.sessoesDispatcher ?? 0;
  const totalSessoes = adminStats?.sessoesAtivas ?? 0;
  const handoffPct = totalSessoes > 0 ? Math.round((handoffs / totalSessoes) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Resolucao Bot (periodo)" value={`${taxaBot}%`} accent="green" />
        <KpiCard
          label="Handoffs para humano"
          value={String(handoffs)}
          accent="amber"
          delta={handoffPct > 0 ? `${handoffPct}% das conversas` : ''}
          deltaPositive={false}
        />
        <KpiCard label="Custo LLM (periodo)" value={`US$ ${totalCostUsd.toFixed(2)}`} accent="yellow" />
        <KpiCard
          label="Requisicoes LLM"
          value={String(llmAnalytics?.totalRequests ?? adminStats?.llmRequests ?? 0)}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stats de mensagens */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">Mensagens — Periodo</h2>
          {adminStats ? (
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              {[
                { label: 'Enviadas', value: adminStats.mensagensEnviadas, color: 'text-blue-600' },
                { label: 'Recebidas', value: adminStats.mensagensRecebidas, color: 'text-green-600' },
                { label: 'Entregues', value: adminStats.entregues, color: 'text-gray-800' },
                { label: 'Lidas', value: adminStats.lidas, color: 'text-gray-800' },
                { label: 'Falhas', value: adminStats.falhas, color: adminStats.falhas > 0 ? 'text-red-600' : 'text-gray-800' },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-gray-500">{m.label}</p>
                  <p className={`text-lg font-black ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">{loading ? 'Carregando...' : 'Sem dados'}</p>
          )}
        </div>

        {/* Custo LLM diario */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">Custo LLM — Diario</h2>
          <p className="mb-3 text-[10px] text-gray-400">US$ por dia de operacao</p>
          {costValues.length > 0 ? (
            <>
              <MiniBar data={costValues} maxVal={Math.max(...costValues, 1)} color="bg-[#FFD600]" height={80} />
              <div className="mt-1 flex justify-between text-[9px] text-gray-400">
                <span>{dailyCosts[0]?.date ?? ''}</span>
                <span>{dailyCosts[dailyCosts.length - 1]?.date ?? ''}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl font-black text-amber-600">US$ {totalCostUsd.toFixed(2)}</span>
                <span className="text-xs text-gray-500">total no periodo</span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">{loading ? 'Carregando...' : 'Sem dados LLM'}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Sessoes breakdown */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Sessoes por Tipo</h2>
          {adminStats ? (
            <div className="space-y-2.5">
              {[
                { label: 'Total sessoes', value: adminStats.sessoesAtivas, pct: 100 },
                { label: 'Sessoes Bot', value: adminStats.sessoesBot, pct: totalSessoes > 0 ? Math.round((adminStats.sessoesBot / totalSessoes) * 100) : 0 },
                { label: 'Sessoes Dispatcher', value: adminStats.sessoesDispatcher, pct: handoffPct },
                { label: 'Carteiros', value: adminStats.motoristaCount, pct: totalSessoes > 0 ? Math.round((adminStats.motoristaCount / totalSessoes) * 100) : 0 },
                { label: 'Destinatarios', value: adminStats.destinatarioCount, pct: totalSessoes > 0 ? Math.round((adminStats.destinatarioCount / totalSessoes) * 100) : 0 },
              ].map((m, i) => (
                <div key={i}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="leading-tight text-gray-700">{m.label}: {m.value}</span>
                    <span className="ml-2 shrink-0 font-semibold text-gray-800">{m.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-[#003399]" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">{loading ? 'Carregando...' : 'Sem dados'}</p>
          )}
        </div>

        {/* Custo por modelo */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Custo por Modelo LLM (30 dias)</h2>
          {llmAnalytics && llmAnalytics.byProviderModel.length > 0 ? (
            <div className="space-y-3">
              {llmAnalytics.byProviderModel.map((m, i) => {
                const pct = llmAnalytics.totalCostUsd > 0
                  ? Math.round((m.costUsd / llmAnalytics.totalCostUsd) * 100)
                  : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-xs">
                        <code className="truncate font-mono text-gray-700">{m.provider}:{m.model}</code>
                        <span className="ml-2 shrink-0 font-semibold text-gray-800">US$ {m.costUsd.toFixed(4)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            i === 0 ? 'bg-[#003399]' : i === 1 ? 'bg-[#0040C0]' : i === 2 ? 'bg-[#1A4DB3]' : 'bg-[#C0CFED]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-[10px] text-gray-400">
                      {m.requests.toLocaleString('pt-BR')} chamadas
                    </span>
                  </div>
                );
              })}
              <div className="mt-4 flex justify-between border-t border-gray-100 pt-3 text-xs">
                <span className="text-gray-500">Total mensal</span>
                <span className="font-bold text-gray-800">US$ {llmAnalytics.totalCostUsd.toFixed(4)}</span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">{loading ? 'Carregando...' : 'Sem dados LLM'}</p>
          )}
        </div>
      </div>

      {/* Token usage summary */}
      {llmAnalytics && (
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Uso de Tokens (30 dias)</h2>
          <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
            {[
              { label: 'Input Tokens', value: llmAnalytics.totalInputTokens.toLocaleString('pt-BR') },
              { label: 'Output Tokens', value: llmAnalytics.totalOutputTokens.toLocaleString('pt-BR') },
              { label: 'Total Requisicoes', value: llmAnalytics.totalRequests.toLocaleString('pt-BR') },
              { label: 'Custo Total', value: `US$ ${llmAnalytics.totalCostUsd.toFixed(4)}` },
            ].map((f, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-gray-500">{f.label}</p>
                <p className="text-lg font-black text-gray-800">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
