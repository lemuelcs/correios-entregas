import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/scan-unitizador', async (_req, res) => {
  res.json({ message: 'TODO: Scan unitizador entrada' });
});

router.post('/confirmar-conferencia', async (_req, res) => {
  res.json({ message: 'TODO: Confirmar conferência' });
});

router.post('/registrar-avaria', async (_req, res) => {
  res.json({ message: 'TODO: Registrar avaria' });
});

router.get('/excepcoes', async (_req, res) => {
  res.json({ message: 'TODO: Lista exceções' });
});

router.get('/relatorio', async (_req, res) => {
  res.json({ message: 'TODO: Relatório recebimento' });
});

export { router as recebimentoRoutes };
