import { create } from 'zustand';
import { api } from '../services/api';

interface User {
  id: string;
  nome: string;
  cpf?: string;
  email?: string;
  role: 'GESTOR' | 'CARTEIRO' | 'DESTINATARIO';
  unidadeId?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  login: (credentials: { cpf?: string; email?: string; senha: string }) => Promise<User>;
  logout: () => void;
  setTokens: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),

  login: async (credentials) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', credentials);
    const { accessToken, refreshToken, user } = res;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, accessToken });
    return user;
  },

  logout: () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null });
  },

  setTokens: (accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({ accessToken });
  },
}));
