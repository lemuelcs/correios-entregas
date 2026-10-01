/** Rotas de orientação (task_05). Registradas no roteador autenticado de `entregas.routes.ts`. */
import type { Router } from 'express';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { orientacaoController } from './orientacao.controller';

export function registrarRotasOrientacao(router: Router): void {
  router.post('/pacotes/:id/orientacao', requireRole('UNIDADE', 'GESTAO'), orientacaoController.manual);
}
