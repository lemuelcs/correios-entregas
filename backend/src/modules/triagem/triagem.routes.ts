import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { triagemController } from './triagem.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('UNIDADE'));

router.post('/configurar-sessao', (req, res, next) => triagemController.configurarSessao(req, res, next));
router.post('/simular', (req, res, next) => triagemController.simular(req, res, next));
router.get('/sort-plan/:rotaId', (req, res, next) => triagemController.getSortPlan(req, res, next));
router.post('/sort-plan/:rotaId/validar', (req, res, next) => triagemController.validarSortPlan(req, res, next));
router.post('/imprimir-etiquetas/:rotaId', (req, res, next) => triagemController.imprimirEtiquetas(req, res, next));
router.get('/status', (req, res, next) => triagemController.getStatus(req, res, next));

export { router as triagemRoutes };
