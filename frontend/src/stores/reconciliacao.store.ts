import { create } from 'zustand';
import { api } from '../services/api';
import type { Objeto } from '../types/api.types';

interface ReconciliacaoState {
  pendentes: Objeto[];
  loading: boolean;
  error: string | null;

  scanRetorno: (codigoRastreio: string) => Promise<void>;
  fetchPendentes: (rotaId: string) => Promise<void>;
  finalizarRota: (rotaId: string) => Promise<void>;
  agendarNovaTentativa: (objetoId: string, data?: string) => Promise<void>;
  encaminharAgencia: (objetoId: string) => Promise<void>;
}

export const useReconciliacaoStore = create<ReconciliacaoState>((set) => ({
  pendentes: [],
  loading: false,
  error: null,

  scanRetorno: async (codigoRastreio) => {
    set({ loading: true, error: null });
    try {
      await api.post('/reconciliacao/scan-retorno', { codigoRastreio });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchPendentes: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      const pendentes = await api.get<Objeto[]>(`/reconciliacao/pendentes/${rotaId}`);
      set({ pendentes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  finalizarRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/reconciliacao/finalizar-rota/${rotaId}`);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  agendarNovaTentativa: async (objetoId, data?) => {
    set({ loading: true, error: null });
    try {
      await api.post('/reconciliacao/agendar-nova-tentativa', { objetoId, data });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  encaminharAgencia: async (objetoId) => {
    set({ loading: true, error: null });
    try {
      await api.post('/reconciliacao/encaminhar-agencia', { objetoId });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
