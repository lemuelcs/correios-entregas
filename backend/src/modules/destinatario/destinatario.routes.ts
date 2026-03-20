import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('DESTINATARIO'));

router.get('/objetos', async (_req, res) => {
  res.json({ message: 'TODO: Objetos do destinatário' });
});

router.post('/vincular-objeto', async (_req, res) => {
  res.json({ message: 'TODO: Vincular objeto' });
});

router.get('/objetos/:codigoRastreio', async (_req, res) => {
  res.json({ message: 'TODO: Detalhe objeto + eventos' });
});

router.post('/interacao', async (_req, res) => {
  res.json({ message: 'TODO: Criar interação' });
});

router.get('/interacoes/:objetoId', async (_req, res) => {
  res.json({ message: 'TODO: Histórico interações' });
});

router.post('/nps', async (_req, res) => {
  res.json({ message: 'TODO: Responder NPS' });
});

export { router as destinatarioRoutes };
