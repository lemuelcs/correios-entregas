/**
 * ComunicacaoPage.tsx
 * WPP-PILOT — Comunicacao WhatsApp com abas: Dashboard, Conversas, Enviar Mensagem
 */
import { useState } from 'react';
import { MessageSquare, RefreshCw, Send, Wifi, WifiOff, LayoutDashboard } from 'lucide-react';

import { useConversas } from './hooks/useConversas';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useDispatcher } from './hooks/useDispatcher';
import { useSendMessage } from './hooks/useSendMessage';

import DashboardTab from './components/DashboardTab';
import ConversasList from './components/ConversasList';
import MessageThread from './components/MessageThread';
import SendMessageTab from './components/SendMessageTab';

type TabId = 'dashboard' | 'conversas' | 'enviar';

export function ComunicacaoPage() {
  const [activeTab, setActiveTab] = useState<TabId>('conversas');

  const conversas = useConversas(activeTab);
  const dashboard = useDashboardStats(activeTab);
  const dispatcher = useDispatcher({
    selectedConversa: conversas.selectedConversa,
    fetchConversas: conversas.fetchConversas,
    fetchMensagens: conversas.fetchMensagens,
  });
  const sendMessage = useSendMessage(activeTab);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comunicacao WhatsApp</h1>
          <p className="text-sm text-gray-500">Conversas ativas nas ultimas 24h</p>
        </div>
        <div className="flex items-center gap-3">
          {conversas.wppStatus && (
            <span
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
                conversas.wppStatus.connected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {conversas.wppStatus.connected ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              {conversas.wppStatus.connected ? 'Conectado' : 'Desconectado'}
            </span>
          )}
          <button
            onClick={() => conversas.fetchConversas()}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {([
            { id: 'dashboard' as TabId, label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'conversas' as TabId, label: 'Conversas', icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'enviar' as TabId, label: 'Enviar Mensagem', icon: <Send className="w-4 h-4" /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-[#003399] text-[#003399]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          stats={dashboard.stats}
          loadingStats={dashboard.loadingStats}
          periodo={dashboard.periodo}
          setPeriodo={dashboard.setPeriodo}
          dataInicio={dashboard.dataInicio}
          dataFim={dashboard.dataFim}
          weekDates={dashboard.weekDates}
          dataSelecionada={dashboard.dataSelecionada}
          setDataSelecionada={dashboard.setDataSelecionada}
          goToPreviousWeek={dashboard.goToPreviousWeek}
          goToNextWeek={dashboard.goToNextWeek}
          goToToday={dashboard.goToToday}
          currentMonthForWeeks={dashboard.currentMonthForWeeks}
          weeksOfMonth={dashboard.weeksOfMonth}
          selectedWeekIndex={dashboard.selectedWeekIndex}
          setSelectedWeekIndex={dashboard.setSelectedWeekIndex}
          goToPreviousMonthForWeeks={dashboard.goToPreviousMonthForWeeks}
          goToNextMonthForWeeks={dashboard.goToNextMonthForWeeks}
          quinzenas={dashboard.quinzenas}
          quinzenasOffset={dashboard.quinzenasOffset}
          selectedQuinzenaIndex={dashboard.selectedQuinzenaIndex}
          setSelectedQuinzenaIndex={dashboard.setSelectedQuinzenaIndex}
          goToPreviousQuinzenas={dashboard.goToPreviousQuinzenas}
          goToNextQuinzenas={dashboard.goToNextQuinzenas}
          visibleMonths={dashboard.visibleMonths}
          monthsOffset={dashboard.monthsOffset}
          selectedMonthIndex={dashboard.selectedMonthIndex}
          setSelectedMonthIndex={dashboard.setSelectedMonthIndex}
          goToPreviousMonths={dashboard.goToPreviousMonths}
          goToNextMonths={dashboard.goToNextMonths}
          formatWeekDay={dashboard.formatWeekDay}
          formatDayMonth={dashboard.formatDayMonth}
          toLocalDateInput={dashboard.toLocalDateInput}
        />
      )}

      {/* Tab: Conversas */}
      {activeTab === 'conversas' && (
        <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[500px]">
          <ConversasList
            conversas={conversas.conversas}
            selectedId={conversas.selectedId}
            loadingConversas={conversas.loadingConversas}
            showMobileDetail={conversas.showMobileDetail}
            onSelect={conversas.handleSelectConversa}
          />
          <MessageThread
            selectedConversa={conversas.selectedConversa}
            mensagens={conversas.mensagens}
            loadingMsgs={conversas.loadingMsgs}
            showMobileDetail={conversas.showMobileDetail}
            setShowMobileDetail={conversas.setShowMobileDetail}
            msgsEndRef={conversas.msgsEndRef}
            dispatcherNome={dispatcher.dispatcherNome}
            setDispatcherNome={dispatcher.setDispatcherNome}
            mensagemInput={dispatcher.mensagemInput}
            setMensagemInput={dispatcher.setMensagemInput}
            sendingMsg={dispatcher.sendingMsg}
            joiningChat={dispatcher.joiningChat}
            leavingChat={dispatcher.leavingChat}
            handleEntrar={dispatcher.handleEntrar}
            handleSair={dispatcher.handleSair}
            handleEnviarMensagem={dispatcher.handleEnviarMensagem}
            handleKeyDown={dispatcher.handleKeyDown}
          />
        </div>
      )}

      {/* Tab: Enviar Mensagem */}
      {activeTab === 'enviar' && (
        <SendMessageTab
          phoneInput={sendMessage.phoneInput}
          setPhoneInput={sendMessage.setPhoneInput}
          mensagem={sendMessage.mensagem}
          setMensagem={sendMessage.setMensagem}
          sending={sendMessage.sending}
          handleEnviarNotificacao={sendMessage.handleEnviarNotificacao}
        />
      )}
    </div>
  );
}
