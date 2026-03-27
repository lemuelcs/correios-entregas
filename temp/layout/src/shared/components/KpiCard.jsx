/**
 * KpiCard — card de métrica para dashboards
 *
 * Props:
 *   label       string   — rótulo da métrica
 *   value       string   — valor principal
 *   unit?       string   — unidade (ex: '%', 'obj')
 *   delta?      string   — variação (ex: '+3%')
 *   deltaPos?   boolean  — verde se true, vermelho se false
 *   icon?       ReactNode
 *   accent?     'blue' | 'yellow' | 'green' | 'red' | 'amber'
 */

const ACCENT_TOP = {
  blue:   'border-t-[#003399]',
  yellow: 'border-t-[#FFD600]',
  green:  'border-t-green-500',
  red:    'border-t-red-500',
  amber:  'border-t-amber-500',
}

export default function KpiCard({ label, value, unit, delta, deltaPos, icon, accent = 'blue' }) {
  return (
    <div className={`bg-white rounded-xl shadow-card border-t-2 ${ACCENT_TOP[accent]} p-4 flex flex-col gap-1 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
        {icon && <span className="text-gray-400 text-base shrink-0">{icon}</span>}
      </div>
      <div className="flex items-end gap-1 mt-1">
        <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
        {unit && <span className="text-sm text-gray-500 mb-0.5">{unit}</span>}
      </div>
      {delta && (
        <span className={`text-xs font-medium ${deltaPos ? 'text-green-600' : 'text-red-500'}`}>
          {delta}
        </span>
      )}
    </div>
  )
}
