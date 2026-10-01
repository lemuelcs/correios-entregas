/** Rotas da carga do dia (task_04). Registradas no roteador autenticado de `entregas.routes.ts`. */
import type { Router } from 'express';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { cargaController, uploadPlanilha } from './carga.controller';

export function registrarRotasCarga(router: Router): void {
  router.get('/quadro', requireRole('UNIDADE', 'GESTAO'), cargaController.quadro);
  router.post('/cargas/:distritoId/previa', requireRole('UNIDADE'), uploadPlanilha, cargaController.previa);
  router.post('/cargas/:distritoId/confirmar', requireRole('UNIDADE'), cargaController.confirmar);
  router.get('/cargas/:cargaId/pacotes', requireRole('UNIDADE', 'GESTAO'), cargaController.pacotes);
  router.patch('/pacotes/:id', requireRole('UNIDADE'), cargaController.editarPacote);
}
