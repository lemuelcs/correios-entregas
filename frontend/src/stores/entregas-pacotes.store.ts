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
  /** Esvazia a lista (a Gestão trocou a unidade em foco: os pacotes eram de outra unidade). */
  limpar: () => void;
}

/** Número do pedido mais recente: só a resposta dele chega à tela. */
let pedidoAtual = 0;

export const useEntregasPacotesStore = create<PacotesState>((set, get) => ({
  lista: null,
  cargaId: null,
  filtro: { status: null, busca: '', pagina: 1 },
  carregando: false,

  limpar: () => {
    pedidoAtual += 1;
    set({ lista: null, cargaId: null, carregando: false });
  },

  carregar: async (cargaId, filtro, unidadeId) => {
    if (get().cargaId !== cargaId) set({ lista: null, cargaId });
    set({ carregando: true, filtro });
    pedidoAtual += 1;
    const pedido = pedidoAtual;
    try {
      const lista = await entregasApi.pacotes(cargaId, {
        status: filtro.status ?? undefined,
        busca: filtro.busca.trim() || undefined,
        pagina: filtro.pagina,
        unidadeId,
      });
      // Uma resposta atrasada (outro filtro, outra rota, ou a lista esvaziada na troca de unidade) não volta à tela.
      if (pedido === pedidoAtual) set({ lista, carregando: false });
      return lista;
    } catch (err) {
      if (pedido === pedidoAtual) set({ carregando: false });
      throw err;
    }
  },
}));
