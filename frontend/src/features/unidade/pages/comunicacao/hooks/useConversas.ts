/**
 * useConversas.ts
 * Manages conversation list polling, message polling, and selection state.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/services/api';
import type { Conversa, Mensagem, InstanciaStatus } from '@/types/comunicacao.types';

export function useConversas(activeTab: string) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [wppStatus, setWppStatus] = useState<InstanciaStatus | null>(null);
  const [loadingConversas, setLoadingConversas] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const msgsEndRef = useRef<HTMLDivElement>(null);
  const conversasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedConversa = conversas.find((c) => c.id === selectedId) ?? null;

  const fetchConversas = useCallback(async (silent = false) => {
    if (!silent) setLoadingConversas(true);
    try {
      const [resConversas, resStatus] = await Promise.all([
        api.get<Conversa[]>('/comunicacao/conversas'),
        api.get<InstanciaStatus>('/comunicacao/status'),
      ]);
      setConversas(resConversas);
      setWppStatus(resStatus);
    } catch {
      // silencia erro de poll
    } finally {
      if (!silent) setLoadingConversas(false);
    }
  }, []);

  const fetchMensagens = useCallback(async (sessionId: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await api.get<Mensagem[]>(`/comunicacao/conversas/${sessionId}/mensagens`);
      setMensagens(res);
    } catch {
      // silencia
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  // Polling conversas (only active on conversas tab)
  useEffect(() => {
    if (activeTab !== 'conversas') {
      if (conversasIntervalRef.current) clearInterval(conversasIntervalRef.current);
      if (msgsIntervalRef.current) clearInterval(msgsIntervalRef.current);
      return;
    }

    fetchConversas();
    conversasIntervalRef.current = setInterval(() => fetchConversas(true), 5000);
    return () => {
      if (conversasIntervalRef.current) clearInterval(conversasIntervalRef.current);
    };
  }, [activeTab, fetchConversas]);

  // Polling mensagens
  useEffect(() => {
    if (activeTab !== 'conversas') return;
    if (msgsIntervalRef.current) clearInterval(msgsIntervalRef.current);
    if (!selectedId) {
      setMensagens([]);
      return;
    }
    fetchMensagens(selectedId);
    msgsIntervalRef.current = setInterval(() => fetchMensagens(selectedId, true), 3000);
    return () => {
      if (msgsIntervalRef.current) clearInterval(msgsIntervalRef.current);
    };
  }, [activeTab, selectedId, fetchMensagens]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleSelectConversa = (id: string) => {
    setSelectedId(id);
    setShowMobileDetail(true);
  };

  return {
    conversas,
    selectedId,
    selectedConversa,
    mensagens,
    wppStatus,
    loadingConversas,
    loadingMsgs,
    showMobileDetail,
    setShowMobileDetail,
    msgsEndRef,
    fetchConversas,
    fetchMensagens,
    handleSelectConversa,
  };
}
