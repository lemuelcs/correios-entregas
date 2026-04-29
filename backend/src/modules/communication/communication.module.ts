/**
 * communication.module.ts
 * Registro do módulo de comunicação. Expõe rotas que atuam como proxy
 * para o microsserviço central ms-whatsapp em delivyo-services.
 */
import type { Application } from 'express';
import { comunicacaoRoutes } from './routes/comunicacao.routes';

export function registerCommunicationModule(app: Application): void {
  app.use('/api/v1/comunicacao', comunicacaoRoutes);
}

export { comunicacaoRoutes };
export { whatsappHubClient } from './public/whatsapp-hub.client';
export type {
  WhatsAppPilotRuntimeConfig,
  SendMessageParams,
  NotifyInsucessoParams,
  StartProxyParams,
  TerminologyPayload,
} from './public/whatsapp-hub.client';
