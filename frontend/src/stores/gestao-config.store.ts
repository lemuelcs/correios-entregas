import { create } from 'zustand';
import { api } from '../services/api';
import type { ConfiguracaoGlobal } from '../types/api.types';

interface GestaoConfigState {
  configs: ConfiguracaoGlobal[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  upsert: (chave: string, valor: unknown, descricao?: string) => Promise<void>;
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
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  upsert: async (chave, valor, descricao) => {
    await api.put(`/gestao/configuracoes/${chave}`, { valor, descricao });
    await get().fetchAll();
  },
}));
