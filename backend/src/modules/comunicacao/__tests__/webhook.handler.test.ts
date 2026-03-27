/**
 * Testes unitários do webhook handler
 * Cenários: ignorar fromMe, grupos, opt-out, roteamento por tipo de participante
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  })),
);

const mockPrisma = {
  pilotWaConfig: { findUnique: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({}) },
  pilotWaSession: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ id: 'session-db-1' }),
  },
  pilotWaMessage: { create: jest.fn().mockResolvedValue({}) },
};
jest.mock('../../../shared/utils/prisma', () => ({ prisma: mockPrisma }));

const mockSendText = jest.fn().mockResolvedValue('');
const mockMarkAsRead = jest.fn().mockResolvedValue(undefined);
jest.mock('../evolution.client', () => ({
  EvolutionClient: {
    extractPhone: jest.requireActual('../evolution.client').EvolutionClient.extractPhone,
    extractText: jest.requireActual('../evolution.client').EvolutionClient.extractText,
  },
  evolutionClient: { sendText: mockSendText, markAsRead: mockMarkAsRead },
}));

const mockResolveParticipant = jest.fn();
jest.mock('../participant.service', () => ({
  participantService: { resolveParticipant: mockResolveParticipant },
}));

const mockRelayMessage = jest.fn().mockResolvedValue(undefined);
jest.mock('../proxy.service', () => ({
  pilotProxyService: { relayMessage: mockRelayMessage },
}));

const mockHandleCarteiro = jest.fn().mockResolvedValue(undefined);
const mockHandleDestinatario = jest.fn().mockResolvedValue(undefined);
const mockHandleUnknown = jest.fn().mockResolvedValue(undefined);
jest.mock('../bot.service', () => ({
  pilotBotService: {
    handleCarteiro: mockHandleCarteiro,
    handleDestinatario: mockHandleDestinatario,
    handleUnknown: mockHandleUnknown,
  },
}));

const mockPilotSessionService = {
  get: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(null),
};
jest.mock('../session.service', () => ({
  pilotSessionService: mockPilotSessionService,
}));

import { handleInboundWebhook } from '../webhook.handler';
import type { Request, Response } from 'express';

function makeReq(overrides: Partial<any> = {}): Request {
  return {
    headers: {},
    body: {
      event: 'messages.upsert',
      instance: 'piloto_test',
      data: {
        key: { id: 'msg-1', remoteJid: '5561999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'OI' },
        messageType: 'conversation',
      },
      ...overrides,
    },
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('handleInboundWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
  });

  it('responde 200 imediatamente', async () => {
    mockResolveParticipant.mockResolvedValue({
      instanceName: 'piloto_test',
      phone: '5561999999999',
      participantType: 'UNKNOWN',
      state: 'BOT_ACTIVE',
      lastActivityAt: Date.now(),
    });
    const req = makeReq();
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('ignora evento que não é messages.upsert', async () => {
    const req = makeReq();
    req.body.event = 'connection.update';
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockResolveParticipant).not.toHaveBeenCalled();
  });

  it('ignora mensagem enviada por nós (fromMe=true)', async () => {
    const req = makeReq();
    req.body.data.key.fromMe = true;
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockResolveParticipant).not.toHaveBeenCalled();
  });

  it('ignora mensagem de grupo (@g.us)', async () => {
    const req = makeReq();
    req.body.data.key.remoteJid = '120363000000000@g.us';
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockResolveParticipant).not.toHaveBeenCalled();
  });

  it('roteia CARTEIRO para handleCarteiro', async () => {
    mockResolveParticipant.mockResolvedValue({
      instanceName: 'piloto_test',
      phone: '5561999999999',
      participantType: 'CARTEIRO',
      state: 'BOT_ACTIVE',
      lastActivityAt: Date.now(),
    });
    const req = makeReq();
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockHandleCarteiro).toHaveBeenCalledTimes(1);
    expect(mockHandleDestinatario).not.toHaveBeenCalled();
  });

  it('roteia DESTINATARIO para handleDestinatario', async () => {
    mockResolveParticipant.mockResolvedValue({
      instanceName: 'piloto_test',
      phone: '5561999999999',
      participantType: 'DESTINATARIO',
      state: 'BOT_ACTIVE',
      lastActivityAt: Date.now(),
    });
    const req = makeReq();
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockHandleDestinatario).toHaveBeenCalledTimes(1);
    expect(mockHandleCarteiro).not.toHaveBeenCalled();
  });

  it('roteia UNKNOWN para handleUnknown', async () => {
    mockResolveParticipant.mockResolvedValue({
      instanceName: 'piloto_test',
      phone: '5561999999999',
      participantType: 'UNKNOWN',
      state: 'BOT_ACTIVE',
      lastActivityAt: Date.now(),
    });
    const req = makeReq();
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockHandleUnknown).toHaveBeenCalledTimes(1);
  });

  it('faz relay quando participante está em PROXY_ACTIVE', async () => {
    mockResolveParticipant.mockResolvedValue({
      instanceName: 'piloto_test',
      phone: '5561999999999',
      participantType: 'CARTEIRO',
      state: 'PROXY_ACTIVE',
      proxySessionId: 'proxy-abc',
      lastActivityAt: Date.now(),
    });
    const req = makeReq();
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockRelayMessage).toHaveBeenCalledWith('piloto_test', '5561999999999', 'OI', 'proxy-abc');
    expect(mockHandleCarteiro).not.toHaveBeenCalled();
  });

  it('trata opt-out: envia confirmação e para o processamento', async () => {
    mockPrisma.pilotWaConfig.findUnique.mockResolvedValue({
      instanceName: 'piloto_test',
      optOutKeywords: ['PARAR', 'STOP'],
    });
    const req = makeReq();
    req.body.data.message.conversation = 'PARAR';
    const res = makeRes();
    await handleInboundWebhook(req, res);
    expect(mockPilotSessionService.update).toHaveBeenCalledWith(
      'piloto_test',
      '5561999999999',
      { state: 'OPTED_OUT' },
    );
    expect(mockSendText).toHaveBeenCalledTimes(1);
    expect(mockResolveParticipant).not.toHaveBeenCalled();
  });
});
