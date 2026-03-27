import { create } from 'zustand';
import { api } from '../services/api';
import type { Rota, Parada } from '../types/api.types';

interface CarteiroAppState {
  rotaAtual: Rota | null;
  paradaAtual: Parada | null;
  historico: Rota[];
  loading: boolean;
  error: string | null;

  fetchRotaAtual: () => Promise<void>;
  coletarUnitizador: (qrCode: string) => Promise<void>;
  confirmarColeta: (rotaId: string, objetosConfirmados: string[]) => Promise<void>;
  fetchParadaAtual: (rotaId: string) => Promise<void>;
  registrarEntrega: (data: any) => Promise<void>;
  registrarInsucesso: (data: any) => Promise<void>;
  confirmarRetorno: (rotaId: string) => Promise<void>;
  fetchResumoRota: (rotaId: string) => Promise<void>;
  fetchHistorico: () => Promise<void>;
  enviarGps: (rotaId: string, lat: number, lng: number) => Promise<void>;
}

export const useCarteiroAppStore = create<CarteiroAppState>((set) => ({
  rotaAtual: null,
  paradaAtual: null,
  historico: [],
  loading: false,
  error: null,

  fetchRotaAtual: async () => {
    set({ loading: true, error: null });
    try {
      const rotaAtual = await api.get<Rota>('/carteiro/rota-atual');
      set({ rotaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  coletarUnitizador: async (qrCode) => {
    set({ loading: true, error: null });
    try {
      const rotaAtual = await api.post<Rota>('/carteiro/coletar-unitizador', { qrCode });
      set({ rotaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  confirmarColeta: async (rotaId, objetosConfirmados) => {
    set({ loading: true, error: null });
    try {
      const rotaAtual = await api.post<Rota>('/carteiro/confirmar-coleta', { rotaId, objetosConfirmados });
      set({ rotaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchParadaAtual: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      const paradaAtual = await api.get<Parada>(`/carteiro/parada-atual/${rotaId}`);
      set({ paradaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  registrarEntrega: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/carteiro/registrar-entrega', data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  registrarInsucesso: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/carteiro/registrar-insucesso', data);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  confirmarRetorno: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/carteiro/confirmar-retorno`, { rotaId });
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchResumoRota: async (rotaId) => {
    set({ loading: true, error: null });
    try {
      const rotaAtual = await api.get<Rota>(`/carteiro/resumo-rota/${rotaId}`);
      set({ rotaAtual, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchHistorico: async () => {
    set({ loading: true, error: null });
    try {
      const historico = await api.get<Rota[]>('/carteiro/historico-rotas');
      set({ historico, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  enviarGps: async (rotaId, lat, lng) => {
    set({ loading: true, error: null });
    try {
      await api.post('/carteiro/gps', { rotaId, lat, lng });
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
