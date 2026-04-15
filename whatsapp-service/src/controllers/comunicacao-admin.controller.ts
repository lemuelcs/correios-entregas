/**
 * comunicacao-admin.controller.ts
 * Controller Multi-Tenant para gestão de WhatsApp (White-Label).
 */
import { NextFunction, Request, Response } from 'express';
import { evolutionClient, WPP_PILOT_WEBHOOK_EVENTS } from '../services/comunicacao/evolution.client';
import { db } from '../types/prisma-extended';
import { formatEvolutionApiError } from '../utils/evolution-error';
import { getWppConfigByTenant, upsertTenantWppConfig } from '../utils/config-loader';
import logger from '../shared/utils/logger';

const APP_BASE_URL = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3003}`;

class ComunicacaoAdminController {
  /**
   * Retorna a configuração de WhatsApp do Tenant logado.
   */
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId || req.user!.unidadeId; // Fallback para unidadeId se tenantId não estiver presente
      const config = await getWppConfigByTenant(tenantId);
      
      if (!config) {
        res.json({ configured: false });
        return;
      }

      // Verifica status real na Evolution API
      const liveState = await evolutionClient.getConnectionState(config.instanceName).catch(() => null);
      
      res.json({
        configured: true,
        tenantId: config.tenantId,
        instanceName: config.instanceName,
        phoneNumber: config.phoneNumber,
        organizationName: config.organizationName,
        terminology: config.terminology,
        customMessages: config.customMessages,
        flowDefinition: config.flowDefinition,
        connected: liveState === 'open',
        botEnabled: config.botEnabled,
        llmEnabled: config.llmEnabled,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Salva as configurações White-Label do Tenant.
   */
  async saveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId || req.user!.unidadeId;
      const { 
        instanceName, 
        phoneNumber, 
        terminology, 
        customMessages, 
        flowDefinition,
        botEnabled,
        llmEnabled,
        llmConfig
      } = req.body;

      const config = await upsertTenantWppConfig(tenantId, {
        instanceName,
        phoneNumber,
        terminology,
        customMessages,
        flowDefinition,
        botEnabled,
        llmEnabled,
        llmConfig
      });

      // Garante que o webhook está configurado para esta instância
      const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      await evolutionClient.setWebhook(instanceName, webhookUrl).catch(err => {
        logger.warn({ instanceName, err: err.message }, '[WPP-ADMIN] Falha ao configurar webhook');
      });

      res.json({ ok: true, config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria uma nova instância para o Tenant e configura o Webhook.
   */
  async criarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId || req.user!.unidadeId;
      const { instanceName } = req.body;

      if (!instanceName) {
        res.status(400).json({ error: 'Nome da instância é obrigatório' });
        return;
      }

      // 1. Criar na Evolution API
      const { qrcode } = await evolutionClient.createBaileysInstance(instanceName);

      // 2. Configurar Webhook apontando para este microserviço
      const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      await evolutionClient.setWebhook(instanceName, webhookUrl);

      // 3. Salvar referência no banco local
      await upsertTenantWppConfig(tenantId, { instanceName, connected: false });

      res.json({ ok: true, instanceName, qrcode });
    } catch (err: any) {
      logger.error(err, '[WPP-ADMIN] Erro ao criar instância');
      const { status, message } = formatEvolutionApiError(err);
      res.status(status).json({ error: message });
    }
  }

  /**
   * Gera um novo QR Code para uma instância existente.
   */
  async conectarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId || req.user!.unidadeId;
      const config = await getWppConfigByTenant(tenantId);

      if (!config) {
        res.status(404).json({ error: 'Configuração não encontrada' });
        return;
      }

      const { qrcode } = await evolutionClient.getQrCodeWithPolling(config.instanceName);
      res.json({ ok: true, qrcode, instanceName: config.instanceName });
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Exclui a instância do Tenant.
   */
  async excluirInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId || req.user!.unidadeId;
      const config = await getWppConfigByTenant(tenantId);

      if (config) {
        await evolutionClient.deleteInstance(config.instanceName).catch(() => null);
        await db.wppPilotConfig.delete({ where: { id: config.id } });
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ComunicacaoAdminController();
