import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { reconciliacaoController } from './reconciliacao.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('UNIDADE'));

router.post('/scan-retorno', (req, res, next) => reconciliacaoController.scanRetorno(req, res, next));
router.get('/pendentes/:rotaId', (req, res, next) => reconciliacaoController.getPendentes(req, res, next));
router.post('/finalizar-rota/:rotaId', (req, res, next) => reconciliacaoController.finalizarRota(req, res, next));
router.post('/agendar-nova-tentativa', (req, res, next) => reconciliacaoController.agendarNovaTentativa(req, res, next));
router.post('/encaminhar-agencia', (req, res, next) => reconciliacaoController.encaminharAgencia(req, res, next));

export { router as reconciliacaoRoutes };
