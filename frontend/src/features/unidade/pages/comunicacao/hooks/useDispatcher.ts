/**
 * useDispatcher.ts
 * Manages dispatcher join/leave/send message logic for the conversas tab.
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import type { Conversa } from '@/types/comunicacao.types';

interface UseDispatcherOptions {
  selectedConversa: Conversa | null;
  fetchConversas: (silent?: boolean) => Promise<void>;
  fetchMensagens: (sessionId: string, silent?: boolean) => Promise<void>;
}

export function useDispatcher({ selectedConversa, fetchConversas, fetchMensagens }: UseDispatcherOptions) {
  const [dispatcherNome, setDispatcherNome] = useState('');
  const [mensagemInput, setMensagemInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [joiningChat, setJoiningChat] = useState(false);
  const [leavingChat, setLeavingChat] = useState(false);

  const handleEntrar = async () => {
    if (!selectedConversa || !dispatcherNome.trim()) {
      toast.error('Informe seu nome antes de entrar na conversa');
      return;
    }
    setJoiningChat(true);
    try {
      await api.post('/comunicacao/dispatcher/entrar', {
        wppSessionId: selectedConversa.id,
        dispatcherNome: dispatcherNome.trim(),
      });
      toast.success('Voce entrou na conversa');
      await fetchConversas(true);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao entrar na conversa');
    } finally {
      setJoiningChat(false);
    }
  };

  const handleSair = async () => {
    if (!selectedConversa?.dispatcherSessionId) return;
    setLeavingChat(true);
    try {
      await api.post(`/comunicacao/dispatcher/${selectedConversa.dispatcherSessionId}/sair`);
      toast.success('Voce saiu da conversa');
      await fetchConversas(true);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao sair da conversa');
    } finally {
      setLeavingChat(false);
    }
  };

  const handleEnviarMensagem = async () => {
    if (!selectedConversa?.dispatcherSessionId || !mensagemInput.trim()) return;
    setSendingMsg(true);
    try {
      await api.post(`/comunicacao/dispatcher/${selectedConversa.dispatcherSessionId}/mensagem`, {
        content: mensagemInput.trim(),
      });
      setMensagemInput('');
      await fetchMensagens(selectedConversa.id, true);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao enviar mensagem');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  return {
    dispatcherNome, setDispatcherNome,
    mensagemInput, setMensagemInput,
    sendingMsg, joiningChat, leavingChat,
    handleEntrar, handleSair, handleEnviarMensagem, handleKeyDown,
  };
}
