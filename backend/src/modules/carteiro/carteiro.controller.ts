import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { carteiroService } from './carteiro.service';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { getPaginationParams } from '../../shared/utils/pagination';

const coletarUnitizadorSchema = z.object({
  qrCode: z.string(),
});

const confirmarColetaSchema = z.object({
  rotaId: z.string().uuid(),
  objetosConfirmados: z.array(z.string()).min(1),
});

const registrarEntregaSchema = z.object({
  objetoId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  foto: z.string().optional(),
});

const registrarInsucessoSchema = z.object({
  objetoId: z.string().uuid(),
  motivo: z.enum(['SEM_ATENDIMENTO', 'RECUSADO', 'ENDERECO_INCORRETO', 'MUDOU_SE']),
  latitude: z.number(),
  longitude: z.number(),
  foto: z.string().optional(),
});

const registrarPnovSchema = z.object({
  rotaId: z.string().uuid(),
  objetoId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
});

const confirmarRetornoSchema = z.object({
  rotaId: z.string().uuid(),
});

const gpsSchema = z.object({
  rotaId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  velocidade: z.number().optional(),
});

async function resolveCarteiroId(userId: string): Promise<string> {
  const carteiro = await prisma.carteiro.findUnique({
    where: { usuarioId: userId },
  });

  if (!carteiro) {
    throw new AppError(404, 'Carteiro nao encontrado para este usuario');
  }

  return carteiro.id;
}

export class CarteiroController {
  async getRotaAtual(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const result = await carteiroService.getRotaAtual(carteiroId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getHistoricoRotas(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { page, limit } = getPaginationParams(req);
      const result = await carteiroService.getHistoricoRotas(carteiroId, page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async coletarUnitizador(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { qrCode } = coletarUnitizadorSchema.parse(req.body);
      const result = await carteiroService.coletarUnitizador(carteiroId, qrCode);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async confirmarColeta(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { rotaId, objetosConfirmados } = confirmarColetaSchema.parse(req.body);
      const result = await carteiroService.confirmarColeta(carteiroId, rotaId, objetosConfirmados);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getParadaAtual(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const result = await carteiroService.getParadaAtual(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async registrarEntrega(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { objetoId, latitude, longitude, foto } = registrarEntregaSchema.parse(req.body);
      const result = await carteiroService.registrarEntrega(
        objetoId,
        latitude,
        longitude,
        foto,
        carteiroId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async registrarInsucesso(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { objetoId, motivo, latitude, longitude, foto } = registrarInsucessoSchema.parse(req.body);
      const result = await carteiroService.registrarInsucesso(
        objetoId,
        motivo,
        latitude,
        longitude,
        foto,
        carteiroId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async registrarPnov(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { rotaId, objetoId, latitude, longitude } = registrarPnovSchema.parse(req.body);
      const result = await carteiroService.registrarPnov(
        rotaId,
        objetoId,
        latitude,
        longitude,
        carteiroId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async confirmarRetorno(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { rotaId } = confirmarRetornoSchema.parse(req.body);
      const result = await carteiroService.confirmarRetorno(carteiroId, rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getResumoRota(req: Request, res: Response, next: NextFunction) {
    try {
      const rotaId = req.params.rotaId as string;
      const result = await carteiroService.getResumoRota(rotaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async registrarGps(req: Request, res: Response, next: NextFunction) {
    try {
      const carteiroId = await resolveCarteiroId(req.user!.sub);
      const { rotaId, latitude, longitude, velocidade } = gpsSchema.parse(req.body);
      const result = await carteiroService.registrarGps(
        carteiroId,
        rotaId,
        latitude,
        longitude,
        velocidade,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const carteiroController = new CarteiroController();
