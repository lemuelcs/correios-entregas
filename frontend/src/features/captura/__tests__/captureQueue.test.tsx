import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaptureQueue, EspacoInsuficiente, LIMITE_RECENTES, _reiniciarPedidoDePersistencia } from '../captureQueue';
import { AvisoEspaco } from '../components/AvisoEspaco';
import { filaIsolada, novaCaptura } from './fabricas';

const SALVO = { tipo: 'SALVO', pacoteId: 'p1', atualizado: false } as const;

async function bytes(blob: Blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

describe('captureQueue', () => {
  it('UT-071 add(captura) → listar("aguardando") contém a captura, com o blob íntegro', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();

    await fila.add(c);

    const aguardando = await fila.listar('aguardando');
    expect(aguardando).toHaveLength(1);
    expect(aguardando[0]).toMatchObject({
      capturaId: c.capturaId,
      estado: 'aguardando',
      tentativas: 0,
      barcodes: c.barcodes,
      codigo: c.codigo,
    });
    expect(aguardando[0].jpeg.type).toBe('image/jpeg');
    expect(await bytes(aguardando[0].jpeg)).toEqual(await bytes(c.jpeg));
  });

  it('UT-072 recriar a instância (reabrir o app) → a fila persiste', async () => {
    const nomeBanco = `teste-${crypto.randomUUID()}`;
    const primeira = new CaptureQueue({ nomeBanco });
    const c = novaCaptura();
    await primeira.add(c);
    await primeira.fechar();

    const reaberta = new CaptureQueue({ nomeBanco });
    const itens = await reaberta.listar('aguardando');

    expect(itens.map((i) => i.capturaId)).toEqual([c.capturaId]);
    expect(await bytes(itens[0].jpeg)).toEqual(await bytes(c.jpeg));
  });

  it('UT-073 add com QuotaExceededError → emite espaco_insuficiente e a UI mostra o aviso', async () => {
    const fila = filaIsolada();
    await fila.listar(); // abre o banco antes de sabotar o put
    render(<AvisoEspaco fila={fila} />);
    const eventos: string[] = [];
    fila.on((e) => eventos.push(e.tipo));
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError');
    });

    await act(async () => {
      await expect(fila.add(novaCaptura())).rejects.toBeInstanceOf(EspacoInsuficiente);
    });

    expect(eventos).toContain('espaco_insuficiente');
    expect(screen.getByRole('alert')).toHaveTextContent('Espaço do aparelho acabando');
  });

  it('UT-074 marcar(id, "concluida") → sai de aguardando, e recentes guarda o resultado', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);

    await fila.marcar(c.capturaId, 'concluida', { resultado: SALVO });

    expect(await fila.listar('aguardando')).toEqual([]);
    const recentes = await fila.recentes();
    expect(recentes).toHaveLength(1);
    expect(recentes[0]).toMatchObject({ capturaId: c.capturaId, codigo: c.codigo, resultado: SALVO });
  });

  it('UT-075 recentes mantém só os últimos 20', async () => {
    const fila = filaIsolada();
    const ids: string[] = [];
    for (let i = 0; i < LIMITE_RECENTES + 5; i++) {
      const c = novaCaptura();
      ids.push(c.capturaId);
      await fila.add(c);
      await fila.marcar(c.capturaId, 'concluida', { resultado: SALVO });
    }

    const recentes = await fila.recentes();
    expect(recentes).toHaveLength(LIMITE_RECENTES);
    // do mais novo para o mais antigo; os 5 primeiros saíram
    expect(recentes.map((r) => r.capturaId)).toEqual(ids.slice(5).reverse());
  });

  it('UT-076 add com capturaId repetido → substitui, sem duplicar', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);

    await fila.add({ ...c, codigo: 'AA123456785BR', codigoDigitado: true });

    const todos = await fila.listar();
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ capturaId: c.capturaId, codigo: 'AA123456785BR', codigoDigitado: true });
  });

  it('pede armazenamento persistente ao abrir o banco', async () => {
    _reiniciarPedidoDePersistencia();
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    try {
      await filaIsolada().listar();
      expect(persist).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
