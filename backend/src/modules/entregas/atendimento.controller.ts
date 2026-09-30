/** Controller do atendimento: `POST /atendimento/sessao` → `{url, expiraEm}`. */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { sessaoAtendimentoSchema } from './cadastro.schemas';
import { abrirSessaoAtendimento } from './atendimento.service';

export const atendimentoController = {
  sessao(req: Request, res: Response, next: NextFunction): void {
    (async () => {
      if (!req.user) throw new AppError(401, 'Não autenticado');
      const pedido = sessaoAtendimentoSchema.parse(req.body ?? {});
      res.json(await abrirSessaoAtendimento(req.user, pedido));
    })().catch(next);
  },
};
