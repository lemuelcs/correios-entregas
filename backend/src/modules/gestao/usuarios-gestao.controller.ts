import { Request, Response, NextFunction } from 'express';
import { usuariosGestaoService } from './usuarios-gestao.service';
import { createUsuarioSchema, updateUsuarioSchema } from './gestao.schemas';
import type { Role } from '@prisma/client';

export class UsuariosGestaoController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.query.role as Role | undefined;
      const unidadeId = req.query.unidadeId as string | undefined;
      const ativo = req.query.ativo === 'false' ? false : req.query.ativo === 'true' ? true : undefined;
      const result = await usuariosGestaoService.list({ role, unidadeId, ativo });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usuariosGestaoService.getById(req.params.id as string);
      res.json(result);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createUsuarioSchema.parse(req.body);
      const result = await usuariosGestaoService.create(data as any);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateUsuarioSchema.parse(req.body);
      const result = await usuariosGestaoService.update(req.params.id as string, data as any);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export const usuariosGestaoController = new UsuariosGestaoController();
