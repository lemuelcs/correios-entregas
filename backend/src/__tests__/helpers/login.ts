/**
 * Helper de login para testes: emite o mesmo access token que o `auth.service`
 * (payload `{ sub, role, unidadeId }`, HS256 com JWT_SECRET).
 */
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

const JWT_SECRET_PADRAO = 'dev-jwt-secret-change-in-production-32chars'; // mesmo fallback do auth.middleware

export interface UsuarioToken {
  id: string;
  role: Role;
  unidadeId?: string | null;
}

export function tokenPara(usuario: UsuarioToken, expiresIn: jwt.SignOptions['expiresIn'] = '15m'): string {
  const secret = process.env.JWT_SECRET || JWT_SECRET_PADRAO;
  return jwt.sign(
    { sub: usuario.id, role: usuario.role, unidadeId: usuario.unidadeId ?? undefined },
    secret,
    { expiresIn },
  );
}

/** Header pronto para supertest: `.set(authHeader(u))`. */
export function authHeader(usuario: UsuarioToken): { Authorization: string } {
  return { Authorization: `Bearer ${tokenPara(usuario)}` };
}
