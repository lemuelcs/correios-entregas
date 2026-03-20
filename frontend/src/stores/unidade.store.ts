import { create } from 'zustand';
import { api } from '../services/api';
import type { DashboardData, Unidade } from '../types/api.types';

interface UnidadeState {
  dashboard: DashboardData | null;
  unidade: Unidade | null;
  loading: boolean;
  error: string | null;

  fetchDashboard: (unidadeId: string) => Promise<void>;
  fetchUnidade: (id: string) => Promise<void>;
  updateFaixasCep: (id: string, faixas: string[]) => Promise<void>;
}

export const useUnidadeStore = create<UnidadeState>((set) => ({
  dashboard: null,
  unidade: null,
  loading: false,
  error: null,

  fetchDashboard: async (unidadeId) => {
    set({ loading: true, error: null });
    try {
      const dashboard = await api.get<DashboardData>(`/unidades/${unidadeId}/dashboard`);
      set({ dashboard, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchUnidade: async (id) => {
    set({ loading: true, error: null });
    try {
      const unidade = await api.get<Unidade>(`/unidades/${id}`);
      set({ unidade, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  updateFaixasCep: async (id, faixas) => {
    set({ loading: true, error: null });
    try {
      const unidade = await api.put<Unidade>(`/unidades/${id}/faixas-cep`, { faixas });
      set({ unidade, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
