/**
 * Estado de tela da captura (zustand): o distrito do dia (`GET /captura/hoje`),
 * os contadores locais da fila, a conexão e os avisos "Pacote … salvo · desfazer".
 *
 * O `GET /hoje` fica guardado no aparelho (localStorage) para o app abrir e
 * fotografar sem sinal (ADR-003): sem rede, vale o último do mesmo dia.
 */
import { create } from 'zustand';
import { ApiError, api } from '@/services/api';
import { obterCaptureQueue, type Recente, type ResultadoCaptura } from './captureQueue';
import { obterCaptureSync } from './captureSync';

export type StatusCarga = 'CARREGADO' | 'LIBERADO' | 'EM_ENTREGA' | 'CONCLUIDO';

export interface DistritoHoje {
  distritoId: string;
  codigo: string;
  nome: string;
  cargaStatus: StatusCarga | null;
}

export interface RecenteServidor {
  capturaId: string;
  pacoteId: string;
  distritoId: string;
  codigo: string;
  nome: string | null;
  semWhatsapp: boolean;
  codigoDigitado: boolean;
  origem: 'PLANILHA' | 'FOTO' | 'PLANILHA_FOTO';
  atualizado: boolean;
  processadoEm: string | null;
}

export interface Hoje {
  data: string; // AAAA-MM-DD
  distritos: DistritoHoje[];
  ativo: string | null;
  contadores: { capturados: number; paraConferir: number };
  recentes: RecenteServidor[];
}

export type TipoAviso = 'salvo' | 'conferir' | 'recusado';

export interface Aviso {
  capturaId: string;
  tipo: TipoAviso;
  codigo: string;
  distritoCodigo: string;
  texto: string;
}

export const CHAVE_HOJE = 'captura:hoje';
const TEMPO_AVISO_MS = 20_000;
const MAX_AVISOS = 3;

/** Distritos liberados: o carteiro não remove mais (só o supervisor). */
export const CARGA_LIBERADA: ReadonlySet<StatusCarga> = new Set(['LIBERADO', 'EM_ENTREGA', 'CONCLUIDO']);

const MOTIVO_RECUSA: Record<string, string> = {
  DV_INVALIDO: 'o código não confere',
  MULTIPLOS_ROTULOS: 'mais de um rótulo na foto',
  OUTRA_UNIDADE: 'é de outra unidade',
  JA_ENTREGUE: 'já foi entregue',
  SEM_DISTRITO: 'você não tem rota hoje',
  FOTO_INVALIDA: 'a foto não pôde ser lida',
};

export function textoRecusa(codigo: string): string {
  return MOTIVO_RECUSA[codigo] ?? 'recusado pelo sistema';
}

