import { calculateS10CheckDigit, validateS10 } from '../s10';

describe('s10', () => {
  it('UT-001 calcula o dígito pela regra da UPU e valida um código BR', () => {
    expect(calculateS10CheckDigit('12345678')).toBe(5);
    expect(validateS10('AA123456785BR').valid).toBe(true);
  });

  it.each([
    ['10000002', 5, 'AA100000025BR'], // soma 22, resto 0 -> 5
    ['10000014', 0, 'AA100000140BR'], // resto 1 -> 0
  ])('UT-002 serial %s (resto 0/1) tem dígito %i e %s é válido', (serial, dv, codigo) => {
    expect(calculateS10CheckDigit(serial)).toBe(dv);
    expect(validateS10(codigo).valid).toBe(true);
  });

  it('UT-003 recusa dígito errado', () => {
    expect(validateS10('AB123456789BR')).toEqual(expect.objectContaining({ valid: false }));
  });

  it('UT-004 aceita qualquer país só com a opção qualquerPais', () => {
    expect(validateS10('LB390996032CN', { qualquerPais: true }).valid).toBe(true);
    expect(validateS10('LB390996032CN').valid).toBe(false);
  });

  it('UT-005 normaliza minúsculas e espaços', () => {
    const r = validateS10('aa 123456785 br');
    expect(r.valid).toBe(true);
    expect(`${r.servico}${r.serial}${r.checkDigit}BR`).toBe('AA123456785BR');
  });

  it.each(['OY526018152BR', 'QB908301669BR'])('códigos de referência reais: %s é válido', (codigo) => {
    expect(validateS10(codigo).valid).toBe(true);
  });
});
