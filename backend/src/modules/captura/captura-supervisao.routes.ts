/**
 * Supervisor da captura (TechSpec › API Endpoints › Supervisor; ADR-014): montado
 * no roteador autenticado do módulo `entregas` em `/api/v1/entregas/captura`.
 * Leitura: UNIDADE e GESTAO (`?unidadeId=`); escrita: UNIDADE, na própria unidade.
 */
import { Router } from 'express';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { capturaSupervisaoController as c } from './captura-supervisao.controller';

export const capturaSupervisaoRoutes = Router();

const leitura = requireRole('UNIDADE', 'GESTAO');
const escrita = requireRole('UNIDADE');

capturaSupervisaoRoutes.get('/pacotes/:id/historico', leitura, c.historico);
capturaSupervisaoRoutes.get('/pacotes/:id/foto', leitura, c.foto);
capturaSupervisaoRoutes.delete('/pacotes/:id', escrita, c.remover);
capturaSupervisaoRoutes.put('/carteiros/:id/senha', escrita, c.definirSenha);

/** Registra as rotas em `/captura` do roteador autenticado de `entregas.routes.ts`. */
export function registrarRotasCapturaSupervisao(router: Router): void {
  router.use('/captura', capturaSupervisaoRoutes);
}
