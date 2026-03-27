import { create } from 'zustand';
import { api } from '../services/api';
import type { Carteiro, Rota, VolumePrevisao } from '../types/api.types';

interface DespachoState {
  pontoDia: any[];
  carteiros: Carteiro[];
  rotasPendentes: Rota[];
  previsoes: VolumePrevisao[];
  loading: boolean;
  error: string | null;

  fetchPontoDia: () => Promise<void>;
  registrarPonto: (data: any) => Promise<void>;
  fetchCarteiros: () => Promise<void>;
  fetchRotasPendentes: () => Promise<void>;
  liberarRota: (rotaId: string, data: any) => Promise<void>;
  cancelarRota: (rotaId: string) => Promise<void>;
  fetchPrevisaoVolume: () => Promise<void>;
  criarPrevisaoVolume: (data: any) => Promise<void>;
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
      const pontoDia = await api.get<any[]>('/despacho/ponto-dia');
      set({ pontoDia, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  registrarPonto: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/despacho/ponto-dia/registrar', data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchCarteiros: async () => {
    set({ loading: true, error: null });
    try {
      const carteiros = await api.get<Carteiro[]>('/despacho/carteiros');
      set({ carteiros, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchRotasPendentes: async () => {
    set({ loading: true, error: null });
    try {
      const rotasPendentes = await api.get<Rota[]>('/despacho/rotas-pendentes');
      set({ rotasPendentes, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  liberarRota: async (rotaId, data) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/despacho/liberar-rota/${rotaId}`, data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  cancelarRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/despacho/cancelar-rota/${rotaId}`);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchPrevisaoVolume: async () => {
    set({ loading: true, error: null });
    try {
      const previsoes = await api.get<VolumePrevisao[]>('/despacho/previsao-volume');
      set({ previsoes, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  criarPrevisaoVolume: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/despacho/previsao-volume', data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
