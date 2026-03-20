import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { unitizadorService } from './unitizador.service';
import { getPaginationParams } from '../../shared/utils/pagination';

const TipoUnitizadorEnum = z.enum(['BAG', 'SACOLA', 'CARRINHO', 'CAIXETA', 'CDL', 'CAF', 'VEICULO']);
const StatusUnitizadorEnum = z.enum(['DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'INATIVO']);
const StatusVeiculoEnum = z.enum(['DISPONIVEL', 'EM_ROTA', 'MANUTENCAO', 'INATIVO']);
const ModalEntregaEnum = z.enum([
  'A_PE', 'BICICLETA', 'BICICLETA_ELETRICA', 'MOTOCICLETA', 'CARRO', 'FURGAO', 'VAN', 'SPRINTER',
]);

const createSchema = z.object({
  codigo: z.string().min(1),
  tipo: TipoUnitizadorEnum,
  unidadeId: z.string().uuid(),
  larguraCm: z.number().positive().optional(),
  alturaCm: z.number().positive().optional(),
  profundidadeCm: z.number().positive().optional(),
  volumeLitros: z.number().positive().optional(),
  capacidadeKg: z.number().positive().optional(),
});

const updateSchema = z.object({
  statusAtual: StatusUnitizadorEnum.optional(),
  localizacaoAtual: z.object({
    tipo: z.string(),
    referencia: z.string(),
  }).optional(),
  rotaAtualId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  ativo: z.boolean().optional(),
  larguraCm: z.number().positive().optional(),
  alturaCm: z.number().positive().optional(),
  profundidadeCm: z.number().positive().optional(),
  volumeLitros: z.number().positive().optional(),
  capacidadeKg: z.number().positive().optional(),
});

const transferirSchema = z.object({
  origemIds: z.array(z.string().uuid()).min(1),
  destinoIds: z.array(z.string().uuid()).min(1),
  objetoIds: z.array(z.string().uuid()).min(1),
  observacao: z.string().optional(),
});

const createVeiculoSchema = z.object({
  codigo: z.string().min(1),
  unidadeId: z.string().uuid(),
  placa: z.string().min(1),
  modeloVeiculo: z.string().min(1),
  modal: ModalEntregaEnum,
  capacidadeKg: z.number().positive().optional(),
});

const updateVeiculoSchema = z.object({
  placa: z.string().min(1).optional(),
  modeloVeiculo: z.string().min(1).optional(),
  modal: ModalEntregaEnum.optional(),
  statusVeiculo: StatusVeiculoEnum.optional(),
  capacidadeKg: z.number().positive().optional(),
  ativo: z.boolean().optional(),
});

export class UnitizadorController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPaginationParams(req);
      const filters = {
        unidadeId: req.user!.unidadeId!,
        tipo: req.query.tipo as string | undefined,
        statusAtual: req.query.statusAtual as string | undefined,
      };
      const result = await unitizadorService.list(pagination, filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSchema.parse(req.body);
      const result = await unitizadorService.create(data, req.user!.sub);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await unitizadorService.getById(req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateSchema.parse(req.body);
      const result = await unitizadorService.update(req.params.id as string, data, req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getHistorico(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPaginationParams(req);
      const result = await unitizadorService.getHistorico(req.params.id as string, pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async transferir(req: Request, res: Response, next: NextFunction) {
    try {
      const data = transferirSchema.parse(req.body);
      const result = await unitizadorService.transferir(data, req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async findByQrCode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await unitizadorService.findByQrCode(req.params.qrCode as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listVeiculos(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await unitizadorService.listVeiculos(req.user!.unidadeId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async createVeiculo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createVeiculoSchema.parse(req.body);
      const result = await unitizadorService.createVeiculo(data, req.user!.sub);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateVeiculo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateVeiculoSchema.parse(req.body);
      const result = await unitizadorService.updateVeiculo(req.params.id as string, data, req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const unitizadorController = new UnitizadorController();
