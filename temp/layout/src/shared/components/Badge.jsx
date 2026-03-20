/**
 * Badge — status pill reutilizável
 *
 * variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'blue' | 'yellow'
 * size:    'sm' | 'md'
 */
const VARIANTS = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100   text-red-700',
  info:    'bg-blue-100  text-blue-700',
  neutral: 'bg-gray-100  text-gray-600',
  blue:    'bg-[#E6EBF7] text-[#003399]',
  yellow:  'bg-[#FFFDE0] text-[#9B7A00]',
}

const SIZES = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
}

export default function Badge({ variant = 'neutral', size = 'md', children, dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${VARIANTS[variant]} ${SIZES[size]}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-green-500' :
          variant === 'warning' ? 'bg-amber-500' :
          variant === 'danger'  ? 'bg-red-500'   :
          variant === 'info'    ? 'bg-blue-500'  :
          variant === 'blue'    ? 'bg-[#003399]' : 'bg-gray-400'
        } pulse-dot`} />
      )}
      {children}
    </span>
  )
}
