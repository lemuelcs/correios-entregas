const TABS = [
  { id: 'objetos',  icon: '📦', label: 'Objetos' },
  { id: 'rastrear', icon: '🔍', label: 'Rastrear' },
  { id: 'ajuda',    icon: '❓', label: 'Ajuda' },
  { id: 'conta',    icon: '👤', label: 'Conta' },
]

export default function BottomNav({ active, onNav }) {
  return (
    <nav className="flex bg-white border-t border-gray-200 shrink-0">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onNav(t.id)}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${active === t.id ? 'text-[#003399]' : 'text-gray-400'}`}>
          <span className="text-xl leading-none">{t.icon}</span>
          <span className={`text-[10px] font-medium ${active === t.id ? 'text-[#003399]' : 'text-gray-400'}`}>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
