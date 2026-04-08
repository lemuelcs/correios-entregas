import { Request, Response, NextFunction } from 'express';
import { configGlobalService } from './config-global.service';
import { upsertConfigSchema } from './gestao.schemas';

export class ConfigGlobalController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configGlobalService.list();
      res.json(result);
    } catch (err) { next(err); }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { valor, descricao } = upsertConfigSchema.parse(req.body);
      const chave = req.params.chave as string;
      const result = await configGlobalService.upsert(chave, valor, descricao);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export const configGlobalController = new ConfigGlobalController();
