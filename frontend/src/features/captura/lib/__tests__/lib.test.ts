// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeS10, validateS10 } from '../s10';

const BACKEND_UTILS = path.resolve(__dirname, '../../../../../../backend/src/shared/utils');
const LIB = path.resolve(__dirname, '..');

describe('lib/s10 (cópia do aparelho)', () => {
  it('UT-127 passa os vetores do S10: DV, país qualquer, normalização e tamanho', () => {
    expect(validateS10('AA123456785BR').valid).toBe(true);
    expect(validateS10('AA123456784BR').valid).toBe(false);
    expect(validateS10('RR123456785CN', { qualquerPais: true }).valid).toBe(true);
    expect(validateS10('RR123456785CN').valid).toBe(false);
    expect(normalizeS10(' oy 716-488-072 br ')).toBe('OY716488072BR');
    expect(validateS10(' oy 716-488-072 br ').valid).toBe(true);
    expect(validateS10('AA12345678BR').valid).toBe(false);
  });
});

describe('lib/ (paridade com o backend)', () => {
  it.each(['s10.ts', 'telefone.ts', 'sigep-datamatrix.ts'])(
    '%s é idêntico à origem, fora o cabeçalho da cópia',
    (arquivo) => {
      const origem = readFileSync(path.join(BACKEND_UTILS, arquivo), 'utf8');
      const copia = readFileSync(path.join(LIB, arquivo), 'utf8');
      const semCabecalho = copia.replace(/^(\/\/.*\n)+\n/, '');
      expect(semCabecalho).toBe(origem);
    },
  );
});
