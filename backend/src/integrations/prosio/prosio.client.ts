/**
 * Cliente das APIs do Prosio usadas pelas entregas mediadas (ADR-011):
 * mensagens (`POST /api/v1/messages`), mediação (`/api/v1/mediation/cases`) e
 * sessão de atendimento (`POST /api/v1/atendimento/sessoes`).
 *
 * Cada chamada recebe o `CanalResolvido` (credenciais decifradas de um
 * `CanalProsio`) e autentica com `Authorization: Bearer <apiKey>`. Falhas viram
 * `ProsioError(status, code)`, com `tentavel` para 429, 5xx e falhas sem
 * resposta. Nenhum segredo, telefone ou corpo de mensagem vai para o log.
 *
 * **Mediação: contrato real × TechSpec.** O `MediationOpenCaseRequestSchema`
 * do Prosio é `strictObject` com `externalRef`, `providerPhone`,
 * `recipientPhone`, `motivo?` e `optIn?`: um campo a mais faz a abertura ser
 * recusada (422). Por isso `resumo` (R5), `respondBy` (R3), `unidadeRef` (P1)
 * e `firstContact: 'integrador'` (R1) só vão para o fio com
 * `extensoesMediacao: true` (env `PROSIO_MEDIACAO_EXTENSOES=true`), ligado
 * quando o Prosio passar a aceitá-los. Pelo mesmo motivo, `atualizarFatosCaso`
 * (R2, sem rota pública no Prosio) recusa com `ProsioError(501,
 * 'fatos_nao_suportados')` sem chamar a rede enquanto as extensões estão
 * desligadas.
 */
import type { CanalProsio } from '@prisma/client';
import logger from '../../shared/utils/logger';
import { decifrar } from '../../shared/utils/cripto';
import {
  ProsioError,
  type CanalResolvido,
  type CasoAberto,
  type FatosCaso,
  type NovaMensagem,
  type NovoCaso,
  type PrimeiroContato,
  type SessaoAtendimento,
  type UsuarioAtendimento,
} from './prosio.types';

export * from './prosio.types';

export interface ProsioClient {
  enviarMensagem(canal: CanalResolvido, msg: NovaMensagem): Promise<{ messageId: string }>;
  abrirCaso(canal: CanalResolvido, caso: NovoCaso): Promise<CasoAberto>;
  atualizarFatosCaso(canal: CanalResolvido, caseId: string, fatos: FatosCaso): Promise<void>;
  cancelarCaso(canal: CanalResolvido, caseId: string): Promise<void>;
  criarSessaoAtendimento(canal: CanalResolvido, u: UsuarioAtendimento): Promise<SessaoAtendimento>;
}

export interface OpcoesProsioClient {
  /** Tempo limite por chamada (padrão 10 s). */
  timeoutMs?: number;
  /** Envia os campos R1/R3/R5/P1 na abertura e habilita `atualizarFatosCaso`. */
  extensoesMediacao?: boolean;
  /** Para testes. */
  fetch?: typeof fetch;
}

type CanalComSegredos = Pick<
  CanalProsio,
  'id' | 'nome' | 'baseUrl' | 'tipo' | 'compartilhado' | 'apiKeyCifrada' | 'callbackSecretCifrado'
>;

/**
 * Decifra as credenciais de um `CanalProsio`. Os segredos ficam em
 * propriedades não enumeráveis (fora de `JSON.stringify` e dos logs).
 * Credencial ilegível (chave trocada, texto corrompido) →
 * `ProsioError(503, 'credencial_ilegivel')`, não tentável.
 */
export function resolverCanal(canal: CanalComSegredos, chave?: Buffer): CanalResolvido {
  let apiKey: string;
  let callbackSecret: string;
  try {
    apiKey = decifrar(canal.apiKeyCifrada, chave);
    callbackSecret = decifrar(canal.callbackSecretCifrado, chave);
  } catch {
    logger.error({ canalId: canal.id }, 'entregas.prosio credencial do canal ilegível');
    throw new ProsioError(503, 'credencial_ilegivel', { tentavel: false });
  }
  const resolvido = {
    id: canal.id,
    nome: canal.nome,
    baseUrl: canal.baseUrl.replace(/\/+$/, ''),
    tipo: canal.tipo,
    compartilhado: canal.compartilhado,
  };
  Object.defineProperties(resolvido, {
    apiKey: { value: apiKey, enumerable: false },
    callbackSecret: { value: callbackSecret, enumerable: false },
  });
  return Object.freeze(resolvido) as CanalResolvido;
}

