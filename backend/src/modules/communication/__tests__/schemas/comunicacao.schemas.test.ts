import {
  insucessoNotificarSchema,
  proxyStartSchema,
  dispatcherEntrarSchema,
  notifySchema,
  adminConfigSchema,
  adminStatsQuerySchema,
  llmConfigSchema,
} from '../../schemas/comunicacao.schemas';

describe('comunicacao schemas', () => {
  describe('insucessoNotificarSchema', () => {
    it('accepts valid input', () => {
      const result = insucessoNotificarSchema.safeParse({
        pacoteInsucessoId: 'abc123',
        motoristaPhone: '5521999992121',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing pacoteInsucessoId', () => {
      const result = insucessoNotificarSchema.safeParse({
        motoristaPhone: '5521999992121',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty pacoteInsucessoId', () => {
      const result = insucessoNotificarSchema.safeParse({
        pacoteInsucessoId: '',
        motoristaPhone: '5521999992121',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing motoristaPhone', () => {
      const result = insucessoNotificarSchema.safeParse({
        pacoteInsucessoId: 'abc123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('proxyStartSchema', () => {
    it('accepts valid input', () => {
      const result = proxyStartSchema.safeParse({
        motoristaPhone: '5521999992121',
        destinatarioPhone: '5511988881234',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing phones', () => {
      const result = proxyStartSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts optional fields', () => {
      const result = proxyStartSchema.safeParse({
        motoristaPhone: '5521999992121',
        destinatarioPhone: '5511988881234',
        motoristaId: 'mot-1',
        rotaId: 'rota-1',
        pacoteId: 'pac-1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.motoristaId).toBe('mot-1');
      }
    });
  });

  describe('dispatcherEntrarSchema', () => {
    it('accepts valid input', () => {
      const result = dispatcherEntrarSchema.safeParse({
        wppSessionId: 'session-1',
        dispatcherNome: 'John',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing wppSessionId', () => {
      const result = dispatcherEntrarSchema.safeParse({
        dispatcherNome: 'John',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('notifySchema', () => {
    it('accepts valid input', () => {
      const result = notifySchema.safeParse({
        phone: '5521999992121',
        text: 'Hello world',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty phone', () => {
      const result = notifySchema.safeParse({
        phone: '',
        text: 'Hello',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty text', () => {
      const result = notifySchema.safeParse({
        phone: '5521999992121',
        text: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('adminConfigSchema', () => {
    it('accepts valid input with all fields', () => {
      const result = adminConfigSchema.safeParse({
        instanceName: 'my-instance',
        phoneNumber: '5521999992121',
        dspNome: 'MyDSP',
        locale: 'en_US',
        timezone: 'America/New_York',
        botEnabled: false,
        proxyEnabled: false,
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults for optional fields', () => {
      const result = adminConfigSchema.safeParse({
        instanceName: 'my-instance',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locale).toBe('pt_BR');
        expect(result.data.timezone).toBe('America/Sao_Paulo');
        expect(result.data.botEnabled).toBe(true);
        expect(result.data.proxyEnabled).toBe(true);
      }
    });

    it('rejects missing instanceName', () => {
      const result = adminConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('adminStatsQuerySchema', () => {
    it('accepts valid date format', () => {
      const result = adminStatsQuerySchema.safeParse({
        dataInicio: '2026-01-01',
        dataFim: '2026-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (both fields optional)', () => {
      const result = adminStatsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const result = adminStatsQuerySchema.safeParse({
        dataInicio: '01/01/2026',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('llmConfigSchema', () => {
    it('accepts empty object (all fields optional)', () => {
      const result = llmConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts full config', () => {
      const result = llmConfigSchema.safeParse({
        llmEnabled: true,
        llmConfig: { model: 'gpt-4', temperature: 0.7 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid llmEnabled type', () => {
      const result = llmConfigSchema.safeParse({
        llmEnabled: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });
});
