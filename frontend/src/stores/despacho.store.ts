import { create } from 'zustand';
import { api } from '../services/api';
import type { Carteiro, Rota, VolumePrevisao, PontoDiaItem } from '../types/api.types';

interface RegistrarPontoData {
  carteiroId: string;
  data: string;
  presente: boolean;
  horaEntrada?: string;
  observacao?: string;
}

interface LiberarRotaData {
  horarioDespachoAlvo?: string;
  observacao?: string;
}

interface DespachoState {
  pontoDia: PontoDiaItem[];
  carteiros: Carteiro[];
  rotasPendentes: Rota[];
  previsoes: VolumePrevisao[];
  loading: boolean;
  error: string | null;

  fetchPontoDia: () => Promise<void>;
  registrarPonto: (data: RegistrarPontoData) => Promise<void>;
  fetchCarteiros: () => Promise<void>;
  fetchRotasPendentes: () => Promise<void>;
  liberarRota: (rotaId: string, data: LiberarRotaData) => Promise<void>;
  cancelarRota: (rotaId: string) => Promise<void>;
  fetchPrevisaoVolume: () => Promise<void>;
  criarPrevisaoVolume: (data: Omit<VolumePrevisao, 'id'>) => Promise<void>;
}

export const useDespachoStore = create<DespachoState>((set) => ({
  pontoDia: [],
  carteiros: [],
  rotasPendentes: [],
  previsoes: [],
  loading: false,
  error: null,

  fetchPontoDia: async () => {
    set({ loading: true, error: null });
    try {
      const pontoDia = await api.get<PontoDiaItem[]>('/despacho/ponto-dia');
      set({ pontoDia, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  registrarPonto: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/despacho/ponto-dia/registrar', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchCarteiros: async () => {
    set({ loading: true, error: null });
    try {
      const carteiros = await api.get<Carteiro[]>('/despacho/carteiros');
      set({ carteiros, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchRotasPendentes: async () => {
    set({ loading: true, error: null });
    try {
      const rotasPendentes = await api.get<Rota[]>('/despacho/rotas-pendentes');
      set({ rotasPendentes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  liberarRota: async (rotaId, data) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/despacho/liberar-rota/${rotaId}`, data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  cancelarRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/despacho/cancelar-rota/${rotaId}`);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchPrevisaoVolume: async () => {
    set({ loading: true, error: null });
    try {
      const previsoes = await api.get<VolumePrevisao[]>('/despacho/previsao-volume');
      set({ previsoes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  criarPrevisaoVolume: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/despacho/previsao-volume', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
