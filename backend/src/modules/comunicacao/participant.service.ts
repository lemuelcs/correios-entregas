import { prisma } from '../../shared/utils/prisma';
import { type WaPilotSession, pilotSessionService } from './session.service';

export class ParticipantService {
  /**
   * Resolve quem é o remetente. Ordem:
   * 1. Sessão Redis (rápido)
   * 2. Carteiro.telefonePiloto no banco
   * 3. Objeto.destinatarioTelefone no banco
   * 4. UNKNOWN
   */
  async resolveParticipant(instanceName: string, phone: string): Promise<WaPilotSession> {
    // 1. Cache Redis
    const cached = await pilotSessionService.get(instanceName, phone);
    if (cached) return cached;

    // 2. É carteiro?
    const carteiro = await prisma.carteiro.findFirst({
      where: { telefonePiloto: phone, ativo: true },
    });

    if (carteiro) {
      const session: WaPilotSession = {
        instanceName,
        phone,
        participantType: 'CARTEIRO',
        carteiroId: carteiro.id,
        state: 'BOT_ACTIVE',
        lastActivityAt: Date.now(),
      };
      await pilotSessionService.set(session);
      return session;
    }

    // 3. É destinatário com objeto ativo?
    const objeto = await prisma.objeto.findFirst({
      where: {
        destinatarioTelefone: { contains: phone.slice(-11) },
        statusAtual: {
          in: [
            'COLETADO_CARTEIRO',
            'EM_ROTA',
            'TENTATIVA_SEM_ATENDIMENTO',
            'DEVOLVIDO_UNIDADE',
            'AGUARDANDO_RETIRADA',
          ],
        },
      },
    });

    if (objeto) {
      const session: WaPilotSession = {
        instanceName,
        phone,
        participantType: 'DESTINATARIO',
        state: 'BOT_ACTIVE',
        lastActivityAt: Date.now(),
      };
      await pilotSessionService.set(session);
      return session;
    }

    // 4. Desconhecido
    const unknown: WaPilotSession = {
      instanceName,
      phone,
      participantType: 'UNKNOWN',
      state: 'BOT_ACTIVE',
      lastActivityAt: Date.now(),
    };
    await pilotSessionService.set(unknown);
    return unknown;
  }
}

export const participantService = new ParticipantService();
