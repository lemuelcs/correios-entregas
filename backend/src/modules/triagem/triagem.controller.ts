import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { triagemService } from './triagem.service';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const configurarSessaoSchema = z.object({
  modeloTriagem: z.enum(['MANUAL', 'PTL', 'ADTA']),
  estruturas: z.number().int().positive('Estruturas deve ser um inteiro positivo'),
  posicoesPorEstrutura: z.number().int().positive('Posicoes por estrutura deve ser um inteiro positivo'),
  throughputHora: z.number().int().positive('Throughput deve ser um inteiro positivo').optional(),
});

const simularSchema = z.object({
  quantidadeObjetos: z.number().int().positive('Quantidade deve ser um inteiro positivo').optional(),
});

export class TriagemController {
  async configurarSessao(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuario nao vinculado a uma unidade');
      }
      const data = configurarSessaoSchema.parse(req.body);
      const resultado = await triagemService.configurarSessao(unidadeId, data);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async simular(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuario nao vinculado a uma unidade');
      }
      const { quantidadeObjetos } = simularSchema.parse(req.body);
      const resultado = await triagemService.simular(unidadeId, quantidadeObjetos);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async getSortPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const resultado = await triagemService.getSortPlan(rotaId);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async validarSortPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const resultado = await triagemService.validarSortPlan(rotaId, req.user!.sub);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async imprimirEtiquetas(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const pdfBuffer = await triagemService.imprimirEtiquetas(rotaId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=etiquetas-${rotaId}.pdf`);
      res.end(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId = req.user!.unidadeId;
      if (!unidadeId) {
        throw new AppError(400, 'Usuario nao vinculado a uma unidade');
      }
      const resultado = await triagemService.getStatus(unidadeId);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

export const triagemController = new TriagemController();