function registro(valor: unknown): Record<string, unknown> | undefined {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

/**
 * O Prosio devolve erros em três formatos: `{ code, message }` (`CodedError`,
 * atendimento), `{ error, details: { reason, detail } }` (`AppError`, recusas
 * da mediação) e `{ error: 'Invalid request', details }` (Zod). O `code` sai do
 * primeiro que existir; sem nenhum, de uma tabela por status.
 */
function codigoDoErro(status: number, corpo: unknown): { code: string; detalhe?: string } {
  const r = registro(corpo);
  const detalhes = registro(r?.details);
  const code =
    texto(r?.code) ??
    texto(detalhes?.reason) ??
    texto(r?.reason) ??
    (status === 429
      ? 'rate_limited'
      : status === 401
        ? 'nao_autorizado'
        : status === 403
          ? 'proibido'
          : status === 404
            ? 'nao_encontrado'
            : status === 409
              ? 'conflito'
              : status === 400 || status === 422
                ? 'requisicao_invalida'
                : status >= 500
                  ? 'erro_prosio'
                  : `http_${status}`);
  const detalhe = texto(detalhes?.detail) ?? texto(r?.message);
  return detalhe ? { code, detalhe: detalhe.slice(0, 300) } : { code };
}

export class ProsioHttpClient implements ProsioClient {
  private readonly timeoutMs: number;
  private readonly extensoesMediacao: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(opcoes: OpcoesProsioClient = {}) {
    this.timeoutMs = opcoes.timeoutMs ?? 10_000;
    this.extensoesMediacao = opcoes.extensoesMediacao ?? process.env.PROSIO_MEDIACAO_EXTENSOES === 'true';
    this.fetchFn = opcoes.fetch ?? ((...args) => fetch(...args));
  }

  async enviarMensagem(canal: CanalResolvido, msg: NovaMensagem): Promise<{ messageId: string }> {
    const corpo = {
      channel: 'whatsapp',
      to: msg.to,
      body: msg.body,
      reference: msg.reference,
      idempotencyKey: msg.idempotencyKey,
      ...(msg.buttons && msg.buttons.length > 0 ? { buttons: msg.buttons } : {}),
      ...(msg.unidadeRef ? { unidadeRef: msg.unidadeRef } : {}),
    };
    const { dados } = await this.chamar(canal, 'POST', '/api/v1/messages', corpo, msg.idempotencyKey);
    const messageId = texto(registro(dados)?.messageId);
    if (!messageId) throw new ProsioError(502, 'resposta_invalida');
    return { messageId };
  }

  async abrirCaso(canal: CanalResolvido, caso: NovoCaso): Promise<CasoAberto> {
    const corpo: Record<string, unknown> = {
      externalRef: caso.externalRef,
      providerPhone: caso.providerPhone,
      recipientPhone: caso.recipientPhone,
      ...(caso.motivo ? { motivo: caso.motivo } : {}),
    };
    if (this.extensoesMediacao) {
      corpo.firstContact = 'integrador';
      corpo.resumo = caso.resumo;
      corpo.respondBy = caso.respondBy.toISOString();
      if (caso.unidadeRef) corpo.unidadeRef = caso.unidadeRef;
    }
    const { status, dados } = await this.chamar(canal, 'POST', '/api/v1/mediation/cases', corpo);
    const r = registro(dados);
    const caseId = texto(r?.caseId);
    if (!caseId) throw new ProsioError(502, 'resposta_invalida');
    const firstContact = texto(r?.firstContact) as PrimeiroContato | undefined;
    const protocolo = texto(r?.protocolo);
    return {
      caseId,
      created: status === 201,
      ...(firstContact ? { firstContact } : {}),
      ...(protocolo ? { protocolo } : {}),
      ...(r && 'expiresAt' in r ? { expiresAt: (r.expiresAt as string | null) ?? null } : {}),
    };
  }

  async atualizarFatosCaso(canal: CanalResolvido, caseId: string, fatos: FatosCaso): Promise<void> {
    if (!this.extensoesMediacao) {
      throw new ProsioError(501, 'fatos_nao_suportados', { tentavel: false });
    }
    await this.chamar(canal, 'PATCH', `/api/v1/mediation/cases/${encodeURIComponent(caseId)}/facts`, {
      motivoRelatado: fatos.motivoRelatado,
      perguntaAberta: fatos.perguntaAberta,
    });
  }

  async cancelarCaso(canal: CanalResolvido, caseId: string): Promise<void> {
    await this.chamar(canal, 'POST', `/api/v1/mediation/cases/${encodeURIComponent(caseId)}/cancel`, {});
  }

  async criarSessaoAtendimento(canal: CanalResolvido, u: UsuarioAtendimento): Promise<SessaoAtendimento> {
    const corpo = {
      usuario: { idExterno: u.idExterno, nome: u.nome, email: u.email, papel: u.papel },
      ...(u.dominio ? { dominio: u.dominio } : {}),
      ...(u.unidadeRef ? { unidadeRef: u.unidadeRef } : {}),
    };
    const { dados } = await this.chamar(canal, 'POST', '/api/v1/atendimento/sessoes', corpo);
    const r = registro(dados);
    const url = texto(r?.url);
    const expiraEm = texto(r?.expiraEm);
    if (!url || !expiraEm) throw new ProsioError(502, 'resposta_invalida');
    return { url, expiraEm };
  }

  private async chamar(
    canal: CanalResolvido,
    metodo: 'POST' | 'PATCH',
    caminho: string,
    corpo: unknown,
    idempotencyKey?: string,
  ): Promise<{ status: number; dados: unknown }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${canal.apiKey}`,
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    let resposta: Response;
    try {
      resposta = await this.fetchFn(`${canal.baseUrl}${caminho}`, {
        method: metodo,
        headers,
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // DOMException do AbortSignal não é `instanceof Error` em todo realm (ex.: Jest): compara pelo nome.
      const nome = (err as { name?: unknown } | null)?.name;
      const code = nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'falha_rede';
      logger.warn({ canalId: canal.id, caminho, code }, 'entregas.prosio falha sem resposta');
      throw new ProsioError(0, code);
    }

    const bruto = await resposta.text().catch(() => '');
    let dados: unknown = undefined;
    if (bruto) {
      try {
        dados = JSON.parse(bruto);
      } catch {
        dados = undefined;
      }
    }

    if (!resposta.ok) {
      const { code, detalhe } = codigoDoErro(resposta.status, dados);
      logger.warn(
        { canalId: canal.id, caminho, status: resposta.status, code },
        'entregas.prosio resposta de erro',
      );
      throw new ProsioError(resposta.status, code, detalhe ? { detalhe } : {});
    }
    return { status: resposta.status, dados };
  }
}

/** Instância padrão, com as opções vindas do ambiente. */
export const prosioClient: ProsioClient = new ProsioHttpClient();
