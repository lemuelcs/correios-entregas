/**
 * Quadro de distritos (Monitoramento › Carregar Dados). Atualizado por polling
 * de 30 s (ADR-015). Os erros sobem para a tela, que mostra o aviso; nenhum
 * dado fictício de reserva.
 */
import { create } from 'zustand';
import { entregasApi } from '@/features/entregas/entregas.api';
import type { Quadro, RespostaLiberacao } from '@/features/entregas/entregas.types';

interface QuadroState {
  quadro: Quadro | null;
  carregando: boolean;
  erro: string | null;
  /** Data consultada (`YYYY-MM-DD`); `null` = hoje, definido pelo servidor. */
  data: string | null;
  carregar: (p: { data?: string | null; unidadeId?: string }) => Promise<Quadro>;
  liberar: (cargaId: string, confirmarSemAvisos?: boolean) => Promise<RespostaLiberacao>;
  limpar: () => void;
}

export const useEntregasQuadroStore = create<QuadroState>((set) => ({
  quadro: null,
  carregando: false,
  erro: null,
  data: null,

  carregar: async ({ data, unidadeId }) => {
    set({ carregando: true });
    try {
      const quadro = await entregasApi.quadro({ data: data ?? undefined, unidadeId });
      set({ quadro, carregando: false, erro: null, data: data ?? null });
      return quadro;
    } catch (err) {
      set({ carregando: false, erro: err instanceof Error ? err.message : 'erro' });
      throw err;
    }
  },

  liberar: async (cargaId, confirmarSemAvisos = false) => entregasApi.liberar(cargaId, confirmarSemAvisos),

  limpar: () => set({ quadro: null, erro: null, data: null }),
}));
