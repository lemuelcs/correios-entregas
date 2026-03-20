import KpiCard from '../../shared/components/KpiCard'
import Badge from '../../shared/components/Badge'
import Alert from '../../shared/components/Alert'
import ProgressBar from '../../shared/components/ProgressBar'

const ALERTS = [
  { variant: 'danger',  text: 'Rota R-07 sem motorista alocado — despacho em 22 min' },
  { variant: 'warning', text: 'Objeto AA123456789BR com 2 tentativas — prazo de guarda vence amanhã' },
  { variant: 'info',    text: 'SGOD sincronizado • Última atualização: 08:42' },
]

const ROTAS = [
  { id: 'R-01', carteiro: 'Carlos M.',   objetos: 142, status: 'Em rota',   pct: 68 },
  { id: 'R-02', carteiro: 'Ana L.',      objetos: 118, status: 'Em rota',   pct: 42 },
  { id: 'R-03', carteiro: 'Paulo S.',    objetos: 97,  status: 'Despachado', pct: 0 },
  { id: 'R-04', carteiro: 'Marcia T.',   objetos: 156, status: 'Em rota',   pct: 91 },
  { id: 'R-07', carteiro: '—',           objetos: 134, status: 'Aguardando', pct: 0 },
]

const STATUS_BADGE = {
  'Em rota':    'info',
  'Despachado': 'warning',
  'Aguardando': 'neutral',
  'Concluído':  'success',
}

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">

      {/* Alertas */}
      <div className="space-y-2">
        {ALERTS.map((a, i) => (
          <Alert key={i} variant={a.variant}>{a.text}</Alert>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Objetos Recebidos"  value="1.847" accent="blue"   delta="+12% vs ontem" deltaPos />
        <KpiCard label="Em Rota"            value="983"   accent="blue"   />
        <KpiCard label="Entregues"          value="612"   unit="obj" accent="green" delta="33%" deltaPos />
        <KpiCard label="Insucessos"         value="47"    accent="amber"  delta="4,8%" deltaPos={false} />
        <KpiCard label="Taxa de Entrega"    value="92,9"  unit="%" accent="green" />
        <KpiCard label="SPH Médio"          value="18,4"  unit="obj/h" accent="yellow" />
      </div>

      {/* Mapa + Rotas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Mapa placeholder */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Mapa Tempo Real</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Em rota</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Entregue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Insucesso</span>
            </div>
          </div>
          <div className="h-72 bg-[#E8F0FE] flex items-center justify-center relative overflow-hidden">
            {/* Simulação visual de mapa */}
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'linear-gradient(#003399 1px, transparent 1px), linear-gradient(90deg, #003399 1px, transparent 1px)', backgroundSize: '32px 32px' }}
            />
            <div className="relative flex flex-col items-center gap-2 text-[#003399]/40">
              <span className="text-4xl">🗺️</span>
              <span className="text-xs font-medium">Integração OSRM / Maps em produção</span>
            </div>
            {/* Pins decorativos */}
            {[
              { top: '30%', left: '40%', color: 'bg-blue-500' },
              { top: '50%', left: '60%', color: 'bg-blue-500' },
              { top: '60%', left: '30%', color: 'bg-green-500' },
              { top: '40%', left: '70%', color: 'bg-red-500' },
              { top: '70%', left: '55%', color: 'bg-blue-500' },
            ].map((pin, i) => (
              <div key={i} className={`absolute w-3 h-3 ${pin.color} rounded-full border-2 border-white shadow`}
                style={{ top: pin.top, left: pin.left }} />
            ))}
          </div>
        </div>

        {/* Rotas do dia */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Rotas do Dia</h2>
            <Badge variant="blue">{ROTAS.length} rotas</Badge>
          </div>
          <div className="divide-y divide-gray-50">
            {ROTAS.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#003399]">{r.id}</span>
                    <span className="text-xs text-gray-600">{r.carteiro}</span>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status]} size="sm">{r.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                  <span>{r.objetos} objetos</span>
                  {r.pct > 0 && <span>{r.pct}% concluído</span>}
                </div>
                {r.pct > 0 && (
                  <ProgressBar value={r.pct} size="sm" color={r.pct >= 90 ? 'bg-green-500' : 'bg-[#003399]'} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Previsão de volume */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Previsão de Volume — Próximos 7 dias</h2>
        <div className="flex items-end gap-2 h-20">
          {[1840, 2100, 1650, 1980, 2240, 1720, 1900].map((v, i) => {
            const days = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
            const pct = Math.round((v / 2400) * 100)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[#E6EBF7] rounded-sm relative" style={{ height: `${pct}%` }}>
                  <div className="absolute inset-0 bg-[#003399] rounded-sm opacity-80" />
                </div>
                <span className="text-[9px] text-gray-500">{days[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
