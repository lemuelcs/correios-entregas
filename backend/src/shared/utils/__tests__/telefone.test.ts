import { normalizarTelefone, TelefoneInvalido } from '../telefone';

function erroDe(entrada: string): TelefoneInvalido {
  try {
    normalizarTelefone(entrada);
  } catch (err) {
    return err as TelefoneInvalido;
  }
  throw new Error(`esperava TelefoneInvalido para "${entrada}"`);
}

describe('telefone', () => {
  it('UT-006 normaliza celular com máscara para E.164', () => {
    expect(normalizarTelefone('(61) 99812-4412')).toBe('+5561998124412');
  });

  it('UT-007 insere o nono dígito em celular com 8 dígitos', () => {
    expect(normalizarTelefone('61 9812-4412')).toBe('+5561998124412');
  });

  it('UT-008 recusa número sem DDD com o código sem_ddd', () => {
    const err = erroDe('98876-1102');
    expect(err).toBeInstanceOf(TelefoneInvalido);
    expect(err.codigo).toBe('sem_ddd');
  });

  it('UT-009 recusa caracteres inválidos com o código formato', () => {
    const err = erroDe('61 9abc-4412');
    expect(err).toBeInstanceOf(TelefoneInvalido);
    expect(err.codigo).toBe('formato');
  });

  it('UT-010 aceita número já com +55', () => {
    expect(normalizarTelefone('+55 (61) 99812-4412')).toBe('+5561998124412');
  });
});
