/**
 * Leitura dos códigos do rótulo na foto parada (ADR-011), com zxing-wasm.
 *
 * - Code 128: o código do objeto (S10) e o código do CEP (8 dígitos).
 * - DataMatrix: o SIGEP bruto (o parser fica em `lib/sigep-datamatrix`).
 *
 * O WASM (~1 MB) só carrega na primeira leitura; as seguintes reutilizam a instância.
 * Dois S10 distintos na mesma foto lançam `MultiplosRotulos`.
 */
import type { ZXingModuleOverrides } from 'zxing-wasm/reader';
import type { BarcodesLidos } from './captureQueue';
import { normalizeS10 } from './lib/s10';
import { parseSigepDataMatrix } from './lib/sigep-datamatrix';

type Leitor = typeof import('zxing-wasm/reader');

/** O formato do S10, sem conferir o DV (quem chama valida e recusa na hora). */
const FORMATO_S10 = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
const FORMATO_CEP = /^\d{8}$/;

export class MultiplosRotulos extends Error {
  readonly codigos: string[];

  constructor(codigos: string[]) {
    super('Mais de um rótulo na foto. Fotografe um pacote por vez.');
    this.name = 'MultiplosRotulos';
    this.codigos = codigos;
  }
}

/** De onde vem o WASM: no app, o arquivo empacotado pelo Vite (e precacheado pelo service worker). */
export type OrigemWasm = () => Promise<ZXingModuleOverrides>;

const origemPadrao: OrigemWasm = async () => {
  const { default: urlWasm } = await import('zxing-wasm/reader/zxing_reader.wasm?url');
  return {
    locateFile: (caminho: string, prefixo: string) => (caminho.endsWith('.wasm') ? urlWasm : prefixo + caminho),
  };
};

let origemWasm: OrigemWasm = origemPadrao;
let leitor: Promise<Leitor> | null = null;

/** Troca a origem do WASM (testes em Node) e descarta a instância carregada. */
export function definirOrigemWasm(origem: OrigemWasm = origemPadrao): void {
  origemWasm = origem;
  leitor = null;
}

function carregarLeitor(): Promise<Leitor> {
  leitor ??= (async () => {
    const modulo = await import('zxing-wasm/reader');
    await modulo.prepareZXingModule({ overrides: await origemWasm(), fireImmediately: true });
    return modulo;
  })().catch((err: unknown) => {
    leitor = null; // uma falha de carga (sem rede no 1º uso) não fica presa
    throw err;
  });
  return leitor;
}

/**
 * Carrega o WASM antes da primeira foto (ao abrir a captura), para o disparo não
 * esperar o download. Falhas são silenciosas: a leitura tenta de novo.
 */
export function precarregarLeitor(): Promise<void> {
  return carregarLeitor().then(
    () => undefined,
    () => undefined,
  );
}

function unicos(valores: string[]): string[] {
  return [...new Set(valores)];
}

export async function decode(jpeg: Blob | ArrayBuffer | Uint8Array): Promise<BarcodesLidos> {
  const { readBarcodes } = await carregarLeitor();
  const bytes = jpeg instanceof Blob ? new Uint8Array(await jpeg.arrayBuffer()) : new Uint8Array(jpeg);

  const lidos = await readBarcodes(bytes, {
    formats: ['Code128', 'DataMatrix'],
    tryHarder: true,
    maxNumberOfSymbols: 8,
  });

  const objetosLineares: string[] = [];
  const ceps: string[] = [];
  const dataMatrix: string[] = [];
  for (const r of lidos) {
    if (!r.isValid || !r.text) continue;
    if (r.format === 'DataMatrix') {
      dataMatrix.push(r.text);
      continue;
    }
    const texto = normalizeS10(r.text);
    if (FORMATO_S10.test(texto)) objetosLineares.push(texto);
    else if (FORMATO_CEP.test(r.text.trim())) ceps.push(r.text.trim());
  }

  // Um rótulo = um S10 no Code 128 e, no máximo, um no DataMatrix. Mais que isso é outro rótulo.
  // A divergência entre o linear e o DataMatrix de um mesmo rótulo é dúvida no servidor (ADR-011).
  const sigeps = unicos(dataMatrix)
    .map((raw) => ({ raw, sigep: parseSigepDataMatrix(raw) }))
    .filter((d) => d.sigep !== null);
  const codigosLineares = unicos(objetosLineares);
  const codigosDm = unicos(sigeps.map((d) => d.sigep!.codigo).filter((c): c is string => c !== null));
  if (codigosLineares.length > 1 || codigosDm.length > 1) {
    throw new MultiplosRotulos(unicos([...codigosLineares, ...codigosDm]));
  }

  const dm = sigeps[0] ?? null;
  return {
    objeto: codigosLineares[0] ?? dm?.sigep?.codigo ?? null,
    cepLinear: unicos(ceps)[0] ?? null,
    dataMatrixRaw: dm?.raw ?? unicos(dataMatrix)[0] ?? null,
    multiplos: false,
  };
}

export const barcode = { decode };
