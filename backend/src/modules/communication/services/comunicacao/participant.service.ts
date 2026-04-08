/**
 * participant.service.ts
 * Identifica se o remetente é motorista ou destinatário
 * Campo de telefone do motorista: Motorista.celular (VarChar 11)
 */
import { db } from '../../types/prisma-extended';
import { normalizePhoneBR } from '../../utils/phone';
import { wppSessionService, WppPilotSession } from './session.service';
import logger from '../../../../shared/utils/logger';

export const participantService = {
  async resolveParticipant(
    instanceName: string,
    phone: string,
    locale = 'pt_BR',
    timezone = 'America/Sao_Paulo',
    dspId?: string,
  ): Promise<WppPilotSession> {
    // 1. Cache Redis — mas ignora cache de UNKNOWN para reavaliar
    const cached = await wppSessionService.get(instanceName, phone);
    if (cached && cached.participantType !== 'UNKNOWN') return cached;

    // 2. Verificar sessão no banco (dispatcher pode estar ativo com Redis expirado)
    const dbSession = await db.wppPilotSession
      .findUnique({
        where: { instanceName_phone: { instanceName, phone } },
      })
      .catch(() => null);

    if (
      dbSession &&
      (dbSession.state === 'DISPATCHER_ACTIVE' || dbSession.botSilenciado)
    ) {
      const session: WppPilotSession = {
        instanceName,
        phone,
        participantType: dbSession.participantType as WppPilotSession['participantType'],
        motoristaId: dbSession.carteiroId ?? undefined,
        state: dbSession.state,
        botSilenciado: dbSession.botSilenciado,
        locale,
        timezone,
        lastActivityAt: Date.now(),
      };
      await wppSessionService.set(session);
      return session;
    }

    const phoneDigits = normalizePhoneBR(phone);

    logger.debug(
      { phone, phoneDigits, dspId },
      '[WPP-PILOT] Resolvendo participante',
    );

    // 3. É carteiro? (buscar via usuario ou wppPilotSession com carteiroId)
    const carteiroWhere: Record<string, unknown> = {
      ativo: true,
    };
    if (dspId) carteiroWhere.unidadeId = dspId;

    const carteiro = await db.carteiro
      .findFirst({
        where: carteiroWhere,
        select: { id: true },
      })
      .catch((err: Error) => {
        logger.error(
          { err: err.message, phoneDigits },
          '[WPP-PILOT] Erro ao buscar carteiro',
        );
        return null;
      });

    if (carteiro) {
      const session: WppPilotSession = {
        instanceName,
        phone,
        participantType: 'CARTEIRO',
        motoristaId: carteiro.id,
        state: 'BOT_ACTIVE',
        locale,
        timezone,
        lastActivityAt: Date.now(),
      };
      await wppSessionService.set(session);
      return session;
    }

    // 4. É destinatário? (Objeto.destinatarioTelefone com status de insucesso)
    const objetoWhere: Record<string, unknown> = {
      destinatarioTelefone: { contains: phoneDigits },
      statusAtual: { in: ['TENTATIVA_SEM_ATENDIMENTO', 'DEVOLVIDO_UNIDADE', 'AGUARDANDO_RETIRADA'] },
    };
    if (dspId) {
      objetoWhere.rota = { unidadeId: dspId };
    }

    const pacote = await db.objeto
      .findFirst({
        where: objetoWhere,
        select: { id: true },
      })
      .catch(() => null);

    if (pacote) {
      const session: WppPilotSession = {
        instanceName,
        phone,
        participantType: 'DESTINATARIO',
        state: 'BOT_ACTIVE',
        locale,
        timezone,
        lastActivityAt: Date.now(),
      };
      await wppSessionService.set(session);
      return session;
    }

    // 5. Desconhecido — NÃO cacheia no Redis para reavaliar na próxima mensagem
    const unknown: WppPilotSession = {
      instanceName,
      phone,
      participantType: 'UNKNOWN',
      state: 'BOT_ACTIVE',
      locale,
      timezone,
      lastActivityAt: Date.now(),
    };
    logger.warn(
      { phone, phoneDigits, dspId },
      '[WPP-PILOT] Participante desconhecido — sem cache',
    );
    return unknown;
  },
};
