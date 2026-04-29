import { create } from 'zustand';
import { api } from '../services/api';
import type { SortPlan, SimulacaoTriagem, TriagemStatus } from '../types/api.types';

interface ConfigurarSessaoData {
  modeloTriagem: string;
  estruturas: number;
  posicoesPorEstrutura: number;
  throughputHora?: number;
}

interface TriagemState {
  status: TriagemStatus | null;
  sortPlan: SortPlan | null;
  simulacao: SimulacaoTriagem | null;
  loading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchSortPlan: (rotaId: string) => Promise<void>;
  validarSortPlan: (rotaId: string) => Promise<void>;
  simular: (qtd?: number) => Promise<void>;
  configurarSessao: (config: ConfigurarSessaoData) => Promise<void>;
}

export const useTriagemStore = create<TriagemState>((set) => ({
  status: null,
  sortPlan: null,
  simulacao: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.get<TriagemStatus>('/triagem/status');
      set({ status, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchSortPlan: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      const sortPlan = await api.get<SortPlan>(`/triagem/sort-plan/${rotaId}`);
      set({ sortPlan, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  validarSortPlan: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      const sortPlan = await api.post<SortPlan>(`/triagem/sort-plan/${rotaId}/validar`);
      set({ sortPlan, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  simular: async (qtd?) => {
    set({ loading: true, error: null });
    try {
      const simulacao = await api.post<SimulacaoTriagem>('/triagem/simular', qtd != null ? { qtd } : undefined);
      set({ simulacao, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  configurarSessao: async (config) => {
    set({ loading: true, error: null });
    try {
      await api.post('/triagem/configurar-sessao', config);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
