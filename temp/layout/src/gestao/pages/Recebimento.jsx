import { useState } from 'react'
import Badge from '../../shared/components/Badge'
import KpiCard from '../../shared/components/KpiCard'

const UNITIZADORES_ESPERADOS = [
  { codigo: 'UNI-20240301-001', tipo: 'Bag',    objetos: 48, status: 'Recebido',  hora: '07:12' },
  { codigo: 'UNI-20240301-002', tipo: 'Saca',   objetos: 112, status: 'Recebido', hora: '07:15' },
  { codigo: 'UNI-20240301-003', tipo: 'Pallete', objetos: 240, status: 'Recebido', hora: '07:28' },
  { codigo: 'UNI-20240301-004', tipo: 'Bag',    objetos: 67,  status: 'Pendente', hora: '—' },
  { codigo: 'UNI-20240301-005', tipo: 'Caixa',  objetos: 34,  status: 'Pendente', hora: '—' },
]

export default function Recebimento() {
  const [codigoScan, setCodigoScan] = useState('')
  const [scanLista, setScanLista] = useState([
    { codigo: 'AA123456789BR', ts: '07:14:22', ok: true },
    { codigo: 'AA987654321BR', ts: '07:14:45', ok: true },
    { codigo: 'SX000001111BR', ts: '07:15:03', ok: false, motivo: 'Código não encontrado no manifesto' },
  ])

  function handleScan(e) {
    e.preventDefault()
    if (!codigoScan.trim()) return
    setScanLista(prev => [
      { codigo: codigoScan.trim().toUpperCase(), ts: new Date().toLocaleTimeString('pt-BR'), ok: true },
      ...prev,
    ])
    setCodigoScan('')
  }

  return (
    <div className="p-6 space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Esperados"  value="501"  accent="blue" />
        <KpiCard label="Recebidos"  value="400"  accent="green" />
        <KpiCard label="Pendentes"  value="101"  accent="amber" />
        <KpiCard label="Divergências" value="1" accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Scanner de Unitizador */}
        <div className="bg-white rounded-xl shadow-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">📷 Scanner de Unitizador</h2>

          {/* Área de câmera */}
          <div className="relative bg-gray-900 rounded-lg h-44 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-4 border-2 border-[#FFD600] rounded-lg pointer-events-none" />
            <div className="absolute h-0.5 bg-[#FFD600]/60 left-6 right-6 scan-line" />
            <span className="text-white/30 text-3xl">📦</span>
            <p className="absolute bottom-3 text-white/60 text-xs">Aponte para o QR Code / código de barras</p>
          </div>

          {/* Input manual */}
          <form onSubmit={handleScan} className="flex gap-2">
            <input
              type="text"
              value={codigoScan}
              onChange={e => setCodigoScan(e.target.value)}
              placeholder="Código manual (Enter para confirmar)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 focus:border-[#003399]"
            />
            <button type="submit" className="bg-[#003399] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#002266] transition-colors">
              Scan
            </button>
          </form>

          {/* Lista de scans da sessão */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Sessão atual — {scanLista.length} escaneados</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {scanLista.map((s, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${s.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`font-mono font-semibold ${s.ok ? 'text-green-700' : 'text-red-700'}`}>{s.codigo}</span>
                  <span className={s.ok ? 'text-green-600' : 'text-red-600'}>
                    {s.ok ? `✓ ${s.ts}` : `✗ ${s.motivo}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unitizadores esperados */}
        <div className="bg-white rounded-xl shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Unitizadores Esperados (CWS)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {UNITIZADORES_ESPERADOS.map((u) => (
              <div key={u.codigo} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-semibold text-gray-800 truncate">{u.codigo}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{u.tipo} · {u.objetos} objetos</p>
                </div>
                <Badge
                  variant={u.status === 'Recebido' ? 'success' : 'warning'}
                  size="sm"
                  dot
                >
                  {u.status}
                </Badge>
                {u.hora !== '—' && (
                  <span className="text-[10px] text-gray-400 shrink-0">{u.hora}</span>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button className="w-full py-2 bg-[#003399] text-white text-sm font-medium rounded-lg hover:bg-[#002266] transition-colors">
              Confirmar Recebimento da Sessão
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
