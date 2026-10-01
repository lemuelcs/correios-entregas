const BASE_URL = '/api/v1';

/**
 * Erro de uma chamada à API. `message` continua sendo o texto do backend
 * (`error`), como antes; `status`, `codigo` e `detalhes` permitem às telas
 * novas traduzir o código (ex.: `sem_carteiro`, `atendimento_indisponivel`).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes: unknown;

  constructor(status: number, codigo: string, detalhes?: unknown) {
    super(codigo);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

/** Código usado quando a sessão expirou e a tela já foi levada ao login. */
export const SESSAO_EXPIRADA = 'sessao_expirada';

/** Caminho atual, para voltar a ele depois do login (US-036.EC-2). */
export function caminhoParaVoltar(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function urlDeLogin(voltar = caminhoParaVoltar()): string {
  if (!voltar || voltar === '/' || voltar.startsWith('/login')) return '/login';
  return `/login?voltar=${encodeURIComponent(voltar)}`;
}

class ApiClient {
  private montarRequisicao(method: string, body: unknown, token: string | null): RequestInit {
    const headers: Record<string, string> = {};
    const ehFormulario = typeof FormData !== 'undefined' && body instanceof FormData;
    // FormData: o navegador define o Content-Type com o boundary do multipart.
    if (!ehFormulario) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return {
      method,
      headers,
      body: body === undefined || body === null ? undefined : ehFormulario ? body : JSON.stringify(body),
    };
  }

  private async parseResponseBody(res: Response): Promise<unknown> {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return res.json();
    }

    const text = await res.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res = await fetch(`${BASE_URL}${path}`, this.montarRequisicao(method, body, localStorage.getItem('accessToken')));

    // O 401 do próprio login é "credenciais inválidas", não sessão expirada.
    if (res.status === 401 && path !== '/auth/login') {
      const refreshToken = localStorage.getItem('refreshToken');
      let renovado = false;
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const { accessToken } = await refreshRes.json();
            localStorage.setItem('accessToken', accessToken);
            res = await fetch(`${BASE_URL}${path}`, this.montarRequisicao(method, body, accessToken));
            renovado = res.status !== 401;
          }
        } catch { /* token refresh failed */ }
      }
      if (!renovado) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = urlDeLogin();
        throw new ApiError(401, SESSAO_EXPIRADA);
      }
    }

    if (!res.ok) {
      const parsed = await this.parseResponseBody(res);

      if (parsed && typeof parsed === 'object') {
        const errorMessage =
          'error' in parsed && typeof parsed.error === 'string'
            ? parsed.error
            : 'message' in parsed && typeof parsed.message === 'string'
              ? parsed.message
              : null;

        if (errorMessage) {
          throw new ApiError(res.status, errorMessage, 'details' in parsed ? parsed.details : undefined);
        }
      }

      if (typeof parsed === 'string' && parsed.trim()) {
        throw new ApiError(res.status, parsed.trim());
      }

      throw new ApiError(res.status, `HTTP ${res.status}`);
    }

    return await this.parseResponseBody(res) as T;
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  patch<T>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const api = new ApiClient();
