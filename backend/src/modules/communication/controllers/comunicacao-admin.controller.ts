/**
 * comunicacao-admin.controller.ts
 * Controller para endpoints administrativos do módulo WPP-PILOT v1.3
 * (config, instância, webhook, stats, LLM)
 */
import { NextFunction, Request, Response } from 'express';
import { evolutionClient } from '../services/comunicacao/evolution.client';
import { WPP_PILOT_WEBHOOK_EVENTS } from '../services/comunicacao/evolution.client';
import { describeEvolutionBaseUrl } from '../services/comunicacao/evolution-url';
import { db } from '../types/prisma-extended';
import { parseEvolutionInstanceMissingError, formatEvolutionApiError } from '../utils/evolution-error';
import logger from '../../../shared/utils/logger';

const APP_BASE_URL = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

class ComunicacaoAdminController {
  /**
   * GET /api/comunicacao/admin/check-instance?instanceName=xxx
   * Verifica se o instanceName está disponível e se a instância está ativa na Evolution API
   */
  async checkInstance(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const instanceName = req.query.instanceName as string;

      if (!instanceName?.trim()) {
        res.status(400).json({ error: 'instanceName é obrigatório' });
        return;
      }

      const conflict = await db.wppPilotConfig.findUnique({ where: { instanceName } });
      const takenByOther = conflict && conflict.unidadeId !== unidadeId;

      let evolutionState: string | null = null;
      try {
        evolutionState = await evolutionClient.getConnectionState(instanceName);
      } catch {
        evolutionState = null;
      }

      res.json({
        available: !takenByOther,
        takenByOther,
        evolutionState, // 'open' | 'close' | 'connecting' | null (indisponível)
        instanceExists: evolutionState !== null,
        isConnected: evolutionState === 'open',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/admin/config
   * Retorna a configuração WPP-PILOT do tenant + status do webhook na Evolution API
   */
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.json({ configured: false }); return; }

      const instanceExists = await evolutionClient.instanceExists(config.instanceName).catch(() => false);
      const webhookInfo = await evolutionClient.fetchWebhookInfo(config.instanceName).catch(() => null);
      const expectedUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      const eventsOk = WPP_PILOT_WEBHOOK_EVENTS.every(
        (e) => (webhookInfo?.events ?? []).includes(e),
      );

      res.json({
        configured: true,
        instanceName: config.instanceName,
        phoneNumber: config.phoneNumber,
        dspNome: config.unidadeNome,
        locale: config.locale,
        timezone: config.timezone,
        botEnabled: config.botEnabled,
        proxyEnabled: config.proxyEnabled,
        instanceExists,
        connected: config.connected,
        connectedAt: config.connectedAt ?? null,
        lastWebhookAt: config.lastWebhookAt ?? null,
        webhook: {
          current: webhookInfo,
          expected: { url: expectedUrl, events: WPP_PILOT_WEBHOOK_EVENTS },
          ok: webhookInfo?.url === expectedUrl && eventsOk,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/admin/config
   * Cria ou atualiza WppPilotConfig e configura o webhook na Evolution API.
   */
  async saveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const {
        instanceName,
        phoneNumber,
        dspNome,
        locale = 'pt_BR',
        timezone = 'America/Sao_Paulo',
        botEnabled = true,
        proxyEnabled = true,
      } = req.body;

      if (!instanceName) {
        res.status(400).json({ error: 'instanceName é obrigatório' });
        return;
      }

      // Verificar se instanceName já está em uso por outro tenant
      const conflict = await db.wppPilotConfig.findUnique({ where: { instanceName } });
      if (conflict && conflict.unidadeId !== unidadeId) {
        res.status(409).json({ error: `A instância "${instanceName}" já está em uso por outro tenant.` });
        return;
      }

      // Upsert por unidadeId (único por tenant). Se o instanceName mudou, atualiza também.
      const existing = await db.wppPilotConfig.findUnique({ where: { unidadeId } });
      const config = existing
        ? await db.wppPilotConfig.update({
            where: { unidadeId },
            data: { instanceName, phoneNumber, unidadeNome: dspNome, locale, timezone, botEnabled, proxyEnabled },
          })
        : await db.wppPilotConfig.create({
            data: {
              instanceName,
              unidadeId,
              phoneNumber: phoneNumber ?? '',
              unidadeNome: dspNome ?? 'Correios',
              locale,
              timezone,
              botEnabled,
              proxyEnabled,
            },
          });

      // Configurar webhook na Evolution API — falha não impede o salvamento da config
      const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      let webhookError: string | null = null;
      try {
        await evolutionClient.setWebhook(instanceName, webhookUrl);
      } catch (err: any) {
        webhookError = parseEvolutionInstanceMissingError(err) ?? err.message;
        logger.warn({ unidadeId, instanceName, err: webhookError }, '[COMUNICACAO] Webhook não configurado');
      }

      logger.info({ unidadeId, instanceName }, '[COMUNICACAO] WppPilotConfig criado/atualizado');
      res.json({ ok: true, config, webhookUrl, events: WPP_PILOT_WEBHOOK_EVENTS, webhookError });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/admin/configurar-webhook
   * Reconfigura apenas o webhook na Evolution API (sem alterar WppPilotConfig).
   */
  async configurarWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) {
        res.status(404).json({ error: 'WppPilotConfig não encontrado para este tenant' });
        return;
      }

      const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      const instanceExists = await evolutionClient.instanceExists(config.instanceName).catch(() => true);
      if (!instanceExists) {
        res.status(409).json({
          error: `A instância "${config.instanceName}" não existe na Evolution API. Crie ou recrie a instância antes de reconfigurar o webhook.`,
        });
        return;
      }

      await evolutionClient.setWebhook(config.instanceName, webhookUrl);

      // Verificar resultado
      const info = await evolutionClient.fetchWebhookInfo(config.instanceName).catch(() => null);

      logger.info({ unidadeId, instanceName: config.instanceName, webhookUrl }, '[COMUNICACAO] Webhook reconfigurado');
      res.json({ ok: true, instanceName: config.instanceName, webhookUrl, events: WPP_PILOT_WEBHOOK_EVENTS, webhookInfo: info });
    } catch (err: any) {
      logger.error(err, '[COMUNICACAO] /admin/configurar-webhook erro');
      const { status, message } = formatEvolutionApiError(err, undefined);
      res.status(status).json({ error: message });
    }
  }

  /**
   * POST /api/comunicacao/admin/instance/criar
   * Cria (ou re-cria) a instância Baileys na Evolution API e salva a config no DB.
   */
  async criarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const {
        instanceName,
        phoneNumber,
        dspNome,
        locale = 'pt_BR',
        timezone = 'America/Sao_Paulo',
        botEnabled = true,
        proxyEnabled = true,
      } = req.body;

      if (!instanceName) {
        res.status(400).json({ error: 'instanceName é obrigatório' });
        return;
      }

      // Verificar conflito de instanceName entre tenants
      const conflict = await db.wppPilotConfig.findUnique({ where: { instanceName } });
      if (conflict && conflict.unidadeId !== unidadeId) {
        res.status(409).json({ error: `A instância "${instanceName}" já está em uso por outro tenant.` });
        return;
      }

      // Upsert da config no DB
      const existing = await db.wppPilotConfig.findUnique({ where: { unidadeId } });
      const config = existing
        ? await db.wppPilotConfig.update({
            where: { unidadeId },
            data: { instanceName, phoneNumber, unidadeNome: dspNome, locale, timezone, botEnabled, proxyEnabled, connected: false },
          })
        : await db.wppPilotConfig.create({
            data: {
              instanceName,
              unidadeId,
              phoneNumber: phoneNumber ?? '',
              unidadeNome: dspNome ?? 'Correios',
              locale,
              timezone,
              botEnabled,
              proxyEnabled,
            },
          });

      // Criar instância Baileys na Evolution API
      const { qrcode: createdQrcode } = await evolutionClient.createBaileysInstance(instanceName);

      // Fallback: se a criação não retornou QR code, buscar via polling (geração assíncrona)
      let qrcode = createdQrcode;
      if (!qrcode) {
        try {
          const { qrcode: connectQrcode } = await evolutionClient.getQrCodeWithPolling(instanceName);
          qrcode = connectQrcode;
        } catch {
          // QR code indisponível agora — usuário deve clicar em "Conectar"
        }
      }

      // Configurar webhook (falha não impede resposta)
      const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
      let webhookError: string | null = null;
      try {
        await evolutionClient.setWebhook(instanceName, webhookUrl);
      } catch (err: any) {
        webhookError = err.message;
        logger.warn({ unidadeId, instanceName, err: err.message }, '[COMUNICACAO] Webhook não configurado após criar instância');
      }

      logger.info({ unidadeId, instanceName }, '[COMUNICACAO] Instância Baileys criada');
      res.json({ ok: true, config, instanceName, qrcode, webhookError });
    } catch (err: any) {
      logger.error(err, '[COMUNICACAO] /admin/instance/criar erro');
      const { status, message } = formatEvolutionApiError(err);
      res.status(status).json({ error: message });
    }
  }

