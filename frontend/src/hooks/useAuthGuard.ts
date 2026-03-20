import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth.store';
import type { Role } from '../types/api.types';

const HOME_BY_ROLE: Record<Role, string> = {
  GESTOR: '/gestao',
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

  useEffect(() => {
    // Not authenticated at all
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    // Token exists but user hasn't been hydrated yet — wait for it
    if (!user) {
      return;
    }

    // Role check
    if (requiredRole && user.role !== requiredRole) {
      const home = HOME_BY_ROLE[user.role] ?? '/login';
      navigate(home, { replace: true });
    }
  }, [accessToken, user, requiredRole, navigate]);
}
