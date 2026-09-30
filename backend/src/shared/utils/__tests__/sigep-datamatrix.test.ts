import {
  LAYOUT_SIGEP,
  montarSigepDataMatrix,
  parseSigepDataMatrix,
  TAMANHO_MINIMO_SIGEP,
  validadorCep,
} from '../sigep-datamatrix';

/** Mesmo conteúdo do DataMatrix do fixture `rotulo-completo.jpg`. */
const ROTULO_COMPLETO = {
  cepDestino: '72115040',
  codigo: 'OY716488072BR',
  numero: '17',
  complemento: 'CASA',
  telefone: '61993401287',
};

function comCampo(raw: string, campo: keyof typeof LAYOUT_SIGEP, valor: string): string {
  const [ini, fim] = LAYOUT_SIGEP[campo];
  return raw.slice(0, ini) + valor.padEnd(fim - ini, ' ').slice(0, fim - ini) + raw.slice(fim);
}

describe('sigep-datamatrix', () => {
  it('UT-007 extrai CEP, código, número, complemento e telefone do DataMatrix do rotulo-completo', () => {
    const raw = montarSigepDataMatrix(ROTULO_COMPLETO);
    expect(parseSigepDataMatrix(raw)).toEqual({
      cepDestino: '72115040',
      codigo: 'OY716488072BR',
      numero: '17',
      complemento: 'CASA',
      telefone: '61993401287',
    });
  });

  it('UT-008 telefone 000000000000 vira null', () => {
    const raw = montarSigepDataMatrix({ ...ROTULO_COMPLETO, telefone: '000000000000' });
    expect(raw.slice(...LAYOUT_SIGEP.telefone)).toBe('000000000000');
    expect(parseSigepDataMatrix(raw)?.telefone).toBeNull();
  });

  it('UT-009 número 00000 vira null e complemento só com espaços vira null', () => {
    const raw = montarSigepDataMatrix({ ...ROTULO_COMPLETO, numero: '00000', complemento: '     ' });
    const r = parseSigepDataMatrix(raw);
    expect(r?.numero).toBeNull();
    expect(r?.complemento).toBeNull();
    expect(r?.cepDestino).toBe('72115040');
  });

  it('UT-010 string menor que o tamanho mínimo do layout devolve null sem exceção', () => {
    const raw = montarSigepDataMatrix(ROTULO_COMPLETO);
    expect(parseSigepDataMatrix(raw.slice(0, TAMANHO_MINIMO_SIGEP - 1))).toBeNull();
    expect(parseSigepDataMatrix('')).toBeNull();
    expect(parseSigepDataMatrix(null)).toBeNull();
    expect(parseSigepDataMatrix(raw.slice(0, TAMANHO_MINIMO_SIGEP))).not.toBeNull();
  });

  it('UT-011 CEP com letras na posição do CEP devolve null', () => {
    const raw = comCampo(montarSigepDataMatrix(ROTULO_COMPLETO), 'cepDestino', '7211A040');
    expect(parseSigepDataMatrix(raw)).toBeNull();
  });

  it('UT-012 código com DV inválido dá codigo null e preserva os demais campos', () => {
    const raw = comCampo(montarSigepDataMatrix(ROTULO_COMPLETO), 'codigo', 'OY716488071BR');
    expect(parseSigepDataMatrix(raw)).toEqual({ ...ROTULO_COMPLETO, codigo: null });
  });

  it('montarSigepDataMatrix segue o layout: 133 caracteres até a longitude, pipe e reserva de 30', () => {
    const raw = montarSigepDataMatrix(ROTULO_COMPLETO);
    expect(raw).toHaveLength(164);
    expect(raw[133]).toBe('|');
    expect(raw.slice(...LAYOUT_SIGEP.numero)).toBe('00017');
    expect(raw.slice(...LAYOUT_SIGEP.telefone)).toBe('061993401287');
    expect(raw.slice(...LAYOUT_SIGEP.validadorCepDestino)).toBe(String(validadorCep('72115040')));
    expect(validadorCep('72115040')).toBe(0); // 7+2+1+1+5+0+4+0 = 20
    expect(validadorCep('71919360')).toBe(4); // 36
  });
});
