import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { unidadeService } from './unidade.service';
import { getPaginationParams } from '../../shared/utils/pagination';

const createUnidadeSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.enum(['CDD', 'CEE', 'HIBRIDA']),
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
  cep: z.string().length(8),
  latitude: z.number(),
  longitude: z.number(),
  modeloTriagem: z.enum(['MANUAL', 'PTL', 'ADTA']).optional(),
  configTriagem: z.record(z.unknown()).optional(),
});

const updateUnidadeSchema = createUnidadeSchema.partial();

const faixasCepSchema = z.array(
  z.object({
    inicio: z.string(),
    fim: z.string(),
    distritoCodigo: z.string().optional(),
  }),
);

export class UnidadeController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPaginationParams(req);
      const ativa = req.query.ativa !== undefined
        ? req.query.ativa === 'true'
        : undefined;

      const result = await unidadeService.list({ pagination, ativa });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createUnidadeSchema.parse(req.body);
      const unidade = await unidadeService.create({
        codigo: data.codigo,
        nome: data.nome,
        tipo: data.tipo,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        cep: data.cep,
        latitude: data.latitude,
        longitude: data.longitude,
        modeloTriagem: data.modeloTriagem,
        configTriagem: data.configTriagem,
      });
      res.status(201).json(unidade);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const unidade = await unidadeService.getById(id);
      res.json(unidade);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = updateUnidadeSchema.parse(req.body);
      const unidade = await unidadeService.update(id, data);
      res.json(unidade);
    } catch (err) {
      next(err);
    }
  }

  async getFaixasCep(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const faixas = await unidadeService.getFaixasCep(id);
      res.json(faixas);
    } catch (err) {
      next(err);
    }
  }

  async updateFaixasCep(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const faixas = faixasCepSchema.parse(req.body);
      const result = await unidadeService.updateFaixasCep(
        id,
        faixas.map((faixa) => ({
          inicio: faixa.inicio,
          fim: faixa.fim,
          distritoCodigo: faixa.distritoCodigo,
        })),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMinhasUnidades(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const unidades = await unidadeService.getMinhasUnidades(userId);
      res.json(unidades);
    } catch (err) {
      next(err);
    }
  }

  async getDashboardData(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await unidadeService.getDashboardData(id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const unidadeController = new UnidadeController();
