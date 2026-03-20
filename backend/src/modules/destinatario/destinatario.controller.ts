import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { destinatarioService } from './destinatario.service';

const vincularObjetoSchema = z.object({
  codigoRastreio: z.string().min(13).max(13),
});

const criarInteracaoSchema = z.object({
  objetoId: z.string().uuid(),
  tipo: z.enum(['REAGENDAR', 'AUTORIZAR_TERCEIRO', 'REDIRECIONAR', 'MANTER_AGENCIA', 'CONTATAR_CARTEIRO']),
  dados: z.record(z.unknown()),
});

const responderNpsSchema = z.object({
  objetoId: z.string().uuid(),
  nota: z.number().int().min(0).max(10),
  comentario: z.string().optional(),
});

export class DestinatarioController {
  async getObjetos(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await destinatarioService.getObjetos(req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async vincularObjeto(req: Request, res: Response, next: NextFunction) {
    try {
      const { codigoRastreio } = vincularObjetoSchema.parse(req.body);
      const result = await destinatarioService.vincularObjeto(req.user!.sub, codigoRastreio);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getObjetoDetalhe(req: Request, res: Response, next: NextFunction) {
    try {
      const codigoRastreio = req.params.codigoRastreio as string;
      const result = await destinatarioService.getObjetoDetalhe(codigoRastreio);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async criarInteracao(req: Request, res: Response, next: NextFunction) {
    try {
      const { objetoId, tipo, dados } = criarInteracaoSchema.parse(req.body);
      const result = await destinatarioService.criarInteracao(
        objetoId,
        req.user!.sub,
        tipo,
        dados,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getInteracoes(req: Request, res: Response, next: NextFunction) {
    try {
      const objetoId = req.params.objetoId as string;
      const result = await destinatarioService.getInteracoes(objetoId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async responderNps(req: Request, res: Response, next: NextFunction) {
    try {
      const { objetoId, nota, comentario } = responderNpsSchema.parse(req.body);
      const result = await destinatarioService.responderNps(
        objetoId,
        req.user!.sub,
        nota,
        comentario,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const destinatarioController = new DestinatarioController();
