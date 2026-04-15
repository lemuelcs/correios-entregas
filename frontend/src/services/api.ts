const BASE_URL = '/api/v1';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
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
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // Try refresh
      const refreshToken = localStorage.getItem('refreshToken');
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
            // Retry original request
            const retryRes = await fetch(`${BASE_URL}${path}`, {
              method,
              headers: { ...this.getHeaders(), Authorization: `Bearer ${accessToken}` },
              body: body ? JSON.stringify(body) : undefined,
            });
            if (retryRes.ok) return await this.parseResponseBody(retryRes) as T;
          }
        } catch { /* token refresh failed */ }
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
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
          throw new Error(errorMessage);
        }
      }

      if (typeof parsed === 'string' && parsed.trim()) {
        throw new Error(parsed.trim());
      }

      throw new Error(`HTTP ${res.status}`);
    }

    return await this.parseResponseBody(res) as T;
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const api = new ApiClient();
