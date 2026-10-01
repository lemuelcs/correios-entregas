/**
 * Base dos servidores HTTP falsos dos testes (Prosio, Seu Rastreio).
 *
 * - Sobe em `127.0.0.1` numa porta aleatória, ou na informada (`url` é a origin).
 * - Grava toda requisição (`requisicoes`), com corpo cru e já interpretado.
 * - Responde pelo roteiro do teste (`roteirizar`) ou, sem roteiro que case,
 *   pelo comportamento padrão da subclasse.
 * - `parar()` fecha o servidor e derruba as conexões abertas.
 */
import http from 'http';
import type { AddressInfo, Socket } from 'net';

export interface RequisicaoGravada {
  metodo: string;
  /** Caminho sem a query string. */
  caminho: string;
  query: URLSearchParams;
  /** Nomes em minúsculas. */
  headers: Record<string, string>;
  corpoCru: string;
  /** JSON interpretado; `undefined` se vazio ou inválido. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON livre, lido à vontade nos testes
  corpo: any;
  recebidaEm: Date;
  /** Preenchida depois que a resposta é enviada. */
  resposta?: { status: number; corpo: unknown };
}

export interface RespostaFalsa {
  status: number;
  corpo?: unknown;
  headers?: Record<string, string>;
  /** Atraso antes de responder (para testar tempo limite). */
  atrasoMs?: number;
}

export type RespostaOuFuncao =
  | RespostaFalsa
  | ((req: RequisicaoGravada) => RespostaFalsa | undefined | Promise<RespostaFalsa | undefined>);

interface EntradaRoteiro {
  metodo: string;
  caminho: string | RegExp;
  resposta: RespostaOuFuncao;
  /** `undefined` = sempre; número = quantas vezes ainda vale. */
  restantes?: number;
}

export abstract class ServidorFalso {
  readonly requisicoes: RequisicaoGravada[] = [];
  private roteiro: EntradaRoteiro[] = [];
  private servidor?: http.Server;
  private readonly sockets = new Set<Socket>();
  private porta = 0;

  get url(): string {
    if (!this.porta) throw new Error('servidor falso não iniciado');
    return `http://127.0.0.1:${this.porta}`;
  }

  /** `porta` 0 (padrão) = porta livre aleatória; o harness da UI (e2e) usa uma fixa. */
  async iniciar(porta = 0): Promise<this> {
    const servidor = http.createServer((req, res) => {
      void this.atender(req, res);
    });
    servidor.on('connection', (s) => {
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
    });
    await new Promise<void>((ok, falha) => {
      servidor.once('error', falha);
      servidor.listen(porta, '127.0.0.1', () => ok());
    });
    this.servidor = servidor;
    this.porta = (servidor.address() as AddressInfo).port;
    return this;
  }

  async parar(): Promise<void> {
    const servidor = this.servidor;
    if (!servidor) return;
    this.servidor = undefined;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    await new Promise<void>((ok) => servidor.close(() => ok()));
  }

  /**
   * Programa uma resposta para `metodo caminho` (string exata ou RegExp).
   * `vezes` limita quantas requisições ela atende; sem `vezes`, vale até
   * `redefinir()`. O roteiro mais recente tem prioridade. Uma função que
   * devolve `undefined` passa a vez ao próximo roteiro ou ao padrão.
   */
  roteirizar(metodo: string, caminho: string | RegExp, resposta: RespostaOuFuncao, vezes?: number): this {
    this.roteiro.unshift({ metodo: metodo.toUpperCase(), caminho, resposta, restantes: vezes });
    return this;
  }

  /** Esquece roteiros e requisições gravadas (e o estado da subclasse). */
  redefinir(): void {
    this.roteiro = [];
    this.requisicoes.length = 0;
  }

  protected abstract padrao(req: RequisicaoGravada): RespostaFalsa | Promise<RespostaFalsa>;

  private async atender(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const partes: Buffer[] = [];
    for await (const p of req) partes.push(p as Buffer);
    const corpoCru = Buffer.concat(partes).toString('utf8');
    let corpo: unknown;
    try {
      corpo = corpoCru ? JSON.parse(corpoCru) : undefined;
    } catch {
      corpo = undefined;
    }
    const alvo = new URL(req.url ?? '/', 'http://falso');
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
    }
    const gravada: RequisicaoGravada = {
      metodo: (req.method ?? 'GET').toUpperCase(),
      caminho: alvo.pathname,
      query: alvo.searchParams,
      headers,
      corpoCru,
      corpo,
      recebidaEm: new Date(),
    };
    this.requisicoes.push(gravada);

    let resposta: RespostaFalsa;
    try {
      resposta = (await this.doRoteiro(gravada)) ?? (await this.padrao(gravada));
    } catch (err) {
      resposta = { status: 500, corpo: { error: `falso: ${(err as Error).message}` } };
    }
    if (resposta.atrasoMs) await new Promise((ok) => setTimeout(ok, resposta.atrasoMs));
    gravada.resposta = { status: resposta.status, corpo: resposta.corpo };
    if (res.destroyed) return;
    const texto = resposta.corpo === undefined ? '' : JSON.stringify(resposta.corpo);
    res.writeHead(resposta.status, {
      ...(texto ? { 'Content-Type': 'application/json' } : {}),
      ...resposta.headers,
    });
    res.end(texto);
  }

  private async doRoteiro(req: RequisicaoGravada): Promise<RespostaFalsa | undefined> {
    for (const entrada of this.roteiro) {
      if (entrada.metodo !== req.metodo) continue;
      const casa =
        typeof entrada.caminho === 'string' ? entrada.caminho === req.caminho : entrada.caminho.test(req.caminho);
      if (!casa) continue;
      if (entrada.restantes !== undefined && entrada.restantes <= 0) continue;
      const r = typeof entrada.resposta === 'function' ? await entrada.resposta(req) : entrada.resposta;
      if (!r) continue;
      if (entrada.restantes !== undefined) entrada.restantes -= 1;
      return r;
    }
    return undefined;
  }
}
