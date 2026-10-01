/**
 * Cliente do Seu Rastreio (ADR-016): `GET {base}/api/public/rastreio/{codigo}`
 * com `Authorization: Bearer ${SEU_RASTREIO_TOKEN}` e limite de 3 s. Sem retry
 * aqui: o caminho síncrono (ação de botão) não repete, e o worker usa as
 * tentativas do BullMQ olhando `RastreioError.tentavel`.
 *
 * `SEU_RASTREIO_URL` troca a origem (padrão `https://seurastreio.com.br`); os
 * testes apontam para o servidor falso.
 */
import logger from '../../shared/utils/logger';
import { classificarEvento, VERSAO_PADROES_RASTREIO, type ClassificacaoEvento } from './classificacao';

export { classificarEvento, type ClassificacaoEvento } from './classificacao';

export const SEU_RASTREIO_URL_PADRAO = 'https://seurastreio.com.br';

export interface EventoRastreio {
  data: string | null;
  local: string | null;
  destino: string | null;
  descricao: string | null;
}

export interface ResultadoRastreio {
  codigo: string;
  status: string | null;
  eventoMaisRecente: EventoRastreio | null;
  /** `classificarEvento(eventoMaisRecente.descricao)`. */
  classificacao: ClassificacaoEvento | null;
}

/** `status` 0 = sem resposta (tempo limite ou rede). */
export class RastreioError extends Error {
  readonly tentavel: boolean;

  constructor(
    public status: number,
    public code: string,
    tentavel?: boolean,
  ) {
    super(code);
    this.name = 'RastreioError';
    this.tentavel = tentavel ?? (status === 0 || status === 429 || status >= 500);
  }
}

export interface RastreioClient {
  /** `null` quando o Seu Rastreio não conhece o código (404). */
  consultar(codigo: string): Promise<ResultadoRastreio | null>;
}

export interface OpcoesRastreioClient {
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

function textoOuNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export class SeuRastreioClient implements RastreioClient {
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opcoes: OpcoesRastreioClient = {}) {
    this.timeoutMs = opcoes.timeoutMs ?? 3_000;
    this.fetchFn = opcoes.fetch ?? ((...args) => fetch(...args));
  }

  async consultar(codigo: string): Promise<ResultadoRastreio | null> {
    const token = this.opcoes.token ?? process.env.SEU_RASTREIO_TOKEN ?? '';
    if (!token) throw new RastreioError(503, 'sem_credencial', false);
    const base = (this.opcoes.baseUrl ?? process.env.SEU_RASTREIO_URL ?? SEU_RASTREIO_URL_PADRAO).replace(/\/+$/, '');

    let resposta: Response;
    try {
      resposta = await this.fetchFn(`${base}/api/public/rastreio/${encodeURIComponent(codigo)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // DOMException do AbortSignal não é `instanceof Error` em todo realm (ex.: Jest): compara pelo nome.
      const nome = (err as { name?: unknown } | null)?.name;
      const code = nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'falha_rede';
      logger.warn({ codigo, code }, 'entregas.rastreio consulta sem resposta');
      throw new RastreioError(0, code);
    }

    if (resposta.status === 404) {
      await resposta.text().catch(() => '');
      return null;
    }
    if (!resposta.ok) {
      await resposta.text().catch(() => '');
      const code = resposta.status === 401 || resposta.status === 403 ? 'nao_autorizado'
        : resposta.status === 429 ? 'rate_limited' : `http_${resposta.status}`;
      logger.warn({ codigo, status: resposta.status, code }, 'entregas.rastreio resposta de erro');
      throw new RastreioError(resposta.status, code);
    }

    let dados: Record<string, unknown>;
    try {
      const j = (await resposta.json()) as unknown;
      if (j === null || typeof j !== 'object' || Array.isArray(j)) throw new Error('formato');
      dados = j as Record<string, unknown>;
    } catch {
      throw new RastreioError(502, 'resposta_invalida', false);
    }

    const ev = dados.eventoMaisRecente;
    const eventoMaisRecente: EventoRastreio | null =
      ev !== null && typeof ev === 'object' && !Array.isArray(ev)
        ? {
            data: textoOuNull((ev as Record<string, unknown>).data),
            local: textoOuNull((ev as Record<string, unknown>).local),
            destino: textoOuNull((ev as Record<string, unknown>).destino),
            descricao: textoOuNull((ev as Record<string, unknown>).descricao),
          }
        : null;
    const classificacao = classificarEvento(eventoMaisRecente?.descricao);
    if (eventoMaisRecente?.descricao && !classificacao) {
      logger.info(
        { codigo, versaoPadroes: VERSAO_PADROES_RASTREIO, descricao: eventoMaisRecente.descricao },
        'entregas.rastreio evento não mapeado',
      );
    }
    return { codigo, status: textoOuNull(dados.status), eventoMaisRecente, classificacao };
  }
}

/** Instância padrão (token e origem lidos do ambiente a cada chamada). */
export const rastreioClient: RastreioClient = new SeuRastreioClient();
