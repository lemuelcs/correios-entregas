import { KpiCard } from '@/shared/ui/KpiCard';
import { Badge } from '@/shared/ui/Badge';
import {
  RESOLUCAO_POR_DIA,
  CUSTO_POR_DIA,
  MOTIVOS_HANDOFF,
  CUSTO_LLM,
  ALERTAS_CONFIGURADOS,
  COMPLIANCE_LGPD,
} from '../../comunicacao.data';

// ── MiniBar ─────────────────────────────────────────────────────────────────

function MiniBar({ data, maxVal, color = 'bg-[#003399]', height = 64 }: { data: number[]; maxVal: number; color?: string; height?: number }) {
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((v, i) => {
        const pct = (v / maxVal) * 100;
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
  const resolucaoMedia = Math.round(RESOLUCAO_POR_DIA.reduce((a, b) => a + b, 0) / RESOLUCAO_POR_DIA.length);
  const custoTotal = CUSTO_POR_DIA.reduce((a, b) => a + b, 0).toFixed(2);

  return (
    <div className="space-y-6 p-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Resolucao Bot (30d)" value={`${resolucaoMedia}%`} accent="green" delta="+6% vs mes anterior" deltaPositive />
        <KpiCard label="Handoffs para humano" value="57" accent="amber" delta="17% das conversas" deltaPositive={false} />
        <KpiCard label="Custo LLM (30d)" value={`US$ ${custoTotal}`} accent="yellow" delta="meta: US$ 100/mes" deltaPositive />
        <KpiCard label="Msgs proxied (30d)" value="1.284" accent="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Taxa de resolução bot */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">Taxa de Resolucao Bot — 14 dias</h2>
          <p className="mb-3 text-[10px] text-gray-400">% conversas resolvidas sem handoff humano</p>
          <MiniBar data={RESOLUCAO_POR_DIA} maxVal={100} color="bg-green-500" height={80} />
          <div className="mt-1 flex justify-between text-[9px] text-gray-400">
            <span>14 dias atras</span>
            <span>Hoje</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-2xl font-black text-green-600">{resolucaoMedia}%</span>
            <span className="text-xs text-gray-500">media do periodo · Meta: ≥ 70%</span>
            <Badge variant="success" size="sm">
              Acima da meta
            </Badge>
          </div>
        </div>

        {/* Custo LLM */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">Custo LLM — 14 dias</h2>
          <p className="mb-3 text-[10px] text-gray-400">US$ por dia de operacao</p>
          <MiniBar data={CUSTO_POR_DIA} maxVal={5} color="bg-[#FFD600]" height={80} />
          <div className="mt-1 flex justify-between text-[9px] text-gray-400">
            <span>14 dias atras</span>
            <span>Hoje</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-2xl font-black text-amber-600">US$ {custoTotal}</span>
            <span className="text-xs text-gray-500">ultimos 14 dias</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Motivos de handoff */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Principais Motivos de Handoff</h2>
          <div className="space-y-2.5">
            {MOTIVOS_HANDOFF.map((m, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="leading-tight text-gray-700">{m.motivo}</span>
                  <span className="ml-2 shrink-0 font-semibold text-gray-800">{m.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custo por modelo */}
        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Custo por Modelo LLM (30 dias)</h2>
          <div className="space-y-3">
            {CUSTO_LLM.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-xs">
                    <code className="truncate font-mono text-gray-700">{m.modelo}</code>
                    <span className="ml-2 shrink-0 font-semibold text-gray-800">{m.custo}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${
                        i === 0 ? 'bg-[#003399]' : i === 1 ? 'bg-[#0040C0]' : i === 2 ? 'bg-[#1A4DB3]' : 'bg-[#C0CFED]'
                      }`}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-[10px] text-gray-400">
                  {m.chamadas.toLocaleString('pt-BR')} chamadas
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-gray-100 pt-3 text-xs">
            <span className="text-gray-500">Total mensal</span>
            <span className="font-bold text-gray-800">
              US$ {CUSTO_LLM.reduce((a, m) => a + parseFloat(m.custo.replace('US$ ', '').replace(',', '.')), 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Alertas configurados */}
      <div className="rounded-xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Alertas Configurados</h2>
        <div className="space-y-2">
          {ALERTAS_CONFIGURADOS.map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.status === 'OK' ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="flex-1 text-xs text-gray-700">{a.alerta}</span>
              <span className={`text-[10px] font-medium ${a.status === 'OK' ? 'text-green-600' : 'text-amber-600'}`}>{a.check}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LGPD compliance */}
      <div className="rounded-xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Compliance LGPD</h2>
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
          {COMPLIANCE_LGPD.map((f, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-gray-500">{f.label}</p>
              <p className="text-lg font-black text-gray-800">{f.value}</p>
              <Badge variant={f.status === 'ok' ? 'success' : 'info'} size="sm">
                {f.status === 'ok' ? 'Conforme' : 'Monitorar'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
