import { useEffect, useState } from 'react';
import { useGestaoConfigStore } from '@/stores/gestao-config.store';
import { Panel } from '@/shared/ui/Panel';
import toast from 'react-hot-toast';

type Tab = 'integracoes' | 'whatsapp' | 'vroom-osrm';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'integracoes', label: 'Integracoes' },
  { id: 'whatsapp', label: 'WhatsApp' },
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

const WHATSAPP_KEYS = [
  { chave: 'WPP_GLOBAL_INSTANCE_NAME', label: 'Instance Name' },
  { chave: 'WPP_GLOBAL_PHONE', label: 'Telefone do Bot' },
  { chave: 'WPP_GLOBAL_BOT_ENABLED', label: 'Bot Habilitado' },
  { chave: 'WPP_GLOBAL_PROXY_ENABLED', label: 'Proxy Habilitado' },
  { chave: 'WPP_GLOBAL_LLM_ENABLED', label: 'LLM Habilitado' },
  { chave: 'WPP_GLOBAL_LLM_PROVIDER', label: 'LLM Provider' },
  { chave: 'WPP_GLOBAL_LLM_MODEL', label: 'LLM Model' },
  { chave: 'WPP_GLOBAL_LOCALE', label: 'Locale' },
  { chave: 'WPP_GLOBAL_TIMEZONE', label: 'Timezone' },
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
              'px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
              activeTab === t.id ? 'border-correios-blue text-correios-blue' : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >{t.label}</button>
        ))}
      </div>

      {loading ? (
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

          {activeTab === 'whatsapp' && (
            <Panel title="WhatsApp Global" description="Configuracao global do bot WhatsApp para todas as unidades.">
              <div className="space-y-4">
                {WHATSAPP_KEYS.map(k => (
                  <div key={k.chave}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{k.label}</label>
                    <div className="flex gap-2">
                      <input className={inputClass} value={getValue(k.chave)} onChange={e => setValue(k.chave, e.target.value)} placeholder={k.chave} />
                      <button onClick={() => handleSave(k.chave)} className="shrink-0 rounded-lg border border-correios-blue px-3 py-2 text-xs font-semibold text-correios-blue hover:bg-correios-blue-50">Salvar</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => handleSaveAll(WHATSAPP_KEYS)} className="rounded-lg bg-correios-blue px-6 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Salvar Todas</button>
              </div>
            </Panel>
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
    </div>
  );
}