  /**
   * POST /api/comunicacao/admin/instance/conectar
   * Busca o QR code atual da instância para reconectar.
   * Se a instância não existir na Evolution API, cria automaticamente.
   */
  async conectarInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) {
        res.status(404).json({ error: 'Instância não configurada para este tenant. Salve a configuração primeiro.' });
        return;
      }

      const instanceName: string = config.instanceName;

      // Verificar se a instância existe na Evolution API
      const exists = await evolutionClient.instanceExists(instanceName).catch(() => false);

      if (!exists) {
        // Instância não existe na Evolution API — criar automaticamente
        logger.info({ unidadeId, instanceName }, '[COMUNICACAO] Instância não encontrada na Evolution API, criando automaticamente');
        const { qrcode: createdQr } = await evolutionClient.createBaileysInstance(instanceName);

        // Configurar webhook após criar
        const webhookUrl = `${APP_BASE_URL}/api/v1/comunicacao/webhook/inbound`;
        try {
          await evolutionClient.setWebhook(instanceName, webhookUrl);
        } catch (whErr: any) {
          logger.warn({ unidadeId, instanceName, err: whErr.message }, '[COMUNICACAO] Webhook não configurado após auto-criar instância');
        }

        if (createdQr) {
          res.json({ ok: true, qrcode: createdQr, instanceName, autoCreated: true });
          return;
        }

        // Fallback: QR code é gerado assincronamente, aguardar com polling
        const { qrcode: fallbackQr } = await evolutionClient.getQrCodeWithPolling(instanceName);
        res.json({ ok: true, qrcode: fallbackQr, instanceName, autoCreated: true });
        return;
      }

      // Verificar estado da conexão
      const state = await evolutionClient.getConnectionState(instanceName).catch(() => 'close' as const);
      if (state === 'open') {
        res.json({ ok: true, qrcode: null, instanceName, alreadyConnected: true });
        return;
      }

      // Instância existe mas desconectada — buscar QR code com polling
      const { qrcode } = await evolutionClient.getQrCodeWithPolling(instanceName);

      // Se não retornou QR, tentar restart + connect com polling
      if (!qrcode) {
        logger.info({ unidadeId, instanceName }, '[COMUNICACAO] QR code não retornado, reiniciando instância');
        try {
          await evolutionClient.restartInstance(instanceName);
          const { qrcode: retryQr } = await evolutionClient.getQrCodeWithPolling(instanceName);
          res.json({ ok: true, qrcode: retryQr, instanceName });
          return;
        } catch (restartErr: any) {
          logger.warn({ instanceName, err: restartErr.message }, '[COMUNICACAO] Falha ao reiniciar para obter QR');
        }
      }

      res.json({ ok: true, qrcode, instanceName });
    } catch (err: any) {
      logger.error(err, '[COMUNICACAO] /admin/instance/conectar erro');
      const { status, message } = formatEvolutionApiError(err);
      res.status(status).json({ error: message });
    }
  }

  /**
   * POST /api/comunicacao/admin/instance/reiniciar
   * Reinicia a instância Baileys na Evolution API.
   */
  async reiniciarInstancia(req: Request, res: Response, next: NextFunction) {
    let instanceName: string | undefined;
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) {
        res.status(404).json({ error: 'Instância não configurada para este tenant' });
        return;
      }
      instanceName = config.instanceName;
      await evolutionClient.restartInstance(config.instanceName);
      logger.info({ unidadeId, instanceName: config.instanceName }, '[COMUNICACAO] Instância reiniciada');
      res.json({ ok: true, instanceName: config.instanceName });
    } catch (err: any) {
      logger.error(err, '[COMUNICACAO] /admin/instance/reiniciar erro');
      const { status, message } = formatEvolutionApiError(err, instanceName);
      res.status(status).json({ error: message });
    }
  }

  /**
   * DELETE /api/comunicacao/admin/instance
   * Exclui a instância da Evolution API e marca como desconectada no DB.
   */
  async excluirInstancia(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) {
        res.status(404).json({ error: 'Instância não configurada para este tenant' });
        return;
      }
      await evolutionClient.deleteInstance(config.instanceName);
      await db.wppPilotConfig.update({
        where: { unidadeId },
        data: { connected: false, connectedAt: null },
      });
      logger.info({ unidadeId, instanceName: config.instanceName }, '[COMUNICACAO] Instância excluída');
      res.json({ ok: true, instanceName: config.instanceName });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/admin/instance/listar
   * Lista todas as instâncias registradas na Evolution API.
   */
  async listarInstancias(req: Request, res: Response, next: NextFunction) {
    try {
      const instances = await evolutionClient.fetchInstances();
      res.json({ ok: true, instances });
    } catch (err: any) {
      logger.error(err, '[COMUNICACAO] /admin/instance/listar erro');
      const { status, message } = formatEvolutionApiError(err);
      res.status(status).json({ error: message });
    }
  }

  /**
   * GET /api/comunicacao/admin/stats?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
   * Retorna métricas de mensagens e sessões do WPP-PILOT no período informado.
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const { dataInicio, dataFim } = req.query as { dataInicio?: string; dataFim?: string };

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) {
        res.json({
          mensagensEnviadas: 0, mensagensRecebidas: 0,
          entregues: 0, lidas: 0, falhas: 0,
          sessoesAtivas: 0, sessoesBot: 0, sessoesDispatcher: 0,
          motoristaCount: 0, destinatarioCount: 0,
          llmRequests: 0, llmCostUsd: 0, taxaBot: 0,
        });
        return;
      }

      const start = dataInicio ? new Date(`${dataInicio}T00:00:00`) : new Date(Date.now() - 7 * 86400000);
      const end = dataFim ? new Date(`${dataFim}T23:59:59`) : new Date();

      // Contar mensagens por direction + deliveryStatus
      const msgGroups = await db.wppPilotMessage.groupBy({
        by: ['direction', 'deliveryStatus'],
        where: {
          session: { instanceName: config.instanceName },
          createdAt: { gte: start, lte: end },
        },
        _count: { _all: true },
      });

      let mensagensEnviadas = 0;
      let mensagensRecebidas = 0;
      let entregues = 0;
      let lidas = 0;
      let falhas = 0;

      for (const g of msgGroups as any[]) {
        const count = g._count._all;
        if (g.direction === 'OUTBOUND') mensagensEnviadas += count;
        if (g.direction === 'INBOUND') mensagensRecebidas += count;
        if (g.deliveryStatus === 'DELIVERED') entregues += count;
        if (g.deliveryStatus === 'READ') lidas += count;
        if (g.deliveryStatus === 'FAILED') falhas += count;
      }

      // Contar sessões com atividade no período
      const sessoes = await db.wppPilotSession.findMany({
        where: {
          instanceName: config.instanceName,
          lastMessageAt: { gte: start, lte: end },
        },
        select: { state: true, participantType: true },
      });

      const sessoesAtivas = sessoes.length;
      const sessoesBot = sessoes.filter((s: any) => s.state === 'BOT_ACTIVE').length;
      const sessoesDispatcher = sessoes.filter((s: any) => s.state === 'DISPATCHER_ACTIVE').length;
      const motoristaCount = sessoes.filter((s: any) => s.participantType === 'CARTEIRO').length;
      const destinatarioCount = sessoes.filter((s: any) => s.participantType === 'DESTINATARIO').length;
      const taxaBot = sessoesAtivas > 0
        ? Math.round((sessoesBot / sessoesAtivas) * 10000) / 100
        : 0;

      // LLM usage no período
      let llmRequests = 0;
      let llmCostUsd = 0;
      {
        const llmAgg = await db.llmUsageLog.aggregate({
          where: {
            configId: config.id,
            createdAt: { gte: start, lte: end },
          },
          _count: { _all: true },
          _sum: { costUsd: true },
        });
        llmRequests = (llmAgg._count as any)?._all ?? 0;
        llmCostUsd = Math.round(Number(llmAgg._sum?.costUsd ?? 0) * 1000000) / 1000000;
      }

      res.json({
        mensagensEnviadas, mensagensRecebidas,
        entregues, lidas, falhas,
        sessoesAtivas, sessoesBot, sessoesDispatcher,
        motoristaCount, destinatarioCount,
        llmRequests, llmCostUsd, taxaBot,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/admin/llm-config
   * Retorna configuração LLM do WppPilotConfig do tenant
   */
  async getLlmConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({
        where: { unidadeId },
        select: { llmEnabled: true, llmConfig: true },
      });

      if (!config) {
        res.json({ data: { llmEnabled: false, llmConfig: {} } });
        return;
      }

      res.json({ data: { llmEnabled: config.llmEnabled, llmConfig: config.llmConfig || {} } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/comunicacao/admin/llm-config
   * Atualiza configuração LLM do WppPilotConfig
   */
  async updateLlmConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const { llmEnabled, llmConfig } = req.body;

      const existing = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!existing) {
        res.status(404).json({ error: 'WppPilotConfig não encontrado. Configure a instância primeiro.' });
        return;
      }

      const data: Record<string, unknown> = {};
      if (typeof llmEnabled === 'boolean') data.llmEnabled = llmEnabled;
      if (llmConfig !== undefined) data.llmConfig = llmConfig;

      const updated = await db.wppPilotConfig.update({
        where: { unidadeId },
        data,
        select: { llmEnabled: true, llmConfig: true },
      });

      logger.info({ unidadeId, llmEnabled: updated.llmEnabled }, '[COMUNICACAO] LLM config atualizado');
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/admin/llm-config/test
   * Testa a configuração LLM
   */
  async testLlmConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({
        where: { unidadeId },
        select: { llmConfig: true },
      });

      if (!config) {
        res.status(404).json({ data: { success: false, error: 'Config não encontrada' } });
        return;
      }

      const llmConfig = config.llmConfig as Record<string, unknown> | null;
      const provider = (llmConfig?.provider as string) || 'openai';
      const model = (llmConfig?.model as string) || 'gpt-4o-mini';

      // Teste simples de conexão
      try {
        const { wppPilotLlmAdapter } = await import('../services/comunicacao/llm-adapter.service');
        const result = await wppPilotLlmAdapter.processUnmatchedMessage(
          unidadeId, 'Test', 'CARTEIRO', '0', 'Diga "OK" se estiver funcionando.', undefined, undefined,
        );
        if (result) {
          res.json({ data: { success: true, response: result.text, provider, model } });
        } else {
          res.json({ data: { success: false, error: 'LLM não respondeu. Verifique as API keys.' } });
        }
      } catch (testErr: any) {
        res.json({ data: { success: false, error: testErr.message } });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/admin/llm-analytics
   * Retorna analytics de uso LLM (tokens, custo, breakdown por modelo)
   */
  async getLlmAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;

      // Buscar configId via unidadeId
      const wppConfig = await db.wppPilotConfig
        .findFirst({ where: { unidadeId }, select: { id: true } })
        .catch(() => null);

      if (!wppConfig) {
        res.json({
          data: {
            period: { start: '', end: '' },
            totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0,
            byProviderModel: [], daily: [],
          },
        });
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = await db.llmUsageLog.findMany({
        where: {
          configId: wppConfig.id,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          provider: true, model: true,
          inputTokens: true, outputTokens: true,
          costUsd: true, latencyMs: true,
          createdAt: true, success: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Aggregate by provider:model
      const byProviderModel = new Map<string, {
        provider: string; model: string;
        requests: number; inputTokens: number; outputTokens: number;
        costUsd: number; totalLatencyMs: number;
      }>();

      // Aggregate by day
      const dailyMap = new Map<string, { costUsd: number; requests: number }>();

      let totalRequests = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCostUsd = 0;

      for (const log of logs) {
        const key = `${log.provider}:${log.model}`;
        const existing = byProviderModel.get(key) || {
          provider: log.provider, model: log.model,
          requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, totalLatencyMs: 0,
        };
        existing.requests++;
        existing.inputTokens += log.inputTokens;
        existing.outputTokens += log.outputTokens;
        existing.costUsd += Number(log.costUsd);
        existing.totalLatencyMs += log.latencyMs;
        byProviderModel.set(key, existing);

        const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
        const dayEntry = dailyMap.get(dateStr) || { costUsd: 0, requests: 0 };
        dayEntry.costUsd += Number(log.costUsd);
        dayEntry.requests++;
        dailyMap.set(dateStr, dayEntry);

        totalRequests++;
        totalInputTokens += log.inputTokens;
        totalOutputTokens += log.outputTokens;
        totalCostUsd += Number(log.costUsd);
      }

      res.json({
        data: {
          period: { start: thirtyDaysAgo.toISOString(), end: new Date().toISOString() },
          totalRequests,
          totalInputTokens,
          totalOutputTokens,
          totalCostUsd: Math.round(totalCostUsd * 1000000) / 1000000,
          byProviderModel: Array.from(byProviderModel.values()).map((e) => ({
            ...e,
            avgLatencyMs: e.requests > 0 ? Math.round(e.totalLatencyMs / e.requests) : 0,
            costUsd: Math.round(e.costUsd * 1000000) / 1000000,
          })),
          daily: Array.from(dailyMap.entries())
            .map(([date, v]) => ({ date, ...v, costUsd: Math.round(v.costUsd * 1000000) / 1000000 }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ComunicacaoAdminController();
