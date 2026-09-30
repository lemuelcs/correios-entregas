/**
 * Rotas de entrada do Prosio (task_05, ADR-014), no roteador SEM JWT de
 * `entregas.routes.ts`. Limite de taxa próprio, fora do `authenticate`.
 * O corpo cru do webhook é montado por `montarParsersEntregas` (antes do JSON global).
 */
import express, { type Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prosioEntradaController } from './prosio-entrada.controller';

/** Caminho do webhook (para o parser de corpo cru em `app.ts`). */
export const ROTA_WEBHOOK_PROSIO = /^\/api\/v1\/entregas\/prosio\/[^/]+\/webhook\/?$/;

/** Corpo cru até 256 kb, para verificar o HMAC sobre os bytes exatos recebidos. */
export const parserWebhookProsio = express.raw({ type: () => true, limit: '256kb' });

export const limiteEntradaProsio = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.ENTREGAS_PROSIO_LIMITE_POR_MINUTO) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: 'Muitas requisições. Tente novamente em instantes.' },
});

export function registrarRotasProsio(router: Router): void {
  router.post('/prosio/:canalId/webhook', limiteEntradaProsio, prosioEntradaController.webhook);
  router.post('/prosio/:canalId/acao/:prefixo', limiteEntradaProsio, prosioEntradaController.acao);
}
