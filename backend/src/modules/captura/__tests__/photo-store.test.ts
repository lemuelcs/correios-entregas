import { mkdtempSync, readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { ChaveFotoInvalida, DiskPhotoStore, chaveFoto } from '../photo-store';

describe('DiskPhotoStore', () => {
  let dir: string;
  let store: DiskPhotoStore;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'fotos-'));
    store = new DiskPhotoStore(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('UT-048 put e get devolvem os mesmos bytes', async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    await store.put('u1/2026-09-30/c1.jpg', buf);
    expect(await store.get('u1/2026-09-30/c1.jpg')).toEqual(buf);
  });

  it('UT-049 delete e depois get → null', async () => {
    await store.put('u1/2026-09-30/c1.jpg', Buffer.from('x'));
    await store.delete('u1/2026-09-30/c1.jpg');
    expect(await store.get('u1/2026-09-30/c1.jpg')).toBeNull();
  });

  it('UT-050 delete de chave inexistente resolve sem erro', async () => {
    await expect(store.delete('u1/2026-09-30/nao-existe.jpg')).resolves.toBeUndefined();
  });

  it('UT-051 chave com ".." lança erro sem tocar o disco', async () => {
    await expect(store.put('../fora.jpg', Buffer.from('x'))).rejects.toBeInstanceOf(ChaveFotoInvalida);
    await expect(store.put('u1/../../fora.jpg', Buffer.from('x'))).rejects.toBeInstanceOf(ChaveFotoInvalida);
    await expect(store.get('/etc/passwd')).rejects.toBeInstanceOf(ChaveFotoInvalida);
    await expect(store.delete('u1/..')).rejects.toBeInstanceOf(ChaveFotoInvalida);
    expect(readdirSync(dir)).toEqual([]);
    expect(readdirSync(path.dirname(dir)).includes('fora.jpg')).toBe(false);
  });

  it('chave no formato <unidadeId>/<AAAA-MM-DD>/<capturaId>.jpg', () => {
    expect(chaveFoto('u1', new Date('2026-09-30T00:00:00Z'), 'c1')).toBe('u1/2026-09-30/c1.jpg');
  });
});
