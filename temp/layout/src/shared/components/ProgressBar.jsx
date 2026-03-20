/**
 * ProgressBar — barra de progresso reutilizável
 *
 * Props:
 *   value    number  — 0 a 100
 *   color?   string  — classe Tailwind ex: 'bg-[#003399]'
 *   size?    'sm' | 'md' | 'lg'
 *   label?   string
 *   showPct? boolean
 */

const HEIGHTS = { sm: 'h-1', md: 'h-2', lg: 'h-3' }

export default function ProgressBar({
  value = 0,
  color = 'bg-[#003399]',
  size = 'md',
  label,
  showPct = false,
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex justify-between items-center mb-1">
          {label   && <span className="text-xs text-gray-600">{label}</span>}
          {showPct && <span className="text-xs font-semibold text-gray-700">{pct}%</span>}
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${HEIGHTS[size]}`}>
        <div
          className={`${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%`, height: '100%' }}
        />
      </div>
    </div>
  )
}
