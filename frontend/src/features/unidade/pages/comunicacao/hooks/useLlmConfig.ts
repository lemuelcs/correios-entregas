import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import type { AdminConfig, LlmConfigForm } from '@/types/comunicacao.types';

const DEFAULT_LLM: LlmConfigForm = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 1024,
  complexityRouting: { enabled: false },
};

export function useLlmConfig(bootstrapData: AdminConfig | null, refetch: () => Promise<void>) {
  const [llmConfig, setLlmConfig] = useState<LlmConfigForm>(DEFAULT_LLM);
  const [saving, setSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);

  useEffect(() => {
    if (!bootstrapData) return;
    // Try to load from dedicated endpoint
    api.get<{ data: { llmEnabled: boolean; llmConfig: LlmConfigForm } }>('/comunicacao/admin/llm-config')
      .then((result) => {
        if (result.data?.llmConfig) {
          setLlmConfig(result.data.llmConfig);
        }
      })
      .catch(() => {});
  }, [bootstrapData]);

  const handleSaveLlm = async () => {
    setSaving(true);
    try {
      await api.put('/comunicacao/admin/llm-config', { llmConfig });
      toast.success('Configuracao global de LLM salva');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar LLM');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLlm = async () => {
    setLlmTesting(true);
    try {
      const result = await api.post<{ data: { success: boolean; response?: string; error?: string } }>('/comunicacao/admin/llm-config/test');
      const data = result.data;
      if (data?.success) {
        toast.success('LLM global respondeu com sucesso');
      } else {
        toast.error(data?.error ?? 'Falha no teste');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao testar LLM');
    } finally {
      setLlmTesting(false);
    }
  };

  return { llmConfig, setLlmConfig, saving, llmTesting, handleSaveLlm, handleTestLlm };
}
