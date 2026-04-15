import { useEffect, useState } from 'react';
import { useGestaoConfigStore } from '@/stores/gestao-config.store';
import { Panel } from '@/shared/ui/Panel';
import toast from 'react-hot-toast';
import { Bot, Brain, MessageCircle, RefreshCcw } from 'lucide-react';

import { useWppPilotConfig } from '@/features/unidade/pages/comunicacao/hooks/useWppPilotConfig';
import { useLlmConfig } from '@/features/unidade/pages/comunicacao/hooks/useLlmConfig';
import WhatsAppBotTab from '@/features/unidade/pages/comunicacao/components/WhatsAppBotTab';
import WhatsAppLlmTab from '@/features/unidade/pages/comunicacao/components/WhatsAppLlmTab';
import QrCodeModal from '@/features/unidade/pages/comunicacao/components/QrCodeModal';

type Tab = 'integracoes' | 'whatsapp-bot' | 'ia-llm' | 'vroom-osrm';
const tabs: Array<{ id: Tab; label: string; icon?: typeof Bot }> = [
  { id: 'integracoes', label: 'Integracoes' },
  { id: 'whatsapp-bot', label: 'Bot WhatsApp', icon: Bot },
  { id: 'ia-llm', label: 'IA / LLM', icon: Brain },
  { id: 'vroom-osrm', label: 'VROOM / OSRM' },
];

