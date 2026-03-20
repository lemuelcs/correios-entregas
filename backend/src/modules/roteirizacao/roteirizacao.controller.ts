import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { roteirizacaoService } from './roteirizacao.service';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const executarSchema = z.object({
  modoOtimizacao: z.enum(['ABSOLUTO', 'LARGE_VAN', 'BALANCEADO']).default('ABSOLUTO'),
  solver: z.enum(['VROOM', 'PYVRP']).default('VROOM'),
});

const editarRotaSchema = z.object({
  reorder: z.array(z.number().int().positive()).optional(),
  moveObjetos: z
    .array(
      z.object({
        objetoId: z.string().uuid(),
        toRotaId: z.string().uuid(),
      }),
    )
    .optional(),
});

export class RoteirizacaoController {
  async executar(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }

      const { modoOtimizacao, solver } = executarSchema.parse(req.body);
      const atorId = req.user!.sub;

      const result = await roteirizacaoService.executar(
        unidadeId,
        modoOtimizacao,
        solver,
        atorId,
      );

      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getJobStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.jobId as string;
      const result = await roteirizacaoService.getJobStatus(jobId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getResultado(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.jobId as string;
      const result = await roteirizacaoService.getResultado(jobId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async aprovar(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.jobId as string;
      const atorId = req.user!.sub;
      const result = await roteirizacaoService.aprovar(jobId, atorId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async editarRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const changes = editarRotaSchema.parse(req.body);

      if (!changes.reorder && !changes.moveObjetos) {
        throw new AppError(400, 'Forneça ao menos reorder ou moveObjetos');
      }

      const result = await roteirizacaoService.editarRota(rotaId, changes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async removerRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const result = await roteirizacaoService.removerRota(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const roteirizacaoController = new RoteirizacaoController();
