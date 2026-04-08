import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { unidadeController } from './unidade.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('UNIDADE'), (req, res, next) => unidadeController.list(req, res, next));
router.post('/', requireRole('UNIDADE'), (req, res, next) => unidadeController.create(req, res, next));
router.get('/minhas', requireRole('UNIDADE'), (req, res, next) => unidadeController.getMinhasUnidades(req, res, next));
router.get('/:id', requireRole('UNIDADE'), (req, res, next) => unidadeController.getById(req, res, next));
router.put('/:id', requireRole('UNIDADE'), (req, res, next) => unidadeController.update(req, res, next));
router.get('/:id/faixas-cep', requireRole('UNIDADE'), (req, res, next) => unidadeController.getFaixasCep(req, res, next));
router.put('/:id/faixas-cep', requireRole('UNIDADE'), (req, res, next) => unidadeController.updateFaixasCep(req, res, next));
router.get('/:id/dashboard', requireRole('UNIDADE'), (req, res, next) => unidadeController.getDashboardData(req, res, next));

export { router as unidadeRoutes };
