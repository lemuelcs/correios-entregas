import { createHmac } from 'crypto';
import { assinarCorpo, verificarAssinatura } from '../assinatura';

const SEGREDO = 's3cr3t-s3cr3t-16';
const corpo = Buffer.from('{"a":1}');
const hmac = (c: Buffer | string, s = SEGREDO) => createHmac('sha256', s).update(c).digest('hex');

describe('verificarAssinatura', () => {
  it('UT-075: aceita sha256=<hmac correto> do corpo cru', () => {
    expect(verificarAssinatura(corpo, `sha256=${hmac(corpo)}`, SEGREDO)).toBe(true);
    expect(verificarAssinatura(corpo, assinarCorpo(corpo, SEGREDO), SEGREDO)).toBe(true);
    // hex em maiúsculas continua válido
    expect(verificarAssinatura(corpo, `sha256=${hmac(corpo).toUpperCase()}`, SEGREDO)).toBe(true);
  });

  it('UT-076: assinatura de outro corpo (ou outro segredo) → false', () => {
    expect(verificarAssinatura(corpo, `sha256=${hmac('{"a":2}')}`, SEGREDO)).toBe(false);
    expect(verificarAssinatura(Buffer.from('{"a": 1}'), `sha256=${hmac(corpo)}`, SEGREDO)).toBe(false);
    expect(verificarAssinatura(corpo, `sha256=${hmac(corpo, 'outro-segredo-qualquer')}`, SEGREDO)).toBe(false);
  });

  it('UT-077: header sem prefixo, hex de tamanho errado ou malformado → false, sem exceção', () => {
    const certo = hmac(corpo);
    const casos: unknown[] = [
      certo, // sem o prefixo
      `sha1=${certo}`,
      `sha256=${certo.slice(0, 62)}`, // curto
      `sha256=${certo}00`, // longo
      `sha256=${'z'.repeat(64)}`, // não é hex
      'sha256=',
      '',
      undefined,
      null,
      42,
    ];
    for (const header of casos) {
      expect(() => verificarAssinatura(corpo, header as string, SEGREDO)).not.toThrow();
      expect(verificarAssinatura(corpo, header as string, SEGREDO)).toBe(false);
    }
    expect(verificarAssinatura(corpo, `sha256=${certo}`, '')).toBe(false);
    expect(verificarAssinatura('{"a":1}' as unknown as Buffer, `sha256=${certo}`, SEGREDO)).toBe(false);
  });
});
