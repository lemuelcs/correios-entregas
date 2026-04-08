import { Request, Response, NextFunction } from 'express';
import { unidadesGestaoService } from './unidades-gestao.service';
import { createUnidadeSchema, updateUnidadeSchema } from './gestao.schemas';

export class UnidadesGestaoController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const seId = req.query.seId as string | undefined;
      const uf = req.query.uf as string | undefined;
      const ativa = req.query.ativa === 'false' ? false : req.query.ativa === 'true' ? true : undefined;
      const result = await unidadesGestaoService.list({ seId, uf, ativa });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await unidadesGestaoService.getById(req.params.id as string);
      res.json(result);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createUnidadeSchema.parse(req.body);
      const result = await unidadesGestaoService.create(data);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateUnidadeSchema.parse(req.body);
      const result = await unidadesGestaoService.update(req.params.id as string, data);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export const unidadesGestaoController = new UnidadesGestaoController();
