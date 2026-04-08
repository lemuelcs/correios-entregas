import { create } from 'zustand';
import { api } from '../services/api';

interface Unidade {
  id: string;
  nome: string;
}

interface User {
  id: string;
  nome: string;
  cpf?: string;
  email?: string;
  role: 'GESTAO' | 'UNIDADE' | 'CARTEIRO' | 'DESTINATARIO';
  unidadeId?: string;
  unidade?: Unidade | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  unidadeId: string | null;
  unidadeNome: string | null;
  login: (credentials: { cpf?: string; email?: string; matricula?: string; senha: string }) => Promise<User>;
  logout: () => void;
  setTokens: (accessToken: string) => void;
  switchUnidade: (unidadeId: string, unidadeNome: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  unidadeId: localStorage.getItem('unidadeId'),
  unidadeNome: localStorage.getItem('unidadeNome'),

  login: async (credentials) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', credentials);
    const { accessToken, refreshToken, user } = res;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    const unidadeId = user.unidadeId ?? null;
    const unidadeNome = user.unidade?.nome ?? null;
    if (unidadeId) localStorage.setItem('unidadeId', unidadeId);
    if (unidadeNome) localStorage.setItem('unidadeNome', unidadeNome);

    set({ user, accessToken, unidadeId, unidadeNome });
    return user;
  },

  logout: () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('unidadeId');
    localStorage.removeItem('unidadeNome');
    set({ user: null, accessToken: null, unidadeId: null, unidadeNome: null });
  },

  setTokens: (accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({ accessToken });
  },

  switchUnidade: (unidadeId, unidadeNome) => {
    localStorage.setItem('unidadeId', unidadeId);
    localStorage.setItem('unidadeNome', unidadeNome);
    set({ unidadeId, unidadeNome });
  },
}));
