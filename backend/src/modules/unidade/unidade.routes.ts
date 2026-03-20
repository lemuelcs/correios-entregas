import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Lista unidades' });
});

router.post('/', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Cria unidade' });
});

router.get('/:id', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Detalhe unidade' });
});

router.put('/:id', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Atualiza unidade' });
});

router.get('/:id/faixas-cep', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Faixas de CEP' });
});

router.put('/:id/faixas-cep', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Atualiza faixas CEP' });
});

router.get('/:id/dashboard', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Dashboard dados' });
});

export { router as unidadeRoutes };
