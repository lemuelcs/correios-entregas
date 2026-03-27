/**
 * BottomNav — navegação inferior do app Carteiro
 *
 * Props:
 *   active    string     — id da tab ativa
 *   onNav     (id) => void
 */

const TABS = [
  { id: 'home',     icon: '🏠', label: 'Início' },
  { id: 'rota',     icon: '🗺️', label: 'Rota' },
  { id: 'coleta',   icon: '📦', label: 'Coleta' },
  { id: 'historico',icon: '📋', label: 'Histórico' },
]

export default function BottomNav({ active, onNav }) {
  return (
    <nav className="flex bg-white border-t border-gray-200 shrink-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onNav(t.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
            active === t.id ? 'text-[#003399]' : 'text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">{t.icon}</span>
          <span className={`text-[10px] font-medium ${active === t.id ? 'text-[#003399]' : 'text-gray-400'}`}>
            {t.label}
          </span>
          {active === t.id && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-[#003399] rounded-full" />
          )}
        </button>
      ))}
    </nav>
  )
}
