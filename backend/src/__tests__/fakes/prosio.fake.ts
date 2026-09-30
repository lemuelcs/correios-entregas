/**
 * Prosio falso para os testes de integração (ADR-011, ADR-014).
 *
 * Comportamento padrão (sobreponível por `roteirizar`):
 * - `POST /api/v1/messages` → 202 `{ messageId, status: 'accepted' }`; o mesmo
 *   `Idempotency-Key` devolve o mesmo `messageId` (como o Prosio real).
 * - `POST /api/v1/mediation/cases` → 201 na primeira `externalRef`, 200 com
 *   `created: false` nas seguintes; `firstContact` = `primeiroContato`.
 * - `PATCH /api/v1/mediation/cases/:id/facts` → 200 (formato previsto no
 *   TechSpec, R2; o Prosio real ainda não tem essa rota).
 * - `POST /api/v1/mediation/cases/:id/cancel` → 200, idempotente.
 * - `POST /api/v1/atendimento/sessoes` → 200 `{ url, expiraEm }`.
 * - `Authorization` diferente de `Bearer <apiKey>` (quando `apiKey` foi
 *   informada) → 401 `{ code: 'chave_invalida' }`.
 *
 * Com `mediacaoEstrita: true`, a abertura de caso recusa campos fora do
 * `MediationOpenCaseRequestSchema` real com 422 `details.reason:
 * 'invalid_phone'` — exatamente o que o Prosio de hoje faz.
 *
 * Também faz o papel do Prosio chamando o correios-entregas:
 * `enviarCallback*` (assinados com HMAC) e `acionarBotao` (integração
 * `buttonAction` do tenant).
 */
import { assinarCorpo } from '../../integrations/prosio/assinatura';
import type {
  CallbackDesfechoMediacao,
  CallbackStatusMensagem,
  PrimeiroContato,
} from '../../integrations/prosio/prosio.types';
import { ServidorFalso, type RequisicaoGravada, type RespostaFalsa } from './servidor-falso';

export type { RequisicaoGravada, RespostaFalsa } from './servidor-falso';

export interface OpcoesProsioFake {
  /** Quando informada, exige `Authorization: Bearer <apiKey>`. */
  apiKey?: string;
  primeiroContato?: PrimeiroContato;
  mediacaoEstrita?: boolean;
}

export interface RespostaCallback {
  status: number;
  corpo: unknown;
}

const CAMPOS_ABERTURA_REAIS = new Set(['externalRef', 'providerPhone', 'recipientPhone', 'motivo', 'optIn']);

export class ProsioFake extends ServidorFalso {
  apiKey?: string;
  primeiroContato: PrimeiroContato;
  mediacaoEstrita: boolean;

  private seq = 0;
  private readonly porIdempotencia = new Map<string, string>();
  private readonly casosPorRef = new Map<string, string>();
  private readonly cancelados = new Set<string>();

  constructor(opcoes: OpcoesProsioFake = {}) {
    super();
    this.apiKey = opcoes.apiKey;
    this.primeiroContato = opcoes.primeiroContato ?? 'queued';
    this.mediacaoEstrita = opcoes.mediacaoEstrita ?? false;
  }

  static async iniciar(opcoes: OpcoesProsioFake = {}): Promise<ProsioFake> {
    return new ProsioFake(opcoes).iniciar();
  }

  override redefinir(): void {
    super.redefinir();
    this.porIdempotencia.clear();
    this.casosPorRef.clear();
    this.cancelados.clear();
  }

  // ——— Consultas às requisições gravadas ————————————————————————————

  /** `POST /api/v1/messages` recebidos. */
  mensagens(): RequisicaoGravada[] {
    return this.requisicoes.filter((r) => r.metodo === 'POST' && r.caminho === '/api/v1/messages');
  }

  /** `POST /api/v1/mediation/cases` recebidos. */
  aberturasDeCaso(): RequisicaoGravada[] {
    return this.requisicoes.filter((r) => r.metodo === 'POST' && r.caminho === '/api/v1/mediation/cases');
  }

