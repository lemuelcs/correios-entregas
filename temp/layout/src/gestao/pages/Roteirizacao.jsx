import { useState } from 'react'
import Badge from '../../shared/components/Badge'

const RESULTADO_ROTAS = [
  { id: 'R-01', carteiro: 'Carlos M.', paradas: 42, objetos: 142, distancia: '18,4 km', tempo: '6h20', carga: 87 },
  { id: 'R-02', carteiro: 'Ana L.',    paradas: 38, objetos: 118, distancia: '14,2 km', tempo: '5h40', carga: 72 },
  { id: 'R-03', carteiro: 'Paulo S.',  paradas: 29, objetos: 97,  distancia: '11,8 km', tempo: '4h50', carga: 59 },
  { id: 'R-04', carteiro: 'Marcia T.', paradas: 47, objetos: 156, distancia: '21,3 km', tempo: '7h10', carga: 95 },
]

export default function Roteirizacao() {
  const [solver, setSolver] = useState('VROOM')
  const [modo, setModo] = useState('Absoluto')
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState(false)

  function handleOtimizar() {
    setRodando(true)
    setResultado(false)
    setTimeout(() => { setRodando(false); setResultado(true) }, 2000)
  }

  return (
    <div className="p-6 space-y-6">

      {/* Configuração */}
      <div className="bg-white rounded-xl shadow-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">⚙️ Configuração da Otimização</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Solver */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Solver</label>
            <div className="flex gap-2">
              {['VROOM', 'PyVRP'].map((s) => (
                <button key={s} onClick={() => setSolver(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${solver === s ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {solver === 'VROOM' ? 'Mais rápido, ótimo para >200 paradas' : 'Mais preciso, melhor para otimização fina'}
            </p>
          </div>

          {/* Modo */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Modo de Carga</label>
            <div className="flex gap-1">
              {['Absoluto', 'LargeVan', 'Balanceado'].map((m) => (
                <button key={m} onClick={() => setModo(m)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-colors ${modo === m ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Parâmetros rápidos */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 block">Parâmetros</label>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-28">Max. objetos/rota</label>
              <input type="number" defaultValue={160} className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-28">Janela de entrega</label>
              <input type="text" defaultValue="07:00–18:00" className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleOtimizar}
            disabled={rodando}
            className="px-6 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {rodando ? (
              <><span className="animate-spin">⚙️</span> Otimizando...</>
            ) : '🚀 Iniciar Otimização'}
          </button>
          {resultado && (
            <Badge variant="success">✓ Otimização concluída em 1,8s</Badge>
          )}
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="bg-white rounded-xl shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Resultado — {RESULTADO_ROTAS.length} rotas geradas</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Exportar CSV</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-[#FFD600] text-[#003399] font-semibold rounded-lg hover:bg-[#E6C000]">Aprovar Roteirização</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-semibold">Rota</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Carteiro</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Paradas</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Objetos</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Distância</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Tempo Est.</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Carga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {RESULTADO_ROTAS.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-[#003399]">{r.id}</td>
                    <td className="px-4 py-3 text-gray-700">{r.carteiro}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.paradas}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.objetos}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.distancia}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.tempo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-16">
                          <div className={`h-full rounded-full ${r.carga >= 90 ? 'bg-amber-500' : 'bg-[#003399]'}`} style={{ width: `${r.carga}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 shrink-0">{r.carga}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!resultado && !rodando && (
        <div className="bg-white rounded-xl shadow-card h-48 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="text-sm font-medium">Configure os parâmetros e clique em "Iniciar Otimização"</p>
          </div>
        </div>
      )}
    </div>
  )
}
