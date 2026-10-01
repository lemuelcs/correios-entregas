/**
 * Quadro das saídas do dia (Monitoramento › Carregar Dados, ADR-019).
 * Atualizado por polling de 30 s (ADR-015). Os erros sobem para a tela, que
 * mostra o aviso; nenhum dado fictício de reserva.
 */
import { create } from 'zustand';
import { entregasApi } from '@/features/entregas/entregas.api';
import type {
  AtribuicaoCarteiro,
  QuadroSaidas,
  RespostaAtribuicao,
  RespostaLiberacao,
  RespostaLiberacaoLote,
  ResultadoImportacaoSaida,
} from '@/features/entregas/entregas.types';

interface QuadroState {
  quadro: QuadroSaidas | null;
  carregando: boolean;
  erro: string | null;
  /** Data consultada (`YYYY-MM-DD`); `null` = hoje, definido pelo servidor. */
  data: string | null;
  /** `unidadeId`: só a Gestão envia (um id, ou `todas` para a visão agregada). */
  carregar: (p: { data?: string | null; unidadeId?: string }) => Promise<QuadroSaidas>;
  importar: (p: { arquivo: File; numero: number; horario: string; data?: string | null; unidadeId?: string }) => Promise<ResultadoImportacaoSaida>;
  liberar: (cargaId: string, confirmarSemAvisos?: boolean) => Promise<RespostaLiberacao>;
  liberarVarias: (cargaIds: string[]) => Promise<RespostaLiberacaoLote>;
  atribuirCarteiros: (atribuicoes: AtribuicaoCarteiro[], p?: { data?: string | null; unidadeId?: string }) => Promise<RespostaAtribuicao>;
  limpar: () => void;
}

/** Só a resposta do pedido mais recente entra no estado (troca rápida de data ou unidade). */
let pedido = 0;

export const useEntregasQuadroStore = create<QuadroState>((set) => ({
  quadro: null,
  carregando: false,
  erro: null,
  data: null,

  carregar: async ({ data, unidadeId }) => {
    const meu = (pedido += 1);
    set({ carregando: true });
    try {
      const quadro = await entregasApi.saidas({ data: data ?? undefined, unidadeId });
      if (meu === pedido) set({ quadro, carregando: false, erro: null, data: data ?? null });
      return quadro;
    } catch (err) {
      if (meu === pedido) set({ carregando: false, erro: err instanceof Error ? err.message : 'erro' });
      throw err;
    }
  },

  importar: async ({ arquivo, numero, horario, data, unidadeId }) =>
    entregasApi.importarSaida({ arquivo, numero, horario, data: data ?? undefined, unidadeId }),

  liberar: async (cargaId, confirmarSemAvisos = false) => entregasApi.liberar(cargaId, confirmarSemAvisos),

  liberarVarias: async (cargaIds) => entregasApi.liberarRotas(cargaIds),

  atribuirCarteiros: async (atribuicoes, p = {}) =>
    entregasApi.atribuirCarteiros(atribuicoes, { data: p.data ?? undefined, unidadeId: p.unidadeId }),

  limpar: () => {
    pedido += 1;
    set({ quadro: null, erro: null, data: null });
  },
}));
