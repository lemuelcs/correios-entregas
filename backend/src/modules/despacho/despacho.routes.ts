import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('GESTOR'));

router.get('/ponto-dia', async (_req, res) => {
  res.json({ message: 'TODO: Lista carteiros com ponto' });
});

router.post('/ponto-dia/registrar', async (_req, res) => {
  res.json({ message: 'TODO: Registrar ponto' });
});

router.post('/liberar-rota/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Liberar rota' });
});

router.post('/cancelar-rota/:rotaId', async (_req, res) => {
  res.json({ message: 'TODO: Cancelar rota' });
});

router.get('/rotas-pendentes', async (_req, res) => {
  res.json({ message: 'TODO: Rotas pendentes' });
});

router.post('/previsao-volume', async (_req, res) => {
  res.json({ message: 'TODO: Criar previsão volume' });
});

router.get('/previsao-volume', async (_req, res) => {
  res.json({ message: 'TODO: Previsões do dia' });
});

router.get('/simulacao', async (_req, res) => {
  res.json({ message: 'TODO: Simulação dimensionamento' });
});

export { router as despachoRoutes };
