/**
 * Consulta de CEP da captura (ADR-009).
 *
 * ViaCEP primeiro; o CWS dos Correios entra como fallback só quando configurado
 * (`CORREIOS_CWS_USERNAME`). Cache Redis `cep:<8>`: 30 dias para encontrado, 1 dia
 * para inexistente; falha de rede não é guardada. Timeout de 3 s por provedor.
 * Redis indisponível não derruba a consulta.
 */
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { getRedis } from '../../shared/utils/redis';
import logger from '../../shared/utils/logger';
import { cepLookup } from './captura.metricas';
import type { CepInfo, CepService, ResultadoCep } from './captura.types';

export const TTL_CEP_ENCONTRADO_S = 30 * 24 * 60 * 60;
export const TTL_CEP_NAO_ENCONTRADO_S = 24 * 60 * 60;
export const TIMEOUT_CEP_MS = 3000;

/** O que o cache precisa (subconjunto do ioredis). */
export interface CacheCep {
  get(chave: string): Promise<string | null>;
  set(chave: string, valor: string, modo: 'EX', segundos: number): Promise<unknown>;
}

/** Resposta do CWS (`GET /cep/v2/enderecos`). */
export interface CepCws {
  cep: string;
  logradouro?: string | null;
  bairro?: string | null;
  localidade: string;
  uf: string;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ViaCepServiceDeps {
  fetch?: FetchLike;
  viaCepUrl?: string;
  timeoutMs?: number;
  /** Cliente do cache; `null` (ou exceção) = sem cache. */
  cache?: () => CacheCep | null;
  /** Consulta ao CWS; ausente = CWS não configurado. Um erro 404/400 = CEP inexistente. */
  cws?: ((cep: string, signal: AbortSignal) => Promise<CepCws>) | null;
}

type Consulta = CepInfo | 'NAO_ENCONTRADO' | 'INDISPONIVEL';

class Timeout extends Error {}

function textoOuNulo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Normaliza o CEP (só dígitos). Diferente de 8 dígitos → `AppError(400, cep_invalido)`. */
export function normalizarCep(cep: string): string {
  const d = String(cep ?? '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(d) || String(cep).replace(/[\s.-]/g, '') !== d) {
    throw new AppError(400, 'CEP deve ter 8 dígitos', { code: 'cep_invalido' });
  }
  return d;
}

function cacheRedisPadrao(): CacheCep | null {
  const r = getRedis();
  return r && r.status === 'ready' ? r : null;
}

/** Roda `fn` com um `AbortSignal` que dispara em `ms`; rejeita com `Timeout` se passar do prazo. */
async function comTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => {
      ctrl.abort();
      rejeitar(new Timeout('timeout'));
    }, ms);
  });
  try {
    return await Promise.race([fn(ctrl.signal), prazo]);
  } finally {
    clearTimeout(timer);
  }
}

export class ViaCepService implements CepService {
  private readonly fetch: FetchLike;
  private readonly viaCepUrl: string;
  private readonly timeoutMs: number;
  private readonly cache: () => CacheCep | null;
  private readonly cws: ((cep: string, signal: AbortSignal) => Promise<CepCws>) | null;

  constructor(deps: ViaCepServiceDeps = {}) {
    this.fetch = deps.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.viaCepUrl = (deps.viaCepUrl ?? process.env.VIACEP_URL ?? 'https://viacep.com.br/ws').replace(/\/+$/, '');
    this.timeoutMs = deps.timeoutMs ?? TIMEOUT_CEP_MS;
    this.cache = deps.cache ?? cacheRedisPadrao;
    this.cws = deps.cws === undefined ? cwsPadrao() : deps.cws;
  }

  async lookup(cepEntrada: string): Promise<ResultadoCep> {
    const cep = normalizarCep(cepEntrada);
    const chave = `cep:${cep}`;

    const emCache = await this.lerCache(chave);
    if (emCache) {
      cepLookup.inc({ fonte: 'cache', resultado: emCache === 'NAO_ENCONTRADO' ? 'nao_encontrado' : 'encontrado' });
      return emCache;
    }

    const via = await this.viaCep(cep);
    cepLookup.inc({ fonte: 'viacep', resultado: rotulo(via) });
    if (typeof via === 'object') {
      await this.gravarCache(chave, via, TTL_CEP_ENCONTRADO_S);
      return via;
    }

    let cws: Consulta | null = null;
    if (this.cws) {
      cws = await this.consultarCws(cep);
      cepLookup.inc({ fonte: 'cws', resultado: rotulo(cws) });
      if (typeof cws === 'object') {
        await this.gravarCache(chave, cws, TTL_CEP_ENCONTRADO_S);
        return cws;
      }
    }

    if (via === 'NAO_ENCONTRADO' && (cws === null || cws === 'NAO_ENCONTRADO')) {
      await this.gravarCache(chave, 'NAO_ENCONTRADO', TTL_CEP_NAO_ENCONTRADO_S);
      return 'NAO_ENCONTRADO';
    }
    if (via === 'NAO_ENCONTRADO' || cws === 'NAO_ENCONTRADO') return 'NAO_ENCONTRADO';
    return 'INDISPONIVEL';
  }

