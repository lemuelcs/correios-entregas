import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Lista unitizadores' });
});

router.post('/', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Cria unitizador + QR' });
});

router.get('/:id', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Detalhe unitizador' });
});

router.put('/:id', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Atualiza unitizador' });
});

router.get('/:id/historico', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Histórico unitizador' });
});

router.post('/transferir', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Transferência de carga' });
});

router.get('/scan/:qrCode', async (_req, res) => {
  res.json({ message: 'TODO: Busca por QR Code' });
});

// Veículos
router.get('/veiculos', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Lista veículos' });
});

router.post('/veiculos', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Cria veículo' });
});

router.put('/veiculos/:id', requireRole('GESTOR'), async (_req, res) => {
  res.json({ message: 'TODO: Atualiza veículo' });
});

export { router as unitizadorRoutes };
