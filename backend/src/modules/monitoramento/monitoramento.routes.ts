import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.get('/rotas-ativas', async (_req, res) => {
  res.json({ message: 'TODO: Rotas ativas' });
});

router.get('/kpis/:unidadeId', async (_req, res) => {
  res.json({ message: 'TODO: KPIs consolidados' });
});

router.get('/ritmo/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Série temporal ritmo' });
});

router.get('/planejado-executado/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Scatter plot dados' });
});

export { router as monitoramentoRoutes };