  atualizacoesDeFatos(): RequisicaoGravada[] {
    return this.requisicoes.filter((r) => r.metodo === 'PATCH' && /^\/api\/v1\/mediation\/cases\/[^/]+\/facts$/.test(r.caminho));
  }

  cancelamentos(): RequisicaoGravada[] {
    return this.requisicoes.filter((r) => r.metodo === 'POST' && /^\/api\/v1\/mediation\/cases\/[^/]+\/cancel$/.test(r.caminho));
  }

  sessoes(): RequisicaoGravada[] {
    return this.requisicoes.filter((r) => r.metodo === 'POST' && r.caminho === '/api/v1/atendimento/sessoes');
  }

  /** `messageId` devolvido para uma mensagem gravada. */
  messageIdDe(req: RequisicaoGravada): string | undefined {
    const corpo = req.resposta?.corpo as { messageId?: string } | undefined;
    return corpo?.messageId;
  }

  /** `caseId` do caso aberto para `externalRef`, se houver. */
  caseIdDe(externalRef: string): string | undefined {
    return this.casosPorRef.get(externalRef);
  }

  // ——— O Prosio chamando o correios-entregas ————————————————————————

  /**
   * POST de `payload` em `url` com `X-Webhook-Signature: sha256=<HMAC>` do
   * corpo exato enviado. `assinatura` sobrescreve o header (ex.: inválida);
   * `null` omite o header.
   */
  async enviarCallback(
    url: string,
    payload: unknown,
    segredo: string,
    opcoes: { assinatura?: string | null; corpoCru?: string } = {},
  ): Promise<RespostaCallback> {
    const corpo = opcoes.corpoCru ?? JSON.stringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json', connection: 'close' };
    const assinatura = opcoes.assinatura === undefined ? assinarCorpo(corpo, segredo) : opcoes.assinatura;
    if (assinatura !== null) headers['X-Webhook-Signature'] = assinatura;
    const resposta = await fetch(url, { method: 'POST', headers, body: corpo });
    return { status: resposta.status, corpo: await lerCorpo(resposta) };
  }

  /** Callback de status de mensagem (`MessageStatusCallbackSchema`). */
  async enviarCallbackStatus(
    url: string,
    segredo: string,
    dados: Pick<CallbackStatusMensagem, 'messageId' | 'status'> & Partial<CallbackStatusMensagem>,
    opcoes: { assinatura?: string | null } = {},
  ): Promise<RespostaCallback> {
    const payload: CallbackStatusMensagem = {
      channel: 'whatsapp',
      reference: null,
      occurredAt: new Date().toISOString(),
      failureReason: null,
      ...dados,
    };
    return this.enviarCallback(url, payload, segredo, opcoes);
  }

  /** Callback `mediation.outcome` (`MediationOutcomeCallbackSchema`). */
  async enviarCallbackDesfecho(
    url: string,
    segredo: string,
    dados: Pick<CallbackDesfechoMediacao, 'caseId' | 'externalRef'> & {
      outcome: Partial<CallbackDesfechoMediacao['outcome']> & Pick<CallbackDesfechoMediacao['outcome'], 'motivo'>;
    } & Partial<Omit<CallbackDesfechoMediacao, 'outcome' | 'caseId' | 'externalRef'>>,
    opcoes: { assinatura?: string | null } = {},
  ): Promise<RespostaCallback> {
    this.seq += 1;
    const agora = new Date().toISOString();
    const { outcome, ...resto } = dados;
    const payload: CallbackDesfechoMediacao = {
      event: 'mediation.outcome',
      deliveryId: `dlv_falso_${this.seq}`,
      sequence: 1,
      occurredAt: agora,
      disposition: 'decidido',
      ...resto,
      outcome: {
        estado: 'resolvido',
        exigeAcao: false,
        decididoPor: 'recipient',
        decididoEm: agora,
        ...outcome,
      },
    };
    return this.enviarCallback(url, payload, segredo, opcoes);
  }

