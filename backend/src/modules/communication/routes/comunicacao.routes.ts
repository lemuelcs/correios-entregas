/**
 * comunicacao.routes.ts
 * Endpoints do módulo WPP-PILOT v1.4
 * Prefixo: /api/comunicacao
 *
 * Rotas sem JWT: /webhook/inbound (autenticado por HMAC secret)
 * Rotas com JWT: demais (authenticate)
 */
import { Router } from 'express';
import { handleInboundWebhook } from '../services/comunicacao/webhook.handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  insucessoNotificarSchema,
  proxyStartSchema,
  dispatcherEntrarSchema,
  dispatcherMensagemSchema,
  notifySchema,
  adminConfigSchema,
  adminStatsQuerySchema,
  checkInstanceQuerySchema,
  llmConfigSchema,
} from '../schemas/comunicacao.schemas';
import comunicacaoController from '../controllers/comunicacao.controller';
import comunicacaoAdminController from '../controllers/comunicacao-admin.controller';

const router = Router();

// ── Webhook (sem JWT — autenticado por HMAC) ─────────────────────
router.post('/webhook/inbound', handleInboundWebhook);
router.post('/webhook/inbound/:event', handleInboundWebhook);

// ── Middleware de auth para todas as demais rotas ────────────────
router.use(authenticate);

// ── Insucesso ────────────────────────────────────────────────────
router.post('/insucesso/notificar', validate(insucessoNotificarSchema), comunicacaoController.insucessoNotificar);

// ── Proxy ────────────────────────────────────────────────────────
router.post('/proxy/start', validate(proxyStartSchema), comunicacaoController.proxyStart);
router.post('/proxy/:sessionId/end', comunicacaoController.proxyEnd);
router.get('/proxy/sessions', comunicacaoController.proxySessions);

// ── Conversas ────────────────────────────────────────────────────
router.get('/conversas', comunicacaoController.listarConversas);
router.get('/conversas/:sessionId/mensagens', comunicacaoController.getMensagensConversa);

// ── Dispatcher ───────────────────────────────────────────────────
router.post('/dispatcher/entrar', validate(dispatcherEntrarSchema), comunicacaoController.dispatcherEntrar);
router.post('/dispatcher/:dispatcherSessionId/mensagem', validate(dispatcherMensagemSchema), comunicacaoController.dispatcherMensagem);
router.post('/dispatcher/:dispatcherSessionId/sair', comunicacaoController.dispatcherSair);

// ── Status & Notify ──────────────────────────────────────────────
router.get('/status', comunicacaoController.getStatus);
router.post('/notify', validate(notifySchema), comunicacaoController.notify);

// ── Admin: Config & Webhook ──────────────────────────────────────
router.get('/admin/check-instance', validate(checkInstanceQuerySchema, 'query'), comunicacaoAdminController.checkInstance);
router.get('/admin/config', comunicacaoAdminController.getConfig);
router.post('/admin/config', validate(adminConfigSchema), comunicacaoAdminController.saveConfig);
router.post('/admin/configurar-webhook', comunicacaoAdminController.configurarWebhook);

// ── Admin: Instance Lifecycle ────────────────────────────────────
router.post('/admin/instance/criar', validate(adminConfigSchema), comunicacaoAdminController.criarInstancia);
router.post('/admin/instance/conectar', comunicacaoAdminController.conectarInstancia);
router.post('/admin/instance/reiniciar', comunicacaoAdminController.reiniciarInstancia);
router.delete('/admin/instance', comunicacaoAdminController.excluirInstancia);
router.get('/admin/instance/listar', comunicacaoAdminController.listarInstancias);

// ── Admin: Stats ─────────────────────────────────────────────────
router.get('/admin/stats', validate(adminStatsQuerySchema, 'query'), comunicacaoAdminController.getStats);

// ── Admin: LLM Config ────────────────────────────────────────────
router.get('/admin/llm-config', comunicacaoAdminController.getLlmConfig);
router.put('/admin/llm-config', validate(llmConfigSchema), comunicacaoAdminController.updateLlmConfig);
router.post('/admin/llm-config/test', comunicacaoAdminController.testLlmConfig);
router.get('/admin/llm-analytics', comunicacaoAdminController.getLlmAnalytics);

export { router as comunicacaoRoutes };
