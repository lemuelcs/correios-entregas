/**
 * Fila offline da captura (ADR-003, ADR-012), em IndexedDB via `idb`.
 *
 * Banco `captura`:
 * - `fila`: as capturas ainda não resolvidas (chave `capturaId`, índice `estado`);
 * - `recentes`: os últimos 20 resultados, para o aviso "salvo · desfazer" e os contadores;
 * - `operacoes`: operações feitas sem rede sobre capturas já enviadas ("desfazer").
 *
 * A foto é guardada como ArrayBuffer (o Safari antigo perde Blob no IndexedDB) e
 * volta como Blob na leitura.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type EstadoCaptura = 'aguardando' | 'enviando' | 'concluida' | 'falhou_definitivo';

export interface BarcodesLidos {
  objeto: string | null;
  cepLinear: string | null;
  dataMatrixRaw: string | null;
  multiplos: boolean;
}

export interface CapturaLocal {
  capturaId: string;
  distritoId: string;
  data: string; // dia civil (AAAA-MM-DD)
  capturadoEm: string; // ISO
  jpeg: Blob;
  barcodes: BarcodesLidos;
  /** O S10 validado no aparelho (lido ou digitado); vai no `meta.codigo`. */
  codigo: string;
  codigoDigitado: boolean;
  estado: EstadoCaptura;
  tentativas: number;
  ultimoErro?: string;
}

export type NovaCaptura = Omit<CapturaLocal, 'estado' | 'tentativas' | 'ultimoErro'>;

// ---- ResultadoCaptura (contrato da TechSpec › Core Interfaces) ----
export type Fonte = 'DATAMATRIX' | 'BARRAS' | 'CEP' | 'LLM' | 'DIGITADO' | 'CARTEIRO';
export interface Campo { valor: string | null; duvida: boolean; motivo?: string; fonte: Fonte }
export interface CamposLidos {
  codigo: Campo; nome: Campo; whatsapp: Campo; cep: Campo;
  logradouro: Campo; numero: Campo; complemento: Campo;
  bairro: Campo; cidade: Campo; uf: Campo;
}
export type RecusaCaptura = 'DV_INVALIDO' | 'MULTIPLOS_ROTULOS' | 'OUTRA_UNIDADE'
  | 'JA_ENTREGUE' | 'SEM_DISTRITO' | 'FOTO_INVALIDA';
export type ResultadoCaptura =
  | { tipo: 'SALVO'; pacoteId: string; atualizado: boolean }
  | { tipo: 'PARA_CONFERIR'; campos: CamposLidos; motivos: string[] }
  | { tipo: 'TRANSFERENCIA_PENDENTE'; campos: CamposLidos; distritoOrigem: string }
  | { tipo: 'RECUSADO'; codigo: RecusaCaptura };

export interface Recente {
  capturaId: string;
  codigo: string;
  distritoId: string;
  resultado: ResultadoCaptura;
  concluidaEm: string;
  /** Estado local de um "desfazer": enfileirado, aplicado ou recusado pelo servidor. */
  desfazer?: 'removendo' | 'desfeito' | 'recusado';
  desfazerErro?: string;
}

export interface OperacaoPendente {
  id: string;
  tipo: 'desfazer';
  capturaId: string;
  criadaEm: string;
  tentativas: number;
}

export const LIMITE_RECENTES = 20;

interface RegistroFila extends Omit<CapturaLocal, 'jpeg'> {
  jpeg: ArrayBuffer;
  jpegTipo: string;
}

interface CapturaDB extends DBSchema {
  fila: { key: string; value: RegistroFila; indexes: { estado: EstadoCaptura } };
  recentes: { key: string; value: Recente; indexes: { concluidaEm: string } };
  operacoes: { key: string; value: OperacaoPendente };
}

export type EventoFila =
  | { tipo: 'mudou' }
  | { tipo: 'espaco_insuficiente'; erro: unknown };

export class EspacoInsuficiente extends Error {
  constructor(causa?: unknown) {
    super('Espaço do aparelho insuficiente para guardar a foto');
    this.name = 'EspacoInsuficiente';
    this.cause = causa;
  }
}

