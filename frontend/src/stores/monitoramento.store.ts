import { create } from 'zustand';
import { api } from '../services/api';
import type { Rota } from '../types/api.types';

interface MonitoramentoState {
  rotasAtivas: Rota[];
  kpis: any | null;
  alertas: any[];
  loading: boolean;
  error: string | null;

  fetchRotasAtivas: () => Promise<void>;
  fetchKpis: (unidadeId: string) => Promise<void>;
  updateRotaFromSse: (data: Partial<Rota> & { id: string }) => void;
}

export const useMonitoramentoStore = create<MonitoramentoState>((set) => ({
  rotasAtivas: [],
  kpis: null,
  alertas: [],
  loading: false,
  error: null,

  fetchRotasAtivas: async () => {
    set({ loading: true, error: null });
    try {
      const rotasAtivas = await api.get<Rota[]>('/monitoramento/rotas-ativas');
      set({ rotasAtivas, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchKpis: async (unidadeId) => {
    set({ loading: true, error: null });
    try {
      const kpis = await api.get<any>(`/monitoramento/kpis/${unidadeId}`);
      set({ kpis, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  updateRotaFromSse: (data) => {
    set((state) => ({
      rotasAtivas: state.rotasAtivas.map((r) =>
        r.id === data.id ? { ...r, ...data } : r,
      ),
    }));
  },
}));
