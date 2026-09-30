// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode, definirOrigemWasm, MultiplosRotulos } from '../barcode';

// Fixtures da task_01 (sintéticas, bwip-js): não gerar outras.
const ROTULOS = path.resolve(__dirname, '../../../../../backend/src/__tests__/fixtures/rotulos');

interface Fixture {
  arquivo: string;
  esperado: { objeto: string | null; cepLinear: string | null; dataMatrixRaw: string | null; multiplos: boolean };
}
const FIXTURES: Fixture[] = JSON.parse(readFileSync(path.join(ROTULOS, 'rotulos.json'), 'utf8'));

function rotulo(arquivo: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(ROTULOS, arquivo)));
}

function esperado(arquivo: string) {
  return FIXTURES.find((f) => f.arquivo === arquivo)!.esperado;
}

// Em Node não há URL servida: o WASM vem do disco.
const require = createRequire(import.meta.url);
const WASM = readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
const origemDoDisco = vi.fn(async () => ({
  wasmBinary: WASM.buffer.slice(WASM.byteOffset, WASM.byteOffset + WASM.byteLength) as ArrayBuffer,
}));

describe('barcode.decode', () => {
  beforeEach(() => {
    definirOrigemWasm(origemDoDisco);
    origemDoDisco.mockClear();
  });
  afterAll(() => definirOrigemWasm());

  it('UT-086 decode(rotulo-completo.jpg) → objeto, CEP linear e DataMatrix', async () => {
    const r = await decode(rotulo('rotulo-completo.jpg'));

    expect(r.objeto).toBe('OY716488072BR');
    expect(r.cepLinear).toBe('72115040');
    expect(typeof r.dataMatrixRaw).toBe('string');
    expect(r.dataMatrixRaw).toBe(esperado('rotulo-completo.jpg').dataMatrixRaw);
    expect(r.multiplos).toBe(false);
  });

  it('UT-087 decode(rotulo-dois.jpg) → lança MultiplosRotulos (dois S10 distintos)', async () => {
    const erro = await decode(rotulo('rotulo-dois.jpg')).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(MultiplosRotulos);
    expect((erro as MultiplosRotulos).codigos.sort()).toEqual(['AA123456785BR', 'OY716488072BR']);
  });

  it('UT-088 decode(rotulo-escuro.jpg) → nada lido', async () => {
    const r = await decode(rotulo('rotulo-escuro.jpg'));

    expect(r).toMatchObject({ objeto: null, cepLinear: null, dataMatrixRaw: null });
  });

  it('UT-089 decode(rotulo-sem-datamatrix.jpg) → dataMatrixRaw null, com o objeto e o CEP lidos', async () => {
    const r = await decode(rotulo('rotulo-sem-datamatrix.jpg'));

    expect(r).toEqual({ objeto: 'AA123456785BR', cepLinear: '71919360', dataMatrixRaw: null, multiplos: false });
  });

  it('UT-090 o WASM carrega sob demanda na primeira chamada, e a segunda reutiliza a instância', async () => {
    expect(origemDoDisco).not.toHaveBeenCalled(); // importar o módulo não carrega nada

    await decode(rotulo('rotulo-sem-datamatrix.jpg'));
    expect(origemDoDisco).toHaveBeenCalledTimes(1);

    await decode(rotulo('rotulo-completo.jpg'));
    expect(origemDoDisco).toHaveBeenCalledTimes(1);
  });

  it.each(FIXTURES.filter((f) => !f.esperado.multiplos).map((f) => [f.arquivo, f.esperado] as const))(
    '%s bate com o rotulos.json da task_01',
    async (arquivo, esperadoFixture) => {
      expect(await decode(new Blob([rotulo(arquivo) as BlobPart]))).toEqual(esperadoFixture);
    },
  );
});
