import { create } from 'zustand';
import { api } from '../services/api';

interface UsuarioListItem {
  id: string;
  cpf?: string;
  email?: string;
  matricula?: string;
  nome: string;
  role: string;
  unidadeId?: string;
  unidade?: { id: string; nome: string; codigo: string } | null;
  telefoneCelular?: string;
  telefoneComercial?: string;
  ativo: boolean;
  createdAt: string;
}

interface GestaoUsuariosState {
  usuarios: UsuarioListItem[];
  loading: boolean;
  error: string | null;
  fetchAll: (filters?: { role?: string; unidadeId?: string }) => Promise<void>;
  create: (data: any) => Promise<void>;
  update: (id: string, data: any) => Promise<void>;
}

export const useGestaoUsuariosStore = create<GestaoUsuariosState>((set, get) => ({
  usuarios: [],
  loading: false,
  error: null,

  fetchAll: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.role) params.set('role', filters.role);
      if (filters?.unidadeId) params.set('unidadeId', filters.unidadeId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<UsuarioListItem[]>(`/gestao/usuarios${qs}`);
      set({ usuarios: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (data) => {
    await api.post('/gestao/usuarios', data);
    await get().fetchAll();
  },

  update: async (id, data) => {
    await api.put(`/gestao/usuarios/${id}`, data);
    await get().fetchAll();
  },
}));
