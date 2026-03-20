import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/configurar-sessao', async (_req, res) => {
  res.json({ message: 'TODO: Configurar sessão de triagem' });
});

router.post('/simular', async (_req, res) => {
  res.json({ message: 'TODO: Simular dimensionamento' });
});

router.get('/sort-plan/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Sort Plan da rota' });
});

router.post('/sort-plan/:rotaId/validar', async (_req, res) => {
  res.json({ message: 'TODO: Validar Sort Plan' });
});

router.post('/imprimir-etiquetas/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Gerar PDF etiquetas LIFO' });
});

router.get('/status', async (_req, res) => {
  res.json({ message: 'TODO: Status de triagem' });
});

export { router as triagemRoutes };
