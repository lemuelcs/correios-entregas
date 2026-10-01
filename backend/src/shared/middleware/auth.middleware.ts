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

// ——— Estado do usuário (US-002.EC-3 e EC-5) ——————————————————————————————
//
// O token continua válido até expirar, mas a cada requisição o `authenticate`
// confere no banco se o usuário segue ativo e qual é o papel e a unidade dele
// hoje. A consulta fica em cache por 60 s por usuário; a Gestão invalida a
// entrada na hora quando edita o usuário (`invalidarCacheUsuario`).

const TTL_CACHE_MS = 60_000;

interface EstadoUsuario {
  ativo: boolean;
  role: Role;
  unidadeId: string | null;
  expiraEm: number;
}

const cacheUsuarios = new Map<string, EstadoUsuario>();

/** Esquece o estado em cache de um usuário (ou de todos, sem argumento). */
export function invalidarCacheUsuario(usuarioId?: string): void {
  if (usuarioId) cacheUsuarios.delete(usuarioId);
  else cacheUsuarios.clear();
}

async function estadoUsuario(usuarioId: string): Promise<EstadoUsuario | null> {
  const agora = Date.now();
  const emCache = cacheUsuarios.get(usuarioId);
  if (emCache && emCache.expiraEm > agora) return emCache;

  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { ativo: true, role: true, unidadeId: true },
  });
  if (!u) {
    cacheUsuarios.delete(usuarioId);
    return null;
  }
  const estado: EstadoUsuario = { ativo: u.ativo, role: u.role, unidadeId: u.unidadeId, expiraEm: agora + TTL_CACHE_MS };
  cacheUsuarios.set(usuarioId, estado);
  return estado;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  estadoUsuario(payload.sub).then(
    (estado) => {
      if (!estado || !estado.ativo) {
        res.status(401).json({ error: 'Usuário inativo ou inexistente' });
        return;
      }
      // Papel e unidade vêm do banco: um supervisor movido passa a ver só a unidade nova.
      req.user = { sub: payload.sub, role: estado.role, unidadeId: estado.unidadeId ?? undefined };
      next();
    },
    (err: unknown) => next(err),
  );
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
