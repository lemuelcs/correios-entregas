/**
 * bot.service.ts – Respostas automáticas por árvore de decisão (piloto sem LLM).
 * Para produção: substituir pelos calls ao LlmService do M13 completo.
 */
import { prisma } from '../../shared/utils/prisma';
import { evolutionClient } from './evolution.client';
import { pilotProxyService } from './proxy.service';
import { type WaPilotSession } from './session.service';

export class PilotBotService {
  // ── Carteiro ─────────────────────────────────────────────────────────────

  async handleCarteiro(
    instanceName: string,
    phone: string,
    content: string,
    session: WaPilotSession,
  ): Promise<void> {
    const text = content.trim().toUpperCase();

    // Encerrar proxy ativo
    if (session.proxySessionId && (text === 'ENCERRAR' || text === 'FIM')) {
      await pilotProxyService.endSession(session.proxySessionId, 'CARTEIRO_ENDED');
      return;
    }

    if (['OI', 'OLÁ', 'OLA', 'MENU', 'AJUDA'].includes(text)) {
      await evolutionClient.sendText(instanceName, { number: phone, text: this.menuCarteiro(), delay: 500 });
      return;
    }

    if (text === '1' || text.includes('ROTA')) {
      await this.rotaCarteiro(instanceName, phone, session);
      return;
    }

    if (text === '2' || text.includes('INSUCESSO')) {
      await this.insucessosCarteiro(instanceName, phone, session);
      return;
    }

    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: 'Não entendi. Envie *MENU* para ver as opções disponíveis.',
      delay: 500,
    });
  }

  // ── Destinatário ──────────────────────────────────────────────────────────

  async handleDestinatario(
    instanceName: string,
    phone: string,
    content: string,
    _session: WaPilotSession,
  ): Promise<void> {
    const text = content.trim().toUpperCase();

    if (['OI', 'OLÁ', 'OLA', 'MENU', 'AJUDA'].includes(text)) {
      await evolutionClient.sendText(instanceName, { number: phone, text: this.menuDestinatario(), delay: 500 });
      return;
    }

    if (text === '1' || text.includes('RASTREAR') || text.includes('STATUS')) {
      await this.statusDestinatario(instanceName, phone);
      return;
    }

    if (text === '2' || text.includes('REAGENDAR')) {
      await evolutionClient.sendText(instanceName, {
        number: phone,
        text: 'Para reagendar sua entrega, acesse o app Correios ou ligue 0800 725 0100.',
        delay: 500,
      });
      return;
    }

    const nota = parseInt(text, 10);
    if (!isNaN(nota) && nota >= 1 && nota <= 10) {
      await this.registrarNps(instanceName, phone, nota);
      return;
    }

    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: 'Não entendi. Envie *MENU* para ver as opções.',
      delay: 500,
    });
  }

  // ── Participante desconhecido ─────────────────────────────────────────────

  async handleUnknown(instanceName: string, phone: string): Promise<void> {
    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: '*Correios Entregas*\n\nNão identificamos seu cadastro.\nSe você é destinatário, acesse o app Correios para rastreamento.\nSe você é carteiro, confirme seu número junto à unidade.',
      delay: 500,
    });
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  private menuCarteiro(): string {
    return '*Assistente do Carteiro*\n\nOlá! Escolha uma opção:\n\n*1* – Ver rota do dia\n*2* – Insucessos pendentes\n\nOu envie sua dúvida em texto.';
  }

  private menuDestinatario(): string {
    return '*Correios Entregas*\n\nOlá! Como posso ajudar?\n\n*1* – Status da minha encomenda\n*2* – Reagendar entrega\n\nApós receber, envie uma *nota de 1 a 10* para avaliar a entrega.';
  }

  // ── Rota do carteiro ──────────────────────────────────────────────────────

  private async rotaCarteiro(
    instanceName: string,
    phone: string,
    session: WaPilotSession,
  ): Promise<void> {
    if (!session.carteiroId) {
      await evolutionClient.sendText(instanceName, {
        number: phone,
        text: 'Não consegui identificar sua matrícula. Consulte a unidade.',
        delay: 500,
      });
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const rota = await prisma.rota.findFirst({
      where: {
        carteiroId: session.carteiroId,
        createdAt: { gte: hoje },
        statusAtual: { in: ['CRIADA', 'DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO'] },
      },
    });

    if (!rota) {
      await evolutionClient.sendText(instanceName, {
        number: phone,
        text: 'Nenhuma rota atribuída para hoje ainda. Verifique mais tarde ou consulte o gestor.',
        delay: 500,
      });
      return;
    }

    const horario = rota.horarioDespachoAlvo
      ? new Date(rota.horarioDespachoAlvo).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
      : 'a confirmar';

    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: `*Sua rota de hoje*\n\nCódigo: ${rota.codigo}\nObjetos: ${rota.totalObjetos}\nDespacho: ${horario}\nPosição: ${rota.posicaoEstacao ?? 'a definir'}\nStatus: ${rota.statusAtual}`,
      delay: 500,
    });
  }

  // ── Insucessos ────────────────────────────────────────────────────────────

  private async insucessosCarteiro(
    instanceName: string,
    phone: string,
    session: WaPilotSession,
  ): Promise<void> {
    if (!session.carteiroId) return;

    const carteiro = await prisma.carteiro.findUnique({ where: { id: session.carteiroId } });
    if (!carteiro) return;

    const count = await prisma.objeto.count({
      where: { unidadeId: carteiro.unidadeId, statusAtual: 'TENTATIVA_SEM_ATENDIMENTO' },
    });

    await evolutionClient.sendText(instanceName, {
      number: phone,
      text:
        count > 0
          ? `Você tem *${count} objeto(s)* com insucesso pendente na sua unidade.\nAcesse o app para verificar e agendar nova tentativa.`
          : 'Nenhum insucesso pendente. Bom trabalho!',
      delay: 500,
    });
  }

  // ── Status do destinatário ────────────────────────────────────────────────

  private async statusDestinatario(instanceName: string, phone: string): Promise<void> {
    const objeto = await prisma.objeto.findFirst({
      where: {
        destinatarioTelefone: { contains: phone.slice(-11) },
        statusAtual: { notIn: ['ENTREGUE', 'DEVOLVIDO_REMETENTE', 'CANCELADO'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { eventos: { orderBy: { ocorridoEm: 'desc' }, take: 1 } },
    });

    if (!objeto) {
      await evolutionClient.sendText(instanceName, {
        number: phone,
        text: 'Não encontrei encomendas ativas vinculadas a este número.\nVerifique o rastreamento no app Correios ou site oficial.',
        delay: 500,
      });
      return;
    }

    const statusLabel: Record<string, string> = {
      AGUARDANDO_CHEGADA: 'Aguardando chegada na unidade',
      RECEBIDO_UNIDADE: 'Recebido na unidade',
      TRIADO: 'Em triagem',
      UNITIZADO: 'Unitizado para entrega',
      DISPONIVEL_COLETA: 'Disponível para coleta',
      COLETADO_CARTEIRO: 'Coletado pelo carteiro',
      EM_ROTA: 'Saiu para entrega hoje!',
      ENTREGUE: 'Entregue',
      TENTATIVA_SEM_ATENDIMENTO: 'Tentativa sem atendimento',
      DEVOLVIDO_UNIDADE: 'Devolvido à unidade',
      AGUARDANDO_RETIRADA: 'Aguardando retirada na agência',
    };

    const status = statusLabel[objeto.statusAtual] ?? objeto.statusAtual;
    const ultimoEvento = objeto.eventos[0];

    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: `*Status da sua encomenda*\n\nRastreio: ${objeto.codigoRastreio}\nStatus: ${status}\nPara: ${objeto.destinatarioNome.split(' ')[0]}${
        ultimoEvento
          ? `\nAtualizado: ${new Date(ultimoEvento.ocorridoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          : ''
      }`,
      delay: 500,
    });
  }

  // ── NPS ───────────────────────────────────────────────────────────────────

  private async registrarNps(instanceName: string, phone: string, nota: number): Promise<void> {
    const objeto = await prisma.objeto.findFirst({
      where: {
        destinatarioTelefone: { contains: phone.slice(-11) },
        statusAtual: 'ENTREGUE',
        nps: { is: null },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!objeto) {
      await evolutionClient.sendText(instanceName, { number: phone, text: 'Obrigado pela avaliação!', delay: 500 });
      return;
    }

    await prisma.npsResposta.create({
      data: {
        objetoId: objeto.id,
        destinatarioId: objeto.destinatarioCpf ?? phone,
        nota,
        categoria: nota >= 9 ? 'PROMOTOR' : nota >= 7 ? 'NEUTRO' : 'DETRATOR',
      },
    });

    const reply =
      nota >= 9
        ? 'Obrigado! Fico feliz que a entrega foi ótima!'
        : nota >= 7
          ? 'Obrigado pela avaliação!'
          : 'Obrigado pelo feedback. Vamos trabalhar para melhorar!';

    await evolutionClient.sendText(instanceName, { number: phone, text: reply, delay: 500 });
  }
}

export const pilotBotService = new PilotBotService();
