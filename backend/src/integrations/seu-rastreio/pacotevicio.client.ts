/**
 * Cliente do PacoteVicio.dev (rastreio dos Correios): `GET {base}/v1/track/{codigo}`
 * com `X-API-Key`. Implementa o mesmo `RastreioClient` do Seu Rastreio, então o
 * rastreio adaptativo, a atualização da página dos pacotes e as ações de botão
 * não mudam. `events` vem em ordem cronológica: o último é o mais recente.
 *
 * `PACOTEVICIO_API_KEY` liga o provedor; `PACOTEVICIO_URL` troca a origem (testes).
 */
import logger from '../../shared/utils/logger';
import { classificarEvento } from './classificacao';
import { RastreioError, type EventoRastreio, type OpcoesRastreioClient, type RastreioClient, type ResultadoRastreio } from './rastreio.client';

export const PACOTEVICIO_URL_PADRAO = 'https://api.pacotevicio.dev';

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** "Cidade - Unidade" (ou só um deles) a partir de `location`/`destination`. */
function lugar(v: unknown): string | null {
  const o = obj(v);
  if (!o) return null;
  const partes = [texto(o.city), texto(o.facility)].filter((p): p is string => p !== null);
  return partes.length > 0 ? partes.join(' - ') : null;
}

export class PacoteVicioClient implements RastreioClient {
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opcoes: OpcoesRastreioClient = {}) {
    this.timeoutMs = opcoes.timeoutMs ?? 5_000;
    this.fetchFn = opcoes.fetch ?? ((...args) => fetch(...args));
  }

  async consultar(codigo: string): Promise<ResultadoRastreio | null> {
    const chave = this.opcoes.token ?? process.env.PACOTEVICIO_API_KEY ?? '';
    if (!chave) throw new RastreioError(503, 'sem_credencial', false);
    const base = (this.opcoes.baseUrl ?? process.env.PACOTEVICIO_URL ?? PACOTEVICIO_URL_PADRAO).replace(/\/+$/, '');

    let resposta: Response;
    try {
      resposta = await this.fetchFn(`${base}/v1/track/${encodeURIComponent(codigo)}`, {
        method: 'GET',
        headers: { 'X-API-Key': chave, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const nome = (err as { name?: unknown } | null)?.name;
      const code = nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'falha_rede';
      logger.warn({ codigo, code }, 'entregas.rastreio (pacotevicio) consulta sem resposta');
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
      logger.warn({ codigo, status: resposta.status, code }, 'entregas.rastreio (pacotevicio) resposta de erro');
      throw new RastreioError(resposta.status, code);
    }

    let dados: Obj;
    try {
      const j = obj(await resposta.json());
      if (!j) throw new Error('formato');
      dados = j;
    } catch {
      throw new RastreioError(502, 'resposta_invalida', false);
    }

    const eventos = Array.isArray(dados.events) ? dados.events.map(obj).filter((e): e is Obj => e !== null) : [];
    // Em ordem cronológica; por garantia, escolhe o de maior timestamp válido.
    const recente = eventos.reduce<Obj | null>((a, e) => {
      const t = Date.parse(String(e.timestamp ?? ''));
      if (Number.isNaN(t)) return a;
      return a === null || t >= Date.parse(String(a.timestamp)) ? e : a;
    }, null);

    const eventoMaisRecente: EventoRastreio | null = recente
      ? {
          data: texto(recente.timestamp),
          local: lugar(recente.location),
          destino: lugar(recente.destination),
          descricao: texto(recente.description) ?? texto(recente.courier_status_label),
        }
      : null;

    return {
      codigo: texto(dados.tracking_code) ?? codigo,
      status: texto(dados.status),
      eventoMaisRecente,
      classificacao: classificarEvento(eventoMaisRecente?.descricao),
    };
  }
}
