import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { roteirizacaoController } from './roteirizacao.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/executar', (req, res, next) =>
  roteirizacaoController.executar(req, res, next),
);

router.get('/job/:jobId', (req, res, next) =>
  roteirizacaoController.getJobStatus(req, res, next),
);

router.get('/resultado/:jobId', (req, res, next) =>
  roteirizacaoController.getResultado(req, res, next),
);

router.post('/aprovar/:jobId', (req, res, next) =>
  roteirizacaoController.aprovar(req, res, next),
);

router.put('/rota/:rotaId/editar', (req, res, next) =>
  roteirizacaoController.editarRota(req, res, next),
);

router.delete('/rota/:rotaId', (req, res, next) =>
  roteirizacaoController.removerRota(req, res, next),
);

export { router as roteirizacaoRoutes };