  /**
   * Simula a integração `buttonAction` do tenant: `POST url` com
   * `Authorization: Bearer <token>`, o telefone de quem tocou em
   * `x-actor-phone` e o argumento do botão como única entrada (`{ acao }`).
   */
  async acionarBotao(
    url: string,
    dados: { token: string; acao: string; telefone: string; campo?: string },
  ): Promise<RespostaCallback> {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${dados.token}`,
        'x-actor-phone': dados.telefone,
        connection: 'close',
      },
      body: JSON.stringify({ [dados.campo ?? 'acao']: dados.acao }),
    });
    return { status: resposta.status, corpo: await lerCorpo(resposta) };
  }

  // ——— Comportamento padrão ————————————————————————————————————————

  protected padrao(req: RequisicaoGravada): RespostaFalsa {
    if (this.apiKey && req.headers.authorization !== `Bearer ${this.apiKey}`) {
      return { status: 401, corpo: { code: 'chave_invalida', message: 'Chave de API inválida ou revogada.' } };
    }

    if (req.metodo === 'POST' && req.caminho === '/api/v1/messages') {
      const chave = req.headers['idempotency-key'] ?? req.corpo?.idempotencyKey;
      let messageId = chave ? this.porIdempotencia.get(chave) : undefined;
      if (!messageId) {
        this.seq += 1;
        messageId = `msg_falso_${this.seq}`;
        if (chave) this.porIdempotencia.set(chave, messageId);
      }
      return { status: 202, corpo: { messageId, status: 'accepted' } };
    }

    if (req.metodo === 'POST' && req.caminho === '/api/v1/mediation/cases') {
      const corpo = (req.corpo ?? {}) as Record<string, unknown>;
      if (this.mediacaoEstrita) {
        const extras = Object.keys(corpo).filter((k) => !CAMPOS_ABERTURA_REAIS.has(k));
        if (extras.length > 0) {
          return {
            status: 422,
            corpo: {
              error: 'Pontas inválidas para abrir o caso',
              details: { reason: 'invalid_phone', detail: extras.map((k) => `(raiz): Unrecognized key: "${k}"`).join('; ') },
            },
          };
        }
      }
      const externalRef = String(corpo.externalRef ?? '');
      const existente = this.casosPorRef.get(externalRef);
      const created = !existente;
      let caseId = existente;
      if (!caseId) {
        this.seq += 1;
        caseId = `caso_falso_${this.seq}`;
        this.casosPorRef.set(externalRef, caseId);
      }
      return {
        status: created ? 201 : 200,
        corpo: {
          caseId,
          externalRef,
          status: 'open',
          protocolo: caseId.slice(-6).toUpperCase(),
          created,
          envelopeVersion: 1,
          expiresAt: typeof corpo.respondBy === 'string' ? corpo.respondBy : null,
          firstContact: created ? this.primeiroContato : 'not_required',
        },
      };
    }

    const fatos = /^\/api\/v1\/mediation\/cases\/([^/]+)\/facts$/.exec(req.caminho);
    if (req.metodo === 'PATCH' && fatos) {
      return { status: 200, corpo: { caseId: decodeURIComponent(fatos[1]), facts: req.corpo ?? {} } };
    }

    const cancelar = /^\/api\/v1\/mediation\/cases\/([^/]+)\/cancel$/.exec(req.caminho);
    if (req.metodo === 'POST' && cancelar) {
      const caseId = decodeURIComponent(cancelar[1]);
      const cancelled = !this.cancelados.has(caseId);
      this.cancelados.add(caseId);
      return { status: 200, corpo: { caseId, status: 'cancelled', cancelled, outcomePreserved: false } };
    }

    if (req.metodo === 'POST' && req.caminho === '/api/v1/atendimento/sessoes') {
      this.seq += 1;
      return {
        status: 200,
        corpo: {
          url: `${this.url}/app/login?sso_token=falso_${this.seq}`,
          expiraEm: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      };
    }

    return { status: 404, corpo: { error: 'Not found' } };
  }
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}
