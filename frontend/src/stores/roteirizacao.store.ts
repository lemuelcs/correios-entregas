import { create } from 'zustand';
import { api } from '../services/api';
import type { JobStatusDetalhado, RoteirizacaoResultado } from '../types/api.types';

interface RoteirizacaoState {
  jobId: string | null;
  jobStatus: JobStatusDetalhado | null;
  resultado: RoteirizacaoResultado | null;
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
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  pollJobStatus: async (jobId) => {
    set({ loading: true, error: null });
    try {
      const jobStatus = await api.get<JobStatusDetalhado>(`/roteirizacao/job/${jobId}`);
      set({ jobStatus, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchResultado: async (jobId) => {
    set({ loading: true, error: null });
    try {
      const resultado = await api.get<RoteirizacaoResultado>(`/roteirizacao/resultado/${jobId}`);
      set({ resultado, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  aprovar: async (jobId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/roteirizacao/aprovar/${jobId}`);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  removerRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/roteirizacao/rota/${rotaId}`);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
