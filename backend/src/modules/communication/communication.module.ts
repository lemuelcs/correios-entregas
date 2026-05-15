/**
 * communication.module.ts
 * Registro do módulo de comunicação. Expõe rotas que atuam como proxy
 * para o microsserviço central ms-whatsapp em delivyo-services.
 */
import type { Application } from 'express';
import { comunicacaoRoutes } from './routes/comunicacao.routes';
import { chatwootRoutes } from './routes/chatwoot.routes';

export function registerCommunicationModule(app: Application): void {
  // Chatwoot SSO precisa ser montado ANTES do proxy catch-all do hub.
  app.use('/api/v1/comunicacao/chatwoot', chatwootRoutes);
  app.use('/api/v1/comunicacao', comunicacaoRoutes);
}

export { comunicacaoRoutes, chatwootRoutes };
export { whatsappHubClient } from './public/whatsapp-hub.client';
export type {
  WhatsAppPilotRuntimeConfig,
  SendMessageParams,
  NotifyInsucessoParams,
  StartProxyParams,
  TerminologyPayload,
} from './public/whatsapp-hub.client';
