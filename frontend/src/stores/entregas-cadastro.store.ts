/**
 * Cadastro da unidade (distritos, carteiros, agências e lockers) e da Gestão
 * (canais, unidades, supervisores). As gravações recarregam a lista afetada;
 * os erros sobem para a tela (toast), sem dado fictício.
 */
import { create } from 'zustand';
import { entregasApi } from '@/features/entregas/entregas.api';
import type {
  CanalProsio,
  CarteiroCadastro,
  Distrito,
  PontoRetirada,
  Supervisor,
  TipoPonto,
  UnidadeGestao,
} from '@/features/entregas/entregas.types';

interface CadastroState {
  distritos: Distrito[] | null;
  carteiros: CarteiroCadastro[] | null;
  pontos: PontoRetirada[] | null;
  ativosPorTipo: Record<TipoPonto, number>;
  canais: CanalProsio[] | null;
  unidades: UnidadeGestao[] | null;
  supervisores: Supervisor[] | null;

  carregarDistritos: (unidadeId?: string) => Promise<void>;
  carregarCarteiros: (unidadeId?: string) => Promise<void>;
  carregarPontos: (unidadeId?: string) => Promise<void>;
  carregarCanais: () => Promise<void>;
  carregarUnidades: () => Promise<UnidadeGestao[]>;
  carregarSupervisores: () => Promise<void>;
  limparUnidade: () => void;
}

export const useEntregasCadastroStore = create<CadastroState>((set) => ({
  distritos: null,
  carteiros: null,
  pontos: null,
  ativosPorTipo: { AGENCIA: 0, LOCKER: 0 },
  canais: null,
  unidades: null,
  supervisores: null,

  carregarDistritos: async (unidadeId) => {
    const r = await entregasApi.distritos(unidadeId);
    set({ distritos: r.itens });
  },
  carregarCarteiros: async (unidadeId) => {
    const r = await entregasApi.carteiros(unidadeId);
    set({ carteiros: r.itens });
  },
  carregarPontos: async (unidadeId) => {
    const r = await entregasApi.pontos(unidadeId);
    set({ pontos: r.itens, ativosPorTipo: r.ativosPorTipo });
  },
  carregarCanais: async () => {
    set({ canais: await entregasApi.canais() });
  },
  carregarUnidades: async () => {
    const unidades = await entregasApi.unidades();
    set({ unidades });
    return unidades;
  },
  carregarSupervisores: async () => {
    set({ supervisores: await entregasApi.supervisores() });
  },
  limparUnidade: () => set({ distritos: null, carteiros: null, pontos: null }),
}));
