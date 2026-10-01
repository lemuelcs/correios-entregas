/** Lista de pacotes de um distrito no dia (polling de 30 s, ADR-015). Erros sobem para a tela. */
import { create } from 'zustand';
import { entregasApi } from '@/features/entregas/entregas.api';
import type { ListaPacotes } from '@/features/entregas/entregas.types';

export interface FiltroPacotes {
  status: string | null;
  busca: string;
  pagina: number;
}

interface PacotesState {
  lista: ListaPacotes | null;
  cargaId: string | null;
  filtro: FiltroPacotes;
  carregando: boolean;
  carregar: (cargaId: string, filtro: FiltroPacotes, unidadeId?: string) => Promise<ListaPacotes>;
}

export const useEntregasPacotesStore = create<PacotesState>((set, get) => ({
  lista: null,
  cargaId: null,
  filtro: { status: null, busca: '', pagina: 1 },
  carregando: false,

  carregar: async (cargaId, filtro, unidadeId) => {
    if (get().cargaId !== cargaId) set({ lista: null, cargaId });
    set({ carregando: true, filtro });
    try {
      const lista = await entregasApi.pacotes(cargaId, {
        status: filtro.status ?? undefined,
        busca: filtro.busca.trim() || undefined,
        pagina: filtro.pagina,
        unidadeId,
      });
      set({ lista, carregando: false });
      return lista;
    } catch (err) {
      set({ carregando: false });
      throw err;
    }
  },
}));
