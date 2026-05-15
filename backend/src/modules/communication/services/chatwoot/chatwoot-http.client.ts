/**
 * chatwoot-http.client.ts
 *
 * Thin wrapper around axios para Chatwoot Platform + Application APIs.
 * Variante Correios: unico tenant (account fixo via env CHATWOOT_ACCOUNT_FOR_CORREIOS).
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

import logger from '../../../../shared/utils/logger';
import { AppError } from '../../../../shared/middleware/error-handler.middleware';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 500;

const CHATWOOT_BASE_URL = (
  process.env.CHATWOOT_BASE_URL || 'https://chatwoot.delivyodev.com'
).replace(/\/+$/, '');

const PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN || '';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface CorreiosRouting {
  accountId: number;
  apiToken: string;
  baseUrl: string;
}

class ChatwootHttpClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: CHATWOOT_BASE_URL,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  get baseUrl(): string {
    return CHATWOOT_BASE_URL;
  }

  get platformToken(): string {
    if (!PLATFORM_TOKEN) {
      throw new AppError(503, 'CHATWOOT_PLATFORM_TOKEN nao configurado');
    }
    return PLATFORM_TOKEN;
  }

  /**
   * Resolve routing do tenant Correios.
   * Account id: env CHATWOOT_ACCOUNT_FOR_CORREIOS (default 7).
   * API token: env CHATWOOT_API_TOKEN_CORREIOS.
   */
  resolveCorreiosRouting(): CorreiosRouting {
    const accountId = Number(process.env.CHATWOOT_ACCOUNT_FOR_CORREIOS || '7');
    if (!accountId || Number.isNaN(accountId)) {
      throw new AppError(503, 'CHATWOOT_ACCOUNT_FOR_CORREIOS invalido');
    }
    const apiToken = process.env.CHATWOOT_API_TOKEN_CORREIOS;
    if (!apiToken) {
      throw new AppError(503, 'CHATWOOT_API_TOKEN_CORREIOS nao configurado');
    }
    return { accountId, apiToken, baseUrl: CHATWOOT_BASE_URL };
  }

  private shouldRetry(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    if (!error.response) return true;
    return error.response.status >= 500 && error.response.status <= 599;
  }

  async request<T>(config: AxiosRequestConfig, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.http.request<T>({
          timeout: DEFAULT_TIMEOUT_MS,
          ...config,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const willRetry = attempt < DEFAULT_MAX_RETRIES && this.shouldRetry(error);
        logger.warn(
          {
            label,
            attempt,
            willRetry,
            err: axios.isAxiosError(error) ? this.serializeAxiosError(error) : { message: (error as Error)?.message },
          },
          `[CHATWOOT-HTTP] Falha em ${label}`,
        );
        if (!willRetry) break;
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt));
      }
    }
    this.throwAsAppError(lastError, label);
  }

  private serializeAxiosError(error: AxiosError) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    };
  }

  private throwAsAppError(error: unknown, label: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 503;
      const responseData = error.response?.data as { error?: unknown; message?: unknown } | undefined;
      const responseMessage =
        typeof responseData?.error === 'string'
          ? responseData.error
          : typeof responseData?.message === 'string'
            ? responseData.message
            : null;
      const message = responseMessage || error.message || `Falha em ${label}`;
      throw new AppError(status >= 500 ? 503 : status, `[Chatwoot] ${message}`);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(503, `[Chatwoot] Falha em ${label}: ${(error as Error)?.message || 'erro desconhecido'}`);
  }

  platformHeaders() {
    return { api_access_token: this.platformToken };
  }

  accountHeaders(apiToken: string) {
    return { api_access_token: apiToken };
  }
}

export const chatwootHttp = new ChatwootHttpClient();
export type { CorreiosRouting };
