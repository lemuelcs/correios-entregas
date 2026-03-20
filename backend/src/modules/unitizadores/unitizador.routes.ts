import { Router } from 'express';
import { unitizadorController } from './unitizador.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Rotas sem parâmetro dinâmico primeiro (evita conflito com /:id)
router.post('/transferir', requireRole('GESTOR'), (req, res, next) => unitizadorController.transferir(req, res, next));
router.get('/scan/:qrCode', (req, res, next) => unitizadorController.findByQrCode(req, res, next));

// Veículos (sub-rotas sob /unitizadores/veiculos)
router.get('/veiculos', requireRole('GESTOR'), (req, res, next) => unitizadorController.listVeiculos(req, res, next));
router.post('/veiculos', requireRole('GESTOR'), (req, res, next) => unitizadorController.createVeiculo(req, res, next));
router.put('/veiculos/:id', requireRole('GESTOR'), (req, res, next) => unitizadorController.updateVeiculo(req, res, next));

// CRUD unitizadores
router.get('/', requireRole('GESTOR'), (req, res, next) => unitizadorController.list(req, res, next));
router.post('/', requireRole('GESTOR'), (req, res, next) => unitizadorController.create(req, res, next));
router.get('/:id', requireRole('GESTOR'), (req, res, next) => unitizadorController.getById(req, res, next));
router.put('/:id', requireRole('GESTOR'), (req, res, next) => unitizadorController.update(req, res, next));
router.get('/:id/historico', requireRole('GESTOR'), (req, res, next) => unitizadorController.getHistorico(req, res, next));

export { router as unitizadorRoutes };
