import { useState } from 'react'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import { Login, Objetos, Detalhe, Interacao, Reagendar, Nps } from './screens/Screens'
import '../../shared/globals.css'

const SCREEN_CONFIG = {
  login:     { title: 'Correios Entregas', hasBottomNav: false },
  objetos:   { title: 'Meus Objetos',      hasBottomNav: true,  bottomTab: 'objetos' },
  detalhe:   { title: 'Detalhes',          hasBottomNav: false, showBackTo: 'objetos' },
  interacao: { title: 'Gerenciar Entrega', hasBottomNav: false, showBackTo: 'detalhe' },
  reagendar: { title: 'Reagendar',         hasBottomNav: false, showBackTo: 'interacao' },
  nps:       { title: 'Avaliação',         hasBottomNav: false },
}

export default function DestinatarioApp() {
  const [screen, setScreen] = useState('login')

  const config = SCREEN_CONFIG[screen] || SCREEN_CONFIG.login
  const activeTab = config.bottomTab || 'objetos'

  function handleBottomNav(tabId) {
    if (tabId === 'objetos') setScreen('objetos')
  }

  const screenProps = { onNavigate: setScreen }

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center py-8">
      <div className="w-[390px] h-[844px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border-4 border-gray-700">

        {/* Status bar */}
        <div className="h-10 bg-[#003399] flex items-center justify-between px-6 shrink-0">
          <span className="text-white text-[11px] font-semibold">9:41</span>
          <span className="text-white text-[11px]">📶 🔋</span>
        </div>

        {/* TopBar */}
        <TopBar
          title={config.title}
          onBack={config.showBackTo ? () => setScreen(config.showBackTo) : undefined}
        />

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {screen === 'login'     && <Login     {...screenProps} />}
          {screen === 'objetos'   && <Objetos   {...screenProps} />}
          {screen === 'detalhe'   && <Detalhe   {...screenProps} />}
          {screen === 'interacao' && <Interacao {...screenProps} />}
          {screen === 'reagendar' && <Reagendar {...screenProps} />}
          {screen === 'nps'       && <Nps       {...screenProps} />}
        </div>

        {/* Bottom Nav */}
        {config.hasBottomNav && (
          <BottomNav active={activeTab} onNav={handleBottomNav} />
        )}

        {/* Home indicator */}
        <div className="h-6 bg-white flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  )
}
