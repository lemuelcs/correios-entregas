/**
 * `POST /api/v1/entregas/cargas/:cargaId/liberar` (UNIDADE, com escopo) →
 * `202 {avisosAgendados, semWhatsapp, descadastrados, agendadoPara?}`.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { cargaNoEscopo } from './escopo';
import { liberacaoService } from './liberacao.service';

const liberarSchema = z.object({ confirmarSemAvisos: z.boolean().optional() });

async function liberar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const carga = await cargaNoEscopo(req, String(req.params.cargaId));
    const corpo = liberarSchema.parse(req.body ?? {});
    const r = await liberacaoService.liberar(carga.id, { usuarioId: req.user?.sub, confirmarSemAvisos: corpo.confirmarSemAvisos });
    res.status(202).json(r);
  } catch (err) {
    next(err);
  }
}

export function registrarRotasLiberacao(router: Router): void {
  router.post('/cargas/:cargaId/liberar', requireRole('UNIDADE'), liberar);
}
