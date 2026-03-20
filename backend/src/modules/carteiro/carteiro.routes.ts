import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { gpsRateLimit } from '../../shared/middleware/rate-limit.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('CARTEIRO'));

router.get('/rota-atual', async (_req, res) => {
  res.json({ message: 'TODO: Rota atual do carteiro' });
});

router.get('/historico-rotas', async (_req, res) => {
  res.json({ message: 'TODO: Histórico rotas' });
});

router.post('/coletar-unitizador', async (_req, res) => {
  res.json({ message: 'TODO: Coletar unitizador via QR' });
});

router.post('/confirmar-coleta', async (_req, res) => {
  res.json({ message: 'TODO: Confirmar coleta + anti-PNOV' });
});

router.get('/parada-atual/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Próxima parada' });
});

router.post('/registrar-entrega', async (_req, res) => {
  res.json({ message: 'TODO: Registrar entrega (POD)' });
});

router.post('/registrar-insucesso', async (_req, res) => {
  res.json({ message: 'TODO: Registrar insucesso' });
});

router.post('/registrar-pnov', async (_req, res) => {
  res.json({ message: 'TODO: Registrar PNOV' });
});

router.post('/confirmar-retorno', async (_req, res) => {
  res.json({ message: 'TODO: Confirmar retorno à unidade' });
});

router.get('/resumo-rota/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Resumo final da rota' });
});

router.post('/gps', gpsRateLimit, async (_req, res) => {
  res.json({ message: 'TODO: GPS snapshot' });
});

export { router as carteiroRoutes };
