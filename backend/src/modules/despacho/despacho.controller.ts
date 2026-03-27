import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { despachoService } from './despacho.service';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const registrarPontoSchema = z.object({
  carteiroId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)'),
  presente: z.boolean(),
  horaEntrada: z.string().optional(),
  observacao: z.string().optional(),
});

const liberarRotaSchema = z.object({
  posicaoEstacao: z.string().min(1),
  unitizadorIds: z.array(z.string().uuid()).min(1),
});

const previsaoVolumeSchema = z.object({
  faixa: z.string().min(1),
  quantidadeEstimada: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)'),
});

export class DespachoController {
  async getPontoDia(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const data = req.query.data as string | undefined;
      const result = await despachoService.getPontoDia(unidadeId, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async registrarPonto(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const { carteiroId, data, presente, horaEntrada, observacao } =
        registrarPontoSchema.parse(req.body);
      const result = await despachoService.registrarPonto(
        carteiroId,
        data,
        presente,
        horaEntrada,
        observacao,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listCarteiros(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const result = await despachoService.listCarteiros(unidadeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getRotasPendentes(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const result = await despachoService.getRotasPendentes(unidadeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async liberarRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const atorId = req.user!.sub;
      const { posicaoEstacao, unitizadorIds } = liberarRotaSchema.parse(req.body);
      const result = await despachoService.liberarRota(
        rotaId,
        posicaoEstacao,
        unitizadorIds,
        atorId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async cancelarRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const atorId = req.user!.sub;
      const result = await despachoService.cancelarRota(rotaId, atorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async criarPrevisaoVolume(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const { faixa, quantidadeEstimada, data } = previsaoVolumeSchema.parse(req.body);
      const result = await despachoService.criarPrevisaoVolume(
        unidadeId,
        faixa,
        quantidadeEstimada,
        data,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPrevisaoVolume(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const data = req.query.data as string | undefined;
      const result = await despachoService.getPrevisaoVolume(unidadeId, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getSimulacao(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuário não vinculado a uma unidade');
      }
      const result = await despachoService.getSimulacao(unidadeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const despachoController = new DespachoController();
