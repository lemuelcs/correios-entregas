/** Orientação manual do supervisor (US-026): `POST /pacotes/:id/orientacao`. */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { pacoteNoEscopo } from './escopo';
import { orientacaoService } from './orientacao.service';

const corpoManual = z.object({
  texto: z.string({ required_error: 'texto obrigatório' }),
  valeParaAmanha: z.boolean().optional().default(false),
});

export const orientacaoController = {
  async manual(req: Request, res: Response, next: NextFunction) {
    try {
      const pacote = await pacoteNoEscopo(req, String(req.params.id));
      const corpo = corpoManual.safeParse(req.body ?? {});
      if (!corpo.success) throw new AppError(400, 'Dados inválidos', corpo.error.flatten().fieldErrors);
      const o = await orientacaoService.registrar({
        pacoteId: pacote.id,
        tipo: 'MANUAL',
        texto: corpo.data.texto,
        origem: 'SUPERVISOR',
        criadaPorId: req.user!.sub,
        valeParaAmanha: corpo.data.valeParaAmanha,
      });
      res.status(201).json({ data: o });
    } catch (err) {
      next(err);
    }
  },
};