/** Dia civil em America/Sao_Paulo (AAAA-MM-DD), o mesmo do servidor. */
export function diaCivilSP(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** O último `GET /hoje` guardado, se for de hoje (a escala de ontem não vale). */
function lerHojeGuardado(): Hoje | null {
  try {
    const bruto = localStorage.getItem(CHAVE_HOJE);
    const h = bruto ? (JSON.parse(bruto) as Hoje) : null;
    return h && h.data === diaCivilSP() ? h : null;
  } catch {
    return null;
  }
}

function guardarHoje(h: Hoje) {
  try {
    localStorage.setItem(CHAVE_HOJE, JSON.stringify(h));
  } catch {
    // sem espaço: segue sem o cache
  }
}

/** O distrito em que as fotos entram: o escolhido, ou o único do dia. */
export function distritoAtivo(h: Hoje | null): DistritoHoje | null {
  if (!h) return null;
  const id = h.ativo ?? (h.distritos.length === 1 ? h.distritos[0].distritoId : null);
  return h.distritos.find((d) => d.distritoId === id) ?? null;
}

export function codigoDoDistrito(h: Hoje | null, distritoId: string): string {
  return h?.distritos.find((d) => d.distritoId === distritoId)?.codigo ?? '';
}

interface CapturaState {
  hoje: Hoje | null;
  carregandoHoje: boolean;
  erroHoje: string | null;
  online: boolean;
  /** Fotos ainda não enviadas (aguardando + enviando). */
  aguardando: number;
  /** Fotos que o servidor recusou de vez (4xx) e seguem no aparelho. */
  falhas: number;
  /** "Desfazer" local por capturaId (removendo, desfeito ou recusado). */
  desfazer: Record<string, NonNullable<Recente['desfazer']>>;
  avisos: Aviso[];

  carregarHoje(): Promise<void>;
  escolherDistrito(distritoId: string): Promise<void>;
  atualizarFila(): Promise<void>;
  definirOnline(online: boolean): void;
  receberResultado(capturaId: string, resultado: ResultadoCaptura): Promise<void>;
  removerAviso(capturaId: string): void;
  desfazerCaptura(capturaId: string): Promise<void>;
  reiniciar(): void;
}

const timersAviso = new Map<string, ReturnType<typeof setTimeout>>();

function estadoInicial() {
  return {
    hoje: lerHojeGuardado(),
    carregandoHoje: false,
    erroHoje: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    aguardando: 0,
    falhas: 0,
    desfazer: {},
    avisos: [],
  };
}

export const useCapturaStore = create<CapturaState>((set, get) => ({
  ...estadoInicial(),

  async carregarHoje() {
    set({ carregandoHoje: true });
    try {
      const h = await api.get<Hoje>('/captura/hoje');
      guardarHoje(h);
      set({ hoje: h, erroHoje: null, online: true });
    } catch (err) {
      // Erro do servidor: mostra a mensagem. Sem rede (mesmo com `navigator.onLine`
      // dizendo que há): fica o último guardado e o app passa a "Sem conexão".
      if (err instanceof ApiError) set({ erroHoje: err.message, online: true });
      else set({ online: false });
    } finally {
      set({ carregandoHoje: false });
    }
  },

  async escolherDistrito(distritoId) {
    await api.put('/captura/hoje/ativo', { distritoId });
    const h = get().hoje;
    if (h) {
      const novo = { ...h, ativo: distritoId };
      guardarHoje(novo);
      set({ hoje: novo });
    }
    await get().carregarHoje();
  },

  async atualizarFila() {
    const fila = obterCaptureQueue();
    const [contadores, falhas, recentes] = await Promise.all([
      obterCaptureSync().contadores(),
      fila.contar('falhou_definitivo'),
      fila.recentes(),
    ]);
    const desfazer: CapturaState['desfazer'] = {};
    for (const r of recentes) if (r.desfazer) desfazer[r.capturaId] = r.desfazer;
    set({ aguardando: contadores.aguardando, falhas, desfazer });
  },

  definirOnline(online) {
    set({ online });
  },

  async receberResultado(capturaId, resultado) {
    const recente = (await obterCaptureQueue().recentes()).find((r) => r.capturaId === capturaId);
    const codigo = recente?.codigo ?? '';
    const distritoCodigo = codigoDoDistrito(get().hoje, recente?.distritoId ?? '');
    let aviso: Aviso | null = null;
    if (resultado.tipo === 'SALVO') {
      aviso = { capturaId, tipo: 'salvo', codigo, distritoCodigo, texto: `Pacote ${codigo} salvo na rota ${distritoCodigo}` };
    } else if (resultado.tipo === 'PARA_CONFERIR' || resultado.tipo === 'TRANSFERENCIA_PENDENTE') {
      aviso = { capturaId, tipo: 'conferir', codigo, distritoCodigo, texto: `Pacote ${codigo} foi para Para conferir` };
    } else if (resultado.tipo === 'RECUSADO') {
      aviso = { capturaId, tipo: 'recusado', codigo, distritoCodigo, texto: `Pacote ${codigo} não foi salvo: ${textoRecusa(resultado.codigo)}` };
    }
    if (!aviso) return;
    const novo = aviso;
    set((s) => ({ avisos: [...s.avisos.filter((a) => a.capturaId !== capturaId), novo].slice(-MAX_AVISOS) }));
    clearTimeout(timersAviso.get(capturaId));
    timersAviso.set(capturaId, setTimeout(() => get().removerAviso(capturaId), TEMPO_AVISO_MS));
  },

  removerAviso(capturaId) {
    clearTimeout(timersAviso.get(capturaId));
    timersAviso.delete(capturaId);
    set((s) => ({ avisos: s.avisos.filter((a) => a.capturaId !== capturaId) }));
  },

  async desfazerCaptura(capturaId) {
    const sync = obterCaptureSync();
    get().removerAviso(capturaId);
    set((s) => ({ desfazer: { ...s.desfazer, [capturaId]: 'removendo' } }));
    await sync.desfazer(capturaId);
    await sync.sincronizar();
    await get().atualizarFila();
    if (get().online) await get().carregarHoje();
  },

  reiniciar() {
    for (const t of timersAviso.values()) clearTimeout(t);
    timersAviso.clear();
    set(estadoInicial());
  },
}));