const INTEGRATION_KEYS = [
  { chave: 'CORREIOS_CWS_URL', label: 'Correios CWS URL', group: 'Correios CWS' },
  { chave: 'CORREIOS_CWS_USERNAME', label: 'Username', group: 'Correios CWS' },
  { chave: 'CORREIOS_CWS_ACCESS_CODE', label: 'Access Code', group: 'Correios CWS', secret: true },
  { chave: 'CORREIOS_CWS_CONTRACT', label: 'Contract', group: 'Correios CWS' },
  { chave: 'CORREIOS_CWS_CARTAO_POSTAGEM', label: 'Cartao Postagem', group: 'Correios CWS' },
  { chave: 'EVOLUTION_PILOT_URL', label: 'Evolution API URL', group: 'Evolution API' },
  { chave: 'EVOLUTION_PILOT_API_KEY', label: 'API Key', group: 'Evolution API', secret: true },
  { chave: 'EVOLUTION_PILOT_WEBHOOK_SECRET', label: 'Webhook Secret', group: 'Evolution API', secret: true },
  { chave: 'OPENAI_API_KEY', label: 'OpenAI API Key', group: 'LLM Providers', secret: true },
  { chave: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', group: 'LLM Providers', secret: true },
  { chave: 'GOOGLE_AI_API_KEY', label: 'Google AI API Key', group: 'LLM Providers', secret: true },
  { chave: 'GROQ_API_KEY', label: 'Groq API Key', group: 'LLM Providers', secret: true },
  { chave: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', group: 'LLM Providers', secret: true },
  { chave: 'VIACEP_URL', label: 'ViaCEP URL', group: 'Geocoding' },
];

const VROOM_OSRM_KEYS = [
  { chave: 'OSRM_URL', label: 'OSRM URL', group: 'OSRM' },
  { chave: 'OSRM_TIMEOUT_MS', label: 'OSRM Timeout (ms)', group: 'OSRM' },
  { chave: 'VROOM_URL', label: 'VROOM URL', group: 'VROOM' },
  { chave: 'VROOM_TIMEOUT_MS', label: 'VROOM Timeout (ms)', group: 'VROOM' },
  { chave: 'PYVRP_URL', label: 'PyVRP URL', group: 'PyVRP' },
  { chave: 'PYVRP_TIMEOUT_MS', label: 'PyVRP Timeout (ms)', group: 'PyVRP' },
];

export function GestaoAjustesPage() {
  const { configs, loading, fetchAll, upsert } = useGestaoConfigStore();
  const [activeTab, setActiveTab] = useState<Tab>('integracoes');
  const [values, setValues] = useState<Record<string, string>>({});

  // WhatsApp Bot + LLM hooks
  const pilot = useWppPilotConfig();
  const llm = useLlmConfig(pilot.bootstrapData, pilot.refetch);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.chave] = typeof c.valor === 'string' ? c.valor : JSON.stringify(c.valor);
    }
    setValues(map);
  }, [configs]);

  function getValue(chave: string) { return values[chave] ?? ''; }
  function setValue(chave: string, val: string) { setValues(prev => ({ ...prev, [chave]: val })); }

  async function handleSave(chave: string) {
    try {
      await upsert(chave, values[chave] ?? '');
      toast.success(`${chave} salvo`);
    } catch { toast.error('Erro ao salvar'); }
  }

  async function handleSaveAll(keys: Array<{ chave: string }>) {
    try {
      for (const k of keys) {
        if (values[k.chave] !== undefined) {
          await upsert(k.chave, values[k.chave]);
        }
      }
      toast.success('Configuracoes salvas');
    } catch { toast.error('Erro ao salvar'); }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-correios-blue focus:border-transparent';

  function renderKeyGroup(keys: Array<{ chave: string; label: string; group?: string; secret?: boolean }>) {
    const groups = keys.reduce<Record<string, typeof keys>>((acc, k) => {
      const g = k.group ?? 'Geral';
      if (!acc[g]) acc[g] = [];
      acc[g].push(k);
      return acc;
    }, {});

    return Object.entries(groups).map(([group, items]) => (
      <div key={group} className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2">{group}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map(k => (
            <div key={k.chave}>
              <label className="mb-1 block text-xs font-medium text-slate-600">{k.label}</label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type={k.secret ? 'password' : 'text'}
                  value={getValue(k.chave)}
                  onChange={e => setValue(k.chave, e.target.value)}
                  placeholder={k.chave}
                />
                <button onClick={() => handleSave(k.chave)} className="shrink-0 rounded-lg border border-correios-blue px-3 py-2 text-xs font-semibold text-correios-blue hover:bg-correios-blue-50">Salvar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
              activeTab === t.id ? 'border-correios-blue text-correios-blue' : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
          </button>
        ))}
      </div>

      {loading && activeTab === 'integracoes' || loading && activeTab === 'vroom-osrm' ? (
        <p className="py-8 text-center text-sm text-slate-400">Carregando...</p>
      ) : (
        <>
          {activeTab === 'integracoes' && (
            <Panel title="Chaves de Integracao" description="Configuracoes de API para todas as integracoes do sistema.">
              <div className="space-y-6">
                {renderKeyGroup(INTEGRATION_KEYS)}
                <button onClick={() => handleSaveAll(INTEGRATION_KEYS)} className="rounded-lg bg-correios-blue px-6 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Salvar Todas</button>
              </div>
            </Panel>
          )}

          {activeTab === 'whatsapp-bot' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">WhatsApp Global</h1>
                    <p className="text-sm text-gray-500">Configure a instância, webhook e canal de envio globais.</p>
                  </div>
                </div>
                <button
                  onClick={() => pilot.refetch()}
                  disabled={llm.saving}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>

              {pilot.isLoading && !pilot.bootstrapData ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003399]" />
                </div>
              ) : (
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
                  onRefresh={() => pilot.refetch()}
                  onSave={pilot.handleSaveWppPilot}
                  onReconfigureWebhook={pilot.handleReconfigureWebhook}
                  onCreateInstance={pilot.handleCreateInstance}
                  onConnectInstance={pilot.handleConnectInstance}
                  onRestartInstance={pilot.handleRestartInstance}
                  onDeleteInstance={pilot.handleDeleteInstance}
                />
              )}
            </div>
          )}

          {activeTab === 'ia-llm' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="w-8 h-8 text-purple-500" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">IA / LLM Global</h1>
                    <p className="text-sm text-gray-500">Configure o modelo de linguagem compartilhado pelo sistema.</p>
                  </div>
                </div>
              </div>

              {pilot.isLoading && !pilot.bootstrapData ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003399]" />
                </div>
              ) : (
                <WhatsAppLlmTab
                  llmConfig={llm.llmConfig}
                  setLlmConfig={llm.setLlmConfig}
                  saving={llm.saving}
                  onSave={llm.handleSaveLlm}
                  llmTesting={llm.llmTesting}
                  onTest={llm.handleTestLlm}
                />
              )}
            </div>
          )}

          {activeTab === 'vroom-osrm' && (
            <Panel title="VROOM / OSRM / PyVRP" description="Configuracoes dos servicos de roteirizacao e otimizacao.">
              <div className="space-y-6">
                {renderKeyGroup(VROOM_OSRM_KEYS)}
                <button onClick={() => handleSaveAll(VROOM_OSRM_KEYS)} className="rounded-lg bg-correios-blue px-6 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Salvar Todas</button>
              </div>
            </Panel>
          )}
        </>
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
