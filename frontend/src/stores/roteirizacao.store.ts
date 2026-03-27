import { create } from 'zustand';
import { api } from '../services/api';

interface RoteirizacaoState {
  jobId: string | null;
  jobStatus: any | null;
  resultado: any | null;
  loading: boolean;
  error: string | null;

  executar: (modo?: string, solver?: string) => Promise<void>;
  pollJobStatus: (jobId: string) => Promise<void>;
  fetchResultado: (jobId: string) => Promise<void>;
  aprovar: (jobId: string) => Promise<void>;
  removerRota: (rotaId: string) => Promise<void>;
}

export const useRoteirizacaoStore = create<RoteirizacaoState>((set) => ({
  jobId: null,
  jobStatus: null,
  resultado: null,
  loading: false,
  error: null,

  executar: async (modo?, solver?) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post<{ jobId: string }>('/roteirizacao/executar', { modo, solver });
      set({ jobId: res.jobId, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  pollJobStatus: async (jobId) => {
    set({ loading: true, error: null });
    try {
      const jobStatus = await api.get<any>(`/roteirizacao/job/${jobId}`);
      set({ jobStatus, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchResultado: async (jobId) => {
    set({ loading: true, error: null });
    try {
      const resultado = await api.get<any>(`/roteirizacao/resultado/${jobId}`);
      set({ resultado, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  aprovar: async (jobId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/roteirizacao/aprovar/${jobId}`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  removerRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/roteirizacao/rota/${rotaId}`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
