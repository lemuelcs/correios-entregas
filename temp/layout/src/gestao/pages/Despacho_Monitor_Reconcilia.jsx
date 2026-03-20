// ─── Despacho ────────────────────────────────────────────────────────────────
import Badge from '../../shared/components/Badge'
import KpiCard from '../../shared/components/KpiCard'

const ROTAS_DESPACHO = [
  { id: 'R-01', carteiro: 'Carlos M.',  objetos: 142, status: 'Pronta',    veiculo: 'Moto-01', horario: '08:00' },
  { id: 'R-02', carteiro: 'Ana L.',     objetos: 118, status: 'Pronta',    veiculo: 'Moto-02', horario: '08:00' },
  { id: 'R-03', carteiro: 'Paulo S.',   objetos: 97,  status: 'Aguardando',veiculo: 'Moto-03', horario: '08:15' },
  { id: 'R-04', carteiro: 'Marcia T.',  objetos: 156, status: 'Pronta',    veiculo: 'Van-01',  horario: '08:00' },
  { id: 'R-07', carteiro: '—',          objetos: 134, status: 'Bloqueada', veiculo: '—',       horario: '—' },
]

export function Despacho() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Rotas Prontas"    value="3"  accent="green" />
        <KpiCard label="Aguardando"       value="1"  accent="amber" />
        <KpiCard label="Bloqueadas"       value="1"  accent="red" />
        <KpiCard label="Total Objetos"    value="647" accent="blue" />
      </div>

      <div className="bg-white rounded-xl shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Rotas para Despacho</h2>
          <button className="px-3 py-1.5 bg-[#003399] text-white text-xs font-semibold rounded-lg hover:bg-[#002266]">
            Despachar Todas Prontas
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {ROTAS_DESPACHO.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-4">
              <div className="w-14">
                <span className="text-sm font-black text-[#003399]">{r.id}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{r.carteiro}</p>
                <p className="text-xs text-gray-500">{r.veiculo} · {r.objetos} objetos · {r.horario}</p>
              </div>
              <Badge
                variant={r.status === 'Pronta' ? 'success' : r.status === 'Aguardando' ? 'warning' : 'danger'}
                dot
              >
                {r.status}
              </Badge>
              {r.status === 'Pronta' && (
                <button className="px-3 py-1.5 bg-[#FFD600] text-[#003399] text-xs font-bold rounded-lg hover:bg-[#E6C000]">
                  Liberar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Monitoramento ────────────────────────────────────────────────────────────
export function Monitoramento() {
  const pontos = [
    { x: 20, y: 70, carteiro: 'R-01', label: 'C.M' },
    { x: 45, y: 50, carteiro: 'R-02', label: 'A.L' },
    { x: 62, y: 65, carteiro: 'R-04', label: 'M.T' },
    { x: 30, y: 35, carteiro: 'R-03', label: 'P.S' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Em Campo"         value="4"     accent="blue"  />
        <KpiCard label="SPH Médio Live"   value="17,8"  unit="obj/h" accent="green" />
        <KpiCard label="Entregues Hoje"   value="612"   accent="green" />
        <KpiCard label="Alertas Ativos"   value="2"     accent="red" />
      </div>

      {/* Scatter planejado × executado */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">
          Planejado × Executado (% rota concluída)
        </h2>
        <div className="relative w-full h-56 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
          {/* Eixos */}
          <div className="absolute left-8 right-4 bottom-8 top-4">
            <svg className="w-full h-full">
              {/* Linha diagonal de referência */}
              <line x1="0" y1="100%" x2="100%" y2="0" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 4" />
              {pontos.map((p, i) => {
                const cx = `${p.x}%`
                const cy = `${100 - p.y}%`
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r="8" fill="#003399" opacity="0.85" />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fill="white" fontWeight="bold">{p.label}</text>
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-gray-400">% Planejado</p>
          <p className="absolute left-1 top-0 bottom-0 flex items-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            <span className="text-[9px] text-gray-400">% Executado</span>
          </p>
        </div>
      </div>

      {/* Timeline alertas */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Timeline de Alertas</h2>
        <div className="space-y-2">
          {[
            { hora: '10:42', tipo: 'danger',  msg: 'R-07 sem carteiro — despacho em atraso' },
            { hora: '09:18', tipo: 'warning', msg: 'R-04 velocidade de entrega abaixo do esperado (12 obj/h)' },
            { hora: '08:55', tipo: 'info',    msg: 'R-01 iniciou rota — 142 objetos' },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 font-mono">{a.hora}</span>
              <Badge variant={a.tipo} size="sm">{a.msg}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Reconciliação ────────────────────────────────────────────────────────────
export function Reconciliacao() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Objetos Despachados" value="647"  accent="blue" />
        <KpiCard label="Entregues"           value="592"  accent="green" />
        <KpiCard label="Devolvidos"          value="48"   accent="amber" />
        <KpiCard label="Pendentes"           value="7"    accent="red" />
      </div>

      {/* Scanner retorno FC_45 */}
      <div className="bg-white rounded-xl shadow-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">📷 Scan Retorno — FC_45</h2>
        <div className="relative bg-gray-900 rounded-lg h-36 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-4 border-2 border-[#FFD600] rounded-lg" />
          <div className="absolute h-0.5 bg-[#FFD600]/60 left-6 right-6 scan-line" />
          <span className="text-white/30 text-2xl">📦</span>
        </div>
        <p className="text-xs text-gray-500">
          Escaneie cada objeto retornado para gerar evento <strong>FC_45</strong> (devolução ao remetente) ou <strong>OEC_P</strong> (nova tentativa agendada).
        </p>
      </div>

      {/* Objetos pendentes */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Objetos com Pendência</h2>
        <div className="space-y-2">
          {[
            { codigo: 'AA111222333BR', evento: 'BDE_02', tentativas: 2, prazo: 'Vence em 3 dias' },
            { codigo: 'AA444555666BR', evento: 'BDE_04', tentativas: 1, prazo: 'Vence em 5 dias' },
            { codigo: 'SX000777888BR', evento: 'BDE_07', tentativas: 2, prazo: 'Vence amanhã' },
          ].map((obj, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div>
                <p className="text-xs font-mono font-semibold text-gray-800">{obj.codigo}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{obj.evento} · {obj.tentativas}/2 tentativas · {obj.prazo}</p>
              </div>
              <Badge variant="warning" size="sm">Pendente</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
