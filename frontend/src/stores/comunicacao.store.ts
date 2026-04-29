import { create } from 'zustand';
import { api } from '../services/api';
import type {
  Conversa,
  Mensagem,
  ProxySession,
  InstanciaStatus,
  AdminConfig,
  AdminStats,
  LlmAnalytics,
  LlmConfig,
  TemplateHSM,
} from '../types/comunicacao.types';

interface ComunicacaoState {
  // ── Data ────────────────────────────────────────────────────────
  conversas: Conversa[];
  conversaAtual: Conversa | null;
  mensagens: Mensagem[];
  sessoes: ProxySession[];
  templates: TemplateHSM[];
  instanciaStatus: InstanciaStatus | null;
  adminConfig: AdminConfig | null;
  adminStats: AdminStats | null;
  llmAnalytics: LlmAnalytics | null;
  llmConfig: LlmConfig | null;
  loading: boolean;
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────
  fetchConversas: () => Promise<void>;
  fetchMensagens: (conversaId: string) => Promise<void>;
  enviarMensagemGestor: (dispatcherSessionId: string, content: string) => Promise<void>;
  assumirConversa: (wppSessionId: string, dispatcherNome: string) => Promise<{ dispatcherSessionId: string }>;
  encerrarConversa: (dispatcherSessionId: string) => Promise<void>;

  fetchSessoes: () => Promise<void>;
  encerrarSessao: (sessionId: string) => Promise<void>;

  fetchTemplates: () => Promise<void>;
  submeterTemplate: (data: Partial<TemplateHSM>) => Promise<void>;

  fetchInstanciaStatus: () => Promise<void>;
  conectarInstancia: () => Promise<{ qrcode?: string | null; alreadyConnected?: boolean }>;
  desconectarInstancia: () => Promise<void>;

  fetchAdminConfig: () => Promise<void>;
  saveAdminConfig: (data: Record<string, unknown>) => Promise<void>;
  fetchAdminStats: (dataInicio?: string, dataFim?: string) => Promise<void>;

  fetchLlmConfig: () => Promise<void>;
  updateLlmConfig: (data: { llmEnabled?: boolean; llmConfig?: Record<string, unknown> }) => Promise<void>;
  fetchLlmAnalytics: () => Promise<void>;

  enviarNotificacao: (phone: string, text: string) => Promise<void>;
  criarInstancia: (data: Record<string, unknown>) => Promise<{ ok: boolean; qrcode?: string; instanceName?: string; webhookError?: string | null }>;
  reiniciarInstancia: () => Promise<void>;
  excluirInstancia: () => Promise<void>;
  configurarWebhook: () => Promise<{ ok: boolean; webhookUrl?: string; webhookInfo?: unknown }>;
  listarInstancias: () => Promise<{ name: string; connectionStatus?: string }[]>;
  checkInstance: (instanceName: string) => Promise<{ available: boolean; takenByOther: boolean; instanceExists: boolean; isConnected: boolean }>;
  testLlmConfig: () => Promise<{ success: boolean; response?: string; error?: string }>;
}

