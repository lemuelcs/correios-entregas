/**
 * Alert — faixa de alerta/aviso
 *
 * variant: 'info' | 'success' | 'warning' | 'danger'
 */

const STYLES = {
  info:    'bg-blue-50  border-blue-300  text-blue-800',
  success: 'bg-green-50 border-green-300 text-green-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
  danger:  'bg-red-50   border-red-300   text-red-800',
}

const ICONS = {
  info:    'ℹ️',
  success: '✅',
  warning: '⚠️',
  danger:  '🚨',
}

export default function Alert({ variant = 'info', title, children, onClose }) {
  return (
    <div className={`flex items-start gap-3 border rounded-lg px-4 py-3 text-sm ${STYLES[variant]}`}>
      <span className="text-base shrink-0 mt-0.5">{ICONS[variant]}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p className="leading-snug">{children}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none"
        >×</button>
      )}
    </div>
  )
}
