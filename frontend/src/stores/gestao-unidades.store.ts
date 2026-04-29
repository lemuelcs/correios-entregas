import { create } from 'zustand';
import { api } from '../services/api';
import type { Unidade } from '../types/api.types';

interface GestaoUnidadesState {
  unidades: Unidade[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (data: Partial<Unidade>) => Promise<void>;
  update: (id: string, data: Partial<Unidade>) => Promise<void>;
}

export const useGestaoUnidadesStore = create<GestaoUnidadesState>((set, get) => ({
  unidades: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.get<Unidade[]>('/gestao/unidades');
      set({ unidades: data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  create: async (data) => {
    await api.post('/gestao/unidades', data);
    await get().fetchAll();
  },

  update: async (id, data) => {
    await api.put(`/gestao/unidades/${id}`, data);
    await get().fetchAll();
  },
}));
