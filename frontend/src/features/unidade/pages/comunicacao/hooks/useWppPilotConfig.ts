import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import type { AdminConfig, WhatsAppBotFormData } from '@/types/comunicacao.types';

const DEFAULT_FORM: WhatsAppBotFormData = {
  instanceName: '',
  phoneNumber: '',
  unidadeNome: '',
  locale: 'pt_BR',
  timezone: 'America/Sao_Paulo',
  botEnabled: true,
  proxyEnabled: true,
  llmEnabled: false,
};

export function useWppPilotConfig() {
  const [bootstrapData, setBootstrapData] = useState<AdminConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wppPilot, setWppPilot] = useState<AdminConfig | null>(null);
  const [wppPilotForm, setWppPilotForm] = useState<WhatsAppBotFormData>(DEFAULT_FORM);
  const [wppPilotSaving, setWppPilotSaving] = useState(false);
  const [wppPilotConfiguringWebhook, setWppPilotConfiguringWebhook] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await api.get<AdminConfig>('/comunicacao/admin/config');
      setBootstrapData(config);
      setWppPilot(config);
      if (config.configured) {
        setWppPilotForm({
          instanceName: config.instanceName ?? '',
          phoneNumber: config.phoneNumber ?? '',
          unidadeNome: config.dspNome ?? config.unidadeNome ?? '',
          locale: config.locale ?? 'pt_BR',
          timezone: config.timezone ?? 'America/Sao_Paulo',
          botEnabled: config.botEnabled ?? true,
          proxyEnabled: config.proxyEnabled ?? true,
          llmEnabled: config.llmEnabled ?? false,
        });
      }
    } catch {
      // silencia
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const handleSaveWppPilot = async () => {
    if (!wppPilotForm.instanceName.trim()) { toast.error('Informe o nome da instancia'); return; }
    setWppPilotSaving(true);
    try {
      await api.post('/comunicacao/admin/config', {
        instanceName: wppPilotForm.instanceName.trim(),
        phoneNumber: wppPilotForm.phoneNumber,
        dspNome: wppPilotForm.unidadeNome,
        locale: wppPilotForm.locale,
        timezone: wppPilotForm.timezone,
        botEnabled: wppPilotForm.botEnabled,
        proxyEnabled: wppPilotForm.proxyEnabled,
        llmEnabled: wppPilotForm.llmEnabled,
      });
      toast.success('Configuracao global salva e webhook configurado');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar configuracao');
    } finally {
      setWppPilotSaving(false);
    }
  };

  const handleReconfigureWebhook = async () => {
    setWppPilotConfiguringWebhook(true);
    try {
      await api.post('/comunicacao/admin/configurar-webhook');
      toast.success('Webhook global reconfigurado');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao reconfigurar webhook');
    } finally {
      setWppPilotConfiguringWebhook(false);
    }
  };

  const handleCreateInstance = async () => {
    setCreatingInstance(true);
    try {
      const result = await api.post<{ ok: boolean; qrcode?: string; instanceName?: string }>('/comunicacao/admin/instance/criar', {
        instanceName: wppPilotForm.instanceName.trim(),
        phoneNumber: wppPilotForm.phoneNumber,
        dspNome: wppPilotForm.unidadeNome,
        locale: wppPilotForm.locale,
        timezone: wppPilotForm.timezone,
        botEnabled: wppPilotForm.botEnabled,
        proxyEnabled: wppPilotForm.proxyEnabled,
        llmEnabled: wppPilotForm.llmEnabled,
      });
      if (result.qrcode) setQrCode(result.qrcode);
      toast.success('Instancia global criada');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao criar instancia');
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleConnectInstance = async () => {
    setConnecting(true);
    try {
      const result = await api.post<{ ok: boolean; qrcode?: string; alreadyConnected?: boolean }>('/comunicacao/admin/instance/conectar');
      if (result.alreadyConnected) {
        toast.success('Ja conectado');
        await refetch();
      } else if (result.qrcode) {
        setQrCode(result.qrcode);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao conectar');
    } finally {
      setConnecting(false);
    }
  };

  const handleRestartInstance = async () => {
    setRestarting(true);
    try {
      await api.post('/comunicacao/admin/instance/reiniciar');
      toast.success('Instancia global reiniciada');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao reiniciar');
    } finally {
      setRestarting(false);
    }
  };

  const handleDeleteInstance = async () => {
    setDeleting(true);
    try {
      await api.delete('/comunicacao/admin/instance');
      toast.success('Instancia global excluida');
      await refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  return {
    bootstrapData, isLoading, wppPilot, wppPilotForm, setWppPilotForm,
    wppPilotSaving, wppPilotConfiguringWebhook,
    creatingInstance, connecting, restarting, deleting,
    qrCode, setQrCode, refetch,
    handleSaveWppPilot, handleReconfigureWebhook,
    handleCreateInstance, handleConnectInstance, handleRestartInstance, handleDeleteInstance,
  };
}
