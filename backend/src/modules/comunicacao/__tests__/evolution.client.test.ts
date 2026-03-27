/**
 * Testes unitários do EvolutionClient
 * Cenários: extração de phone e texto de payloads do webhook
 */
import { EvolutionClient, type EvolutionWebhookPayload } from '../evolution.client';

describe('EvolutionClient', () => {
  // ── extractPhone ───────────────────────────────────────────────────────────

  describe('extractPhone', () => {
    it('remove sufixo @s.whatsapp.net', () => {
      expect(EvolutionClient.extractPhone('5561999999999@s.whatsapp.net')).toBe('5561999999999');
    });

    it('remove sufixo @g.us (grupos)', () => {
      expect(EvolutionClient.extractPhone('120363000000000@g.us')).toBe('120363000000000');
    });

    it('mantém número sem sufixo', () => {
      expect(EvolutionClient.extractPhone('5511987654321')).toBe('5511987654321');
    });
  });

  // ── extractText ───────────────────────────────────────────────────────────

  function makePayload(message: EvolutionWebhookPayload['data']['message']): EvolutionWebhookPayload {
    return {
      event: 'messages.upsert',
      instance: 'piloto_correios',
      data: {
        key: { id: 'msg-1', remoteJid: '5561999999999@s.whatsapp.net', fromMe: false },
        message,
        messageType: 'conversation',
      },
    };
  }

  describe('extractText', () => {
    it('extrai conversation', () => {
      expect(EvolutionClient.extractText(makePayload({ conversation: 'OI' }))).toBe('OI');
    });

    it('extrai extendedTextMessage', () => {
      expect(
        EvolutionClient.extractText(makePayload({ extendedTextMessage: { text: 'olá' } })),
      ).toBe('olá');
    });

    it('extrai caption de imagem', () => {
      expect(EvolutionClient.extractText(makePayload({ imageMessage: { caption: 'foto' } }))).toBe(
        'foto',
      );
    });

    it('retorna string vazia se sem mensagem', () => {
      expect(EvolutionClient.extractText(makePayload(undefined))).toBe('');
    });

    it('retorna string vazia se mensagem sem texto conhecido', () => {
      expect(EvolutionClient.extractText(makePayload({ audioMessage: {} }))).toBe('');
    });
  });
});
