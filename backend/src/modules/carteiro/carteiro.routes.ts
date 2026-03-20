import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { gpsRateLimit } from '../../shared/middleware/rate-limit.middleware';
import { carteiroController } from './carteiro.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('CARTEIRO'));

router.get('/rota-atual', (req, res, next) => carteiroController.getRotaAtual(req, res, next));

router.get('/historico-rotas', (req, res, next) => carteiroController.getHistoricoRotas(req, res, next));

router.post('/coletar-unitizador', (req, res, next) => carteiroController.coletarUnitizador(req, res, next));

router.post('/confirmar-coleta', (req, res, next) => carteiroController.confirmarColeta(req, res, next));

router.get('/parada-atual/:rotaId', (req, res, next) => carteiroController.getParadaAtual(req, res, next));

router.post('/registrar-entrega', (req, res, next) => carteiroController.registrarEntrega(req, res, next));

router.post('/registrar-insucesso', (req, res, next) => carteiroController.registrarInsucesso(req, res, next));

router.post('/registrar-pnov', (req, res, next) => carteiroController.registrarPnov(req, res, next));

router.post('/confirmar-retorno', (req, res, next) => carteiroController.confirmarRetorno(req, res, next));

router.get('/resumo-rota/:rotaId', (req, res, next) => carteiroController.getResumoRota(req, res, next));

router.post('/gps', gpsRateLimit, (req, res, next) => carteiroController.registrarGps(req, res, next));

export { router as carteiroRoutes };
