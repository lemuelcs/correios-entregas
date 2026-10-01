import { CaptureQueue, type NovaCaptura } from '../captureQueue';

let seq = 0;

/** Uma captura nova, com um JPEG falso de bytes conhecidos. */
export function novaCaptura(over: Partial<NovaCaptura> = {}): NovaCaptura {
  seq += 1;
  return {
    capturaId: crypto.randomUUID(),
    distritoId: 'distrito-1',
    data: '2026-09-30',
    capturadoEm: new Date(Date.UTC(2026, 8, 30, 12, 0, seq)).toISOString(),
    jpeg: new Blob([new Uint8Array([0xff, 0xd8, 0xff, seq % 256, 0xff, 0xd9])], { type: 'image/jpeg' }),
    barcodes: { objeto: 'OY716488072BR', cepLinear: '72115040', dataMatrixRaw: null, multiplos: false },
    codigo: 'OY716488072BR',
    codigoDigitado: false,
    ...over,
  };
}

/** Uma fila num banco isolado (fake-indexeddb é global no arquivo de teste). */
export function filaIsolada(nomeBanco = `teste-${crypto.randomUUID()}`) {
  return new CaptureQueue({ nomeBanco });
}
