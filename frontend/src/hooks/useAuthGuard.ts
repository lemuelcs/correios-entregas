import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../services/api';
import type { Role } from '../types/api.types';

const HOME_BY_ROLE: Record<Role, string> = {
  GESTAO: '/gestao',
  UNIDADE: '/unidade',
  CARTEIRO: '/carteiro',
  DESTINATARIO: '/destinatario',
};

/**
 * Protects a page by checking authentication and (optionally) role.
 *
 * - No token  -> redirect to /login
 * - Token but no user loaded -> fetch /auth/me to hydrate the store
 * - Role mismatch -> redirect to the user's own home page
 */
export function useAuthGuard(requiredRole?: Role) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const hydrating = useRef(false);

  useEffect(() => {
    // Not authenticated at all
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    // Token exists but user hasn't been hydrated yet — fetch /auth/me
    if (!user && !hydrating.current) {
      hydrating.current = true;
      api
        .get<any>('/auth/me')
        .then((data) => {
          const u = data.user ?? data;
          useAuthStore.setState({ user: u });
        })
        .catch(() => {
          // Token is invalid/expired — redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          useAuthStore.setState({ user: null, accessToken: null });
          navigate('/login', { replace: true });
        })
        .finally(() => {
          hydrating.current = false;
        });
      return;
    }

    // Role check
    if (user && requiredRole && user.role !== requiredRole) {
      const home = HOME_BY_ROLE[user.role] ?? '/login';
      navigate(home, { replace: true });
    }
  }, [accessToken, user, requiredRole, navigate]);
}
