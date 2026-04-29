/**
 * comunicacao.routes.ts
 * Proxy do backend Correios Entregas para o microsserviço central ms-whatsapp.
 *
 * Prefixo local: /api/v1/comunicacao
 * Prefixo remoto padrão: /api/comunicacao no hub central (configurável via env).
 */
import { Router } from 'express';

import { authenticate } from '../../../shared/middleware/auth.middleware';
import { proxyWhatsAppHub, proxyWhatsAppHubWebhook } from '../public/whatsapp-hub.proxy';

const router = Router();

// Webhook do Evolution / WPP-Pilot sem JWT — autenticação HMAC ocorre no hub.
router.post('/webhook/inbound', proxyWhatsAppHubWebhook);
router.post('/webhook/inbound/:event', proxyWhatsAppHubWebhook);

// Demais rotas autenticadas seguem para o hub central com JWT compatível reemitido.
router.use(authenticate);
router.use(proxyWhatsAppHub);

export { router as comunicacaoRoutes };
