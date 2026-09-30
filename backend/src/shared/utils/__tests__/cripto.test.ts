import { carregarChave, cifrar, CriptoErro, decifrar } from '../cripto';

const CHAVE = carregarChave({ ENTREGAS_CRYPTO_KEY: 'a'.repeat(64) });

describe('cripto', () => {
  it('UT-011 decifra o que cifrou, com IV aleatório', () => {
    const a = cifrar('psk_live_abc', CHAVE);
    const b = cifrar('psk_live_abc', CHAVE);
    expect(decifrar(a, CHAVE)).toBe('psk_live_abc');
    expect(a).not.toBe(b);
  });

  it('UT-012 um byte alterado no texto cifrado falha a integridade', () => {
    const [versao, iv, tag, dados] = cifrar('psk_live_abc', CHAVE).split(':');
    const bytes = Buffer.from(dados, 'base64');
    bytes[0] ^= 0x01;
    const adulterado = [versao, iv, tag, bytes.toString('base64')].join(':');

    expect(() => decifrar(adulterado, CHAVE)).toThrow(CriptoErro);
    try {
      decifrar(adulterado, CHAVE);
    } catch (err) {
      expect((err as CriptoErro).codigo).toBe('integridade');
    }
  });

  it.each([
    ['ausente', {}],
    ['vazia', { ENTREGAS_CRYPTO_KEY: '' }],
    ['com menos de 32 bytes', { ENTREGAS_CRYPTO_KEY: 'curta-demais' }],
  ])('UT-013 ENTREGAS_CRYPTO_KEY %s faz carregarChave() lançar', (_caso, env) => {
    expect(() => carregarChave(env as NodeJS.ProcessEnv)).toThrow(CriptoErro);
  });

  it('carregarChave aceita hex, base64 de 32 bytes e texto longo', () => {
    expect(carregarChave({ ENTREGAS_CRYPTO_KEY: 'ab'.repeat(32) })).toHaveLength(32);
    expect(carregarChave({ ENTREGAS_CRYPTO_KEY: Buffer.alloc(32, 7).toString('base64') })).toHaveLength(32);
    expect(carregarChave({ ENTREGAS_CRYPTO_KEY: 'x'.repeat(40) })).toHaveLength(32);
  });
});
