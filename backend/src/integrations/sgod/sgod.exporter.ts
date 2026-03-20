import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

interface SgodExportData {
  unidade: {
    codigo: string;
    nome: string;
    tipo: string;
    modeloTriagem: string;
  };
  periodo: {
    data: string;
    turno: string;
  };
  volume: {
    totalRecebido: number;
    totalEntregue: number;
    totalInsucesso: number;
    totalDevolvido: number;
    taxaEntregaPrimeiraTentativa: number; // FADR
  };
  desempenho: {
    rotasTotal: number;
    rotasFinalizadas: number;
    sphMedio: number;
    sprMedio: number;
    utilizacaoMedia: number;
    pnovRate: number;
  };
  capacidade: {
    carteirosTotal: number;
    carteirosPresentes: number;
    veiculosTotal: number;
    veiculosDisponiveis: number;
    unitizadoresTotal: number;
  };
  nps?: {
    score: number;
    respostas: number;
    promotores: number;
    neutros: number;
    detratores: number;
  };
}

class SgodExporter {
  /**
   * Aggregates all operational data for a given unit and date,
   * formatted for consumption by SGOD (Sistema de Gestao das
   * Unidades Operacionais de Distribuicao).
   */
  async exportar(unidadeId: string, data?: string): Promise<SgodExportData> {
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const dataRef = data
      ? new Date(data + 'T00:00:00.000Z')
      : this.todayUTC();
    const dataFim = new Date(dataRef);
    dataFim.setUTCDate(dataFim.getUTCDate() + 1);

    const dataStr = dataRef.toISOString().split('T')[0]!;

    // --- Volume ---

    const totalRecebido = await prisma.objeto.count({
      where: {
        unidadeId,
        createdAt: { gte: dataRef, lt: dataFim },
      },
    });

    const totalEntregue = await prisma.objeto.count({
      where: {
        unidadeId,
        statusAtual: 'ENTREGUE',
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const totalInsucesso = await prisma.objeto.count({
      where: {
        unidadeId,
        statusAtual: 'TENTATIVA_SEM_ATENDIMENTO',
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const totalDevolvido = await prisma.objeto.count({
      where: {
        unidadeId,
        statusAtual: { in: ['DEVOLVIDO_UNIDADE', 'DEVOLVIDO_REMETENTE'] },
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    // FADR: first-attempt delivery rate
    const objetosEntregues1a = await prisma.objeto.count({
      where: {
        unidadeId,
        statusAtual: 'ENTREGUE',
        tentativasEntrega: 1,
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const totalComTentativa = await prisma.objeto.count({
      where: {
        unidadeId,
        tentativasEntrega: { gte: 1 },
        updatedAt: { gte: dataRef, lt: dataFim },
      },
    });

    const taxaEntregaPrimeiraTentativa = totalComTentativa > 0
      ? Number((objetosEntregues1a / totalComTentativa).toFixed(4))
      : 0;

    // --- Desempenho (rotas) ---

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
        iniciadoEm: true,
        concluidoEm: true,
      },
    });

    const rotasTotal = rotas.length;
    const rotasFinalizadas = rotas.filter(
      (r) => r.statusAtual === 'FINALIZADA' || r.statusAtual === 'CONCLUIDA',
    ).length;

    // SPR: average stops per route
    const totalParadas = rotas.reduce((sum, r) => sum + r.totalParadas, 0);
    const sprMedio = rotasTotal > 0
      ? Number((totalParadas / rotasTotal).toFixed(2))
      : 0;

    // SPH: average stops per hour across finished routes
    let totalStops = 0;
    let totalHours = 0;
    for (const r of rotas) {
      if (r.iniciadoEm && r.concluidoEm) {
        const hours =
          (r.concluidoEm.getTime() - r.iniciadoEm.getTime()) / (1000 * 60 * 60);
        if (hours > 0) {
          totalStops += r.totalParadas;
          totalHours += hours;
        }
      }
    }
    const sphMedio = totalHours > 0
      ? Number((totalStops / totalHours).toFixed(2))
      : 0;

    // Utilizacao: delivered / total objects
    const totalObjetosRotas = rotas.reduce((sum, r) => sum + r.totalObjetos, 0);
    const totalEntreguesRotas = rotas.reduce((sum, r) => sum + r.totalEntregues, 0);
    const utilizacaoMedia = totalObjetosRotas > 0
      ? Number((totalEntreguesRotas / totalObjetosRotas).toFixed(4))
      : 0;

    // PNOV rate: total PNOVs / total objects
    const totalPnovs = rotas.reduce((sum, r) => sum + r.totalPnovs, 0);
    const pnovRate = totalObjetosRotas > 0
      ? Number((totalPnovs / totalObjetosRotas).toFixed(4))
      : 0;

    // --- Capacidade ---

    const carteirosTotal = await prisma.carteiro.count({
      where: { unidadeId, ativo: true },
    });

    const carteirosPresentes = await prisma.pontoDia.count({
      where: {
        carteiro: { unidadeId },
        data: dataRef,
        presente: true,
      },
    });

    const veiculosTotal = await prisma.unitizador.count({
      where: {
        unidadeId,
        tipo: 'VEICULO',
        ativo: true,
      },
    });

    const veiculosDisponiveis = await prisma.unitizador.count({
      where: {
        unidadeId,
        tipo: 'VEICULO',
        ativo: true,
        statusVeiculo: 'DISPONIVEL',
      },
    });

    const unitizadoresTotal = await prisma.unitizador.count({
      where: {
        unidadeId,
        tipo: { not: 'VEICULO' },
        ativo: true,
      },
    });

    // --- NPS ---

    const npsRespostas = await prisma.npsResposta.findMany({
      where: {
        objeto: { unidadeId },
        respondidoEm: { gte: dataRef, lt: dataFim },
      },
      select: { nota: true },
    });

    let nps: SgodExportData['nps'] | undefined;
    if (npsRespostas.length > 0) {
      const promotores = npsRespostas.filter((r) => r.nota >= 9).length;
      const detratores = npsRespostas.filter((r) => r.nota <= 6).length;
      const neutros = npsRespostas.length - promotores - detratores;
      const score = Number(
        (((promotores - detratores) / npsRespostas.length) * 100).toFixed(1),
      );
      nps = {
        score,
        respostas: npsRespostas.length,
        promotores,
        neutros,
        detratores,
      };
    }

    // --- Turno ---
    // Determine shift based on current hour (BRT = UTC-3)
    const nowUTC = new Date();
    const brtHour = (nowUTC.getUTCHours() - 3 + 24) % 24;
    const turno = brtHour < 14 ? 'MANHA' : 'TARDE';

    return {
      unidade: {
        codigo: unidade.codigo,
        nome: unidade.nome,
        tipo: unidade.tipo,
        modeloTriagem: unidade.modeloTriagem,
      },
      periodo: {
        data: dataStr,
        turno,
      },
      volume: {
        totalRecebido,
        totalEntregue,
        totalInsucesso,
        totalDevolvido,
        taxaEntregaPrimeiraTentativa,
      },
      desempenho: {
        rotasTotal,
        rotasFinalizadas,
        sphMedio,
        sprMedio,
        utilizacaoMedia,
        pnovRate,
      },
      capacidade: {
        carteirosTotal,
        carteirosPresentes,
        veiculosTotal,
        veiculosDisponiveis,
        unitizadoresTotal,
      },
      nps,
    };
  }

  private todayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}

export const sgodExporter = new SgodExporter();
