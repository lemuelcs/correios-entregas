/**
 * Armazenamento das fotos de rótulo (ADR-010): disco em `FOTOS_DIR` (padrão
 * `/data/fotos`, volume `correios_fotos`), chave `<unidadeId>/<AAAA-MM-DD>/<capturaId>.jpg`.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fotosArmazenadasBytes } from './captura.metricas';
import type { PhotoStore } from './captura.types';

export const FOTOS_DIR_PADRAO = '/data/fotos';

export function chaveFoto(unidadeId: string, data: Date, capturaId: string): string {
  return `${unidadeId}/${data.toISOString().slice(0, 10)}/${capturaId}.jpg`;
}

export class ChaveFotoInvalida extends Error {
  constructor() {
    super('chave_foto_invalida');
    this.name = 'ChaveFotoInvalida';
  }
}

const SEGMENTO = /^[A-Za-z0-9._-]+$/;

export class DiskPhotoStore implements PhotoStore {
  private readonly raiz: string;

  constructor(raiz: string = process.env.FOTOS_DIR || FOTOS_DIR_PADRAO) {
    this.raiz = path.resolve(raiz);
  }

  /** Caminho absoluto da chave; recusa `..`, caminho absoluto e caracteres fora do padrão. */
  private caminho(key: string): string {
    const partes = key.split('/');
    if (!key || key.startsWith('/') || partes.some((p) => p === '' || p === '.' || p === '..' || !SEGMENTO.test(p))) {
      throw new ChaveFotoInvalida();
    }
    const alvo = path.resolve(this.raiz, ...partes);
    if (!alvo.startsWith(this.raiz + path.sep)) throw new ChaveFotoInvalida();
    return alvo;
  }

  async put(key: string, jpeg: Buffer): Promise<void> {
    const alvo = this.caminho(key);
    await fs.mkdir(path.dirname(alvo), { recursive: true });
    const tmp = `${alvo}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, jpeg, { mode: 0o600 });
    await fs.rename(tmp, alvo);
    fotosArmazenadasBytes.inc(jpeg.length);
  }

  async get(key: string): Promise<Buffer | null> {
    const alvo = this.caminho(key);
    try {
      return await fs.readFile(alvo);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const alvo = this.caminho(key);
    try {
      const { size } = await fs.stat(alvo);
      await fs.unlink(alvo);
      fotosArmazenadasBytes.dec(size);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }
}
