import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { monitoramentoService } from './monitoramento.service';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const kpisParamsSchema = z.object({
  unidadeId: z.string().uuid(),
});

const kpisQuerySchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data invalido (YYYY-MM-DD)').optional(),
});

const rotaIdParamsSchema = z.object({
  rotaId: z.string().uuid(),
});

export class MonitoramentoController {
  async getRotasAtivas(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuario nao vinculado a uma unidade');
      }
      const result = await monitoramentoService.getRotasAtivas(unidadeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const { unidadeId } = kpisParamsSchema.parse(req.params);
      const { data } = kpisQuerySchema.parse(req.query);
      const result = await monitoramentoService.getKpis(unidadeId, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getRitmo(req: Request, res: Response, next: NextFunction) {
    try {
      const { rotaId } = rotaIdParamsSchema.parse(req.params);
      const result = await monitoramentoService.getRitmo(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPlanejadoExecutado(req: Request, res: Response, next: NextFunction) {
    try {
      const { rotaId } = rotaIdParamsSchema.parse(req.params);
      const result = await monitoramentoService.getPlanejadoExecutado(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const monitoramentoController = new MonitoramentoController();
