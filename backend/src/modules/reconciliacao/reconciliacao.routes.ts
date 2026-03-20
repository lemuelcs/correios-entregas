import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/scan-retorno', async (_req, res) => {
  res.json({ message: 'TODO: Scan retorno FC_45' });
});

router.get('/pendentes/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Objetos pendentes reconciliação' });
});

router.post('/finalizar-rota/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Finalizar rota' });
});

router.post('/agendar-nova-tentativa', async (_req, res) => {
  res.json({ message: 'TODO: Agendar nova tentativa' });
});

router.post('/encaminhar-agencia', async (_req, res) => {
  res.json({ message: 'TODO: Encaminhar para agência' });
});

export { router as reconciliacaoRoutes };
