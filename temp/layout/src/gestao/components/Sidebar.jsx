/**
 * Sidebar — navegação lateral fixa do ambiente Gestão
 *
 * Props:
 *   activePage  string           — id da página ativa
 *   onNavigate  (id: string) => void
 */

const NAV_GROUPS = [
  {
    label: 'Operação do Dia',
    items: [
      { id: 'dashboard',      icon: '◉', label: 'Dashboard' },
      { id: 'recebimento',    icon: '📥', label: 'Recebimento' },
      { id: 'triagem',        icon: '🔀', label: 'Triagem' },
      { id: 'roteirizacao',   icon: '🗺️', label: 'Roteirização' },
      { id: 'despacho',       icon: '🚀', label: 'Despacho' },
      { id: 'monitoramento',  icon: '📡', label: 'Monitoramento' },
      { id: 'reconciliacao',  icon: '✅', label: 'Reconciliação' },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { id: 'previsao', icon: '📊', label: 'Previsão de Volume' },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { id: 'comunicacao-dashboard',        icon: '💬', label: 'WhatsApp — Dashboard' },
      { id: 'comunicacao-conversas',        icon: '🗨️', label: 'Conversas' },
      { id: 'comunicacao-proxy',            icon: '🔀', label: 'Proxy Carteiro↔Dest.' },
      { id: 'comunicacao-templates',        icon: '📋', label: 'Templates HSM' },
      { id: 'comunicacao-analytics',        icon: '📈', label: 'Analytics' },
      { id: 'comunicacao-config',           icon: '⚙️', label: 'Configuração' },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { id: 'unitizadores', icon: '📦', label: 'Unitizadores' },
      { id: 'veiculos',     icon: '🚐', label: 'Veículos' },
      { id: 'carteiros',    icon: '👷', label: 'Carteiros' },
      { id: 'ponto',        icon: '🕐', label: 'Ponto do Dia' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'configuracoes', icon: '⚙️', label: 'Configurações' },
    ],
  },
]

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="w-60 min-h-screen bg-[#003399] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FFD600] rounded-lg flex items-center justify-center text-[#003399] font-black text-sm">
            C
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Correios</p>
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">Gestão • Distribuição</p>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = activePage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150 text-left mb-0.5
                    ${active
                      ? 'bg-white text-[#003399] shadow-md'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                  <span className="leading-tight">{item.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#003399] shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer user info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFD600] flex items-center justify-center text-[#003399] font-bold text-sm shrink-0">
            G
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">Gestor — CDD São Paulo</p>
            <p className="text-white/50 text-[10px]">Gerente de Unidade</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
