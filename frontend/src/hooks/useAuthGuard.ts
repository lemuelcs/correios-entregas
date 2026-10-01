import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth.store';
import { ApiError, api, urlDeLogin } from '../services/api';
import type { Role, User } from '../types/api.types';

/**
 * Página inicial de cada papel. Supervisor e Gestão entram pelos três módulos (ADR-015);
 * o carteiro entra no app de captura do rótulo.
 */
export const HOME_BY_ROLE: Record<Role, string> = {
  GESTAO: '/entregas/cadastro',
  UNIDADE: '/entregas/carregar',
  CARTEIRO: '/carteiro/captura',
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
/** Espera entre as tentativas de reler `/auth/me` quando a falha não é de sessão (em ms). */
export const ESPERAS_AUTH_ME_MS = [2_000, 5_000, 15_000, 30_000];

export function useAuthGuard(requiredRole?: Role | Role[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuthStore();
  const hydrating = useRef(false);
  // Cada falha que não é de sessão agenda uma nova leitura; o contador refaz o efeito.
  const [tentativa, setTentativa] = useState(0);
  const montado = useRef(false);
  const cancelarEspera = useRef<(() => void) | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cancelarEspera.current?.();
    };
  }, []);
  const papeis = requiredRole === undefined ? null : Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const papeisChave = papeis?.join(',') ?? '';

  useEffect(() => {
    const voltar = `${location.pathname}${location.search}`;

    // Not authenticated at all
    if (!accessToken) {
      navigate(urlDeLogin(voltar), { replace: true });
      return undefined;
    }

    // Token exists but user hasn't been hydrated yet — fetch /auth/me
    if (!user && !hydrating.current) {
      hydrating.current = true;
      const tentarDeNovo = () => {
        cancelarEspera.current?.();
        if (montado.current) setTentativa((n) => n + 1);
      };
      api
        .get<{ user?: User } | User>('/auth/me')
        .then((data) => {
          const u = ('user' in data && data.user) ? data.user : data as User;
          useAuthStore.setState({ user: u });
        })
        .catch((err: unknown) => {
          // Só um 401 encerra a sessão (token inválido ou vencido sem renovação). Um 500, um
          // 503 ou a falta de rede não dizem nada sobre a sessão: ela fica, a fila offline do
          // carteiro também, e a leitura é refeita em instantes (ou quando a rede voltar).
          if (err instanceof ApiError && err.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            useAuthStore.setState({ user: null, accessToken: null });
            navigate(urlDeLogin(voltar), { replace: true });
            return;
          }
          if (!montado.current) return;
          const espera = ESPERAS_AUTH_ME_MS[Math.min(tentativa, ESPERAS_AUTH_ME_MS.length - 1)];
          const timer = window.setTimeout(tentarDeNovo, espera);
          window.addEventListener('online', tentarDeNovo);
          cancelarEspera.current = () => {
            window.clearTimeout(timer);
            window.removeEventListener('online', tentarDeNovo);
            cancelarEspera.current = null;
          };
        })
        .finally(() => {
          hydrating.current = false;
        });
      return undefined;
    }

    // Role check
    if (user && papeisChave && !papeisChave.split(',').includes(user.role)) {
      const home = HOME_BY_ROLE[user.role] ?? '/login';
      navigate(home, { replace: true });
    }
    return undefined;
    // location fica fora das dependências: o guarda reage à sessão, não a cada navegação.
  }, [accessToken, user, papeisChave, navigate, tentativa]);
}
