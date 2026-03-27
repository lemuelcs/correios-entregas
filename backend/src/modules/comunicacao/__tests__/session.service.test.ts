/**
 * Testes unitários do PilotSessionService
 * Redis mockado – testa a lógica de TTL e namespace de chaves
 */
import type { WaPilotSession } from '../session.service';

// Mock ioredis antes de importar o serviço
const mockGet = jest.fn();
const mockSetex = jest.fn();
const mockDel = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    setex: mockSetex,
    del: mockDel,
    on: jest.fn(),
  }));
});

// Importar após mock
import { PilotSessionService } from '../session.service';

const INSTANCE = 'piloto_test';
const PHONE = '5561999999999';

function makeSession(overrides: Partial<WaPilotSession> = {}): WaPilotSession {
  return {
    instanceName: INSTANCE,
    phone: PHONE,
    participantType: 'CARTEIRO',
    state: 'BOT_ACTIVE',
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

describe('PilotSessionService', () => {
  let svc: PilotSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new PilotSessionService();
  });

  describe('get', () => {
    it('retorna null quando não existe no Redis', async () => {
      mockGet.mockResolvedValue(null);
      const result = await svc.get(INSTANCE, PHONE);
      expect(result).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(`pilot:${INSTANCE}:session:${PHONE}`);
    });

    it('retorna sessão parseada quando existe', async () => {
      const session = makeSession();
      mockGet.mockResolvedValue(JSON.stringify(session));
      const result = await svc.get(INSTANCE, PHONE);
      expect(result?.participantType).toBe('CARTEIRO');
      expect(result?.state).toBe('BOT_ACTIVE');
    });
  });

  describe('set', () => {
    it('usa TTL de 24h para CARTEIRO', async () => {
      mockSetex.mockResolvedValue('OK');
      await svc.set(makeSession({ participantType: 'CARTEIRO' }));
      expect(mockSetex).toHaveBeenCalledWith(
        expect.stringContaining(PHONE),
        86_400,
        expect.any(String),
      );
    });

    it('usa TTL de 4h para DESTINATARIO', async () => {
      mockSetex.mockResolvedValue('OK');
      await svc.set(makeSession({ participantType: 'DESTINATARIO' }));
      expect(mockSetex).toHaveBeenCalledWith(
        expect.stringContaining(PHONE),
        14_400,
        expect.any(String),
      );
    });

    it('atualiza lastActivityAt no momento do set', async () => {
      mockSetex.mockResolvedValue('OK');
      const before = Date.now();
      const session = makeSession({ lastActivityAt: 0 });
      await svc.set(session);
      expect(session.lastActivityAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('update', () => {
    it('retorna null quando sessão não existe', async () => {
      mockGet.mockResolvedValue(null);
      const result = await svc.update(INSTANCE, PHONE, { state: 'PROXY_ACTIVE' });
      expect(result).toBeNull();
    });

    it('faz merge e persiste a sessão atualizada', async () => {
      const original = makeSession({ state: 'BOT_ACTIVE' });
      mockGet.mockResolvedValue(JSON.stringify(original));
      mockSetex.mockResolvedValue('OK');

      const updated = await svc.update(INSTANCE, PHONE, {
        state: 'PROXY_ACTIVE',
        proxySessionId: 'proxy-abc',
      });

      expect(updated?.state).toBe('PROXY_ACTIVE');
      expect(updated?.proxySessionId).toBe('proxy-abc');
      // Campos não alterados devem permanecer
      expect(updated?.participantType).toBe('CARTEIRO');
    });
  });

  describe('delete', () => {
    it('chama del com a chave correta', async () => {
      mockDel.mockResolvedValue(1);
      await svc.delete(INSTANCE, PHONE);
      expect(mockDel).toHaveBeenCalledWith(`pilot:${INSTANCE}:session:${PHONE}`);
    });
  });
});
