import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/services/api';
import type { CapturaLocal, ResultadoCaptura } from '../captureQueue';
import { CaptureSync, type Envio } from '../captureSync';
import { filaIsolada, novaCaptura } from './fabricas';

const SALVO: ResultadoCaptura = { tipo: 'SALVO', pacoteId: 'p1', atualizado: false };

function campo(valor: string | null, duvida = false) {
  return { valor, duvida, fonte: 'LLM' as const };
}

const PARA_CONFERIR: ResultadoCaptura = {
  tipo: 'PARA_CONFERIR',
  motivos: ['nome_duvidoso'],
  campos: {
    codigo: campo('OY716488072BR'), nome: campo(null, true), whatsapp: campo(null), cep: campo('72115040'),
    logradouro: campo('QNC 4'), numero: campo('17'), complemento: campo(null), bairro: campo('Taguatinga Norte'),
    cidade: campo('Brasilia'), uf: campo('DF'),
  },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function adiado<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => { resolver = r; });
  return { promessa, resolver };
}

describe('captureSync', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'token-1');
    localStorage.setItem('refreshToken', 'refresh-1');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('UT-077 evento online com 2 itens aguardando → 2 POSTs em série, na ordem de capturadoEm', async () => {
    const fila = filaIsolada();
    const depois = novaCaptura({ capturadoEm: '2026-09-30T12:00:05.000Z' });
    const antes = novaCaptura({ capturadoEm: '2026-09-30T12:00:01.000Z' });
    await fila.add(depois);
    await fila.add(antes);

    let emVoo = 0;
    let maxEmVoo = 0;
    const ordem: string[] = [];
    const enviar = vi.fn<Envio>(async (c) => {
      emVoo += 1;
      maxEmVoo = Math.max(maxEmVoo, emVoo);
      ordem.push(c.capturaId);
      await new Promise((r) => setTimeout(r, 5));
      emVoo -= 1;
      return SALVO;
    });
    const sync = new CaptureSync({ fila, enviar });
    sync.start();
    await vi.waitFor(async () => expect(enviar).toHaveBeenCalledTimes(2)); // a rodada inicial do start
    enviar.mockClear();
    ordem.length = 0;

    // de volta à fila, e o evento online dispara a rodada
    await fila.add(novaCaptura({ capturaId: depois.capturaId, capturadoEm: depois.capturadoEm }));
    await fila.add(novaCaptura({ capturaId: antes.capturaId, capturadoEm: antes.capturadoEm }));
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(async () => expect(await fila.contar('aguardando')).toBe(0));
    sync.stop();
    expect(ordem).toEqual([antes.capturaId, depois.capturaId]);
    expect(maxEmVoo).toBe(1);
  });

  it('UT-077 (POST real) envia multipart com foto e meta para /captura/capturas', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(200, SALVO));
    vi.stubGlobal('fetch', fetchMock);

    await new CaptureSync({ fila }).sincronizar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/captura/capturas');
    const form = init!.body as FormData;
    expect(form.get('foto')).toBeInstanceOf(Blob);
    expect(JSON.parse(form.get('meta') as string)).toMatchObject({
      capturaId: c.capturaId,
      distritoId: c.distritoId,
      data: c.data,
      capturadoEm: c.capturadoEm,
      codigo: c.codigo,
      codigoDigitado: false,
      barcodes: c.barcodes,
    });
  });

  it('UT-078 fetch rejeita por rede → volta para aguardando com tentativas+1 e o mesmo capturaId', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const enviar = vi.fn<Envio>().mockRejectedValue(new TypeError('Failed to fetch'));

    await new CaptureSync({ fila, enviar }).sincronizar();

    const [item] = await fila.listar();
    expect(item).toMatchObject({ capturaId: c.capturaId, estado: 'aguardando', tentativas: 1 });

    enviar.mockResolvedValueOnce(SALVO);
    await new CaptureSync({ fila, enviar }).sincronizar();
    expect(enviar.mock.calls.map(([x]) => x.capturaId)).toEqual([c.capturaId, c.capturaId]);
    expect(await fila.listar()).toEqual([]);
  });

  it('UT-079 409 captura_em_processamento → continua aguardando, com nova tentativa depois', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const enviar = vi
      .fn<Envio>()
      .mockRejectedValueOnce(new ApiError(409, 'Em processamento', { code: 'captura_em_processamento' }))
      .mockResolvedValue(SALVO);
    const sync = new CaptureSync({ fila, enviar, intervaloMs: 30_000 });

    await sync.sincronizar();
    expect(await fila.listar('aguardando')).toMatchObject([
      { capturaId: c.capturaId, tentativas: 1, ultimoErro: 'captura_em_processamento' },
    ]);
    expect(enviar).toHaveBeenCalledTimes(1);

    sync.start();
    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(2)); // rodada do start
    sync.stop();
    expect(await fila.listar()).toEqual([]);

    // e o tique de 30 s também dispara uma rodada
    await fila.add(novaCaptura());
    sync.start();
    await vi.waitFor(async () => expect(await fila.contar('aguardando')).toBe(0));
    await fila.add(novaCaptura());
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(async () => expect(await fila.contar('aguardando')).toBe(0));
    sync.stop();
  });

  it('UT-080 30 itens → o contador aguardando diminui a cada resposta', async () => {
    const fila = filaIsolada();
    for (let i = 0; i < 30; i++) await fila.add(novaCaptura());
    const sync = new CaptureSync({ fila, enviar: async () => SALVO });
    const vistos: number[] = [];
    sync.on((e) => {
      if (e.tipo === 'progresso') vistos.push(e.contadores.aguardando);
    });

    await sync.sincronizar();

    expect(vistos).toEqual(Array.from({ length: 30 }, (_, i) => 29 - i));
  });

  it('UT-081 200 PARA_CONFERIR → o item fica concluida, e o contador para conferir sobe', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const sync = new CaptureSync({ fila, enviar: async () => PARA_CONFERIR });
    expect((await sync.contadores()).paraConferir).toBe(0);

    await sync.sincronizar();

    expect(await fila.obter(c.capturaId)).toBeUndefined(); // concluída sai da fila
    expect((await fila.recentes())[0]).toMatchObject({ capturaId: c.capturaId, resultado: PARA_CONFERIR });
    expect(await sync.contadores()).toEqual({ aguardando: 0, paraConferir: 1 });
  });

  it('UT-082 415 foto_invalida → falhou_definitivo, visível em Para conferir com o motivo', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const outra = novaCaptura();
    await fila.add(outra);
    const enviar = vi
      .fn<Envio>()
      .mockRejectedValueOnce(new ApiError(415, 'Foto inválida', { code: 'foto_invalida' }))
      .mockResolvedValue(SALVO);
    const sync = new CaptureSync({ fila, enviar });

    await sync.sincronizar();

    expect(await fila.listar('falhou_definitivo')).toMatchObject([
      { capturaId: c.capturaId, ultimoErro: 'foto_invalida' },
    ]);
    expect(enviar).toHaveBeenCalledTimes(2); // a recusa definitiva não trava a fila
    expect((await sync.contadores()).paraConferir).toBe(1);
  });

  it('UT-083 401 com o refresh falhando → pausa sem apagar nada, e retoma depois do login', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const redirecionar = vi.spyOn(api, 'redirecionar').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh') ? json(401, { error: 'Refresh inválido' }) : json(401, { error: 'Token expirado' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const sync = new CaptureSync({ fila });

    await sync.sincronizar();

    expect(sync.estaPausado).toBe(true);
    expect(redirecionar).toHaveBeenCalledWith('/login');
    expect(await fila.listar()).toMatchObject([{ capturaId: c.capturaId, estado: 'aguardando', tentativas: 0 }]);

    // pausado: um gatilho sem novo login não envia nada
    fetchMock.mockClear();
    await sync.sincronizar();
    expect(fetchMock).not.toHaveBeenCalled();

    // novo login → o próximo gatilho retoma e envia
    localStorage.setItem('accessToken', 'token-novo');
    localStorage.setItem('refreshToken', 'refresh-novo');
    fetchMock.mockImplementation(async () => json(200, SALVO));
    await sync.sincronizar();

    expect(sync.estaPausado).toBe(false);
    expect(await fila.listar()).toEqual([]);
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init[1].headers as Record<string, string>).Authorization).toBe('Bearer token-novo');
  });

  it('UT-084 desfazer sem rede → enfileirado como operação, e o item aparece "removendo"', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    await fila.marcar(c.capturaId, 'concluida', { resultado: SALVO });
    const desfazer = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const sync = new CaptureSync({ fila, enviar: async () => SALVO, desfazer });

    await sync.desfazer(c.capturaId); // tenta enviar na hora, sem rede
    await vi.waitFor(async () => expect((await fila.operacoes())[0]?.tentativas).toBe(1));

    expect(await fila.operacoes()).toMatchObject([{ tipo: 'desfazer', capturaId: c.capturaId, tentativas: 1 }]);
    expect((await fila.recentes())[0]).toMatchObject({ capturaId: c.capturaId, desfazer: 'removendo' });

    // a rede volta: a operação é aplicada e sai da fila
    desfazer.mockResolvedValue(undefined);
    await sync.sincronizar();
    expect(desfazer).toHaveBeenLastCalledWith(c.capturaId);
    expect(await fila.operacoes()).toEqual([]);
    expect((await fila.recentes())[0]).toMatchObject({ desfazer: 'desfeito' });
  });

  it('UT-085 o sync em andamento não bloqueia captureQueue.add de uma foto nova', async () => {
    const fila = filaIsolada();
    await fila.add(novaCaptura());
    const resposta = adiado<ResultadoCaptura>();
    const enviados: CapturaLocal[] = [];
    const enviar = vi.fn<Envio>(async (c) => {
      enviados.push(c);
      return enviados.length === 1 ? resposta.promessa : SALVO;
    });
    const sync = new CaptureSync({ fila, enviar });

    const rodada = sync.sincronizar();
    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));

    const nova = novaCaptura({ capturadoEm: '2026-09-30T23:00:00.000Z' });
    await fila.add(nova); // resolve com o POST ainda pendente
    expect(await fila.obter(nova.capturaId)).toMatchObject({ estado: 'aguardando' });

    resposta.resolver(SALVO);
    await rodada;
    expect(enviados.map((c) => c.capturaId)).toContain(nova.capturaId);
    expect(await fila.listar()).toEqual([]);
  });
});
