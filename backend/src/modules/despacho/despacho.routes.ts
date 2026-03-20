import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { despachoController } from './despacho.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.get('/ponto-dia', (req, res, next) => despachoController.getPontoDia(req, res, next));
router.post('/ponto-dia/registrar', (req, res, next) => despachoController.registrarPonto(req, res, next));
router.get('/carteiros', (req, res, next) => despachoController.listCarteiros(req, res, next));
router.post('/liberar-rota/:rotaId', (req, res, next) => despachoController.liberarRota(req, res, next));
router.post('/cancelar-rota/:rotaId', (req, res, next) => despachoController.cancelarRota(req, res, next));
router.get('/rotas-pendentes', (req, res, next) => despachoController.getRotasPendentes(req, res, next));
router.post('/previsao-volume', (req, res, next) => despachoController.criarPrevisaoVolume(req, res, next));
router.get('/previsao-volume', (req, res, next) => despachoController.getPrevisaoVolume(req, res, next));
router.get('/simulacao', (req, res, next) => despachoController.getSimulacao(req, res, next));

export { router as despachoRoutes };
