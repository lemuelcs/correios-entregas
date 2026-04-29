import { create } from 'zustand';
import { api } from '../services/api';
import type { Objeto, ScanUnitizadorResult, Divergencia, RelatorioRecebimento } from '../types/api.types';

interface RecebimentoState {
  ultimoScan: ScanUnitizadorResult | null;
  excecoes: Objeto[];
  relatorio: RelatorioRecebimento | null;
  loading: boolean;
  error: string | null;

  scanUnitizador: (codigo: string) => Promise<void>;
  confirmarConferencia: (unitizadorId: string, divergencias: Divergencia[]) => Promise<void>;
  fetchExcecoes: () => Promise<void>;
  fetchRelatorio: () => Promise<void>;
}

export const useRecebimentoStore = create<RecebimentoState>((set) => ({
  ultimoScan: null,
  excecoes: [],
  relatorio: null,
  loading: false,
  error: null,

  scanUnitizador: async (codigo) => {
    set({ loading: true, error: null });
    try {
      const ultimoScan = await api.post<ScanUnitizadorResult>('/recebimento/scan-unitizador', { codigo });
      set({ ultimoScan, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  confirmarConferencia: async (unitizadorId, divergencias) => {
    set({ loading: true, error: null });
    try {
      await api.post('/recebimento/confirmar-conferencia', { unitizadorId, divergencias });
      set({ loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchExcecoes: async () => {
    set({ loading: true, error: null });
    try {
      const excecoes = await api.get<Objeto[]>('/recebimento/excepcoes');
      set({ excecoes, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  fetchRelatorio: async () => {
    set({ loading: true, error: null });
    try {
      const relatorio = await api.get<RelatorioRecebimento>('/recebimento/relatorio');
      set({ relatorio, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
