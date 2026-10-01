import type { NextFunction, Request, Response } from 'express';
import { canaisProsioService } from './canais-prosio.service';
import { createCanalProsioSchema, updateCanalProsioSchema } from './gestao.schemas';

export const canaisProsioController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await canaisProsioService.listar()); } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await canaisProsioService.obter(String(req.params.id))); } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dados = createCanalProsioSchema.parse(req.body);
      res.status(201).json(await canaisProsioService.criar(dados));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dados = updateCanalProsioSchema.parse(req.body);
      res.json(await canaisProsioService.editar(String(req.params.id), dados));
    } catch (err) { next(err); }
  },
};
