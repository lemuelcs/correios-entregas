/**
 * Header — barra superior do ambiente Gestão
 *
 * Props:
 *   title    string   — título da página atual
 *   subtitle? string  — subtítulo opcional
 */

export default function Header({ title, subtitle }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 leading-none">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Date */}
      <p className="text-xs text-gray-400 hidden md:block capitalize">{dateStr}</p>

      {/* Notification bell */}
      <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
        <span className="text-base">🔔</span>
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
      </button>

      {/* User avatar */}
      <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
        <div className="w-7 h-7 rounded-full bg-[#003399] flex items-center justify-center text-white text-xs font-bold">
          G
        </div>
        <span className="text-sm font-medium text-gray-700 hidden md:block">Gestor</span>
      </div>
    </header>
  )
}
