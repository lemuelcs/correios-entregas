const BASE_URL = '/api/v1';

/**
 * Erro HTTP da API. O backend responde `{ error, details }`:
 * - `message` (= `codigo`) é o `error` — na área Entregas é o próprio código
 *   (ex.: `sem_carteiro`); na captura é o texto legível;
 * - `details` (= `detalhes`) é o `details` cru;
 * - `code` é o `details.code` estável da captura (ex.: `captura_ja_resolvida`), ou `null`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code =
      details && typeof details === 'object' && 'code' in details && typeof details.code === 'string'
        ? details.code
        : null;
  }

  /** O `error` do backend (mesmo valor de `message`); usado pela área Entregas. */
  get codigo(): string {
    return this.message;
  }

  /** O `details` do backend (mesmo valor de `details`); usado pela área Entregas. */
  get detalhes(): unknown {
    return this.details;
  }
}

/** Código do erro lançado quando a sessão expirou e a tela já foi levada ao login. */
export const SESSAO_EXPIRADA = 'sessao_expirada';

/** Caminho atual, para voltar a ele depois do login (US-036.EC-2). */
export function caminhoParaVoltar(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function urlDeLogin(voltar = caminhoParaVoltar()): string {
  if (!voltar || voltar === '/' || voltar.startsWith('/login')) return '/login';
  return `/login?voltar=${encodeURIComponent(voltar)}`;
}

// Rotas em que um 401 é a resposta final (credencial errada, refresh inválido), não um token vencido.
const SEM_REFRESH = ['/auth/login', '/auth/refresh'];

class ApiClient {
  /** O refresh em voo: dois 401 simultâneos esperam o mesmo (o refresh é rotativo e de uso único). */
  private refreshEmVoo: Promise<string | null> | null = null;

  private getHeaders(body?: unknown): Record<string, string> {
    // FormData: o navegador monta o Content-Type com o boundary.
    const headers: Record<string, string> = body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private serializar(body: unknown): BodyInit | undefined {
    if (body instanceof FormData) return body;
    return body ? JSON.stringify(body) : undefined;
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

  /** Troca o refresh por um par novo e grava os dois. `null` quando a sessão acabou. */
  private renovarTokens(): Promise<string | null> {
    if (!this.refreshEmVoo) {
      this.refreshEmVoo = (async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return null;
        try {
          const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) return null;
          const tokens = (await res.json()) as { accessToken: string; refreshToken?: string };
          localStorage.setItem('accessToken', tokens.accessToken);
          if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
          return tokens.accessToken;
        } catch {
          return null;
        }
      })().finally(() => {
        this.refreshEmVoo = null;
      });
    }
    return this.refreshEmVoo;
  }

  /**
   * Sessão perdida: limpa só os tokens e manda para o login, com `?voltar=` para a tela atual.
   * A fila offline da captura (IndexedDB) fica intacta e é enviada depois do novo login.
   */
  private encerrarSessao() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    if (window.location.pathname !== '/login') {
      this.redirecionar(urlDeLogin());
    }
  }

  /** Navegação de página inteira; substituível nos testes (o jsdom não navega). */
  redirecionar = (destino: string) => {
    window.location.href = destino;
  };

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.getHeaders(body),
      body: this.serializar(body),
    });

    if (res.status === 401 && !SEM_REFRESH.includes(path)) {
      const accessToken = await this.renovarTokens();
      if (accessToken) {
        res = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: { ...this.getHeaders(body), Authorization: `Bearer ${accessToken}` },
          body: this.serializar(body),
        });
      }
      if (res.status === 401) {
        this.encerrarSessao();
        // A tela já foi levada ao login: os chamadores reconhecem o código e não avisam de novo.
        throw new ApiError(401, SESSAO_EXPIRADA);
      }
    }

    if (!res.ok) {
      const parsed = await this.parseResponseBody(res);
      let message = `HTTP ${res.status}`;
      let details: unknown;

      if (parsed && typeof parsed === 'object') {
        details = 'details' in parsed ? parsed.details : undefined;
        const errorMessage =
          'error' in parsed && typeof parsed.error === 'string'
            ? parsed.error
            : 'message' in parsed && typeof parsed.message === 'string'
              ? parsed.message
              : null;
        if (errorMessage) message = errorMessage;
      } else if (typeof parsed === 'string' && parsed.trim()) {
        message = parsed.trim();
      }

      throw new ApiError(res.status, message, details);
    }

    return await this.parseResponseBody(res) as T;
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  /** POST multipart: não fixa o Content-Type JSON. */
  postForm<T>(path: string, form: FormData) { return this.request<T>('POST', path, form); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  patch<T>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const api = new ApiClient();
