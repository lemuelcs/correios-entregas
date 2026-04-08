import { create } from 'zustand';
import { api } from '../services/api';
import type { SuperintendenciaEstadual } from '../types/api.types';

interface GestaoSEsState {
  ses: SuperintendenciaEstadual[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (data: Partial<SuperintendenciaEstadual>) => Promise<void>;
  update: (id: string, data: Partial<SuperintendenciaEstadual>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useGestaoSEsStore = create<GestaoSEsState>((set, get) => ({
  ses: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.get<SuperintendenciaEstadual[]>('/gestao/ses');
      set({ ses: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (data) => {
    await api.post('/gestao/ses', data);
    await get().fetchAll();
  },

  update: async (id, data) => {
    await api.put(`/gestao/ses/${id}`, data);
    await get().fetchAll();
  },

  remove: async (id) => {
    await api.delete(`/gestao/ses/${id}`);
    await get().fetchAll();
  },
}));
