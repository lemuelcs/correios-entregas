/**
 * `POST /api/v1/entregas/cargas/:cargaId/liberar` (UNIDADE, com escopo) →
 * `202 {avisosAgendados, semWhatsapp, descadastrados, agendadoPara?}`.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { cargaNoEscopo } from './escopo';
import { liberacaoService } from './liberacao.service';
import { atualizarRastreioDaCarga } from './rastreio.service';

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

/**
 * `POST /cargas/:cargaId/rastreio/atualizar` (UNIDADE ou GESTAO, com escopo) →
 * `{consultados, atualizados, falhas, erro, recente}`: consulta o Seu Rastreio de
 * todos os pacotes da rota. Disparado ao abrir a página dos pacotes.
 */
async function atualizarRastreio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const carga = await cargaNoEscopo(req, String(req.params.cargaId));
    res.json(await atualizarRastreioDaCarga({ id: carga.id, status: carga.status }));
  } catch (err) {
    next(err);
  }
}

export function registrarRotasLiberacao(router: Router): void {
  router.post('/cargas/:cargaId/liberar', requireRole('UNIDADE', 'GESTAO'), liberar);
  router.post('/cargas/:cargaId/rastreio/atualizar', requireRole('UNIDADE', 'GESTAO'), atualizarRastreio);
}
