/**
 * Escopo por unidade das rotas `/api/v1/entregas` (TechSpec › API Endpoints › Escopo).
 *
 * - `UNIDADE` enxerga só `req.user.unidadeId`. Recurso (ou `?unidadeId=`) de
 *   outra unidade → 404, para não confirmar que ele existe.
 * - `GESTAO` enxerga todas as unidades e escolhe uma com `?unidadeId=`.
 * - Outros papéis → 403.
 *
 * Reutilizado pelas tasks 03, 05 e 06.
 */
import type { Request } from 'express';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

export function naoEncontrado(): AppError {
  return new AppError(404, 'nao_encontrado');
}

function usuario(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new AppError(401, 'Não autenticado');
  return req.user;
}

function unidadeDaQuery(req: Request): string | undefined {
  const v = req.query.unidadeId;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Unidade efetiva da requisição.
 * `UNIDADE`: a do token (um `?unidadeId=` diferente → 404).
 * `GESTAO`: `?unidadeId=` obrigatório (400 `unidade_obrigatoria`); unidade inexistente → 404.
 */
export async function resolverUnidade(req: Request): Promise<string> {
  const u = usuario(req);
  const pedida = unidadeDaQuery(req);
  if (u.role === 'UNIDADE') {
    if (!u.unidadeId) throw new AppError(403, 'sem_unidade');
    if (pedida && pedida !== u.unidadeId) throw naoEncontrado();
    return u.unidadeId;
  }
  if (u.role === 'GESTAO') {
    if (!pedida) throw new AppError(400, 'unidade_obrigatoria');
    const existe = await prisma.unidade.findUnique({ where: { id: pedida }, select: { id: true } });
    if (!existe) throw naoEncontrado();
    return pedida;
  }
  throw new AppError(403, 'Acesso negado');
}

/** Lança 404 se o usuário não pode ver um recurso da unidade `unidadeId`. */
export function garantirUnidade(req: Request, unidadeId: string): void {
  const u = usuario(req);
  const pedida = unidadeDaQuery(req);
  if (u.role === 'UNIDADE') {
    if (!u.unidadeId || u.unidadeId !== unidadeId) throw naoEncontrado();
    if (pedida && pedida !== unidadeId) throw naoEncontrado();
    return;
  }
  if (u.role === 'GESTAO') {
    if (pedida && pedida !== unidadeId) throw naoEncontrado();
    return;
  }
  throw new AppError(403, 'Acesso negado');
}

/** Distrito visível ao usuário, ou 404. */
export async function distritoNoEscopo(req: Request, distritoId: string) {
  const distrito = await prisma.distrito.findUnique({ where: { id: distritoId } });
  if (!distrito) throw naoEncontrado();
  garantirUnidade(req, distrito.unidadeId);
  return distrito;
}

/** Carga (com o distrito) visível ao usuário, ou 404. */
export async function cargaNoEscopo(req: Request, cargaId: string) {
  const carga = await prisma.cargaDistrito.findUnique({
    where: { id: cargaId },
    include: { distrito: true },
  });
  if (!carga) throw naoEncontrado();
  garantirUnidade(req, carga.distrito.unidadeId);
  return carga;
}

/** Pacote (com carga e distrito) visível ao usuário, ou 404. */
export async function pacoteNoEscopo(req: Request, pacoteId: string) {
  const pacote = await prisma.pacoteDia.findUnique({
    where: { id: pacoteId },
    include: { carga: { include: { distrito: true } } },
  });
  if (!pacote) throw naoEncontrado();
  garantirUnidade(req, pacote.carga.distrito.unidadeId);
  return pacote;
}
