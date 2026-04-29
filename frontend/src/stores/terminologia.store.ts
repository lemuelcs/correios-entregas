import { create } from 'zustand';
import {
  getTerminology,
  updateTerminology,
  type Locale,
  type TerminologyV2,
} from '@/features/gestao/api/terminologia.api';

interface TerminologiaState {
  terminology: TerminologyV2 | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (payload: TerminologyV2) => Promise<void>;
  reset: () => void;
}

export const DEFAULT_TERMINOLOGY: TerminologyV2 = {
  schemaVersion: 'v2',
  terms: {
    driver: {
      'pt-BR': { singular: 'Carteiro', plural: 'Carteiros' },
      'en-US': { singular: 'Carrier', plural: 'Carriers' },
      'es-ES': { singular: 'Cartero', plural: 'Carteros' },
    },
    unit: {
      'pt-BR': { singular: 'Estação', plural: 'Estações' },
      'en-US': { singular: 'Unit', plural: 'Units' },
      'es-ES': { singular: 'Estación', plural: 'Estaciones' },
    },
    pack: {
      'pt-BR': { singular: 'Encomenda', plural: 'Encomendas' },
      'en-US': { singular: 'Package', plural: 'Packages' },
      'es-ES': { singular: 'Paquete', plural: 'Paquetes' },
    },
    customer: {
      'pt-BR': { singular: 'Destinatário', plural: 'Destinatários' },
      'en-US': { singular: 'Recipient', plural: 'Recipients' },
      'es-ES': { singular: 'Destinatario', plural: 'Destinatarios' },
    },
    route: {
      'pt-BR': { singular: 'Rota', plural: 'Rotas' },
      'en-US': { singular: 'Route', plural: 'Routes' },
      'es-ES': { singular: 'Ruta', plural: 'Rutas' },
    },
    tracking_code: {
      'pt-BR': { singular: 'Código de rastreio', plural: 'Códigos de rastreio' },
      'en-US': { singular: 'Tracking code', plural: 'Tracking codes' },
      'es-ES': { singular: 'Código de seguimiento', plural: 'Códigos de seguimiento' },
    },
  },
};

export const TERMINOLOGY_TERM_KEYS: string[] = Object.keys(DEFAULT_TERMINOLOGY.terms);

export const TERMINOLOGY_TERM_LABELS: Record<string, string> = {
  driver: 'Carteiro / Motorista',
  unit: 'Estação / Unidade',
  pack: 'Encomenda / Pacote',
  customer: 'Destinatário / Cliente',
  route: 'Rota',
  tracking_code: 'Código de rastreio',
};

export type { Locale };

export const useTerminologiaStore = create<TerminologiaState>((set) => ({
  terminology: null,
  loading: false,
  saving: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const data = await getTerminology();
      set({ terminology: data, loading: false });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Erro ao carregar terminologia';
      set({ error: message, loading: false });
    }
  },

  async save(payload) {
    set({ saving: true, error: null });
    try {
      await updateTerminology(payload);
      set({ terminology: payload, saving: false });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Erro ao salvar terminologia';
      set({ error: message, saving: false });
      throw err;
    }
  },

  reset() {
    set({ terminology: DEFAULT_TERMINOLOGY });
  },
}));
