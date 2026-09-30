/** Regras de cadastro sem banco: UT-081, UT-082, UT-090. */
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import {
  garantirLimitePontos,
  lerWhatsapp,
  normalizarMatricula,
  validarCanalDaUnidade,
  validarNomePonto,
} from '../cadastro.validacao';

function erroDe(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('esperava AppError');
}

describe('pontos de retirada', () => {
  it('UT-081 nome de 25 caracteres → AppError(400, nome_longo)', () => {
    const e = erroDe(() => validarNomePonto('A'.repeat(25)));
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('nome_longo');
  });

  it('UT-081 nome de 24 caracteres passa (aparado)', () => {
    expect(validarNomePonto(`  ${'B'.repeat(24)}  `)).toBe('B'.repeat(24));
  });

  it('UT-082 o 10º ponto ativo do tipo passa; o 11º → AppError(409, limite_pontos)', () => {
    expect(() => garantirLimitePontos(9)).not.toThrow();
    const e = erroDe(() => garantirLimitePontos(10));
    expect(e.statusCode).toBe(409);
    expect(e.message).toBe('limite_pontos');
  });
});

describe('canal da unidade', () => {
  const waha = { tipo: 'WAHA' as const, ativo: true, compartilhado: false };

  it.each([
    ['WABA pedido com canal WAHA', waha, { canal: 'WABA' as const }],
    ['canal inativo', { ...waha, ativo: false }, {}],
    ['WABA sem canal configurado', null, { canal: 'WABA' as const }],
  ])('UT-090 %s → AppError(400, canal_indisponivel)', (_n, canal, pedido) => {
    const e = erroDe(() => validarCanalDaUnidade(canal, pedido));
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('canal_indisponivel');
  });

  it('UT-090 canal compatível e ativo passa; compartilhado exige a referência', () => {
    expect(() => validarCanalDaUnidade(waha, { canal: 'WAHA' })).not.toThrow();
    expect(() => validarCanalDaUnidade(null, {})).not.toThrow();
    const e = erroDe(() => validarCanalDaUnidade({ ...waha, compartilhado: true }, { prosioUnidadeRef: '  ' }));
    expect(e.message).toBe('unidade_ref_obrigatoria');
    expect(() => validarCanalDaUnidade({ ...waha, compartilhado: true }, { prosioUnidadeRef: 'cdd-norte' })).not.toThrow();
  });
});

describe('matrícula e WhatsApp', () => {
  it('normaliza a matrícula com máscara', () => {
    expect(normalizarMatricula('8.301.552-0')).toBe('83015520');
  });

  it('WhatsApp sem DDD → 400 whatsapp_invalido com o formato esperado', () => {
    const e = erroDe(() => lerWhatsapp('98876-1102'));
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('whatsapp_invalido');
    expect(e.details).toMatchObject({ formato: '(61) 99812-4412' });
    expect(lerWhatsapp('(61) 99812-4412')).toBe('+5561998124412');
  });
});
