import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { monitoramentoController } from './monitoramento.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('UNIDADE'));

router.get('/rotas-ativas', (req, res, next) => monitoramentoController.getRotasAtivas(req, res, next));
router.get('/kpis/:unidadeId', (req, res, next) => monitoramentoController.getKpis(req, res, next));
router.get('/ritmo/:rotaId', (req, res, next) => monitoramentoController.getRitmo(req, res, next));
router.get('/planejado-executado/:rotaId', (req, res, next) => monitoramentoController.getPlanejadoExecutado(req, res, next));

export { router as monitoramentoRoutes };
