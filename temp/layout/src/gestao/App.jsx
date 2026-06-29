import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// Pages
import Dashboard from './pages/Dashboard'
import Recebimento from './pages/Recebimento'
import Triagem from './pages/Triagem'
import Roteirizacao from './pages/Roteirizacao'
import { Despacho, Monitoramento, Reconciliacao } from './pages/Despacho_Monitor_Reconcilia'
import { Previsao, Unitizadores, Veiculos, Carteiros, Ponto, Configuracoes } from './pages/Cadastros_Config'

// M13 — Comunicação WhatsApp
import ComunicacaoDashboard from './pages/comunicacao/ComunicacaoDashboard'
import ConfiguracaoWhatsapp from './pages/comunicacao/ConfiguracaoWhatsapp'
import { ConversasList, ConversaDetalhe } from './pages/comunicacao/Conversas'
import ProxySessions from './pages/comunicacao/ProxySessions'
import Templates from './pages/comunicacao/Templates'
import Analytics from './pages/comunicacao/Analytics'

import '../shared/globals.css'

const PAGE_CONFIG = {
  dashboard:     { title: 'Dashboard',             subtitle: 'Visão geral da operação do dia', component: Dashboard },
  recebimento:   { title: 'Recebimento',           subtitle: 'Conferência de unitizadores recebidos', component: Recebimento },
  triagem:       { title: 'Triagem',               subtitle: 'Sort wall e plano de triagem', component: Triagem },
  roteirizacao:  { title: 'Roteirização',          subtitle: 'Otimização de rotas com VROOM / PyVRP', component: Roteirizacao },
  despacho:      { title: 'Despacho',              subtitle: 'Liberação de rotas para campo', component: Despacho },
  monitoramento: { title: 'Monitoramento',         subtitle: 'Rastreamento em tempo real', component: Monitoramento },
  reconciliacao: { title: 'Reconciliação',         subtitle: 'Retorno e fechamento de rota', component: Reconciliacao },
  previsao:      { title: 'Previsão de Volume',    subtitle: 'Histórico e dimensionamento', component: Previsao },
  unitizadores:  { title: 'Unitizadores',          subtitle: 'Cadastro de bags, sacas e palletes', component: Unitizadores },
  veiculos:      { title: 'Veículos',              subtitle: 'Gestão da frota', component: Veiculos },
  carteiros:     { title: 'Carteiros',             subtitle: 'Equipe de entrega', component: Carteiros },
  ponto:         { title: 'Ponto do Dia',          subtitle: 'Presença e registro', component: Ponto },
  configuracoes: { title: 'Configurações',         subtitle: 'Dados da unidade e integrações', component: Configuracoes },

  // M13 — Comunicação WhatsApp
  'comunicacao-dashboard':          { title: 'Central de Comunicação WhatsApp', subtitle: 'Visão geral da operação de mensagens', component: ComunicacaoDashboard },
  'comunicacao-config':             { title: 'Configuração WhatsApp',            subtitle: 'Conexão, LLM, Chatwoot e horários',   component: ConfiguracaoWhatsapp },
  'comunicacao-conversas':          { title: 'Conversas WhatsApp',               subtitle: 'Histórico e monitor de sessões ativas', component: ConversasList },
  'comunicacao-conversa-detalhe':   { title: 'Detalhes da Conversa',             subtitle: 'Transcrição e metadados da sessão',   component: ConversaDetalhe },
  'comunicacao-proxy':              { title: 'Proxy Carteiro ↔ Destinatário',    subtitle: 'Monitor de sessões em tempo real',    component: ProxySessions },
  'comunicacao-templates':          { title: 'Templates HSM',                    subtitle: 'Mensagens aprovadas pela Meta',       component: Templates },
  'comunicacao-analytics':          { title: 'Analytics de Comunicação',         subtitle: 'Custo LLM, resolução bot e LGPD',    component: Analytics },
}

export default function GestaoApp() {
  const [activePage, setActivePage] = useState('dashboard')

  const config = PAGE_CONFIG[activePage] || PAGE_CONFIG.dashboard
  const PageComponent = config.component

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F5FA]">
      {/* Sidebar fixa */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={config.title} subtitle={config.subtitle} />
        <main className="flex-1 overflow-y-auto">
          <PageComponent onNavigate={setActivePage} />
        </main>
      </div>
    </div>
  )
}
