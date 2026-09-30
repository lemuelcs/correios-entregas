import { prisma } from '../../../shared/utils/prisma';
import {
  criarCarteiro,
  criarDistrito,
  criarUnidade,
  dia,
  escala,
  limparBanco,
} from '../../../__tests__/fixtures/entregas';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { DistritoDoDiaService, MemoriaAtivoStore } from '../distrito-do-dia.service';

// As consultas reais do serviço contra o Postgres (os casos estão nos UT-056..061).
describe('DistritoDoDiaService (Prisma)', () => {
  const hoje = dia('2026-09-30');
  const service = new DistritoDoDiaService({
    now: () => new Date('2026-09-30T10:00:00-03:00'),
    ativoStore: new MemoriaAtivoStore(),
  });

  beforeAll(limparBanco);
  afterAll(async () => {
    await limparBanco();
    await encerrarRecursos();
  });

  it('escala de hoje vence o padrão escalado para outro e garantirCarga cria a carga uma vez', async () => {
    const unidade = await criarUnidade();
    const outraUnidade = await criarUnidade();
    const c1 = await criarCarteiro({ unidadeId: unidade.id });
    const c2 = await criarCarteiro({ unidadeId: unidade.id });
    const d03 = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: c1.id });
    const d05 = await criarDistrito({ unidadeId: unidade.id });
    const alheio = await criarDistrito({ unidadeId: outraUnidade.id });
    await escala({ distritoId: d03.id, carteiroId: c2.id, data: hoje });
    await escala({ distritoId: d05.id, carteiroId: c1.id, data: hoje });
    await escala({ distritoId: alheio.id, carteiroId: c1.id, data: hoje });

    const r = await service.resolver(c1.id);
    expect(r.distritos).toEqual([{ distritoId: d05.id, codigo: d05.codigo, nome: d05.nome, cargaStatus: null }]);
    expect(r.ativo).toBe(d05.id);

    // Padrão sem escala para outro: vale o padrão.
    expect((await service.resolver(c2.id)).distritos.map((d) => d.distritoId)).toEqual([d03.id]);

    const [a, b] = await Promise.all([service.garantirCarga(d05.id, hoje), service.garantirCarga(d05.id, hoje)]);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('CARREGADO');
    expect(await prisma.cargaDistrito.count({ where: { distritoId: d05.id } })).toBe(1);
    expect((await service.resolver(c1.id)).distritos[0].cargaStatus).toBe('CARREGADO');
  });
});