  private async viaCep(cep: string): Promise<Consulta> {
    try {
      return await comTimeout(this.timeoutMs, async (signal) => {
        const resp = await this.fetch(`${this.viaCepUrl}/${cep}/json/`, { signal, headers: { Accept: 'application/json' } });
        if (resp.status === 400 || resp.status === 404) return 'NAO_ENCONTRADO';
        if (!resp.ok) return 'INDISPONIVEL';
        const corpo = (await resp.json()) as Record<string, unknown>;
        if (corpo.erro === true || corpo.erro === 'true') return 'NAO_ENCONTRADO';
        const cidade = textoOuNulo(corpo.localidade);
        const uf = textoOuNulo(corpo.uf);
        if (!cidade || !uf) return 'INDISPONIVEL';
        return { cep, logradouro: textoOuNulo(corpo.logradouro), bairro: textoOuNulo(corpo.bairro), cidade, uf: uf.toUpperCase() };
      });
    } catch (err) {
      logger.warn({ provedor: 'viacep', motivo: err instanceof Timeout ? 'timeout' : 'erro' }, 'captura: consulta de CEP indisponível');
      return 'INDISPONIVEL';
    }
  }

  private async consultarCws(cep: string): Promise<Consulta> {
    const cws = this.cws;
    if (!cws) return 'INDISPONIVEL';
    try {
      const r = await comTimeout(this.timeoutMs, (signal) => cws(cep, signal));
      const cidade = textoOuNulo(r.localidade);
      const uf = textoOuNulo(r.uf);
      if (!cidade || !uf) return 'NAO_ENCONTRADO';
      return { cep, logradouro: textoOuNulo(r.logradouro), bairro: textoOuNulo(r.bairro), cidade, uf: uf.toUpperCase() };
    } catch (err) {
      if (err instanceof AppError && (err.statusCode === 404 || err.statusCode === 400)) return 'NAO_ENCONTRADO';
      logger.warn({ provedor: 'cws', motivo: err instanceof Timeout ? 'timeout' : 'erro' }, 'captura: consulta de CEP indisponível');
      return 'INDISPONIVEL';
    }
  }

  private async lerCache(chave: string): Promise<CepInfo | 'NAO_ENCONTRADO' | null> {
    try {
      const c = this.cache();
      if (!c) return null;
      const bruto = await c.get(chave);
      if (!bruto) return null;
      const v = JSON.parse(bruto) as { r: 'OK'; info: CepInfo } | { r: 'NAO_ENCONTRADO' };
      return v.r === 'OK' ? v.info : 'NAO_ENCONTRADO';
    } catch {
      return null;
    }
  }

  private async gravarCache(chave: string, valor: CepInfo | 'NAO_ENCONTRADO', ttl: number): Promise<void> {
    try {
      const c = this.cache();
      if (!c) return;
      const corpo = valor === 'NAO_ENCONTRADO' ? { r: 'NAO_ENCONTRADO' } : { r: 'OK', info: valor };
      await c.set(chave, JSON.stringify(corpo), 'EX', ttl);
    } catch {
      // cache é otimização
    }
  }
}

function rotulo(r: Consulta): string {
  return typeof r === 'object' ? 'encontrado' : r === 'NAO_ENCONTRADO' ? 'nao_encontrado' : 'indisponivel';
}

/** CWS só quando as credenciais estão no ambiente. */
function cwsPadrao(): ((cep: string, signal: AbortSignal) => Promise<CepCws>) | null {
  if (!process.env.CORREIOS_CWS_USERNAME) return null;
  return async (cep) => {
    const { cwsClient } = await import('../../integrations/correios-cws/cws.client');
    return cwsClient.buscarCep(cep);
  };
}
