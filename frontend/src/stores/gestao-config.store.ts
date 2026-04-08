import { create } from 'zustand';
import { api } from '../services/api';
import type { ConfiguracaoGlobal } from '../types/api.types';

interface GestaoConfigState {
  configs: ConfiguracaoGlobal[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  upsert: (chave: string, valor: any, descricao?: string) => Promise<void>;
}

export const useGestaoConfigStore = create<GestaoConfigState>((set, get) => ({
  configs: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.get<ConfiguracaoGlobal[]>('/gestao/configuracoes');
      set({ configs: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  upsert: async (chave, valor, descricao) => {
    await api.put(`/gestao/configuracoes/${chave}`, { valor, descricao });
    await get().fetchAll();
  },
}));
