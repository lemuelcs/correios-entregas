import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { destinatarioController } from './destinatario.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('DESTINATARIO'));

router.get('/objetos', (req, res, next) => destinatarioController.getObjetos(req, res, next));

router.post('/vincular-objeto', (req, res, next) => destinatarioController.vincularObjeto(req, res, next));

router.get('/objetos/:codigoRastreio', (req, res, next) => destinatarioController.getObjetoDetalhe(req, res, next));

router.post('/interacao', (req, res, next) => destinatarioController.criarInteracao(req, res, next));

router.get('/interacoes/:objetoId', (req, res, next) => destinatarioController.getInteracoes(req, res, next));

router.post('/nps', (req, res, next) => destinatarioController.responderNps(req, res, next));

export { router as destinatarioRoutes };
