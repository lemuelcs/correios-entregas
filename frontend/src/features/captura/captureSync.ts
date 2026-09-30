/**
 * Sincronizador da fila da captura (ADR-012).
 *
 * - Envia em série, na ordem de `capturadoEm`, um `POST /captura/capturas` multipart por captura.
 * - Gatilhos: evento `online`, volta ao primeiro plano (`visibilitychange`) e a cada 30 s.
 * - Retry: rede, 408, 409, 429 e 5xx → volta a `aguardando` (tentativas+1);
 *   outros 4xx → `falhou_definitivo` com o motivo; 401 (refresh falhou) → pausa sem
 *   apagar nada até um novo login.
 * - Operações feitas sem rede ("desfazer") são enviadas antes das capturas novas.
 */
import { ApiError, api } from '@/services/api';
import {
  obterCaptureQueue,
  type CaptureQueue,
  type CapturaLocal,
  type OperacaoPendente,
  type ResultadoCaptura,
} from './captureQueue';

export const INTERVALO_SYNC_MS = 30_000;

/** Status em que a captura continua na fila para outra tentativa. */
const STATUS_TRANSITORIOS = new Set([408, 409, 429]);

export type Envio = (captura: CapturaLocal) => Promise<ResultadoCaptura>;
export type EnvioDesfazer = (capturaId: string) => Promise<void>;

export interface Contadores {
  /** Ainda não enviadas (aguardando + enviando). */
  aguardando: number;
  /** Resultados PARA_CONFERIR/TRANSFERENCIA_PENDENTE recentes + recusas definitivas. */
  paraConferir: number;
}

export type EventoSync =
  | { tipo: 'progresso'; contadores: Contadores }
  | { tipo: 'resultado'; capturaId: string; resultado: ResultadoCaptura }
  | { tipo: 'falhou'; capturaId: string; motivo: string }
  | { tipo: 'pausado' }
  | { tipo: 'retomado' };

export function montarFormulario(c: CapturaLocal): FormData {
  const form = new FormData();
  form.append('foto', c.jpeg, `${c.capturaId}.jpg`);
  form.append(
    'meta',
    JSON.stringify({
      capturaId: c.capturaId,
      distritoId: c.distritoId,
      data: c.data,
      capturadoEm: c.capturadoEm,
      barcodes: c.barcodes,
      codigoDigitado: c.codigoDigitado,
      codigo: c.codigo,
    }),
  );
  return form;
}

export const enviarPadrao: Envio = (c) => api.postForm<ResultadoCaptura>('/captura/capturas', montarFormulario(c));
export const desfazerPadrao: EnvioDesfazer = async (capturaId) => {
  await api.post(`/captura/capturas/${encodeURIComponent(capturaId)}/desfazer`);
};

type Classificacao = 'transitorio' | 'definitivo' | 'sessao';

function classificar(err: unknown): Classificacao {
  if (!(err instanceof ApiError)) return 'transitorio'; // rede (fetch rejeitou), abort etc.
  if (err.status === 401) return 'sessao';
  // Senha redefinida pelo supervisor e ainda não trocada: a fila espera a troca.
  if (err.status === 403 && err.code === 'troca_de_senha_obrigatoria') return 'sessao';
  if (err.status >= 500 || STATUS_TRANSITORIOS.has(err.status)) return 'transitorio';
  return 'definitivo';
}

function motivo(err: unknown): string {
  if (err instanceof ApiError) return err.code ?? err.message;
  return err instanceof Error ? err.message : 'erro_desconhecido';
}

export interface CaptureSyncOptions {
  fila?: CaptureQueue;
  enviar?: Envio;
  desfazer?: EnvioDesfazer;
  intervaloMs?: number;
  /** Lê o token atual, para retomar sozinho depois de um novo login. */
  tokenAtual?: () => string | null;
}

export class CaptureSync {
  private readonly fila: CaptureQueue;
  private readonly enviar: Envio;
  private readonly enviarDesfazer: EnvioDesfazer;
  private readonly intervaloMs: number;
  private readonly tokenAtual: () => string | null;
  private readonly ouvintes = new Set<(e: EventoSync) => void>();

  private emCurso: Promise<void> | null = null;
  private pedirOutraRodada = false;
  private pausado = false;
  private tokenNaPausa: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private desligar: Array<() => void> = [];

  constructor(opts: CaptureSyncOptions = {}) {
    this.fila = opts.fila ?? obterCaptureQueue();
    this.enviar = opts.enviar ?? enviarPadrao;
    this.enviarDesfazer = opts.desfazer ?? desfazerPadrao;
    this.intervaloMs = opts.intervaloMs ?? INTERVALO_SYNC_MS;
    this.tokenAtual = opts.tokenAtual ?? (() => localStorage.getItem('accessToken'));
  }

  get estaPausado() {
    return this.pausado;
  }

