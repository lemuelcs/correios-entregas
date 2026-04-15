/**
 * participant.service.ts
 * Identifica se o remetente é carteiro ou destinatário.
 * Em arquitetura de microserviços, este serviço consulta o banco LOCAL do whatsapp-service.
 * A identificação inicial (primeira mensagem) pode ser feita via consulta ao Monolito (API) 
 * ou via Webhook de provisão de dados.
 */
import { db } from '../../types/prisma-extended';
import { wppSessionService, WppPilotSession } from './session.service';
import logger from '../../shared/utils/logger';

export const participantService = {
  async resolveParticipant(
    instanceName: string,
    phone: string,
    locale = 'pt_BR',
    timezone = 'America/Sao_Paulo',
    unidadeId?: string,
  ): Promise<WppPilotSession> {
    // 1. Tenta buscar no cache Redis primeiro
    const cached = await wppSessionService.get(instanceName, phone);
    if (cached && cached.participantType !== 'UNKNOWN') {
      return cached;
    }

    // 2. Tenta buscar na sessão persistida no banco local (correios_whatsapp_db)
    const dbSession = await db.wppPilotSession.findUnique({
      where: { instanceName_phone: { instanceName, phone } },
    }).catch(() => null);

    if (dbSession) {
      const session: WppPilotSession = {
        instanceName,
        phone,
        participantType: dbSession.participantType as WppPilotSession['participantType'],
        unidadeId: dbSession.unidadeId ?? undefined,
        objetoId: dbSession.objetoId ?? undefined,
        motoristaId: dbSession.carteiroId ?? undefined,
        state: dbSession.state,
        botSilenciado: dbSession.botSilenciado,
        locale,
        timezone,
        lastActivityAt: Date.now(),
      };

      // Atualiza o cache Redis
      await wppSessionService.set(session);
      return session;
    }

    // 3. Se não encontrou localmente, retorna UNKNOWN.
    // TODO: Em produção, aqui dispararíamos uma chamada ao Monolito: 
    // GET http://backend:3002/api/v1/internal/identify-participant?phone=...
    
    const unknown: WppPilotSession = {
      instanceName,
      phone,
      participantType: 'UNKNOWN',
      state: 'BOT_ACTIVE',
      locale,
      timezone,
      lastActivityAt: Date.now(),
    };

    logger.debug({ phone, instanceName }, '[WPP-PILOT] Participante não identificado localmente');
    return unknown;
  },

  /**
   * Método para o Monolito (ou outros serviços) provisionar uma sessão
   * Ex: Quando um carteiro loga no app, o monolito avisa o whatsapp-service.
   */
  async provisionSession(sessionData: Partial<WppPilotSession> & { phone: string, instanceName: string }): Promise<void> {
    const session: WppPilotSession = {
      instanceName: sessionData.instanceName,
      phone: sessionData.phone,
      participantType: sessionData.participantType || 'UNKNOWN',
      unidadeId: sessionData.unidadeId,
      objetoId: sessionData.objetoId,
      motoristaId: sessionData.motoristaId,
      state: sessionData.state || 'BOT_ACTIVE',
      locale: sessionData.locale || 'pt_BR',
      timezone: sessionData.timezone || 'America/Sao_Paulo',
      lastActivityAt: Date.now(),
    };

    await db.wppPilotSession.upsert({
      where: { instanceName_phone: { instanceName: session.instanceName, phone: session.phone } },
      create: {
        instanceName: session.instanceName,
        phone: session.phone,
        participantType: session.participantType,
        unidadeId: session.unidadeId,
        objetoId: session.objetoId,
        carteiroId: session.motoristaId,
        state: session.state,
      },
      update: {
        participantType: session.participantType,
        unidadeId: session.unidadeId,
        objetoId: session.objetoId,
        carteiroId: session.motoristaId,
      }
    });

    await wppSessionService.set(session);
  }
};
