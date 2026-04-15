import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

interface Divergencia {
  objetoId: string;
  tipo: string;
  descricao: string;
}

export class RecebimentoService {
  async scanUnitizador(codigoUnitizador: string, unidadeId: string, atorId: string) {
    const unitizador = await prisma.unitizador.findFirst({
      where: {
        OR: [
          { codigo: codigoUnitizador },
          { qrCode: codigoUnitizador },
        ],
      },
      include: { objetos: true },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador não encontrado');
    }

    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
      select: { nome: true },
    });

    const nomeUnidade = unidade?.nome ?? 'Unidade';
    const agora = new Date();
    const statusAnterior = unitizador.statusAtual;
    const localizacaoAnterior = unitizador.localizacaoAtual;
    const localizacaoNova = { tipo: 'ESPACO_FISICO', referencia: 'RECEBIMENTO' };

    const resultado = await prisma.$transaction(async (tx) => {
      // CASCADE: update all objects inside this unitizador to RECEBIDO_UNIDADE
      if (unitizador.objetos.length > 0) {
        const objetoIds = unitizador.objetos.map((o) => o.id);

        await tx.objeto.updateMany({
          where: { id: { in: objetoIds } },
          data: {
            statusAtual: 'RECEBIDO_UNIDADE',
            unidadeId,
          },
        });

        // Create ObjetoEvento for each object
        await tx.objetoEvento.createMany({
          data: objetoIds.map((objetoId) => ({
            objetoId,
            tipo: 'RO',
            descricao: 'Objeto recebido na unidade',
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'GESTOR' as const,
            atorId,
          })),
        });
      }

      // Update unitizador status and location
      const unitizadorAtualizado = await tx.unitizador.update({
        where: { id: unitizador.id },
        data: {
          statusAtual: 'EM_USO',
          localizacaoAtual: localizacaoNova,
        },
        include: { objetos: true },
      });

      // Create UnitizadorHistorico entry
      await tx.unitizadorHistorico.create({
        data: {
          unitizadorId: unitizador.id,
          statusAnterior,
          statusNovo: 'EM_USO',
          localizacaoAnterior: localizacaoAnterior as object,
          localizacaoNova: localizacaoNova,
          atorId,
          motivo: 'Scan de recebimento na unidade',
        },
      });

      return unitizadorAtualizado;
    });

    return resultado;
  }

  async confirmarConferencia(
    unitizadorId: string,
    divergencias: Divergencia[],
    atorId: string,
  ) {
    const unitizador = await prisma.unitizador.findUnique({
      where: { id: unitizadorId },
      include: {
        objetos: true,
        unidade: { select: { nome: true } },
      },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador não encontrado');
    }

    const agora = new Date();
    const nomeUnidade = unitizador.unidade.nome;
    const objetoIds = unitizador.objetos.map((o) => o.id);
    const resultado = await prisma.$transaction(async (tx) => {
      // Update all objects in unitizador to EM_CONFERENCIA
      if (objetoIds.length > 0) {
        await tx.objeto.updateMany({
          where: { id: { in: objetoIds } },
          data: { statusAtual: 'EM_CONFERENCIA' },
        });

        // Create conference events for all objects
        await tx.objetoEvento.createMany({
          data: objetoIds.map((objetoId) => ({
            objetoId,
            tipo: 'CF',
            descricao: 'Conferência realizada',
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'GESTOR' as const,
            atorId,
          })),
        });
      }

      // Process divergencias
      if (divergencias.length > 0) {
        const avariasIds = divergencias
          .filter((d) => d.tipo === 'AVARIA')
          .map((d) => d.objetoId);

        // Mark AVARIA objects
        if (avariasIds.length > 0) {
          await tx.objeto.updateMany({
            where: { id: { in: avariasIds } },
            data: { statusAtual: 'AVARIADO' },
          });
        }

        // Create divergencia events
        await tx.objetoEvento.createMany({
          data: divergencias.map((d) => ({
            objetoId: d.objetoId,
            tipo: 'DV',
            descricao: `Divergência: ${d.tipo} - ${d.descricao}`,
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'GESTOR' as const,
            atorId,
            metadata: { tipoDivergencia: d.tipo, descricaoDivergencia: d.descricao },
          })),
        });
      }

      return {
        unitizadorId,
        totalObjetos: objetoIds.length,
        totalDivergencias: divergencias.length,
        divergencias,
      };
    });

    return resultado;
  }

  async registrarAvaria(
    objetoId: string,
    categoria: string,
    descricao: string,
    fotoUrl: string | null,
    atorId: string,
  ) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: { unidade: { select: { nome: true } } },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto não encontrado');
    }

    const agora = new Date();

    const resultado = await prisma.$transaction(async (tx) => {
      // Update object status to AVARIADO
      const objetoAtualizado = await tx.objeto.update({
        where: { id: objetoId },
        data: { statusAtual: 'AVARIADO' },
      });

      // Create ObjetoEvento with evidencias
      await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: 'AV',
          descricao: `Avaria registrada: ${categoria} - ${descricao}`,
          ocorridoEm: agora,
          localDescricao: objeto.unidade.nome,
          atorTipo: 'GESTOR',
          atorId,
          evidencias: {
            categoria,
            descricao,
            fotoUrl,
          },
        },
      });

      return objetoAtualizado;
    });

    return resultado;
  }

  async listarExcecoes(unidadeId: string) {
    const objetos = await prisma.objeto.findMany({
      where: {
        unidadeId,
        statusAtual: { in: ['AVARIADO', 'EXTRAVIADO'] },
      },
      include: {
        eventos: {
          orderBy: { ocorridoEm: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return objetos;
  }

  async getRelatorio(unidadeId: string, data?: string) {
    const dataRef = data ? new Date(data) : new Date();
    const inicioDia = new Date(dataRef);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(dataRef);
    fimDia.setHours(23, 59, 59, 999);

    const [totalRecebidos, totalDivergencias, totalAvarias, unitizadoresProcessados] =
      await Promise.all([
        // Total objects received today
        prisma.objetoEvento.count({
          where: {
            tipo: 'RO',
            ocorridoEm: { gte: inicioDia, lte: fimDia },
            objeto: { unidadeId },
          },
        }),

        // Total divergencias today
        prisma.objetoEvento.count({
          where: {
            tipo: 'DV',
            ocorridoEm: { gte: inicioDia, lte: fimDia },
            objeto: { unidadeId },
          },
        }),

        // Total avarias today
        prisma.objetoEvento.count({
          where: {
            tipo: 'AV',
            ocorridoEm: { gte: inicioDia, lte: fimDia },
            objeto: { unidadeId },
          },
        }),

        // Unitizadores processed today (via historico)
        prisma.unitizadorHistorico.count({
          where: {
            unitizador: { unidadeId },
            statusNovo: 'EM_USO',
            ocorridoEm: { gte: inicioDia, lte: fimDia },
          },
        }),
      ]);

    return {
      data: inicioDia.toISOString().split('T')[0],
      totalRecebidos,
      totalDivergencias,
      totalAvarias,
      unitizadoresProcessados,
    };
  }
}

export const recebimentoService = new RecebimentoService();
