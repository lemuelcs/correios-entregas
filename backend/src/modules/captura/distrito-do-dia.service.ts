/**
 * Distrito do dia do carteiro (ADR-014, US-003).
 *
 * 1. As escalas de hoje do carteiro (`EscalaDistrito`), inclusive "trocar só hoje".
 * 2. Sem escala: os distritos de que ele é o padrão, exceto os que têm escala de
 *    hoje para outro carteiro.
 * Só distritos ativos da unidade do carteiro. "Hoje" é o dia civil em America/Sao_Paulo.
 *
 * A `CargaDistrito` do dia não é criada na resolução: `garantirCarga` a cria sob
 * demanda, quando a primeira captura é salva.
 */
import type { CargaDistrito, Prisma, PrismaClient, StatusCarga } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { getRedis } from '../../shared/utils/redis';
import { AppError } from '../../shared/middleware/error-handler.middleware';

export const FUSO_OPERACAO = 'America/Sao_Paulo';

/** Dia civil em America/Sao_Paulo, como meia-noite UTC (o formato das colunas `@db.Date`). */
export function diaCivil(agora: Date, fuso = FUSO_OPERACAO): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return new Date(Date.UTC(valor('year'), valor('month') - 1, valor('day')));
}

export interface DistritoDoDia {
  distritoId: string;
  codigo: string;
  nome: string;
  /** Status da carga do dia; `null` enquanto ela não existe. */
  cargaStatus: StatusCarga | null;
}

export interface ResolucaoDistritoDoDia {
  data: Date;
  distritos: DistritoDoDia[];
  /** O distrito em que as fotos entram; `null` quando há vários e nenhum foi escolhido. */
  ativo: string | null;
}

/** Guarda o distrito escolhido (`PUT /captura/hoje/ativo`) por carteiro e dia. */
export interface AtivoStore {
  get(carteiroId: string, data: Date): Promise<string | null>;
  set(carteiroId: string, data: Date, distritoId: string): Promise<void>;
}

function chaveAtivo(carteiroId: string, data: Date): string {
  return `captura:ativo:${carteiroId}:${data.toISOString().slice(0, 10)}`;
}

export class MemoriaAtivoStore implements AtivoStore {
  private readonly mapa = new Map<string, string>();

  async get(carteiroId: string, data: Date): Promise<string | null> {
    return this.mapa.get(chaveAtivo(carteiroId, data)) ?? null;
  }

  async set(carteiroId: string, data: Date, distritoId: string): Promise<void> {
    this.mapa.set(chaveAtivo(carteiroId, data), distritoId);
  }
}

/** Redis com TTL de 2 dias; sem Redis disponível, cai para a memória do processo. */
export class RedisAtivoStore implements AtivoStore {
  private readonly memoria = new MemoriaAtivoStore();
  private static readonly TTL_SEGUNDOS = 2 * 24 * 60 * 60;

  async get(carteiroId: string, data: Date): Promise<string | null> {
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        return await redis.get(chaveAtivo(carteiroId, data));
      } catch {
        // cai para a memória
      }
    }
    return this.memoria.get(carteiroId, data);
  }

  async set(carteiroId: string, data: Date, distritoId: string): Promise<void> {
    await this.memoria.set(carteiroId, data, distritoId);
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        await redis.set(chaveAtivo(carteiroId, data), distritoId, 'EX', RedisAtivoStore.TTL_SEGUNDOS);
      } catch {
        // a memória já tem o valor
      }
    }
  }
}

type Db = Pick<PrismaClient, 'carteiro' | 'escalaDistrito' | 'distrito' | 'cargaDistrito'>;
type DbCarga = Pick<Prisma.TransactionClient, 'cargaDistrito'>;

export interface DistritoDoDiaDeps {
  db?: Db;
  now?: () => Date;
  ativoStore?: AtivoStore;
}

export class DistritoDoDiaService {
  private readonly db: Db;
  private readonly now: () => Date;
  private readonly ativoStore: AtivoStore;

  constructor(deps: DistritoDoDiaDeps = {}) {
    this.db = deps.db ?? prisma;
    this.now = deps.now ?? (() => new Date());
    this.ativoStore = deps.ativoStore ?? new RedisAtivoStore();
  }

  hoje(): Date {
    return diaCivil(this.now());
  }

  async resolver(carteiroId: string): Promise<ResolucaoDistritoDoDia> {
    const data = this.hoje();
    const carteiro = await this.db.carteiro.findUnique({
      where: { id: carteiroId },
      select: { unidadeId: true, ativo: true },
    });
    if (!carteiro || !carteiro.ativo) return { data, distritos: [], ativo: null };

    const doCarteiro = { unidadeId: carteiro.unidadeId, ativo: true };

    const escalas = await this.db.escalaDistrito.findMany({
      where: { carteiroId, data, distrito: doCarteiro },
      select: { distritoId: true },
    });

    let ids = escalas.map((e) => e.distritoId);
    if (ids.length === 0) {
      const padroes = await this.db.distrito.findMany({
        where: {
          ...doCarteiro,
          carteiroPadraoId: carteiroId,
          escalas: { none: { data, carteiroId: { not: carteiroId } } },
        },
        select: { id: true },
      });
      ids = padroes.map((d) => d.id);
    }
    if (ids.length === 0) return { data, distritos: [], ativo: null };

    const distritos = await this.db.distrito.findMany({
      where: { id: { in: ids } },
      select: { id: true, codigo: true, nome: true, cargas: { where: { data }, select: { status: true } } },
      orderBy: { codigo: 'asc' },
    });
    const lista: DistritoDoDia[] = distritos.map((d) => ({
      distritoId: d.id,
      codigo: d.codigo,
      nome: d.nome,
      cargaStatus: d.cargas[0]?.status ?? null,
    }));

    if (lista.length === 1) return { data, distritos: lista, ativo: lista[0].distritoId };

    const escolhido = await this.ativoStore.get(carteiroId, data);
    const ativo = lista.some((d) => d.distritoId === escolhido) ? escolhido : null;
    return { data, distritos: lista, ativo };
  }

  /** Escolhe o distrito ativo entre os do dia; fora da lista → 403 `distrito_nao_autorizado`. */
  async definirAtivo(carteiroId: string, distritoId: string): Promise<void> {
    const { data, distritos } = await this.resolver(carteiroId);
    if (!distritos.some((d) => d.distritoId === distritoId)) {
      throw new AppError(403, 'Rota fora da sua designação de hoje', { code: 'distrito_nao_autorizado' });
    }
    await this.ativoStore.set(carteiroId, data, distritoId);
  }

  /** O carteiro pode capturar neste distrito hoje? */
  async autorizado(carteiroId: string, distritoId: string): Promise<boolean> {
    const { distritos } = await this.resolver(carteiroId);
    return distritos.some((d) => d.distritoId === distritoId);
  }

  /**
   * A `CargaDistrito(distritoId, data)`, criada com status CARREGADO se ainda não
   * existir. Segura sob concorrência (insert com skipDuplicates + leitura). Aceita o
   * cliente de uma transação.
   */
  async garantirCarga(distritoId: string, data: Date, db: DbCarga = this.db): Promise<CargaDistrito> {
    await db.cargaDistrito.createMany({
      data: [{ distritoId, data, status: 'CARREGADO' }],
      skipDuplicates: true,
    });
    return db.cargaDistrito.findUniqueOrThrow({ where: { distritoId_data: { distritoId, data } } });
  }
}

export const distritoDoDiaService = new DistritoDoDiaService();
