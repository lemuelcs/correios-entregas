import { useState, useEffect } from 'react'
import Badge from '../../../shared/components/Badge'
import KpiCard from '../../../shared/components/KpiCard'

// ── mock de sessões ───────────────────────────────────────────────────────────
const SESSOES_MOCK = [
  {
    id: 'prx_001',
    carteiro:     'Carlos Mendes (COR-001)',
    objeto:       'AA123456789BR',
    inicio:       '14:02',
    duracaoMin:   22,
    msgs:         8,
    maxMsgs:      50,
    maxHoras:     4,
    status:       'ACTIVE',
    expiresIn:    '3h 38min',
  },
  {
    id: 'prx_002',
    carteiro:     'Ana Lima (COR-002)',
    objeto:       'AA987654321BR',
    inicio:       '13:45',
    duracaoMin:   39,
    msgs:         14,
    maxMsgs:      50,
    maxHoras:     4,
    status:       'ACTIVE',
    expiresIn:    '3h 21min',
  },
  {
    id: 'prx_003',
    carteiro:     'Paulo Souza (COR-003)',
    objeto:       null,
    inicio:       '12:30',
    duracaoMin:   92,
    msgs:         31,
    maxMsgs:      50,
    maxHoras:     4,
    status:       'ACTIVE',
    expiresIn:    '2h 28min',
  },
  {
    id: 'prx_004',
    carteiro:     'Marcia Torres (COR-004)',
    objeto:       'SX000001111BR',
    inicio:       '11:18',
    duracaoMin:   164,
    msgs:         49,
    maxMsgs:      50,
    maxHoras:     4,
    status:       'ACTIVE',
    expiresIn:    '56min',
    nearLimit:    true,
  },
  {
    id: 'prx_005',
    carteiro:     'Roberto Lima (COR-007)',
    objeto:       'AA444555666BR',
    inicio:       '10:00',
    duracaoMin:   244,
    msgs:         50,
    maxMsgs:      50,
    maxHoras:     4,
    status:       'ENDED',
    expiresIn:    '—',
    endReason:    'MAX_MESSAGES',
  },
]

function formatDuracao(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export default function ProxySessions() {
  const [sessoes, setSessoes] = useState(SESSOES_MOCK)
  const [encerrando, setEncerrando] = useState(null)
  const [tick, setTick] = useState(0)

  // Simula atualização SSE
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
      setSessoes(prev => prev.map(s =>
        s.status === 'ACTIVE'
          ? { ...s, duracaoMin: s.duracaoMin + 1 }
          : s
      ))
    }, 10000) // a cada 10s
    return () => clearInterval(interval)
  }, [])

  function encerrar(id) {
    setEncerrando(id)
    setTimeout(() => {
      setSessoes(prev => prev.map(s => s.id === id ? { ...s, status: 'ENDED', endReason: 'MANAGER_ENDED' } : s))
      setEncerrando(null)
    }, 1000)
  }

  const ativas   = sessoes.filter(s => s.status === 'ACTIVE')
  const encerradas = sessoes.filter(s => s.status !== 'ACTIVE')

  return (
    <div className="p-6 space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sessões Ativas"     value={String(ativas.length)}     accent="blue" />
        <KpiCard label="Próx. ao limite"    value={String(ativas.filter(s => s.nearLimit).length)} accent="amber" />
        <KpiCard label="Msgs hoje (total)"  value="156"  accent="blue" />
        <KpiCard label="Encerradas hoje"    value={String(encerradas.length)} accent="neutral" />
      </div>

      {/* Aviso SSE */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#E6EBF7] rounded-lg px-4 py-2">
        <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
        Atualização em tempo real via SSE — evento <code className="font-mono bg-white px-1 rounded">proxy_session_update</code>
      </div>

      {/* Tabela sessões ativas */}
      <div className="bg-white rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Sessões Ativas ({ativas.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold">Carteiro</th>
                <th className="text-left px-4 py-2.5 font-semibold">Objeto</th>
                <th className="text-right px-4 py-2.5 font-semibold">Início</th>
                <th className="text-right px-4 py-2.5 font-semibold">Duração</th>
                <th className="text-left px-4 py-2.5 font-semibold">Msgs</th>
                <th className="text-left px-4 py-2.5 font-semibold">Expira em</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-center px-4 py-2.5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ativas.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.nearLimit ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{s.carteiro}</td>
                  <td className="px-4 py-3">
                    {s.objeto
                      ? <span className="font-mono text-xs text-[#003399]">{s.objeto}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{s.inicio}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{formatDuracao(s.duracaoMin)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Barra de uso de mensagens */}
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.msgs / s.maxMsgs >= 0.9 ? 'bg-amber-500' : 'bg-[#003399]'}`}
                          style={{ width: `${(s.msgs / s.maxMsgs) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{s.msgs}/{s.maxMsgs}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${s.nearLimit ? 'text-amber-600' : 'text-gray-600'}`}>
                      {s.nearLimit && '⚠️ '}{s.expiresIn}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success" dot size="sm">ACTIVE</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => encerrar(s.id)}
                      disabled={encerrando === s.id}
                      className="px-3 py-1 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {encerrando === s.id ? '…' : 'Encerrar'}
                    </button>
                  </td>
                </tr>
              ))}
              {ativas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhuma sessão proxy ativa no momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessões encerradas recentes */}
      {encerradas.length > 0 && (
        <div className="bg-white rounded-xl shadow-card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Encerradas Recentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {encerradas.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{s.carteiro}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {s.objeto ? `Objeto: ${s.objeto} · ` : ''}{formatDuracao(s.duracaoMin)} · {s.msgs} msgs
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  {s.endReason === 'MAX_MESSAGES' ? '📊 Limite msgs' :
                   s.endReason === 'MANAGER_ENDED' ? '👤 Gestor encerrou' :
                   s.endReason === 'TIMEOUT' ? '⏱ Timeout' : 'ENDED'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagrama de estados */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Estados possíveis de uma sessão Proxy</h2>
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
          {[
            { label: 'INEXISTENTE', color: 'bg-gray-200 text-gray-600' },
            { arrow: true },
            { label: 'ACTIVE',      color: 'bg-green-100 text-green-700 font-bold' },
            { arrow: true },
            { label: 'ENDED',       color: 'bg-gray-100 text-gray-500' },
          ].map((item, i) =>
            item.arrow
              ? <span key={i} className="text-gray-400">→</span>
              : <span key={i} className={`px-2 py-1 rounded-lg ${item.color}`}>{item.label}</span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Motivos de encerramento: TIMEOUT (4h) · MAX_MESSAGES (50) · DRIVER_ENDED (carteiro digitou ENCERRAR) · MANAGER_ENDED (gestor via painel)
        </p>
      </div>
    </div>
  )
}
