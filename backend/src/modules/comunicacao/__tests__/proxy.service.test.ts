/**
 * Testes unitários do PilotProxyService
 * Cenários: iniciar sessão, relay, encerrar sessão
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

// Mock do Prisma
const mockPrisma = {
  pilotProxySession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  pilotWaConfig: {
    findUnique: jest.fn(),
  },
  pilotProxyAudit: {
    create: jest.fn(),
  },
};
jest.mock('../../../shared/utils/prisma', () => ({ prisma: mockPrisma }));

// Mock do evolutionClient
const mockSendText = jest.fn().mockResolvedValue('msg-id-123');
jest.mock('../evolution.client', () => ({
  evolutionClient: { sendText: mockSendText },
}));

// Mock do pilotSessionService
const mockSessionUpdate = jest.fn().mockResolvedValue(null);
jest.mock('../session.service', () => ({
  pilotSessionService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    update: mockSessionUpdate,
  },
}));

// Setar PROXY_ENCRYPTION_KEY para testes (64 hex chars = 32 bytes)
process.env.PROXY_ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

import { PilotProxyService } from '../proxy.service';

const INSTANCE = 'piloto_test';
const CARTEIRO_PHONE = '5561911111111';
const DEST_PHONE = '5561922222222';

describe('PilotProxyService', () => {
  let svc: PilotProxyService;

  const mockConfig = {
    instanceName: INSTANCE,
    proxyEnabled: true,
    maxProxyHours: 4,
    maxProxyMessages: 50,
  };

  const mockSession = {
    id: 'proxy-session-1',
    instanceName: INSTANCE,
    carteiroPhone: CARTEIRO_PHONE,
    status: 'ACTIVE',
    messageCount: 0,
    expiresAt: new Date(Date.now() + 4 * 3_600_000),
    destinatarioPhoneEnc: '', // será preenchido
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new PilotProxyService();
  });

  // ── startSession ────────────────────────────────────────────────────────────

  describe('startSession', () => {
    it('cria nova sessão e notifica participantes', async () => {
      mockPrisma.pilotProxySession.findFirst.mockResolvedValue(null);
      mockPrisma.pilotWaConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.pilotProxySession.create.mockResolvedValue({ ...mockSession, id: 'new-session' });

      const sessionId = await svc.startSession({
        instanceName: INSTANCE,
        carteiroId: 'carteiro-1',
        carteiroPhone: CARTEIRO_PHONE,
        destinatarioPhone: DEST_PHONE,
      });

      expect(sessionId).toBe('new-session');
      expect(mockPrisma.pilotProxySession.create).toHaveBeenCalledTimes(1);
      // Deve notificar os dois participantes
      expect(mockSendText).toHaveBeenCalledTimes(2);
    });

    it('retorna sessão existente se já há proxy ativo para o carteiro', async () => {
      mockPrisma.pilotProxySession.findFirst.mockResolvedValue({ id: 'existing-session' });

      const sessionId = await svc.startSession({
        instanceName: INSTANCE,
        carteiroId: 'carteiro-1',
        carteiroPhone: CARTEIRO_PHONE,
        destinatarioPhone: DEST_PHONE,
      });

      expect(sessionId).toBe('existing-session');
      expect(mockPrisma.pilotProxySession.create).not.toHaveBeenCalled();
    });

    it('lança erro se proxy desabilitado na config', async () => {
      mockPrisma.pilotProxySession.findFirst.mockResolvedValue(null);
      mockPrisma.pilotWaConfig.findUnique.mockResolvedValue({ ...mockConfig, proxyEnabled: false });

      await expect(
        svc.startSession({
          instanceName: INSTANCE,
          carteiroId: 'carteiro-1',
          carteiroPhone: CARTEIRO_PHONE,
          destinatarioPhone: DEST_PHONE,
        }),
      ).rejects.toThrow('Proxy desabilitado');
    });
  });

  // ── endSession ──────────────────────────────────────────────────────────────

  describe('endSession', () => {
    it('não faz nada se sessão não encontrada', async () => {
      mockPrisma.pilotProxySession.findUnique.mockResolvedValue(null);
      await svc.endSession('nao-existe', 'TIMEOUT');
      expect(mockPrisma.pilotProxySession.update).not.toHaveBeenCalled();
    });

    it('não faz nada se sessão já encerrada', async () => {
      mockPrisma.pilotProxySession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'ENDED',
      });
      await svc.endSession('proxy-session-1', 'TIMEOUT');
      expect(mockPrisma.pilotProxySession.update).not.toHaveBeenCalled();
    });
  });

  // ── relayMessage ────────────────────────────────────────────────────────────

  describe('relayMessage', () => {
    it('não faz relay se sessão não encontrada', async () => {
      mockPrisma.pilotProxySession.findUnique.mockResolvedValue(null);
      await svc.relayMessage(INSTANCE, CARTEIRO_PHONE, 'oi', 'proxy-nao-existe');
      expect(mockSendText).not.toHaveBeenCalled();
    });

    it('encerra por TIMEOUT se sessão expirada', async () => {
      mockPrisma.pilotProxySession.findUnique.mockResolvedValue({
        ...mockSession,
        destinatarioPhoneEnc: svc['encrypt'](DEST_PHONE),
        expiresAt: new Date(Date.now() - 1000), // expirada
      });
      mockPrisma.pilotWaConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.pilotProxySession.update.mockResolvedValue({});

      await svc.relayMessage(INSTANCE, CARTEIRO_PHONE, 'teste', 'proxy-session-1');

      expect(mockPrisma.pilotProxySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endReason: 'TIMEOUT' }),
        }),
      );
    });
  });

  // ── criptografia ────────────────────────────────────────────────────────────

  describe('encrypt/decrypt', () => {
    it('round-trip preserva o número original', () => {
      const original = '5561922222222';
      const encrypted = svc['encrypt'](original);
      expect(encrypted).toContain(':');
      expect(svc['decrypt'](encrypted)).toBe(original);
    });

    it('gera IVs diferentes a cada chamada', () => {
      const enc1 = svc['encrypt']('5561922222222');
      const enc2 = svc['encrypt']('5561922222222');
      expect(enc1).not.toBe(enc2);
    });
  });
});
