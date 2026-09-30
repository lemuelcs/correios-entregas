import type { StatusCarga } from '@prisma/client';
import {
  diaCivil,
  DistritoDoDiaService,
  MemoriaAtivoStore,
} from '../distrito-do-dia.service';

/** Banco em memória com só as consultas que o serviço faz. */
interface Dados {
  carteiros: { id: string; unidadeId: string; ativo: boolean }[];
  distritos: { id: string; unidadeId: string; codigo: string; nome: string; carteiroPadraoId: string | null; ativo: boolean }[];
  escalas: { distritoId: string; data: Date; carteiroId: string }[];
  cargas: { id: string; distritoId: string; data: Date; status: StatusCarga }[];
}

const mesmoDia = (a: Date, b: Date) => a.getTime() === b.getTime();

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeDb(d: Dados): any {
  const distrito = (id: string) => d.distritos.find((x) => x.id === id)!;
  return {
    carteiro: {
      findUnique: async ({ where }: any) => d.carteiros.find((c) => c.id === where.id) ?? null,
    },
    escalaDistrito: {
      findMany: async ({ where }: any) =>
        d.escalas.filter((e) => {
          const dist = distrito(e.distritoId);
          return e.carteiroId === where.carteiroId && mesmoDia(e.data, where.data)
            && dist.unidadeId === where.distrito.unidadeId && dist.ativo === where.distrito.ativo;
        }),
    },
    distrito: {
      findMany: async ({ where, select }: any) => {
        if (where.id?.in) {
          const dataCarga: Date = select.cargas.where.data;
          return d.distritos
            .filter((x) => where.id.in.includes(x.id))
            .sort((a, b) => a.codigo.localeCompare(b.codigo))
            .map((x) => ({
              id: x.id, codigo: x.codigo, nome: x.nome,
              cargas: d.cargas.filter((c) => c.distritoId === x.id && mesmoDia(c.data, dataCarga)),
            }));
        }
        const data: Date = where.escalas.none.data;
        return d.distritos.filter((x) =>
          x.unidadeId === where.unidadeId && x.ativo === where.ativo && x.carteiroPadraoId === where.carteiroPadraoId
          && !d.escalas.some((e) => e.distritoId === x.id && mesmoDia(e.data, data) && e.carteiroId !== where.carteiroPadraoId));
      },
    },
    cargaDistrito: {
      createMany: async ({ data }: any) => {
        let count = 0;
        for (const c of data) {
          if (!d.cargas.some((x) => x.distritoId === c.distritoId && mesmoDia(x.data, c.data))) {
            d.cargas.push({ id: `carga-${d.cargas.length + 1}`, ...c });
            count += 1;
          }
        }
        return { count };
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const { distritoId, data } = where.distritoId_data;
        const c = d.cargas.find((x) => x.distritoId === distritoId && mesmoDia(x.data, data));
        if (!c) throw new Error('not found');
        return c;
      },
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const HOJE = new Date('2026-09-30T00:00:00.000Z');
const ONTEM = new Date('2026-09-29T00:00:00.000Z');
const agora = () => new Date('2026-09-30T09:00:00-03:00');

function cenario(): Dados {
  return {
    carteiros: [
      { id: 'C1', unidadeId: 'U1', ativo: true },
      { id: 'C2', unidadeId: 'U1', ativo: true },
    ],
    distritos: [
      { id: 'D-03', unidadeId: 'U1', codigo: 'D03', nome: 'Distrito 3', carteiroPadraoId: 'C1', ativo: true },
      { id: 'D-05', unidadeId: 'U1', codigo: 'D05', nome: 'Distrito 5', carteiroPadraoId: 'C2', ativo: true },
      { id: 'D-07', unidadeId: 'U1', codigo: 'D07', nome: 'Distrito 7', carteiroPadraoId: null, ativo: true },
    ],
    escalas: [],
    cargas: [],
  };
}

function servico(d: Dados, now = agora, ativoStore = new MemoriaAtivoStore()) {
  return new DistritoDoDiaService({ db: fakeDb(d), now, ativoStore });
}

describe('DistritoDoDiaService', () => {
  it('UT-056 escala de hoje do carteiro define o distrito', async () => {
    const d = cenario();
    d.distritos[0].carteiroPadraoId = null;
    d.escalas.push({ distritoId: 'D-03', data: HOJE, carteiroId: 'C1' });
    d.escalas.push({ distritoId: 'D-05', data: ONTEM, carteiroId: 'C1' });

    const r = await servico(d).resolver('C1');

    expect(r.data).toEqual(HOJE);
    expect(r.distritos.map((x) => x.distritoId)).toEqual(['D-03']);
    expect(r.ativo).toBe('D-03');
  });

  it('UT-057 sem escala, vale o distrito padrão e a carga não é criada', async () => {
    const d = cenario();

    const r = await servico(d).resolver('C1');

    expect(r.distritos).toEqual([{ distritoId: 'D-03', codigo: 'D03', nome: 'Distrito 3', cargaStatus: null }]);
    expect(r.ativo).toBe('D-03');
    expect(d.cargas).toHaveLength(0);
  });

  it('UT-058 padrão escalado para outro hoje e escala do carteiro em outro distrito → o da escala', async () => {
    const d = cenario();
    d.escalas.push({ distritoId: 'D-03', data: HOJE, carteiroId: 'C2' });
    d.escalas.push({ distritoId: 'D-05', data: HOJE, carteiroId: 'C1' });

    const r = await servico(d).resolver('C1');

    expect(r.distritos.map((x) => x.distritoId)).toEqual(['D-05']);

    // O padrão escalado para outro carteiro some mesmo sem escala própria.
    const semEscalaPropria = cenario();
    semEscalaPropria.escalas.push({ distritoId: 'D-03', data: HOJE, carteiroId: 'C2' });
    expect((await servico(semEscalaPropria).resolver('C1')).distritos).toEqual([]);
  });

  it('UT-059 sem escala e sem distrito padrão → lista vazia', async () => {
    const d = cenario();
    d.distritos[0].carteiroPadraoId = null;

    const r = await servico(d).resolver('C1');

    expect(r).toEqual({ data: HOJE, distritos: [], ativo: null });
  });

  it('UT-060 duas escalas hoje → duas opções; ativo é a última escolha ou nenhum', async () => {
    const d = cenario();
    d.escalas.push({ distritoId: 'D-05', data: HOJE, carteiroId: 'C1' });
    d.escalas.push({ distritoId: 'D-07', data: HOJE, carteiroId: 'C1' });
    const s = servico(d);

    const antes = await s.resolver('C1');
    expect(antes.distritos.map((x) => x.distritoId)).toEqual(['D-05', 'D-07']);
    expect(antes.ativo).toBeNull();

    await s.definirAtivo('C1', 'D-07');
    await s.definirAtivo('C1', 'D-05');
    expect((await s.resolver('C1')).ativo).toBe('D-05');

    await expect(s.definirAtivo('C1', 'D-03')).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'distrito_nao_autorizado' },
    });
  });

  it('UT-061 00:30 em São Paulo ainda é o dia civil local, não o UTC anterior', async () => {
    const now = () => new Date('2026-10-01T00:30:00-03:00');
    expect(diaCivil(now())).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    // 23:30 de SP já é o dia seguinte em UTC, mas continua o dia local.
    expect(diaCivil(new Date('2026-09-30T23:30:00-03:00'))).toEqual(HOJE);

    const d = cenario();
    d.escalas.push({ distritoId: 'D-05', data: new Date('2026-10-01T00:00:00.000Z'), carteiroId: 'C1' });
    const r = await servico(d, now).resolver('C1');
    expect(r.data).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(r.distritos.map((x) => x.distritoId)).toEqual(['D-05']);
  });

  it('garantirCarga cria a carga CARREGADO uma vez e depois devolve a mesma', async () => {
    const d = cenario();
    const s = servico(d);

    const a = await s.garantirCarga('D-03', HOJE);
    const b = await s.garantirCarga('D-03', HOJE);

    expect(a).toEqual(expect.objectContaining({ distritoId: 'D-03', status: 'CARREGADO' }));
    expect(b.id).toBe(a.id);
    expect(d.cargas).toHaveLength(1);
  });
});
