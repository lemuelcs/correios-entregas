import { create } from 'zustand';
import { api } from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────

export interface ObjetoDestinatario {
  id: string;
  codigoRastreio: string;
  servicoCodigo: string;
  statusAtual: string;
  remetenteNome: string;
  previsaoEntrega?: string;
  tentativasEntrega: number;
  maxTentativas: number;
  pesoGramas?: number;
  eventos?: ObjetoEvento[];
}

export interface ObjetoEvento {
  id: string;
  tipo: string;
  descricao: string;
  ocorridoEm: string;
  localDescricao: string;
}

export interface Interacao {
  id: string;
  objetoId: string;
  tipo: string;
  dados?: Record<string, unknown>;
  criadoEm: string;
  status: string;
}

export interface NpsPayload {
  score: number;
  comentario?: string;
  objetoId?: string;
}

// ── State ────────────────────────────────────────────────────────────────

interface DestinatarioState {
  objetos: ObjetoDestinatario[];
  objetoDetalhe: ObjetoDestinatario | null;
  interacoes: Interacao[];
  loading: boolean;
  error: string | null;

  fetchObjetos: () => Promise<void>;
  vincularObjeto: (codigoRastreio: string) => Promise<void>;
  fetchObjetoDetalhe: (codigo: string) => Promise<void>;
  criarInteracao: (data: { objetoId: string; tipo: string; dados?: Record<string, unknown> }) => Promise<void>;
  fetchInteracoes: (objetoId: string) => Promise<void>;
  responderNps: (payload: NpsPayload) => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────────────────

export const useDestinatarioStore = create<DestinatarioState>((set) => ({
  objetos: [],
  objetoDetalhe: null,
  interacoes: [],
  loading: false,
  error: null,

  fetchObjetos: async () => {
    set({ loading: true, error: null });
    try {
      const objetos = await api.get<ObjetoDestinatario[]>('/destinatario/objetos');
      set({ objetos, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  vincularObjeto: async (codigoRastreio) => {
    set({ loading: true, error: null });
    try {
      await api.post('/destinatario/vincular-objeto', { codigoRastreio });
      // Refresh the list after linking
      const objetos = await api.get<ObjetoDestinatario[]>('/destinatario/objetos');
      set({ objetos, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchObjetoDetalhe: async (codigo) => {
    set({ loading: true, error: null });
    try {
      const objetoDetalhe = await api.get<ObjetoDestinatario>(`/destinatario/objetos/${codigo}`);
      set({ objetoDetalhe, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  criarInteracao: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/destinatario/interacao', data);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchInteracoes: async (objetoId) => {
    set({ loading: true, error: null });
    try {
      const interacoes = await api.get<Interacao[]>(`/destinatario/interacoes/${objetoId}`);
      set({ interacoes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  responderNps: async (payload) => {
    set({ loading: true, error: null });
    try {
      await api.post('/destinatario/nps', payload);
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
