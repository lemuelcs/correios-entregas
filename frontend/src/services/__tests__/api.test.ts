import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filaIsolada, novaCaptura } from '@/features/captura/__tests__/fabricas';
import { ApiError, SESSAO_EXPIRADA, api } from '../api';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Chamada = [string, RequestInit];

describe('api.ts', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
  let redirecionar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso-velho');
    localStorage.setItem('refreshToken', 'refresh-velho');
    fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    redirecionar = vi.spyOn(api, 'redirecionar').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-111 postForm("/captura/capturas", formData) → não fixa o Content-Type JSON; envia o Authorization', async () => {
    fetchMock.mockResolvedValue(json(200, { tipo: 'SALVO', pacoteId: 'p1', atualizado: false }));
    const form = new FormData();
    form.append('meta', '{}');

    await api.postForm('/captura/capturas', form);

    const [url, init] = fetchMock.mock.calls[0] as Chamada;
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('/api/v1/captura/capturas');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('content-type');
    expect(headers.Authorization).toBe('Bearer acesso-velho');
  });

  it('UT-112 um 401 → o refresh devolve {accessToken, refreshToken}, os dois são gravados, e a requisição é repetida', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'Token expirado' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'acesso-novo', refreshToken: 'refresh-novo' }))
      .mockResolvedValueOnce(json(200, { ok: true }));

    const r = await api.get<{ ok: boolean }>('/captura/hoje');

    expect(r).toEqual({ ok: true });
    expect(localStorage.getItem('accessToken')).toBe('acesso-novo');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-novo');
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as Chamada;
    expect(refreshUrl).toBe('/api/v1/auth/refresh');
    expect(JSON.parse(refreshInit.body as string)).toEqual({ refreshToken: 'refresh-velho' });
    const [retryUrl, retryInit] = fetchMock.mock.calls[2] as Chamada;
    expect(retryUrl).toBe('/api/v1/captura/hoje');
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer acesso-novo');
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it('UT-113 o refresh falha → limpa os tokens e redireciona para /login, sem tocar o IndexedDB da fila', async () => {
    const fila = filaIsolada();
    const c = novaCaptura();
    await fila.add(c);
    const open = vi.spyOn(indexedDB, 'open');
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase');
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'Token expirado' }))
      .mockResolvedValueOnce(json(401, { error: 'Refresh inválido', details: { code: 'refresh_invalido' } }));

    const erro = await api.get('/captura/hoje').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(401);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(redirecionar).toHaveBeenCalledWith('/login');
    expect(open).not.toHaveBeenCalled();
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect((await fila.listar()).map((x) => x.capturaId)).toEqual([c.capturaId]);
  });

  it('UT-114 dois 401 simultâneos → um único refresh em voo', async () => {
    let liberarRefresh!: () => void;
    const refreshPendente = new Promise<void>((r) => { liberarRefresh = r; });
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        await refreshPendente;
        return json(200, { accessToken: 'acesso-novo', refreshToken: 'refresh-novo' });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer acesso-novo' ? json(200, { url }) : json(401, { error: 'Token expirado' });
    });

    const a = api.get('/captura/hoje');
    const b = api.get('/captura/conferir');
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => u.endsWith('/auth/refresh'))).toHaveLength(1),
    );
    liberarRefresh();

    await expect(a).resolves.toEqual({ url: '/api/v1/captura/hoje' });
    await expect(b).resolves.toEqual({ url: '/api/v1/captura/conferir' });
    expect(fetchMock.mock.calls.filter(([u]) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(localStorage.getItem('refreshToken')).toBe('refresh-novo');
  });

  it('401 do próprio login não tenta refresh nem redireciona', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Matrícula ou senha incorretas', details: { code: 'credenciais_invalidas' } }));

    const erro = await api.post('/auth/login', { matricula: '12345678', senha: 'x' }).catch((e: unknown) => e);

    expect(erro).toMatchObject({ status: 401, code: 'credenciais_invalidas', message: 'Matrícula ou senha incorretas' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it('(merge captura × entregas) ApiError expõe code/details da captura e codigo/detalhes da área Entregas', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: 'sem_carteiro', details: { mensagem: 'Distrito sem carteiro no dia' } }));

    const erro = (await api.post('/entregas/cargas/c1/liberar', {}).catch((e: unknown) => e)) as ApiError;

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ status: 409, message: 'sem_carteiro', code: null });
    expect(erro.codigo).toBe('sem_carteiro');
    expect(erro.detalhes).toEqual({ mensagem: 'Distrito sem carteiro no dia' });
  });

  it('(merge captura × entregas) sessão perdida numa tela → erro sessao_expirada e /login?voltar= da tela', async () => {
    window.history.pushState({}, '', '/entregas/carregar?data=2026-09-30');
    try {
      fetchMock
        .mockResolvedValueOnce(json(401, { error: 'Token expirado' }))
        .mockResolvedValueOnce(json(401, { error: 'Refresh inválido', details: { code: 'refresh_invalido' } }));

      const erro = (await api.get('/entregas/quadro').catch((e: unknown) => e)) as ApiError;

      expect(erro).toMatchObject({ status: 401, codigo: SESSAO_EXPIRADA });
      expect(redirecionar).toHaveBeenCalledWith(`/login?voltar=${encodeURIComponent('/entregas/carregar?data=2026-09-30')}`);
      expect(localStorage.getItem('accessToken')).toBeNull();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });
});
