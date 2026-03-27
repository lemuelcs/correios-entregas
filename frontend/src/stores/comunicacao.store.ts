import { create } from 'zustand';
import { api } from '../services/api';
import type { Conversa, Mensagem, ProxySession, StatusInstancia, TemplateHSM } from '../types/comunicacao.types';

interface ComunicacaoState {
  conversas: Conversa[];
  conversaAtual: Conversa | null;
  mensagens: Mensagem[];
  sessoes: ProxySession[];
  templates: TemplateHSM[];
  instanciaStatus: StatusInstancia;
  loading: boolean;
  error: string | null;

  fetchConversas: () => Promise<void>;
  fetchConversa: (id: string) => Promise<void>;
  fetchMensagens: (conversaId: string) => Promise<void>;
  enviarMensagemGestor: (conversaId: string, texto: string) => Promise<void>;
  assumirConversa: (conversaId: string) => Promise<void>;
  encerrarConversa: (conversaId: string) => Promise<void>;
  fetchSessoes: () => Promise<void>;
  encerrarSessao: (id: string) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  submeterTemplate: (data: Partial<TemplateHSM>) => Promise<void>;
  fetchInstanciaStatus: () => Promise<void>;
  conectarInstancia: () => Promise<void>;
  desconectarInstancia: () => Promise<void>;
}

export const useComunicacaoStore = create<ComunicacaoState>((set) => ({
  conversas: [],
  conversaAtual: null,
  mensagens: [],
  sessoes: [],
  templates: [],
  instanciaStatus: 'INACTIVE',
  loading: false,
  error: null,

  fetchConversas: async () => {
    set({ loading: true, error: null });
    try {
      const conversas = await api.get<Conversa[]>('/comunicacao/conversas');
      set({ conversas, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchConversa: async (id) => {
    set({ loading: true, error: null });
    try {
      const conversaAtual = await api.get<Conversa>(`/comunicacao/conversas/${id}`);
      set({ conversaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchMensagens: async (conversaId) => {
    set({ loading: true, error: null });
    try {
      const mensagens = await api.get<Mensagem[]>(`/comunicacao/conversas/${conversaId}/mensagens`);
      set({ mensagens, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  enviarMensagemGestor: async (conversaId, texto) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/conversas/${conversaId}/mensagem-gestor`, { texto });
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  assumirConversa: async (conversaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/conversas/${conversaId}/assumir`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  encerrarConversa: async (conversaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/conversas/${conversaId}/encerrar`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchSessoes: async () => {
    set({ loading: true, error: null });
    try {
      const sessoes = await api.get<ProxySession[]>('/comunicacao/proxy/sessoes');
      set({ sessoes, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  encerrarSessao: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/proxy/sessoes/${id}/encerrar`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await api.get<TemplateHSM[]>('/comunicacao/templates');
      set({ templates, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  submeterTemplate: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/templates', data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchInstanciaStatus: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.get<{ status: StatusInstancia }>('/comunicacao/instancia/status');
      set({ instanciaStatus: result.status, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  conectarInstancia: async () => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/instancia/conectar');
      set({ instanciaStatus: 'ACTIVE', loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  desconectarInstancia: async () => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/instancia/desconectar');
      set({ instanciaStatus: 'INACTIVE', loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
