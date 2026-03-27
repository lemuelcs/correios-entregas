import { Router, type Request, type Response, type NextFunction } from 'express';
import { handleInboundWebhook } from './webhook.handler';
import { pilotProxyService } from './proxy.service';
import { evolutionClient } from './evolution.client';
import { prisma } from '../../shared/utils/prisma';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

const router = Router();

// ── Webhook (sem JWT – autenticado por HMAC) ─────────────────────────────────
router.post('/webhook/inbound', handleInboundWebhook);

// ── Todas as rotas abaixo requerem autenticação ───────────────────────────────
router.use(authenticate);

// ── Proxy – CARTEIRO ─────────────────────────────────────────────────────────

/**
 * POST /comunicacao/proxy/start
 * Inicia canal proxy WhatsApp entre carteiro e destinatário.
 * O carteiroPhone é derivado de Carteiro.telefonePiloto pelo JWT.
 */
router.post(
  '/proxy/start',
  requireRole('CARTEIRO'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { destinatarioPhone, rotaId, objetoId } = req.body as {
        destinatarioPhone: string;
        rotaId?: string;
        objetoId?: string;
      };

      if (!destinatarioPhone) {
        res.status(400).json({ error: 'destinatarioPhone obrigatório' });
        return;
      }

      const userId = req.user!.sub;

      const carteiro = await prisma.carteiro.findUnique({
        where: { usuarioId: userId },
        include: { unidade: { include: { pilotWaConfig: true } } },
      });

      if (!carteiro) {
        res.status(404).json({ error: 'Carteiro não encontrado' });
        return;
      }
      if (!carteiro.telefonePiloto) {
        res.status(400).json({ error: 'Número de WhatsApp do carteiro não configurado para o piloto' });
        return;
      }
      if (!carteiro.unidade.pilotWaConfig) {
        res.status(400).json({ error: 'WhatsApp não configurado para esta unidade' });
        return;
      }

      const sessionId = await pilotProxyService.startSession({
        instanceName: carteiro.unidade.pilotWaConfig.instanceName,
        carteiroId: carteiro.id,
        carteiroPhone: carteiro.telefonePiloto.replace('+', ''),
        destinatarioPhone: destinatarioPhone.replace('+', ''),
        rotaId,
        objetoId,
      });

      res.json({ sessionId });
    } catch (err) {
      next(err);
    }
  },
);

// ── Proxy – GESTOR ────────────────────────────────────────────────────────────

router.post(
  '/proxy/:sessionId/end',
  requireRole('GESTOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await pilotProxyService.endSession(String(req.params.sessionId), 'MANAGER_ENDED');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/proxy/sessions',
  requireRole('GESTOR'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await prisma.pilotProxySession.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  },
);

// ── Status e configuração – GESTOR ────────────────────────────────────────────

router.get(
  '/status/:instanceName',
  requireRole('GESTOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await evolutionClient.getConnectionState(String(req.params.instanceName));
      res.json({ state });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/qrcode/:instanceName',
  requireRole('GESTOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const base64 = await evolutionClient.getQrCode(String(req.params.instanceName));
      res.json({ qrcode: base64 });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/notify',
  requireRole('GESTOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceName, phone, text } = req.body as {
        instanceName: string;
        phone: string;
        text: string;
      };
      const messageId = await evolutionClient.sendText(instanceName, {
        number: phone.replace('+', ''),
        text,
      });
      res.json({ messageId });
    } catch (err) {
      next(err);
    }
  },
);

export { router as comunicacaoRoutes };
