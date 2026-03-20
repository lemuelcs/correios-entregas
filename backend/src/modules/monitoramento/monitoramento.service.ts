import { prisma } from '../../shared/utils/prisma';

export class MonitoramentoService {
  async getRotasAtivas(unidadeId: string) {
    const rotas = await prisma.rota.findMany({
      where: {
        unidadeId,
        statusAtual: 'EM_ANDAMENTO',
      },
      include: {
        carteiro: {
          include: {
            usuario: { select: { id: true, nome: true, email: true } },
          },
        },
        veiculo: {
          select: {
            id: true,
            codigo: true,
            tipo: true,
            placa: true,
            modal: true,
            modeloVeiculo: true,
          },
        },
        _count: {
          select: {
            paradas: true,
            objetos: true,
          },
        },
      },
      orderBy: { iniciadoEm: 'desc' },
    });

    // Fetch last GPS snapshot for each rota
    const rotaIds = rotas.map((r) => r.id);
    const lastGpsSnapshots = rotaIds.length > 0
      ? await prisma.$queryRawUnsafe<
          { rotaId: string; latitude: number; longitude: number; velocidade: number | null; ocorridoEm: Date }[]
        >(
          `SELECT DISTINCT ON ("rotaId") "rotaId", "latitude", "longitude", "velocidade", "ocorridoEm"
           FROM gps_snapshots
           WHERE "rotaId" = ANY($1::text[])
           ORDER BY "rotaId", "ocorridoEm" DESC`,
          rotaIds,
        )
      : [];

    const gpsMap = new Map(
      lastGpsSnapshots.map((g) => [g.rotaId, g]),
    );

    return rotas.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      statusAtual: r.statusAtual,
      totalParadas: r._count.paradas,
      totalObjetos: r._count.objetos,
      totalEntregues: r.totalEntregues,
      totalInsucessos: r.totalInsucessos,
      totalPnovs: r.totalPnovs,
      distanciaEstimadaKm: r.distanciaEstimadaKm,
      duracaoEstimadaMin: r.duracaoEstimadaMin,
      iniciadoEm: r.iniciadoEm,
      retornoEstimado: r.retornoEstimado,
      retornoProjetado: r.retornoProjetado,
      carteiro: {
        id: r.carteiro.id,
        matricula: r.carteiro.matricula,
        modalPrincipal: r.carteiro.modalPrincipal,
        usuario: r.carteiro.usuario,
      },
      veiculo: r.veiculo,
      ultimoGps: gpsMap.get(r.id) ?? null,
    }));
  }

  async getKpis(unidadeId: string, data?: string) {
    const dataRef = data
      ? new Date(data + 'T00:00:00.000Z')
      : this.todayUTC();
    const dataFim = new Date(dataRef);
    dataFim.setUTCDate(dataFim.getUTCDate() + 1);

    // Get all rotas for this unit on this date
    const rotas = await prisma.rota.findMany({
      where: {
        unidadeId,
        createdAt: { gte: dataRef, lt: dataFim },
      },
      select: {
        id: true,
        statusAtual: true,
        totalParadas: true,
        totalObjetos: true,
        totalEntregues: true,
        totalInsucessos: true,
        totalPnovs: true,
        horarioDespachoAlvo: true,
        iniciadoEm: true,
        concluidoEm: true,
      },
    });

    const totalRotas = rotas.length;
    const rotasAtivas = rotas.filter((r) => r.statusAtual === 'EM_ANDAMENTO');

    // FADR: first-attempt delivery rate
    // Objects delivered on first attempt (tentativasEntrega = 1 and status ENTREGUE)
    const objetosEntregues1a = await prisma.objeto.count({
      where: {
        unidadeId,
        statusAtual: 'ENTREGUE',
        tentativasEntrega: 1,
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const totalTentativas = await prisma.objeto.count({
      where: {
        unidadeId,
        tentativasEntrega: { gte: 1 },
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const fadr = totalTentativas > 0
      ? Number((objetosEntregues1a / totalTentativas).toFixed(4))
      : 0;

    // SPR: stops per route (average)
    const totalParadas = rotas.reduce((sum, r) => sum + r.totalParadas, 0);
    const spr = totalRotas > 0
      ? Number((totalParadas / totalRotas).toFixed(2))
      : 0;

    // SPH: stops per hour across active routes
    let totalStopsActive = 0;
    let totalHoursActive = 0;
    const agora = new Date();
    for (const r of rotasAtivas) {
      if (r.iniciadoEm) {
        const fim = r.concluidoEm ?? agora;
        const hours = (fim.getTime() - r.iniciadoEm.getTime()) / (1000 * 60 * 60);
        if (hours > 0) {
          totalStopsActive += r.totalParadas;
          totalHoursActive += hours;
        }
      }
    }
    const sph = totalHoursActive > 0
      ? Number((totalStopsActive / totalHoursActive).toFixed(2))
      : 0;

    // Utilizacao: avg volume usage (totalObjetos / totalParadas as proxy)
    const totalObjetosAll = rotas.reduce((sum, r) => sum + r.totalObjetos, 0);
    const totalEntreguesAll = rotas.reduce((sum, r) => sum + r.totalEntregues, 0);
    const utilizacao = totalObjetosAll > 0
      ? Number((totalEntreguesAll / totalObjetosAll).toFixed(4))
      : 0;

    // OTDR: on-time dispatch rate
    const rotasComDespacho = rotas.filter((r) => r.horarioDespachoAlvo && r.iniciadoEm);
    const rotasOnTime = rotasComDespacho.filter((r) => {
      const alvo = r.horarioDespachoAlvo!;
      const inicio = r.iniciadoEm!;
      // Consider on-time if started within 30 minutes of target
      return inicio.getTime() - alvo.getTime() <= 30 * 60 * 1000;
    });
    const otdr = rotasComDespacho.length > 0
      ? Number((rotasOnTime.length / rotasComDespacho.length).toFixed(4))
      : 0;

    // PNOV rate: total PNOVs / total objects
    const totalPnovs = rotas.reduce((sum, r) => sum + r.totalPnovs, 0);
    const pnovRate = totalObjetosAll > 0
      ? Number((totalPnovs / totalObjetosAll).toFixed(4))
      : 0;

    // NPS: average from NpsResposta
    const npsRespostas = await prisma.npsResposta.findMany({
      where: {
        objeto: {
          unidadeId,
        },
        respondidoEm: { gte: dataRef, lt: dataFim },
      },
      select: { nota: true },
    });

    let nps: number | null = null;
    if (npsRespostas.length > 0) {
      const promotores = npsRespostas.filter((r) => r.nota >= 9).length;
      const detratores = npsRespostas.filter((r) => r.nota <= 6).length;
      nps = Number(
        (((promotores - detratores) / npsRespostas.length) * 100).toFixed(1),
      );
    }

    return {
      data: dataRef.toISOString().split('T')[0],
      totalRotas,
      rotasAtivas: rotasAtivas.length,
      fadr,
      spr,
      sph,
      utilizacao,
      otdr,
      pnovRate,
      nps,
      totalObjetos: totalObjetosAll,
      totalEntregues: totalEntreguesAll,
      totalPnovs,
    };
  }

  async getRitmo(rotaId: string) {
    const snapshots = await prisma.ritmoSnapshot.findMany({
      where: { rotaId },
      orderBy: { ocorridoEm: 'asc' },
    });

    return snapshots;
  }

  async getPlanejadoExecutado(rotaId: string) {
    const paradas = await prisma.parada.findMany({
      where: { rotaId },
      select: {
        id: true,
        sequencia: true,
        latitude: true,
        longitude: true,
        cep: true,
        logradouro: true,
        statusAtual: true,
        estimativaChegada: true,
        chegadaReal: true,
        saidaReal: true,
        totalObjetos: true,
        totalEntregues: true,
        totalInsucessos: true,
      },
      orderBy: { sequencia: 'asc' },
    });

    return paradas.map((p) => ({
      id: p.id,
      sequencia: p.sequencia,
      latitude: p.latitude,
      longitude: p.longitude,
      cep: p.cep,
      logradouro: p.logradouro,
      statusAtual: p.statusAtual,
      planejado: p.estimativaChegada,
      executado: p.chegadaReal,
      saida: p.saidaReal,
      totalObjetos: p.totalObjetos,
      totalEntregues: p.totalEntregues,
      totalInsucessos: p.totalInsucessos,
    }));
  }

  private todayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}

export const monitoramentoService = new MonitoramentoService();
