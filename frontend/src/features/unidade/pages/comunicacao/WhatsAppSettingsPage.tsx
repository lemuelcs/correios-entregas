/**
 * WhatsAppSettingsPage.tsx
 * Settings page with 2 tabs: Bot WhatsApp and IA/LLM
 */
import { useState } from 'react';
import { MessageCircle, RefreshCcw, Brain, Bot } from 'lucide-react';

import { useWppPilotConfig } from './hooks/useWppPilotConfig';
import { useLlmConfig } from './hooks/useLlmConfig';
import WhatsAppBotTab from './components/WhatsAppBotTab';
import WhatsAppLlmTab from './components/WhatsAppLlmTab';
import QrCodeModal from './components/QrCodeModal';

type WhatsAppTabId = 'bot' | 'llm';

export function WhatsAppSettingsPage() {
  const [activeTab, setActiveTab] = useState<WhatsAppTabId>('bot');

  const pilot = useWppPilotConfig();
  const llm = useLlmConfig(pilot.bootstrapData, pilot.refetch);

  const handleRefresh = async () => {
    await pilot.refetch();
  };

  if (pilot.isLoading && !pilot.bootstrapData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003399]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">WhatsApp Global</h1>
                    <p className="text-sm text-gray-500">Configure a instância e o webhook compartilhados por todas as unidades.</p>
                  </div>
                </div>
        <button
          onClick={handleRefresh}
          disabled={llm.saving}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-2">
        <nav className="flex gap-8">
          {([
            { id: 'bot' as WhatsAppTabId, label: 'Bot WhatsApp', icon: Bot },
            { id: 'llm' as WhatsAppTabId, label: 'IA / LLM', icon: Brain },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#003399] text-[#003399]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'bot' && (
        <WhatsAppBotTab
          wppPilot={pilot.wppPilot}
          wppPilotForm={pilot.wppPilotForm}
          setWppPilotForm={pilot.setWppPilotForm}
          wppPilotSaving={pilot.wppPilotSaving}
          wppPilotConfiguringWebhook={pilot.wppPilotConfiguringWebhook}
          creatingInstance={pilot.creatingInstance}
          connecting={pilot.connecting}
          restarting={pilot.restarting}
          deleting={pilot.deleting}
          onRefresh={handleRefresh}
          onSave={pilot.handleSaveWppPilot}
          onReconfigureWebhook={pilot.handleReconfigureWebhook}
          onCreateInstance={pilot.handleCreateInstance}
          onConnectInstance={pilot.handleConnectInstance}
          onRestartInstance={pilot.handleRestartInstance}
          onDeleteInstance={pilot.handleDeleteInstance}
        />
      )}

      {activeTab === 'llm' && (
        <WhatsAppLlmTab
          llmConfig={llm.llmConfig}
          setLlmConfig={llm.setLlmConfig}
          saving={llm.saving}
          onSave={llm.handleSaveLlm}
          llmTesting={llm.llmTesting}
          onTest={llm.handleTestLlm}
        />
      )}

      <QrCodeModal
        open={!!pilot.qrCode}
        qrCode={pilot.qrCode ?? ''}
        connecting={pilot.connecting}
        onRefreshQr={pilot.handleConnectInstance}
        onClose={() => pilot.setQrCode(null)}
      />
    </div>
  );
}
