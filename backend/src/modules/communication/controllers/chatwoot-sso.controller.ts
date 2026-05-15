/**
 * chatwoot-sso.controller.ts
 *
 * GET /api/v1/comunicacao/chatwoot/sso
 *
 * Retorna a URL SSO autenticada para o usuario logado acessar
 * o Chatwoot do Correios Entregas (account fixo 7).
 */
import { NextFunction, Request, Response } from 'express';

import logger from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { prisma } from '../../../shared/utils/prisma';
import { getChatwootSsoUrlForCorreiosUser } from '../services/chatwoot-sso.service';

const LOG_PREFIX = '[CHATWOOT-SSO]';

export async function getSsoUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw new AppError(401, 'Usuario nao autenticado');

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { id: true, nome: true, email: true, role: true },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuario nao encontrado');
    }
    if (!usuario.email) {
      throw new AppError(400, 'Usuario sem email cadastrado — necessario para SSO Chatwoot');
    }

    const result = await getChatwootSsoUrlForCorreiosUser({
      email: usuario.email,
      fullName: usuario.nome,
      role: usuario.role,
      correiosUserId: usuario.id,
    });

    res.json({
      status: 'success',
      data: { url: result.url, accountId: result.accountId },
    });
  } catch (error) {
    logger.warn({ err: (error as Error).message }, `${LOG_PREFIX} Falha em /sso`);
    next(error);
  }
}