  on(ouvinte: (e: EventoSync) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private emitir(e: EventoSync) {
    for (const o of this.ouvintes) o(e);
  }

  /** Liga os gatilhos. Capturas presas em `enviando` (app fechado no meio) voltam à fila. */
  start(): void {
    if (this.timer) return;
    const aoFicarOnline = () => void this.sincronizar();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void this.sincronizar();
    };
    window.addEventListener('online', aoFicarOnline);
    document.addEventListener('visibilitychange', aoVoltar);
    this.timer = setInterval(() => void this.sincronizar(), this.intervaloMs);
    this.desligar = [
      () => window.removeEventListener('online', aoFicarOnline),
      () => document.removeEventListener('visibilitychange', aoVoltar),
    ];
    void this.recuperarPresas().then(() => this.sincronizar());
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const d of this.desligar) d();
    this.desligar = [];
  }

  /** Retoma depois de um novo login (a pausa por 401 não apaga nada). */
  retomar(): Promise<void> {
    if (this.pausado) {
      this.pausado = false;
      this.tokenNaPausa = null;
      this.emitir({ tipo: 'retomado' });
    }
    return this.sincronizar();
  }

  /**
   * Uma rodada de envio. Chamadas concorrentes não disparam envios em paralelo:
   * esperam a rodada em curso, que roda de novo no fim se foi pedida no meio.
   */
  sincronizar(): Promise<void> {
    if (this.pausado) {
      const token = this.tokenAtual();
      if (!token || token === this.tokenNaPausa) return Promise.resolve();
      this.pausado = false; // novo login desde a pausa
      this.tokenNaPausa = null;
      this.emitir({ tipo: 'retomado' });
    }
    if (this.emCurso) {
      this.pedirOutraRodada = true;
      return this.emCurso;
    }
    this.emCurso = (async () => {
      try {
        do {
          this.pedirOutraRodada = false;
          await this.rodada();
        } while (this.pedirOutraRodada && !this.pausado);
      } finally {
        this.emCurso = null;
      }
    })();
    return this.emCurso;
  }

  /** "Desfazer" de uma captura salva: enfileira a operação e tenta enviar já. */
  async desfazer(capturaId: string): Promise<void> {
    await this.fila.enfileirarOperacao({ tipo: 'desfazer', capturaId });
    await this.fila.atualizarRecente(capturaId, { desfazer: 'removendo', desfazerErro: undefined });
    void this.sincronizar();
  }

  async contadores(): Promise<Contadores> {
    const [aguardando, enviando, falhou, recentes] = await Promise.all([
      this.fila.contar('aguardando'),
      this.fila.contar('enviando'),
      this.fila.contar('falhou_definitivo'),
      this.fila.recentes(),
    ]);
    const pendentes = recentes.filter(
      (r) => r.resultado.tipo === 'PARA_CONFERIR' || r.resultado.tipo === 'TRANSFERENCIA_PENDENTE',
    ).length;
    return { aguardando: aguardando + enviando, paraConferir: pendentes + falhou };
  }

  private async recuperarPresas() {
    for (const c of await this.fila.listar('enviando')) {
      await this.fila.marcar(c.capturaId, 'aguardando');
    }
  }

  private pausar() {
    this.pausado = true;
    this.tokenNaPausa = this.tokenAtual();
    this.emitir({ tipo: 'pausado' });
  }

  private async rodada(): Promise<void> {
    if (!(await this.enviarOperacoes())) return;

    // Um item por vez, relendo a fila: fotos novas entram na mesma rodada, em ordem.
    const tentadas = new Set<string>();
    for (;;) {
      const proxima = (await this.fila.listar('aguardando')).find((c) => !tentadas.has(c.capturaId));
      if (!proxima) return;
      tentadas.add(proxima.capturaId);
      const seguir = await this.enviarUma(proxima);
      this.emitir({ tipo: 'progresso', contadores: await this.contadores() });
      if (!seguir) return;
    }
  }

  /** Envia uma captura; devolve se a rodada deve continuar. */
  private async enviarUma(c: CapturaLocal): Promise<boolean> {
    await this.fila.marcar(c.capturaId, 'enviando');
    try {
      const resultado = await this.enviar(c);
      await this.fila.marcar(c.capturaId, 'concluida', { resultado });
      this.emitir({ tipo: 'resultado', capturaId: c.capturaId, resultado });
      return true;
    } catch (err) {
      const tipo = classificar(err);
      if (tipo === 'sessao') {
        await this.fila.marcar(c.capturaId, 'aguardando');
        this.pausar();
        return false;
      }
      if (tipo === 'definitivo') {
        const m = motivo(err);
        await this.fila.marcar(c.capturaId, 'falhou_definitivo', { ultimoErro: m, tentativas: c.tentativas + 1 });
        this.emitir({ tipo: 'falhou', capturaId: c.capturaId, motivo: m });
        return true;
      }
      await this.fila.marcar(c.capturaId, 'aguardando', { ultimoErro: motivo(err), tentativas: c.tentativas + 1 });
      // Sem rede ou servidor sobrecarregado: para a rodada. Um 408/409 é só deste item.
      return err instanceof ApiError && (err.status === 408 || err.status === 409);
    }
  }

  /** Envia as operações pendentes; devolve se as capturas podem seguir. */
  private async enviarOperacoes(): Promise<boolean> {
    for (const op of await this.fila.operacoes()) {
      const r = await this.enviarOperacao(op);
      if (r === 'parar') return false;
    }
    return true;
  }

  private async enviarOperacao(op: OperacaoPendente): Promise<'seguir' | 'parar'> {
    try {
      await this.enviarDesfazer(op.capturaId);
      await this.fila.removerOperacao(op.id);
      await this.fila.atualizarRecente(op.capturaId, { desfazer: 'desfeito' });
      return 'seguir';
    } catch (err) {
      const tipo = classificar(err);
      if (tipo === 'sessao') {
        this.pausar();
        return 'parar';
      }
      if (tipo === 'definitivo') {
        await this.fila.removerOperacao(op.id);
        await this.fila.atualizarRecente(op.capturaId, { desfazer: 'recusado', desfazerErro: motivo(err) });
        return 'seguir';
      }
      await this.fila.atualizarOperacao({ ...op, tentativas: op.tentativas + 1 });
      return 'parar';
    }
  }
}

let instancia: CaptureSync | null = null;

export function obterCaptureSync(): CaptureSync {
  instancia ??= new CaptureSync();
  return instancia;
}
