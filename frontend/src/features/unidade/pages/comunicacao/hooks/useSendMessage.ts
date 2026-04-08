/**
 * useSendMessage.ts
 * Manages the "Enviar Mensagem" tab logic: phone input, message send.
 * Note: The Carteiro model doesn't have a phone field, so no carteiro search.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export function useSendMessage(_activeTab: string) {
  const [phoneInput, setPhoneInput] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);

  const handleEnviarNotificacao = async () => {
    if (!phoneInput.trim() || !mensagem.trim()) {
      toast.error('Preencha o telefone e a mensagem');
      return;
    }
    setSending(true);
    try {
      await api.post('/comunicacao/notify', {
        phone: phoneInput.replace(/\D/g, ''),
        text: mensagem.trim(),
      });
      toast.success('Mensagem enviada com sucesso');
      setMensagem('');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  return {
    phoneInput, setPhoneInput,
    mensagem, setMensagem,
    sending,
    handleEnviarNotificacao,
  };
}
