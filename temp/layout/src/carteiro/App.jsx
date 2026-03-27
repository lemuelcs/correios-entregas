import { useState } from 'react'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import { Home, Coleta, Rota, Entrega, EntregaOk, Insucesso, Resumo, Historico } from './screens/Screens'
import '../../shared/globals.css'

/**
 * SCREEN_CONFIG — mapeia ids para componentes e configurações de TopBar/Nav
 *
 * hasBottomNav: mostra bottom nav (tabs principais)
 * showBackTo: id da tela de "voltar" (topBar com seta)
 * title: título exibido na topbar
 */
const SCREEN_CONFIG = {
  home:        { title: 'Correios · Carteiro', hasBottomNav: true,  bottomTab: 'home' },
  coleta:      { title: 'Coleta de Unitizadores', hasBottomNav: true, showBackTo: 'home', bottomTab: 'coleta' },
  rota:        { title: 'Rota R-01', hasBottomNav: true,  bottomTab: 'rota' },
  entrega:     { title: 'Registrar Entrega', hasBottomNav: false, showBackTo: 'rota' },
  'entrega-ok':{ title: 'Entrega Confirmada', hasBottomNav: false, showBackTo: 'rota' },
  insucesso:   { title: 'Registrar Insucesso', hasBottomNav: false, showBackTo: 'rota' },
  resumo:      { title: 'Resumo da Rota', hasBottomNav: false },
  historico:   { title: 'Histórico', hasBottomNav: true, bottomTab: 'historico' },
}

export default function CarteiroApp() {
  const [screen, setScreen] = useState('home')

  const config = SCREEN_CONFIG[screen] || SCREEN_CONFIG.home
  const activeTab = config.bottomTab || 'home'

  function handleBottomNav(tabId) {
    const tabToScreen = { home: 'home', rota: 'rota', coleta: 'coleta', historico: 'historico' }
    setScreen(tabToScreen[tabId] || 'home')
  }

  const screenProps = { onNavigate: setScreen }

  return (
    /* Phone frame (só para demo desktop — em produção seria full-screen) */
    <div className="min-h-screen bg-gray-800 flex items-center justify-center py-8">
      <div className="w-[390px] h-[844px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border-4 border-gray-700">

        {/* Status bar simulada */}
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
          {screen === 'home'        && <Home       {...screenProps} />}
          {screen === 'coleta'      && <Coleta     {...screenProps} />}
          {screen === 'rota'        && <Rota       {...screenProps} />}
          {screen === 'entrega'     && <Entrega    {...screenProps} />}
          {screen === 'entrega-ok'  && <EntregaOk  {...screenProps} />}
          {screen === 'insucesso'   && <Insucesso  {...screenProps} />}
          {screen === 'resumo'      && <Resumo     {...screenProps} />}
          {screen === 'historico'   && <Historico  {...screenProps} />}
        </div>

        {/* Bottom Nav */}
        {config.hasBottomNav && (
          <BottomNav active={activeTab} onNav={handleBottomNav} />
        )}

        {/* Home indicator iOS */}
        <div className="h-6 bg-white flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  )
}
