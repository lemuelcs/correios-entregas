import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reconciliacaoService } from './reconciliacao.service';

const scanRetornoSchema = z.object({
  codigoRastreio: z.string().min(1, 'Código de rastreio é obrigatório'),
});

const agendarNovaTentativaSchema = z.object({
  objetoId: z.string().uuid('ID do objeto inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)').optional(),
});

const encaminharAgenciaSchema = z.object({
  objetoId: z.string().uuid('ID do objeto inválido'),
});

export class ReconciliacaoController {
  async scanRetorno(req: Request, res: Response, next: NextFunction) {
    try {
      const { codigoRastreio } = scanRetornoSchema.parse(req.body);
      const atorId = req.user!.sub;
      const result = await reconciliacaoService.scanRetorno(codigoRastreio, atorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPendentes(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const result = await reconciliacaoService.getPendentes(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async finalizarRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const atorId = req.user!.sub;
      const result = await reconciliacaoService.finalizarRota(rotaId, atorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async agendarNovaTentativa(req: Request, res: Response, next: NextFunction) {
    try {
      const { objetoId, data } = agendarNovaTentativaSchema.parse(req.body);
      const atorId = req.user!.sub;
      const result = await reconciliacaoService.agendarNovaTentativa(objetoId, data ?? null, atorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async encaminharAgencia(req: Request, res: Response, next: NextFunction) {
    try {
      const { objetoId } = encaminharAgenciaSchema.parse(req.body);
      const atorId = req.user!.sub;
      const result = await reconciliacaoService.encaminharAgencia(objetoId, atorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const reconciliacaoController = new ReconciliacaoController();
