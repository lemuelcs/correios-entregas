import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.post('/executar', async (_req, res) => {
  res.json({ message: 'TODO: Executar roteirização' });
});

router.get('/job/:jobId', async (_req, res) => {
  res.json({ message: 'TODO: Status do job' });
});

router.get('/resultado/:jobId', async (_req, res) => {
  res.json({ message: 'TODO: Resultado do job' });
});

router.post('/aprovar/:jobId', async (_req, res) => {
  res.json({ message: 'TODO: Aprovar rotas' });
});

router.put('/rota/:rotaId/editar', async (_req, res) => {
  res.json({ message: 'TODO: Editar rota manualmente' });
});

router.delete('/rota/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Remover rota' });
});

export { router as roteirizacaoRoutes };
