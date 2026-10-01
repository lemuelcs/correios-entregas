/**
 * Seu Rastreio falso: `GET /api/public/rastreio/:codigo`.
 *
 * - `definirEvento(codigo, descricao, extras?)` programa o evento mais recente
 *   do código; `definirResposta(codigo, resposta)` programa qualquer resposta
 *   (500, atraso para tempo limite etc.).
 * - Código sem nada programado → 404.
 * - `token` informado → exige `Authorization: Bearer <token>` (senão 401).
 *
 * Aponte o cliente para ele com `SEU_RASTREIO_URL = fake.url` (ou a opção
 * `baseUrl` do `SeuRastreioClient`).
 */
import type { EventoRastreio } from '../../integrations/seu-rastreio/rastreio.client';
import { ServidorFalso, type RequisicaoGravada, type RespostaFalsa } from './servidor-falso';

export type { RequisicaoGravada, RespostaFalsa } from './servidor-falso';

const CAMINHO = /^\/api\/public\/rastreio\/([^/]+)$/;

export class SeuRastreioFake extends ServidorFalso {
  token?: string;
  private readonly respostas = new Map<string, RespostaFalsa>();

  constructor(opcoes: { token?: string } = {}) {
    super();
    this.token = opcoes.token;
  }

  static async iniciar(opcoes: { token?: string } = {}): Promise<SeuRastreioFake> {
    return new SeuRastreioFake(opcoes).iniciar();
  }

  override redefinir(): void {
    super.redefinir();
    this.respostas.clear();
  }

  /** Programa o evento mais recente de `codigo` (resposta 200). */
  definirEvento(
    codigo: string,
    descricao: string,
    extras: Partial<Omit<EventoRastreio, 'descricao'>> & { status?: string } = {},
  ): this {
    const { status, ...evento } = extras;
    this.respostas.set(codigo, {
      status: 200,
      corpo: {
        status: status ?? descricao,
        eventoMaisRecente: {
          data: evento.data ?? new Date().toISOString(),
          local: evento.local ?? 'CDD Teste - Brasília/DF',
          destino: evento.destino ?? null,
          descricao,
        },
      },
    });
    return this;
  }

  /** Programa uma resposta arbitrária para `codigo`. */
  definirResposta(codigo: string, resposta: RespostaFalsa): this {
    this.respostas.set(codigo, resposta);
    return this;
  }

  /** Códigos consultados, na ordem. */
  consultas(): string[] {
    return this.requisicoes
      .map((r) => CAMINHO.exec(r.caminho))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => decodeURIComponent(m[1]));
  }

  protected padrao(req: RequisicaoGravada): RespostaFalsa {
    const m = CAMINHO.exec(req.caminho);
    if (req.metodo !== 'GET' || !m) return { status: 404, corpo: { error: 'Not found' } };
    if (this.token && req.headers.authorization !== `Bearer ${this.token}`) {
      return { status: 401, corpo: { error: 'Unauthorized' } };
    }
    return this.respostas.get(decodeURIComponent(m[1])) ?? { status: 404, corpo: { error: 'Objeto não encontrado' } };
  }
}
