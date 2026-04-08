import { Loader2, Save, TestTube } from 'lucide-react';
import type { LlmConfigForm } from '@/types/comunicacao.types';

interface WhatsAppLlmTabProps {
  llmConfig: LlmConfigForm;
  setLlmConfig: (value: LlmConfigForm) => void;
  saving: boolean;
  onSave: () => Promise<void>;
  llmTesting: boolean;
  onTest: () => Promise<void>;
}

export default function WhatsAppLlmTab({ llmConfig, setLlmConfig, saving, onSave, llmTesting, onTest }: WhatsAppLlmTabProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Configuracao IA / LLM</h3>
        <p className="text-sm text-gray-500 mt-1">Configure o modelo de linguagem usado pelo chatbot de atendimento automatizado.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select value={llmConfig.provider} onChange={(e) => setLlmConfig({ ...llmConfig, provider: e.target.value as LlmConfigForm['provider'] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#003399]/30">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
          <select value={llmConfig.model} onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#003399]/30">
            {llmConfig.provider === 'openai' && (
              <>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
              </>
            )}
            {llmConfig.provider === 'anthropic' && (
              <>
                <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              </>
            )}
            {llmConfig.provider === 'google' && (
              <>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </>
            )}
            {llmConfig.provider === 'openrouter' && <option value="gpt-4o-mini">GPT-4o Mini (OpenRouter)</option>}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura: {llmConfig.temperature?.toFixed(1)}</label>
          <input type="range" min="0" max="1" step="0.1" value={llmConfig.temperature ?? 0.3} onChange={(e) => setLlmConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })} className="w-full accent-[#003399]" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Preciso</span>
            <span>Criativo</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
          <input type="number" min="256" max="4096" step="256" value={llmConfig.maxTokens ?? 1024} onChange={(e) => setLlmConfig({ ...llmConfig, maxTokens: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#003399]/30" />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={llmConfig.complexityRouting?.enabled ?? false}
            onChange={(e) =>
              setLlmConfig({
                ...llmConfig,
                complexityRouting: {
                  ...llmConfig.complexityRouting!,
                  enabled: e.target.checked,
                },
              })
            }
            className="rounded"
          />
          Roteamento por complexidade
        </label>
        <p className="text-xs text-gray-500 mt-1">Usa modelo mais barato para perguntas simples e modelo premium para assuntos complexos (disputas, acidentes, etc.)</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#003399] text-white rounded-lg hover:bg-[#002266] disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar
        </button>
        <button onClick={onTest} disabled={llmTesting} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium">
          {llmTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}Testar
        </button>
      </div>
    </div>
  );
}
