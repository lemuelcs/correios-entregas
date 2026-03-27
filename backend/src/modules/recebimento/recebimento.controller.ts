import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recebimentoService } from './recebimento.service';

const scanUnitizadorSchema = z.object({
  codigoUnitizador: z.string().min(1, 'Código do unitizador é obrigatório'),
});

const confirmarConferenciaSchema = z.object({
  unitizadorId: z.string().uuid('ID do unitizador inválido'),
  divergencias: z.array(
    z.object({
      objetoId: z.string().uuid('ID do objeto inválido'),
      tipo: z.string().min(1, 'Tipo da divergência é obrigatório'),
      descricao: z.string().min(1, 'Descrição da divergência é obrigatória'),
    }),
  ).default([]),
});

const registrarAvariaSchema = z.object({
  objetoId: z.string().uuid('ID do objeto inválido'),
  categoria: z.string().min(1, 'Categoria da avaria é obrigatória'),
  descricao: z.string().min(1, 'Descrição da avaria é obrigatória'),
  fotoUrl: z.string().url().nullable().default(null),
});

const relatorioQuerySchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)').optional(),
});

export class RecebimentoController {
  async scanUnitizador(req: Request, res: Response, next: NextFunction) {
    try {
      const { codigoUnitizador } = scanUnitizadorSchema.parse(req.body);
      const resultado = await recebimentoService.scanUnitizador(
        codigoUnitizador,
        req.user!.unidadeId!,
        req.user!.sub,
      );
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async confirmarConferencia(req: Request, res: Response, next: NextFunction) {
    try {
      const { unitizadorId, divergencias } = confirmarConferenciaSchema.parse(req.body);
      const resultado = await recebimentoService.confirmarConferencia(
        unitizadorId,
        divergencias,
        req.user!.sub,
      );
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async registrarAvaria(req: Request, res: Response, next: NextFunction) {
    try {
      const { objetoId, categoria, descricao, fotoUrl } = registrarAvariaSchema.parse(req.body);
      const resultado = await recebimentoService.registrarAvaria(
        objetoId,
        categoria,
        descricao,
        fotoUrl,
        req.user!.sub,
      );
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async listarExcecoes(req: Request, res: Response, next: NextFunction) {
    try {
      const resultado = await recebimentoService.listarExcecoes(req.user!.unidadeId!);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async getRelatorio(req: Request, res: Response, next: NextFunction) {
    try {
      const { data } = relatorioQuerySchema.parse(req.query);
      const resultado = await recebimentoService.getRelatorio(req.user!.unidadeId!, data);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

export const recebimentoController = new RecebimentoController();