export const useComunicacaoStore = create<ComunicacaoState>((set, get) => ({
  conversas: [],
  conversaAtual: null,
  mensagens: [],
  sessoes: [],
  templates: [],
  instanciaStatus: null,
  adminConfig: null,
  adminStats: null,
  llmAnalytics: null,
  llmConfig: null,
  loading: false,
  error: null,

  // ── Conversas ───────────────────────────────────────────────────

  fetchConversas: async () => {
    set({ loading: true, error: null });
    try {
      const conversas = await api.get<Conversa[]>('/comunicacao/conversas');
      set({ conversas, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchMensagens: async (conversaId) => {
    set({ loading: true, error: null });
    try {
      const mensagens = await api.get<Mensagem[]>(`/comunicacao/conversas/${conversaId}/mensagens`);
      // Set conversaAtual from the conversas list if available
      const conversa = get().conversas.find((c) => c.id === conversaId) ?? null;
      set({ mensagens, conversaAtual: conversa, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  enviarMensagemGestor: async (dispatcherSessionId, content) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/dispatcher/${dispatcherSessionId}/mensagem`, { content });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  assumirConversa: async (wppSessionId, dispatcherNome) => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<{ dispatcherSessionId: string }>('/comunicacao/dispatcher/entrar', {
        wppSessionId,
        dispatcherNome,
      });
      set({ loading: false });
      return result;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  encerrarConversa: async (dispatcherSessionId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/dispatcher/${dispatcherSessionId}/sair`);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── Proxy Sessions ──────────────────────────────────────────────

  fetchSessoes: async () => {
    set({ loading: true, error: null });
    try {
      const sessoes = await api.get<ProxySession[]>('/comunicacao/proxy/sessions');
      set({ sessoes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  encerrarSessao: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/comunicacao/proxy/${sessionId}/end`);
      // Remove from local state or mark as ended
      set((state) => ({
        sessoes: state.sessoes.filter((s) => s.id !== sessionId),
        loading: false,
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── Templates ───────────────────────────────────────────────────

  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await api.get<TemplateHSM[]>('/comunicacao/templates');
      set({ templates, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  submeterTemplate: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/templates', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── Instancia Status ────────────────────────────────────────────

  fetchInstanciaStatus: async () => {
    set({ loading: true, error: null });
    try {
      const instanciaStatus = await api.get<InstanciaStatus>('/comunicacao/status');
      set({ instanciaStatus, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  conectarInstancia: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<{ ok: boolean; qrcode?: string | null; instanceName?: string; alreadyConnected?: boolean }>(
        '/comunicacao/admin/instance/conectar',
      );
      set({ loading: false });
      return { qrcode: result.qrcode, alreadyConnected: result.alreadyConnected };
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  desconectarInstancia: async () => {
    set({ loading: true, error: null });
    try {
      await api.delete('/comunicacao/admin/instance');
      set({ instanciaStatus: { connected: false, state: 'close', instanceName: null }, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── Admin Config ────────────────────────────────────────────────

  fetchAdminConfig: async () => {
    set({ loading: true, error: null });
    try {
      const adminConfig = await api.get<AdminConfig>('/comunicacao/admin/config');
      set({ adminConfig, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  saveAdminConfig: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/admin/config', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchAdminStats: async (dataInicio, dataFim) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set('dataInicio', dataInicio);
      if (dataFim) params.set('dataFim', dataFim);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const adminStats = await api.get<AdminStats>(`/comunicacao/admin/stats${qs}`);
      set({ adminStats, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── LLM Config ──────────────────────────────────────────────────

  fetchLlmConfig: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.get<{ data: LlmConfig }>('/comunicacao/admin/llm-config');
      set({ llmConfig: result.data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  updateLlmConfig: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.put('/comunicacao/admin/llm-config', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchLlmAnalytics: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.get<{ data: LlmAnalytics }>('/comunicacao/admin/llm-analytics');
      set({ llmAnalytics: result.data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  // ── Notify (Enviar Mensagem) ────────────────────────────────────

  enviarNotificacao: async (phone, text) => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/notify', { phone, text });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  // ── Instance Lifecycle ──────────────────────────────────────────

  criarInstancia: async (data) => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<{ ok: boolean; qrcode?: string; instanceName?: string; webhookError?: string | null }>(
        '/comunicacao/admin/instance/criar',
        data,
      );
      set({ loading: false });
      return result;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  reiniciarInstancia: async () => {
    set({ loading: true, error: null });
    try {
      await api.post('/comunicacao/admin/instance/reiniciar');
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  excluirInstancia: async () => {
    set({ loading: true, error: null });
    try {
      await api.delete('/comunicacao/admin/instance');
      set({ instanciaStatus: { connected: false, state: 'close', instanceName: null }, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  configurarWebhook: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<{ ok: boolean; webhookUrl?: string; webhookInfo?: unknown }>(
        '/comunicacao/admin/configurar-webhook',
      );
      set({ loading: false });
      return result;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },

  listarInstancias: async () => {
    try {
      const result = await api.get<{ instances: { name: string; connectionStatus?: string }[] }>(
        '/comunicacao/admin/instance/listar',
      );
      return result.instances ?? [];
    } catch {
      return [];
    }
  },

  checkInstance: async (instanceName) => {
    const result = await api.get<{ available: boolean; takenByOther: boolean; instanceExists: boolean; isConnected: boolean }>(
      `/comunicacao/admin/check-instance?instanceName=${encodeURIComponent(instanceName)}`,
    );
    return result;
  },

  testLlmConfig: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<{ data: { success: boolean; response?: string; error?: string } }>(
        '/comunicacao/admin/llm-config/test',
      );
      set({ loading: false });
      return result.data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
      throw e;
    }
  },
}));
