import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from './error-handler.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-32chars';

interface JwtPayload {
  sub: string;
  role: Role;
  unidadeId?: string;
  senhaTemporaria?: boolean;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso negado. Role necessária: ' + roles.join(', ') });
      return;
    }
    next();
  };
}

/**
 * Bloqueia as rotas do app enquanto a senha for temporária (403
 * `troca_de_senha_obrigatoria`). O claim vem do login; se ele diz "temporária",
 * confere o banco, para que o mesmo token passe logo depois de `POST /auth/trocar-senha`.
 * Usar depois de `authenticate`.
 */
export async function requireSenhaDefinitiva(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, 'Não autenticado'));
      return;
    }
    if (req.user.senhaTemporaria) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.sub },
        select: { senhaTemporaria: true },
      });
      if (!usuario || usuario.senhaTemporaria) {
        next(new AppError(403, 'Troque a senha temporária para continuar', { code: 'troca_de_senha_obrigatoria' }));
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
