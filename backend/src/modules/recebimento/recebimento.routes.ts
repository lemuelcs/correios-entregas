import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { recebimentoController } from './recebimento.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/scan-unitizador', (req, res, next) => recebimentoController.scanUnitizador(req, res, next));
router.post('/confirmar-conferencia', (req, res, next) => recebimentoController.confirmarConferencia(req, res, next));
router.post('/registrar-avaria', (req, res, next) => recebimentoController.registrarAvaria(req, res, next));
router.get('/excepcoes', (req, res, next) => recebimentoController.listarExcecoes(req, res, next));
router.get('/relatorio', (req, res, next) => recebimentoController.getRelatorio(req, res, next));

export { router as recebimentoRoutes };
