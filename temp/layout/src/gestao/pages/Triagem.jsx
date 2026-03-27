import { useState } from 'react'
import Badge from '../../shared/components/Badge'

// Células do sort wall (CEP prefix → rota)
const SORT_CELLS = [
  { id: 'A1', rota: 'R-01', cep: '01310', qtd: 34, max: 50 },
  { id: 'A2', rota: 'R-02', cep: '01320', qtd: 50, max: 50 },
  { id: 'A3', rota: 'R-03', cep: '01330', qtd: 12, max: 50 },
  { id: 'A4', rota: 'R-04', cep: '01340', qtd: 47, max: 50 },
  { id: 'B1', rota: 'R-05', cep: '01350', qtd: 28, max: 50 },
  { id: 'B2', rota: 'R-06', cep: '01360', qtd: 0,  max: 50 },
  { id: 'B3', rota: 'R-07', cep: '01370', qtd: 38, max: 50 },
  { id: 'B4', rota: 'R-08', cep: '01380', qtd: 50, max: 50 },
  { id: 'C1', rota: 'R-09', cep: '01390', qtd: 22, max: 50 },
  { id: 'C2', rota: 'R-10', cep: '01400', qtd: 15, max: 50 },
  { id: 'C3', rota: 'R-11', cep: '01410', qtd: 41, max: 50 },
  { id: 'C4', rota: 'R-12', cep: '01420', qtd: 8,  max: 50 },
]

function cellColor(qtd, max) {
  const pct = qtd / max
  if (pct >= 1)   return 'bg-red-500 text-white'
  if (pct >= 0.8) return 'bg-amber-400 text-white'
  if (pct >= 0.4) return 'bg-blue-500 text-white'
  if (pct === 0)  return 'bg-gray-100 text-gray-400'
  return 'bg-[#E6EBF7] text-[#003399]'
}

const SORT_PLAN = [
  { origem: 'UNI-001', rota: 'R-01', objetos: 42, celula: 'A1', status: 'Concluído' },
  { origem: 'UNI-002', rota: 'R-04', objetos: 38, celula: 'A4', status: 'Em processo' },
  { origem: 'UNI-003', rota: 'R-07', objetos: 29, celula: 'B3', status: 'Pendente' },
]

export default function Triagem() {
  const [modo, setModo] = useState('PTL')

  return (
    <div className="p-6 space-y-6">

      {/* Config de modo */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Configuração de Triagem</h2>
        <div className="flex gap-2 flex-wrap">
          {['PTL', 'Manual', 'ADTA'].map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                modo === m
                  ? 'bg-[#003399] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m === 'PTL' ? '💡 PTL (Put-to-Light)' : m === 'Manual' ? '✋ Manual' : '🤖 ADTA'}
            </button>
          ))}
        </div>
        {modo === 'PTL' && (
          <p className="text-xs text-gray-500 mt-2">
            Cada célula do sort wall acenderá LED indicando rota destino. Operador segue a iluminação.
          </p>
        )}
      </div>

      {/* Sort Wall visual */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Sort Wall — Visão das Células</h2>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"/>Cheio</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"/>80%+</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block"/>Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block"/>Vazio</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SORT_CELLS.map((cell) => (
            <div
              key={cell.id}
              className={`rounded-lg p-3 text-center cursor-pointer hover:opacity-90 transition-opacity ${cellColor(cell.qtd, cell.max)}`}
            >
              <p className="text-base font-black">{cell.id}</p>
              <p className="text-[10px] font-bold mt-0.5">{cell.rota}</p>
              <p className="text-[10px] opacity-80">{cell.cep}*</p>
              <p className="text-xs font-semibold mt-1">{cell.qtd}/{cell.max}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plano de triagem */}
      <div className="bg-white rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Plano de Triagem</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold">Unitizador</th>
                <th className="text-left px-4 py-2.5 font-semibold">Rota Destino</th>
                <th className="text-left px-4 py-2.5 font-semibold">Objetos</th>
                <th className="text-left px-4 py-2.5 font-semibold">Célula</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {SORT_PLAN.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">{row.origem}</td>
                  <td className="px-4 py-3 font-bold text-[#003399]">{row.rota}</td>
                  <td className="px-4 py-3 text-gray-700">{row.objetos}</td>
                  <td className="px-4 py-3">
                    <span className="bg-[#E6EBF7] text-[#003399] font-bold text-xs px-2 py-0.5 rounded">{row.celula}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={row.status === 'Concluído' ? 'success' : row.status === 'Em processo' ? 'info' : 'neutral'}
                      size="sm"
                    >
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
