import KpiCard from '../../../shared/components/KpiCard'
import Badge from '../../../shared/components/Badge'

// ── dados mock ────────────────────────────────────────────────────────────────
const RESOLUCAO_POR_DIA = [72, 74, 70, 78, 81, 76, 79, 75, 83, 80, 77, 82, 85, 76]
const CUSTO_POR_DIA     = [2.1, 2.8, 1.9, 3.2, 3.8, 2.6, 2.9, 2.4, 3.1, 2.7, 3.0, 3.3, 2.8, 2.5]

const MOTIVOS_HANDOFF = [
  { motivo: 'Não consigo acessar o app',         qtd: 18, pct: 32 },
  { motivo: 'Reclamação sobre entrega',           qtd: 12, pct: 21 },
  { motivo: 'Problema com código de rastreio',   qtd: 9,  pct: 16 },
  { motivo: 'Solicitação não reconhecida pelo bot', qtd: 8, pct: 14 },
  { motivo: 'Outros',                            qtd: 10, pct: 17 },
]

const CUSTO_LLM = [
  { modelo: 'gpt-4o-mini', chamadas: 1842, custo: 'US$ 1,47', pct: 62 },
  { modelo: 'gpt-4o',      chamadas: 214,  custo: 'US$ 5,23', pct: 9  },
  { modelo: 'claude-haiku-4-5-20251001',chamadas: 380, custo: 'US$ 0,95', pct: 16 },
  { modelo: 'gemini-flash', chamadas: 310,  custo: 'US$ 0,31', pct: 13 },
]

function MiniBar({ data, maxVal, color = 'bg-[#003399]', height = 64 }) {
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((v, i) => {
        const pct = (v / maxVal) * 100
        return (
          <div key={i} className="flex-1 flex flex-col-reverse">
            <div className={`${color} rounded-t-sm opacity-80 hover:opacity-100 transition-opacity`}
              style={{ height: `${pct}%` }} />
          </div>
        )
      })}
    </div>
  )
}

export default function Analytics() {
  const resolucaoMedia = Math.round(RESOLUCAO_POR_DIA.reduce((a, b) => a + b, 0) / RESOLUCAO_POR_DIA.length)
  const custoTotal = CUSTO_POR_DIA.reduce((a, b) => a + b, 0).toFixed(2)

  return (
    <div className="p-6 space-y-6">

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Resolução Bot (30d)"   value={`${resolucaoMedia}%`}  accent="green"  delta="+6% vs mês anterior" deltaPos />
        <KpiCard label="Handoffs para humano"  value="57"                    accent="amber"  delta="17% das conversas" deltaPos={false} />
        <KpiCard label="Custo LLM (30d)"       value={`US$ ${custoTotal}`}   accent="yellow" delta="meta: US$ 100/mês" deltaPos />
        <KpiCard label="Msgs proxied (30d)"    value="1.284"                 accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Taxa de resolução bot */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Taxa de Resolução Bot — 14 dias</h2>
          <p className="text-[10px] text-gray-400 mb-3">% conversas resolvidas sem handoff humano</p>
          <MiniBar data={RESOLUCAO_POR_DIA} maxVal={100} color="bg-green-500" height={80} />
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>14 dias atrás</span><span>Hoje</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-2xl font-black text-green-600">{resolucaoMedia}%</span>
            <span className="text-xs text-gray-500">média do período · Meta: ≥ 70%</span>
            <Badge variant="success" size="sm">✓ Acima da meta</Badge>
          </div>
        </div>

        {/* Custo LLM */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Custo LLM — 14 dias</h2>
          <p className="text-[10px] text-gray-400 mb-3">US$ por dia de operação</p>
          <MiniBar data={CUSTO_POR_DIA} maxVal={5} color="bg-[#FFD600]" height={80} />
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>14 dias atrás</span><span>Hoje</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-2xl font-black text-amber-600">US$ {custoTotal}</span>
            <span className="text-xs text-gray-500">últimos 14 dias</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Motivos de handoff */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Principais Motivos de Handoff</h2>
          <div className="space-y-2.5">
            {MOTIVOS_HANDOFF.map((m, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 leading-tight">{m.motivo}</span>
                  <span className="font-semibold text-gray-800 shrink-0 ml-2">{m.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custo por modelo */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Custo por Modelo LLM (30 dias)</h2>
          <div className="space-y-3">
            {CUSTO_LLM.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <code className="font-mono text-gray-700 truncate">{m.modelo}</code>
                    <span className="font-semibold text-gray-800 shrink-0 ml-2">{m.custo}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${i === 0 ? 'bg-[#003399]' : i === 1 ? 'bg-[#0040C0]' : i === 2 ? 'bg-[#1A4DB3]' : 'bg-[#C0CFED]'}`}
                      style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 w-20 text-right">{m.chamadas.toLocaleString('pt-BR')} chamadas</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-500">Total mensal</span>
            <span className="font-bold text-gray-800">
              US$ {CUSTO_LLM.reduce((a, m) => a + parseFloat(m.custo.replace('US$ ', '')), 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Alertas configurados */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Alertas Configurados</h2>
        <div className="space-y-2">
          {[
            { alerta: 'Custo LLM diário > R$ 150/dia',           status: 'OK',      check: '✓ Máx. hoje: R$ 14,80' },
            { alerta: 'Sessões proxy simultâneas > 20',           status: 'OK',      check: '✓ Máx. hoje: 6' },
            { alerta: 'Taxa de falha LLM > 5% em 5min',          status: 'OK',      check: '✓ Taxa atual: 0,2%' },
            { alerta: 'Instância Evolution offline > 5min',       status: 'ALERT',   check: '⚠️ Offline às 11:34 por 3 min (recuperado)' },
            { alerta: 'Fila n8n > 1000 jobs pendentes',          status: 'OK',      check: '✓ Fila atual: 3' },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'OK' ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-gray-700 flex-1">{a.alerta}</span>
              <span className={`text-[10px] font-medium ${a.status === 'OK' ? 'text-green-600' : 'text-amber-600'}`}>{a.check}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LGPD compliance */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Compliance LGPD</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: 'Msgs nullificadas (30d+)',   value: '12.430', status: 'ok' },
            { label: 'Sessões proxy expiradas (7d)', value: '891',  status: 'ok' },
            { label: 'Logs LLM expirados (90d)',    value: '3.210', status: 'ok' },
            { label: 'Opt-outs ativos',             value: '14',    status: 'info' },
          ].map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 mb-1">{f.label}</p>
              <p className="text-lg font-black text-gray-800">{f.value}</p>
              <Badge variant={f.status === 'ok' ? 'success' : 'info'} size="sm">
                {f.status === 'ok' ? '✓ Conforme' : 'Monitorar'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
