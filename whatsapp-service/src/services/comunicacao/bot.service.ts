/**
 * bot.service.ts
 * Chatbot White-Label com Inteligência em Cascata (Keywords -> Flow JSON -> LLM)
 * Adaptado para taxonomia agnóstica: Driver, Addressee, Pack, Station.
 */
import { db } from '../../types/prisma-extended';
import { wppProxyPilotService } from './proxy-pilot.service';
import { WppPilotSession, wppSessionService } from './session.service';
import { sendAndSave } from './wpp-outbound';
import logger from '../../shared/utils/logger';
import {
  MENU_KW,
  STOP_KW,
  STATUS_KW,
  HANDOFF_KW,
  matchesAny,
} from './keywords';
import { t } from './i18n/messages';
import { getGreeting } from './i18n/greetings';

export const wppBotService = {
  /**
   * Handler principal que decide qual fluxo seguir
   */
  async handleMessage(
    instanceName: string,
    phone: string,
    content: string,
    session: WppPilotSession,
    config: any, // WppPilotConfig vindo do webhook handler
  ): Promise<void> {
    if (session.botSilenciado) return;

    const text = content.trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const { locale, timezone, terminology, organizationName, flowDefinition, customMessages } = config;
    const greeting = getGreeting(locale, timezone);

    // Contexto para o i18n
    const i18nCtx = {
      locale,
      terminology,
      customMessages: customMessages || {},
      orgName: organizationName,
    };

    // ── NÍVEL 1: Comandos Globais de Sistema (Custo Zero) ────────────────
    
    // Encerrar Proxy / Canal Ativo
    if (session.proxySessionId && matchesAny(text, STOP_KW)) {
      await wppProxyPilotService.endSession(session.proxySessionId, 'USER_ENDED');
      await sendAndSave(instanceName, phone, t(i18nCtx, 'close_channel'), 500);
      return;
    }

    // Solicitação de Humano
    if (matchesAny(text, HANDOFF_KW)) {
      const { handoffService } = await import('./handoff.service');
      await handoffService.requestHumanHandoff(
        instanceName, phone, session, config.tenantId, organizationName, content, locale,
      );
      return;
    }

    // Menu Principal
    if (matchesAny(text, MENU_KW)) {
      const menuKey = session.participantType === 'DRIVER' ? 'menu_driver' : 'menu_addressee';
      await sendAndSave(instanceName, phone, t(i18nCtx, menuKey, { greeting }), 500);
      return;
    }

    // ── NÍVEL 2: Fluxo Configurável por Organização (JSON Flow) ──────────
    // Se o usuário digitou um número, verificamos no flowDefinition do banco
    if (/^\d+$/.test(text)) {
      const option = flowDefinition?.[session.participantType]?.[text];
      if (option) {
        await this.executeFlowAction(instanceName, phone, session, option, i18nCtx);
        return;
      }
    }

    // ── NÍVEL 3: Inteligência Generativa (LLM) ──────────────────────────
    // Ativado se não houve match nos níveis acima e LLM está ativo
    if (config.llmEnabled) {
      const llmResponse = await this.tryLlmCascade(config, session, content, phone);
      if (llmResponse) {
        if (llmResponse.escalate) {
          const { handoffService } = await import('./handoff.service');
          await handoffService.requestHumanHandoff(
            instanceName, phone, session, config.tenantId, organizationName, content, locale,
          );
          return;
        }
        await sendAndSave(instanceName, phone, llmResponse.text, 500);
        return;
      }
    }

    // Fallback Final
    await sendAndSave(instanceName, phone, t(i18nCtx, 'not_understood'), 500);
  },

  /**
   * Executa uma ação de fluxo baseada no JSON configurado para o cliente
   */
  async executeFlowAction(
    instanceName: string,
    phone: string,
    session: WppPilotSession,
    action: any,
    i18nCtx: any
  ): Promise<void> {
    const { type, payload } = action;

    switch (type) {
      case 'text':
        await sendAndSave(instanceName, phone, t(i18nCtx, payload), 500);
        break;
      
      case 'status_check':
        // Lógica de busca de status (Pack Status)
        await this.handlePackStatus(instanceName, phone, session, i18nCtx);
        break;

      case 'driver_route':
        // Lógica de rota do motorista
        await this.handleDriverRoute(instanceName, phone, session, i18nCtx);
        break;

      default:
        await sendAndSave(instanceName, phone, t(i18nCtx, 'not_understood'), 500);
    }
  },

  /**
   * Nível 3 da Cascata: LLM Generativo com Contexto
   */
  async tryLlmCascade(
    config: any,
    session: WppPilotSession,
    content: string,
    phone: string
  ): Promise<{ text: string; escalate?: boolean } | null> {
    try {
      const { wppPilotLlmAdapter } = await import('./llm-adapter.service');
      // Passamos a terminologia para o LLM para que ele responda usando os termos corretos do cliente
      return await wppPilotLlmAdapter.processMessage(
        config.tenantId,
        config.organizationName,
        session.participantType,
        phone,
        content,
        {
          driverId: session.driverId,
          packId: session.packId,
          terminology: config.terminology,
          timezone: config.timezone
        }
      );
    } catch (err) {
      logger.error(err, '[WPP-BOT] Falha no nível 3 da cascata (LLM)');
      return null;
    }
  },

  // Handlers de Negócio Genéricos
  
  async handlePackStatus(instanceName: string, phone: string, session: WppPilotSession, i18nCtx: any) {
    // Busca informações do pacote no banco (referência lógica)
    // No futuro, isso pode ser uma chamada de API para o Monolito
    await sendAndSave(instanceName, phone, t(i18nCtx, 'status_detail', { code: session.packId || 'N/A', status: 'Em trânsito' }), 500);
  },

  async handleDriverRoute(instanceName: string, phone: string, session: WppPilotSession, i18nCtx: any) {
    await sendAndSave(instanceName, phone, t(i18nCtx, 'route_summary', { stops: 0, time: '--:--' }), 500);
  }
};
