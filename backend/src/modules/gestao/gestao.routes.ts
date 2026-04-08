import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { seController } from './se.controller';
import { unidadesGestaoController } from './unidades-gestao.controller';
import { usuariosGestaoController } from './usuarios-gestao.controller';
import { configGlobalController } from './config-global.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTAO'));

// ── Superintendencias Estaduais ──────────────────────────────────────────────
router.get('/ses', (req, res, next) => seController.list(req, res, next));
router.post('/ses', (req, res, next) => seController.create(req, res, next));
router.get('/ses/:id', (req, res, next) => seController.getById(req, res, next));
router.put('/ses/:id', (req, res, next) => seController.update(req, res, next));
router.delete('/ses/:id', (req, res, next) => seController.delete(req, res, next));

// ── Unidades ─────────────────────────────────────────────────────────────────
router.get('/unidades', (req, res, next) => unidadesGestaoController.list(req, res, next));
router.post('/unidades', (req, res, next) => unidadesGestaoController.create(req, res, next));
router.get('/unidades/:id', (req, res, next) => unidadesGestaoController.getById(req, res, next));
router.put('/unidades/:id', (req, res, next) => unidadesGestaoController.update(req, res, next));

// ── Usuarios ─────────────────────────────────────────────────────────────────
router.get('/usuarios', (req, res, next) => usuariosGestaoController.list(req, res, next));
router.post('/usuarios', (req, res, next) => usuariosGestaoController.create(req, res, next));
router.get('/usuarios/:id', (req, res, next) => usuariosGestaoController.getById(req, res, next));
router.put('/usuarios/:id', (req, res, next) => usuariosGestaoController.update(req, res, next));

// ── Configuracoes Globais ────────────────────────────────────────────────────
router.get('/configuracoes', (req, res, next) => configGlobalController.list(req, res, next));
router.put('/configuracoes/:chave', (req, res, next) => configGlobalController.upsert(req, res, next));

export { router as gestaoRoutes };