function ehQuotaExcedida(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'QuotaExceededError';
}

function porCapturadoEm(a: { capturadoEm: string }, b: { capturadoEm: string }) {
  return a.capturadoEm.localeCompare(b.capturadoEm);
}

export interface CaptureQueueOptions {
  nomeBanco?: string;
}

export class CaptureQueue {
  private readonly nomeBanco: string;
  private dbPromise: Promise<IDBPDatabase<CapturaDB>> | null = null;
  private readonly ouvintes = new Set<(e: EventoFila) => void>();

  constructor(opts: CaptureQueueOptions = {}) {
    this.nomeBanco = opts.nomeBanco ?? 'captura';
  }

  private db(): Promise<IDBPDatabase<CapturaDB>> {
    if (!this.dbPromise) {
      pedirArmazenamentoPersistente();
      this.dbPromise = openDB<CapturaDB>(this.nomeBanco, 1, {
        upgrade(db) {
          const fila = db.createObjectStore('fila', { keyPath: 'capturaId' });
          fila.createIndex('estado', 'estado');
          const recentes = db.createObjectStore('recentes', { keyPath: 'capturaId' });
          recentes.createIndex('concluidaEm', 'concluidaEm');
          db.createObjectStore('operacoes', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  on(ouvinte: (e: EventoFila) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private emitir(e: EventoFila) {
    for (const o of this.ouvintes) o(e);
  }

  /** Enfileira (ou substitui, pelo mesmo `capturaId`) uma captura como `aguardando`. */
  async add(nova: NovaCaptura): Promise<void> {
    const registro: RegistroFila = {
      ...nova,
      jpeg: await nova.jpeg.arrayBuffer(),
      jpegTipo: nova.jpeg.type || 'image/jpeg',
      estado: 'aguardando',
      tentativas: 0,
    };
    try {
      const db = await this.db();
      await db.put('fila', registro);
    } catch (err) {
      if (ehQuotaExcedida(err)) {
        this.emitir({ tipo: 'espaco_insuficiente', erro: err });
        throw new EspacoInsuficiente(err);
      }
      throw err;
    }
    this.emitir({ tipo: 'mudou' });
  }

  async obter(capturaId: string): Promise<CapturaLocal | undefined> {
    const r = await (await this.db()).get('fila', capturaId);
    return r ? paraCaptura(r) : undefined;
  }

  /** As capturas da fila (de um estado, ou todas), na ordem de `capturadoEm`. */
  async listar(estado?: EstadoCaptura): Promise<CapturaLocal[]> {
    const db = await this.db();
    const registros = estado ? await db.getAllFromIndex('fila', 'estado', estado) : await db.getAll('fila');
    return registros.sort(porCapturadoEm).map(paraCaptura);
  }

  async contar(estado: EstadoCaptura): Promise<number> {
    return (await this.db()).countFromIndex('fila', 'estado', estado);
  }

  /**
   * Muda o estado de uma captura. `concluida` tira a captura da fila (e a foto
   * do aparelho) e guarda o resultado em `recentes`.
   */
  async marcar(
    capturaId: string,
    estado: EstadoCaptura,
    extra: { resultado?: ResultadoCaptura; ultimoErro?: string; tentativas?: number } = {},
  ): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['fila', 'recentes'], 'readwrite');
    const fila = tx.objectStore('fila');
    const atual = await fila.get(capturaId);
    if (!atual) {
      await tx.done;
      return;
    }

    if (estado === 'concluida') {
      await fila.delete(capturaId);
      if (extra.resultado) {
        await tx.objectStore('recentes').put({
          capturaId,
          codigo: atual.codigo,
          distritoId: atual.distritoId,
          resultado: extra.resultado,
          concluidaEm: carimbo(),
        });
        await aparar(tx.objectStore('recentes'));
      }
    } else {
      await fila.put({
        ...atual,
        estado,
        tentativas: extra.tentativas ?? atual.tentativas,
        ultimoErro: extra.ultimoErro ?? (estado === 'aguardando' || estado === 'enviando' ? atual.ultimoErro : undefined),
      });
    }
    await tx.done;
    this.emitir({ tipo: 'mudou' });
  }

  async remover(capturaId: string): Promise<void> {
    await (await this.db()).delete('fila', capturaId);
    this.emitir({ tipo: 'mudou' });
  }

  /** Os últimos resultados, do mais novo para o mais antigo. */
  async recentes(): Promise<Recente[]> {
    const todos = await (await this.db()).getAllFromIndex('recentes', 'concluidaEm');
    return todos.reverse();
  }

  async atualizarRecente(capturaId: string, mudanca: Partial<Omit<Recente, 'capturaId'>>): Promise<void> {
    const db = await this.db();
    const atual = await db.get('recentes', capturaId);
    if (!atual) return;
    await db.put('recentes', { ...atual, ...mudanca });
    this.emitir({ tipo: 'mudou' });
  }

  async enfileirarOperacao(op: Omit<OperacaoPendente, 'id' | 'criadaEm' | 'tentativas'>): Promise<OperacaoPendente> {
    const registro: OperacaoPendente = {
      ...op,
      id: `${op.tipo}:${op.capturaId}`,
      criadaEm: new Date().toISOString(),
      tentativas: 0,
    };
    await (await this.db()).put('operacoes', registro);
    this.emitir({ tipo: 'mudou' });
    return registro;
  }

  async operacoes(): Promise<OperacaoPendente[]> {
    const todas = await (await this.db()).getAll('operacoes');
    return todas.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
  }

  async atualizarOperacao(op: OperacaoPendente): Promise<void> {
    await (await this.db()).put('operacoes', op);
  }

  async removerOperacao(id: string): Promise<void> {
    await (await this.db()).delete('operacoes', id);
    this.emitir({ tipo: 'mudou' });
  }

  /** Apaga tudo (fila, recentes e operações): só no "Sair" confirmado. */
  async limpar(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['fila', 'recentes', 'operacoes'], 'readwrite');
    await Promise.all([
      tx.objectStore('fila').clear(),
      tx.objectStore('recentes').clear(),
      tx.objectStore('operacoes').clear(),
      tx.done,
    ]);
    this.emitir({ tipo: 'mudou' });
  }

  /** Fecha a conexão (testes e troca de instância). */
  async fechar(): Promise<void> {
    if (this.dbPromise) {
      (await this.dbPromise).close();
      this.dbPromise = null;
    }
  }
}

let ultimoCarimbo = 0;

/** ISO estritamente crescente: a ordem de `recentes` não empata no mesmo milissegundo. */
function carimbo(): string {
  ultimoCarimbo = Math.max(Date.now(), ultimoCarimbo + 1);
  return new Date(ultimoCarimbo).toISOString();
}

function paraCaptura({ jpeg, jpegTipo, ...resto }: RegistroFila): CapturaLocal {
  return { ...resto, jpeg: new Blob([jpeg], { type: jpegTipo }) };
}

async function aparar(recentes: { index(n: 'concluidaEm'): { getAllKeys(): Promise<string[]> }; delete(k: string): Promise<void> }) {
  const chaves = await recentes.index('concluidaEm').getAllKeys();
  const excedentes = chaves.slice(0, Math.max(0, chaves.length - LIMITE_RECENTES));
  for (const k of excedentes) await recentes.delete(k);
}

let persistenciaPedida = false;

/** Pede ao navegador para não despejar o banco sob pressão de espaço (iOS). Uma vez por sessão. */
export function pedirArmazenamentoPersistente(): void {
  if (persistenciaPedida) return;
  persistenciaPedida = true;
  try {
    void navigator.storage?.persist?.().catch(() => false);
  } catch {
    // navegador sem StorageManager: segue sem persistência garantida
  }
}

/** Só para testes: permite verificar o pedido de novo. */
export function _reiniciarPedidoDePersistencia(): void {
  persistenciaPedida = false;
}

let instancia: CaptureQueue | null = null;

/** A fila do app (uma por aba). */
export function obterCaptureQueue(): CaptureQueue {
  instancia ??= new CaptureQueue();
  return instancia;
}
