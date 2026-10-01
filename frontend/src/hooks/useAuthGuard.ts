import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth.store';
import { api, urlDeLogin } from '../services/api';
import type { Role, User } from '../types/api.types';

/** Página inicial de cada papel. Supervisor e Gestão entram pelos três módulos (ADR-015). */
export const HOME_BY_ROLE: Record<Role, string> = {
  GESTAO: '/entregas/cadastro',
  UNIDADE: '/entregas/carregar',
  CARTEIRO: '/carteiro',
  DESTINATARIO: '/destinatario',
};

/** Áreas que cada papel pode abrir (usado para validar o `?voltar=` do login). */
const AREAS_POR_PAPEL: Record<Role, string[]> = {
  GESTAO: ['/entregas', '/gestao'],
  UNIDADE: ['/entregas', '/unidade'],
  CARTEIRO: ['/carteiro'],
  DESTINATARIO: ['/destinatario'],
};

/** Destino seguro depois do login: o `voltar` pedido, se for uma área do papel; senão a página inicial. */
export function destinoAposLogin(role: Role, voltar: string | null): string {
  if (voltar && voltar.startsWith('/') && !voltar.startsWith('//')) {
    const caminho = voltar.split(/[?#]/)[0];
    if (AREAS_POR_PAPEL[role]?.some((area) => caminho === area || caminho.startsWith(`${area}/`))) return voltar;
  }
  return HOME_BY_ROLE[role] ?? '/login';
}

/**
 * Protects a page by checking authentication and (optionally) role.
 *
 * - No token  -> redirect to /login (com `?voltar=` para retornar à tela pedida)
 * - Token but no user loaded -> fetch /auth/me to hydrate the store
 * - Role mismatch -> redirect to the user's own home page
 */
export function useAuthGuard(requiredRole?: Role | Role[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuthStore();
  const hydrating = useRef(false);
  const papeis = requiredRole === undefined ? null : Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const papeisChave = papeis?.join(',') ?? '';

  useEffect(() => {
    const voltar = `${location.pathname}${location.search}`;

    // Not authenticated at all
    if (!accessToken) {
      navigate(urlDeLogin(voltar), { replace: true });
      return;
    }

    // Token exists but user hasn't been hydrated yet — fetch /auth/me
    if (!user && !hydrating.current) {
      hydrating.current = true;
      api
        .get<{ user?: User } | User>('/auth/me')
        .then((data) => {
          const u = ('user' in data && data.user) ? data.user : data as User;
          useAuthStore.setState({ user: u });
        })
        .catch(() => {
          // Token is invalid/expired — redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          useAuthStore.setState({ user: null, accessToken: null });
          navigate(urlDeLogin(voltar), { replace: true });
        })
        .finally(() => {
          hydrating.current = false;
        });
      return;
    }

    // Role check
    if (user && papeisChave && !papeisChave.split(',').includes(user.role)) {
      const home = HOME_BY_ROLE[user.role] ?? '/login';
      navigate(home, { replace: true });
    }
    // location fica fora das dependências: o guarda reage à sessão, não a cada navegação.
  }, [accessToken, user, papeisChave, navigate]);
}
