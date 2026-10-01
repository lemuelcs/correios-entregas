import { create } from 'zustand';

const CHAVE = 'entregasUnidadeId';

function ler(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

interface ContextoEntregasState {
  /** Unidade em foco da Gestão (o supervisor usa sempre a unidade do token). */
  unidadeGestaoId: string | null;
  escolherUnidade: (unidadeId: string | null) => void;
}

export const useEntregasContextoStore = create<ContextoEntregasState>((set) => ({
  unidadeGestaoId: ler(),
  escolherUnidade: (unidadeId) => {
    try {
      if (unidadeId) localStorage.setItem(CHAVE, unidadeId);
      else localStorage.removeItem(CHAVE);
    } catch { /* armazenamento indisponível */ }
    set({ unidadeGestaoId: unidadeId });
  },
}));
