/**
 * comunicacao.controller.ts
 * Controller para endpoints operacionais do módulo WPP-PILOT v1.3
 * (insucesso, proxy, conversas, dispatcher, status, notify)
 */
import { NextFunction, Request, Response } from 'express';
import { wppProxyPilotService } from '../services/comunicacao/proxy-pilot.service';
import { insucessoWppService } from '../services/comunicacao/insucesso-wpp.service';
import { dispatcherService } from '../services/comunicacao/dispatcher.service';
import { evolutionClient, EvolutionClient } from '../services/comunicacao/evolution.client';
import { sendAndSave } from '../services/comunicacao/wpp-outbound';
import { db } from '../types/prisma-extended';
import { stripNonDigits } from '../utils/phone';
import logger from '../../../shared/utils/logger';

class ComunicacaoController {
  /**
   * POST /api/comunicacao/insucesso/notificar
   * Trigger chamado pelo backend quando PacoteInsucesso é criado/atualizado
   */
  async insucessoNotificar(req: Request, res: Response, next: NextFunction) {
    try {
      const { pacoteInsucessoId, motoristaPhone, motoristaId, rotaId } = req.body;
      const unidadeId: string = req.user!.unidadeId!;

      if (!pacoteInsucessoId || !motoristaPhone) {
        res.status(400).json({ error: 'pacoteInsucessoId e motoristaPhone são obrigatórios' });
        return;
      }

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config?.connected) {
        res.status(503).json({ error: 'WhatsApp não conectado para este DSP' });
        return;
      }

      const result = await insucessoWppService.iniciarFluxo({
        pacoteInsucessoId,
        instanceName: config.instanceName,
        dspId: unidadeId,
        motoristaId: motoristaId ?? '',
        motoristaPhone: stripNonDigits(motoristaPhone),
        rotaId,
        dspNome: config.unidadeNome,
        locale: config.locale,
        timezone: config.timezone,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/proxy/start
   * Abre canal anônimo motorista ↔ destinatário
   */
  async proxyStart(req: Request, res: Response, next: NextFunction) {
    try {
      const { motoristaPhone, destinatarioPhone, motoristaId, rotaId, pacoteId } = req.body;
      const unidadeId: string = req.user!.unidadeId!;

      if (!motoristaPhone || !destinatarioPhone) {
        res.status(400).json({ error: 'motoristaPhone e destinatarioPhone são obrigatórios' });
        return;
      }

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config?.connected) {
        res.status(503).json({ error: 'WhatsApp não conectado' });
        return;
      }

      const sessionId = await wppProxyPilotService.startSession({
        instanceName: config.instanceName,
        dspId: unidadeId,
        motoristaId: motoristaId ?? '',
        dspNome: config.unidadeNome,
        motoristaPhone: stripNonDigits(motoristaPhone),
        destinatarioPhone: stripNonDigits(destinatarioPhone),
        rotaId,
        pacoteId,
      });

      res.json({ sessionId, ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/proxy/:sessionId/end
   */
  async proxyEnd(req: Request, res: Response, next: NextFunction) {
    try {
      await wppProxyPilotService.endSession(req.params.sessionId as string, 'GESTOR_ENDED');
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/proxy/sessions
   */
  async proxySessions(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.json([]); return; }

      const sessions = await db.wppProxyPilotSession.findMany({
        where: { instanceName: config.instanceName, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/conversas
   * Lista conversas com atividade nas últimas 24h
   */
  async listarConversas(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const conversas = await dispatcherService.listarConversasAtivas(unidadeId);
      res.json(conversas);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/conversas/:sessionId/mensagens
   * Histórico completo (bot + dispatcher mesclados)
   */
  async getMensagensConversa(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt((req.query.limit as string) ?? '50') || 50;
      const msgs = await dispatcherService.getMensagensConversa(req.params.sessionId as string, limit);
      res.json(msgs);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/dispatcher/entrar
   */
  async dispatcherEntrar(req: Request, res: Response, next: NextFunction) {
    try {
      const { wppSessionId, dispatcherNome, dispatcherId } = req.body;
      const unidadeId: string = req.user!.unidadeId!;

      if (!wppSessionId || !dispatcherNome) {
        res.status(400).json({ error: 'wppSessionId e dispatcherNome são obrigatórios' });
        return;
      }

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.status(404).json({ error: 'Config WPP não encontrada' }); return; }

      const result = await dispatcherService.entrarConversa({
        wppSessionId,
        instanceName: config.instanceName,
        dispatcherId: dispatcherId ?? (req as any).user?.id ?? 'unknown',
        dispatcherNome,
        dspId: unidadeId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/dispatcher/:dispatcherSessionId/mensagem
   */
  async dispatcherMensagem(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = req.body;
      const unidadeId: string = req.user!.unidadeId!;

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.status(404).json({ error: 'Config WPP não encontrada' }); return; }

      await dispatcherService.enviarMensagem({
        dispatcherSessionId: req.params.dispatcherSessionId as string,
        content,
        instanceName: config.instanceName,
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/dispatcher/:dispatcherSessionId/sair
   */
  async dispatcherSair(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.status(404).json({ error: 'Config WPP não encontrada' }); return; }

      await dispatcherService.sairConversa({
        dispatcherSessionId: req.params.dispatcherSessionId as string,
        instanceName: config.instanceName,
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comunicacao/status
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const unidadeId: string = req.user!.unidadeId!;
      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config) { res.json({ connected: false, instanceName: null }); return; }

      const state = await evolutionClient.getConnectionState(config.instanceName).catch(() => 'error');
      res.json({ connected: state === 'open', state, instanceName: config.instanceName });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comunicacao/notify
   * Envio proativo de notificação WhatsApp para qualquer número
   */
  async notify(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, text } = req.body;
      const unidadeId: string = req.user!.unidadeId!;

      const config = await db.wppPilotConfig.findFirst({ where: { unidadeId } });
      if (!config?.connected) { res.status(503).json({ error: 'WhatsApp não conectado' }); return; }

      const cleanPhone = EvolutionClient.normalizePhone(phone);
      const msgId = await sendAndSave(config.instanceName, cleanPhone, text);

      res.json({ messageId: msgId });
    } catch (error) {
      next(error);
    }
  }
}

export default new ComunicacaoController();
