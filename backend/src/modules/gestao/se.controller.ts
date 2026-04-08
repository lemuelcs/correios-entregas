import { Request, Response, NextFunction } from 'express';
import { seService } from './se.service';
import { createSeSchema, updateSeSchema } from './gestao.schemas';

export class SeController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const ativa = req.query.ativa === 'false' ? false : req.query.ativa === 'true' ? true : undefined;
      const uf = typeof req.query.uf === 'string' ? req.query.uf : undefined;
      const result = await seService.list({ ativa, uf });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await seService.getById(req.params.id as string);
      res.json(result);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSeSchema.parse(req.body);
      const result = await seService.create(data);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateSeSchema.parse(req.body);
      const result = await seService.update(req.params.id as string, data);
      res.json(result);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await seService.delete(req.params.id as string);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
}

export const seController = new SeController();
