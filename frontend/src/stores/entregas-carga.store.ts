/**
 * Carregamento de pacotes de um distrito (ADR-017): a prévia vem do servidor,
 * sem nada gravado; cada correção de linha recalcula a prévia; a confirmação
 * revalida tudo no servidor.
 */
import { create } from 'zustand';
import { entregasApi } from '@/features/entregas/entregas.api';
import type { LinhaPrevia, Previa, ResultadoConfirmacao } from '@/features/entregas/entregas.types';

interface CargaState {
  distritoId: string | null;
  previa: Previa | null;
  origem: string | null;
  processando: boolean;
  iniciar: (distritoId: string) => void;
  enviarArquivo: (arquivo: File) => Promise<Previa>;
  enviarTexto: (texto: string) => Promise<Previa>;
  corrigirLinha: (n: number, campos: Partial<Pick<LinhaPrevia, 'codigo' | 'nome' | 'whatsapp'>>) => Promise<Previa>;
  descartarLinha: (n: number) => Promise<Previa | null>;
  confirmar: () => Promise<ResultadoConfirmacao>;
  descartarPrevia: () => void;
}

export const useEntregasCargaStore = create<CargaState>((set, get) => {
  async function executar(fn: () => Promise<Previa>, origem?: string): Promise<Previa> {
    set({ processando: true });
    try {
      const previa = await fn();
      set({ previa, processando: false, ...(origem !== undefined ? { origem } : {}) });
      return previa;
    } catch (err) {
      set({ processando: false });
      throw err;
    }
  }

  function distrito(): string {
    const id = get().distritoId;
    if (!id) throw new Error('Distrito não definido');
    return id;
  }

  return {
    distritoId: null,
    previa: null,
    origem: null,
    processando: false,

    iniciar: (distritoId) => {
      if (get().distritoId !== distritoId) set({ distritoId, previa: null, origem: null });
    },

    enviarArquivo: (arquivo) => executar(() => entregasApi.previaArquivo(distrito(), arquivo), arquivo.name),
    enviarTexto: (texto) => executar(() => entregasApi.previaTexto(distrito(), texto), 'linhas coladas'),

    corrigirLinha: (n, campos) => {
      const atual = get().previa;
      if (!atual) throw new Error('Sem prévia');
      const linhas = atual.linhas.map((l) => (l.n === n ? { ...l, ...campos } : l));
      return executar(() => entregasApi.previaLinhas(distrito(), linhas));
    },

    descartarLinha: async (n) => {
      const atual = get().previa;
      if (!atual) return null;
      const linhas = atual.linhas.filter((l) => l.n !== n);
      if (linhas.length === 0) {
        set({ previa: null, origem: null });
        return null;
      }
      return executar(() => entregasApi.previaLinhas(distrito(), linhas));
    },

    confirmar: async () => {
      const atual = get().previa;
      if (!atual) throw new Error('Sem prévia');
      set({ processando: true });
      try {
        const r = await entregasApi.confirmar(distrito(), atual.linhas);
        set({ processando: false, previa: null, origem: null });
        return r;
      } catch (err) {
        set({ processando: false });
        throw err;
      }
    },

    descartarPrevia: () => set({ previa: null, origem: null }),
  };
});
