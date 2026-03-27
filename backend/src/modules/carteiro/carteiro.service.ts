import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const PRAZOS_GUARDA: Record<string, number> = {
  DG: 7,
  DL: 7,
  DX: 7,
  PB: 7,
  PC: 7,
  RB: 20,
};

const MOTIVO_BDE: Record<string, string> = {
  SEM_ATENDIMENTO: 'BDE_02',
  RECUSADO: 'BDE_04',
  ENDERECO_INCORRETO: 'BDE_07',
  MUDOU_SE: 'BDE_10',
};

const MOTIVO_DESCRICAO: Record<string, string> = {
  SEM_ATENDIMENTO: 'Destinatario ausente - sem atendimento',
  RECUSADO: 'Objeto recusado pelo destinatario',
  ENDERECO_INCORRETO: 'Endereco incorreto ou insuficiente',
  MUDOU_SE: 'Destinatario mudou-se',
};

export class CarteiroService {
  async getRotaAtual(carteiroId: string) {
    const rota = await prisma.rota.findFirst({
      where: {
        carteiroId,
        statusAtual: { in: ['DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO'] },
      },
      include: {
        paradas: { orderBy: { sequencia: 'asc' } },
        objetos: true,
        veiculo: true,
        carteiro: {
          include: { usuario: true },
        },
      },
    });

    return rota ?? null;
  }

  async getHistoricoRotas(carteiroId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [rotas, total] = await Promise.all([
      prisma.rota.findMany({
        where: {
          carteiroId,
          statusAtual: { in: ['CONCLUIDA', 'FINALIZADA'] },
        },
        orderBy: { concluidoEm: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { paradas: true, objetos: true } },
        },
      }),
      prisma.rota.count({
        where: {
          carteiroId,
          statusAtual: { in: ['CONCLUIDA', 'FINALIZADA'] },
        },
      }),
    ]);

    return {
      data: rotas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async coletarUnitizador(carteiroId: string, qrCode: string) {
    const unitizador = await prisma.unitizador.findUnique({
      where: { qrCode },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador nao encontrado para este QR Code');
    }

    // Find the rota linked to this unitizador
    let rota = unitizador.rotaAtualId
      ? await prisma.rota.findUnique({
          where: { id: unitizador.rotaAtualId },
          include: {
            objetos: true,
            paradas: { orderBy: { sequencia: 'asc' } },
            veiculo: true,
            carteiro: { include: { usuario: true } },
          },
        })
      : null;

    // Fallback: search rotas whose unitizadorIds JSON array contains this unitizador
    if (!rota) {
      const rotas = await prisma.rota.findMany({
        where: {
          statusAtual: { in: ['DISPONIVEL', 'COLETADA'] },
        },
        include: {
          objetos: true,
          paradas: { orderBy: { sequencia: 'asc' } },
          veiculo: true,
          carteiro: { include: { usuario: true } },
        },
      });

      rota = rotas.find((r) => {
        const ids = r.unitizadorIds as string[];
        return Array.isArray(ids) && ids.includes(unitizador.id);
      }) ?? null;
    }

    if (!rota) {
      throw new AppError(404, 'Nenhuma rota encontrada para este unitizador');
    }

    if (rota.carteiroId !== carteiroId) {
      throw new AppError(403, 'Esta rota nao esta atribuida a voce');
    }

    return rota;
  }

  async confirmarColeta(
    carteiroId: string,
    rotaId: string,
    objetosConfirmados: string[],
  ) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        objetos: { select: { id: true, codigoRastreio: true } },
        unidade: { select: { nome: true } },
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota nao encontrada');
    }

    if (rota.carteiroId !== carteiroId) {
      throw new AppError(403, 'Esta rota nao esta atribuida a voce');
    }

    const todosObjetoIds = rota.objetos.map((o) => o.id);
    const confirmadosSet = new Set(objetosConfirmados);
    const pnovIds = todosObjetoIds.filter((id) => !confirmadosSet.has(id));
    const confirmadosIds = todosObjetoIds.filter((id) => confirmadosSet.has(id));

    const agora = new Date();
    const nomeUnidade = rota.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      // PNOV objects: not present during collection
      if (pnovIds.length > 0) {
        await tx.objetoEvento.createMany({
          data: pnovIds.map((objetoId) => ({
            objetoId,
            tipo: 'PNOV',
            descricao: 'Objeto nao encontrado na coleta (PNOV)',
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'CARTEIRO' as const,
            atorId: carteiroId,
            rotaId,
          })),
        });
      }

      // Confirmed objects: update status to COLETADO_CARTEIRO and create OEC event
      if (confirmadosIds.length > 0) {
        await tx.objeto.updateMany({
          where: { id: { in: confirmadosIds } },
          data: { statusAtual: 'COLETADO_CARTEIRO' },
        });

        await tx.objetoEvento.createMany({
          data: confirmadosIds.map((objetoId) => ({
            objetoId,
            tipo: 'OEC',
            descricao: 'Objeto coletado pelo carteiro',
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'CARTEIRO' as const,
            atorId: carteiroId,
            rotaId,
          })),
        });
      }

      // Update rota
      await tx.rota.update({
        where: { id: rotaId },
        data: {
          statusAtual: 'EM_ANDAMENTO',
          iniciadoEm: agora,
          totalPnovs: { increment: pnovIds.length },
        },
      });

      return {
        rotaId,
        pnovs: pnovIds,
        totalConfirmados: confirmadosIds.length,
        totalPnovs: pnovIds.length,
      };
    });

    return resultado;
  }

  async getParadaAtual(rotaId: string) {
    const parada = await prisma.parada.findFirst({
      where: {
        rotaId,
        statusAtual: 'PENDENTE',
      },
      orderBy: { sequencia: 'asc' },
    });

    if (!parada) {
      return null;
    }

    // Get objects at this stop
    const objetos = await prisma.objeto.findMany({
      where: {
        rotaId,
        stopSequence: parada.sequencia,
      },
    });

    return { ...parada, objetos };
  }

  async registrarEntrega(
    objetoId: string,
    latitude: number,
    longitude: number,
    foto: string | undefined,
    atorId: string,
  ) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: {
        rota: { select: { id: true, unidade: { select: { nome: true } } } },
      },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    if (objeto.statusAtual !== 'COLETADO_CARTEIRO' && objeto.statusAtual !== 'EM_ROTA') {
      throw new AppError(422, 'Status do objeto nao permite entrega');
    }

    const agora = new Date();
    const rotaId = objeto.rotaId;
    const localDescricao = objeto.rota?.unidade?.nome ?? 'Em campo';

    const resultado = await prisma.$transaction(async (tx) => {
      // Update objeto status
      await tx.objeto.update({
        where: { id: objetoId },
        data: { statusAtual: 'ENTREGUE' },
      });

      // Create delivery event
      const evento = await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: 'BDE_01',
          descricao: 'Entregue com sucesso',
          ocorridoEm: agora,
          latitude,
          longitude,
          localDescricao,
          atorTipo: 'CARTEIRO',
          atorId,
          evidencias: { fotos: foto ? [foto] : [], assinatura: null },
          rotaId,
          stopSequence: objeto.stopSequence,
        },
      });

      // Update parada counters if object is assigned to a stop
      if (rotaId && objeto.stopSequence !== null) {
        const parada = await tx.parada.findFirst({
          where: { rotaId, sequencia: objeto.stopSequence },
        });

        if (parada) {
          const updatedParada = await tx.parada.update({
            where: { id: parada.id },
            data: { totalEntregues: { increment: 1 } },
          });

          // Check if all objects at this stop are done
          const totalProcessados = updatedParada.totalEntregues + updatedParada.totalInsucessos;
          if (totalProcessados >= updatedParada.totalObjetos) {
            await tx.parada.update({
              where: { id: parada.id },
              data: { statusAtual: 'CONCLUIDA' },
            });
          }
        }
      }

      // Update rota counters
      if (rotaId) {
        await tx.rota.update({
          where: { id: rotaId },
          data: { totalEntregues: { increment: 1 } },
        });
      }

      return evento;
    });

    return { success: true, evento: resultado };
  }

  async registrarInsucesso(
    objetoId: string,
    motivo: string,
    latitude: number,
    longitude: number,
    foto: string | undefined,
    atorId: string,
  ) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: {
        rota: { select: { id: true, unidade: { select: { nome: true } } } },
      },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    const bdeCode = MOTIVO_BDE[motivo];
    if (!bdeCode) {
      throw new AppError(400, 'Motivo de insucesso invalido');
    }

    const agora = new Date();
    const rotaId = objeto.rotaId;
    const localDescricao = objeto.rota?.unidade?.nome ?? 'Em campo';
    const novasTentativas = objeto.tentativasEntrega + 1;

    // Determine new status
    let novoStatus: 'TENTATIVA_SEM_ATENDIMENTO' | 'DEVOLVIDO_UNIDADE' = 'TENTATIVA_SEM_ATENDIMENTO';
    let dataLimiteGuarda: Date | null = null;

    if (novasTentativas >= objeto.maxTentativas) {
      novoStatus = 'DEVOLVIDO_UNIDADE';
      const diasGuarda = PRAZOS_GUARDA[objeto.servicoCodigo] ?? objeto.diasGuarda;
      dataLimiteGuarda = new Date(agora);
      dataLimiteGuarda.setDate(dataLimiteGuarda.getDate() + diasGuarda);
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // Update objeto
      await tx.objeto.update({
        where: { id: objetoId },
        data: {
          statusAtual: novoStatus,
          tentativasEntrega: novasTentativas,
          ...(dataLimiteGuarda ? { dataLimiteGuarda } : {}),
        },
      });

      // Create insucesso event
      const evento = await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: bdeCode,
          descricao: MOTIVO_DESCRICAO[motivo],
          ocorridoEm: agora,
          latitude,
          longitude,
          localDescricao,
          atorTipo: 'CARTEIRO',
          atorId,
          evidencias: foto ? { fotos: [foto] } : undefined,
          rotaId,
          stopSequence: objeto.stopSequence,
          metadata: { motivo, tentativa: novasTentativas },
        },
      });

      // Update parada counters
      if (rotaId && objeto.stopSequence !== null) {
        const parada = await tx.parada.findFirst({
          where: { rotaId, sequencia: objeto.stopSequence },
        });

        if (parada) {
          const updatedParada = await tx.parada.update({
            where: { id: parada.id },
            data: { totalInsucessos: { increment: 1 } },
          });

          // Check if all objects at this stop are done
          const totalProcessados = updatedParada.totalEntregues + updatedParada.totalInsucessos;
          if (totalProcessados >= updatedParada.totalObjetos) {
            await tx.parada.update({
              where: { id: parada.id },
              data: { statusAtual: 'CONCLUIDA' },
            });
          }
        }
      }

      // Update rota counters
      if (rotaId) {
        await tx.rota.update({
          where: { id: rotaId },
          data: { totalInsucessos: { increment: 1 } },
        });
      }

      return evento;
    });

    return resultado;
  }

  async registrarPnov(
    rotaId: string,
    objetoId: string,
    latitude: number,
    longitude: number,
    atorId: string,
  ) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: {
        rota: { select: { unidade: { select: { nome: true } } } },
      },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    const agora = new Date();
    const localDescricao = objeto.rota?.unidade?.nome ?? 'Em campo';

    const resultado = await prisma.$transaction(async (tx) => {
      const evento = await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: 'PNOV',
          descricao: 'Objeto nao encontrado (PNOV)',
          ocorridoEm: agora,
          latitude,
          longitude,
          localDescricao,
          atorTipo: 'CARTEIRO',
          atorId,
          rotaId,
        },
      });

      await tx.rota.update({
        where: { id: rotaId },
        data: { totalPnovs: { increment: 1 } },
      });

      return evento;
    });

    return resultado;
  }

  async confirmarRetorno(carteiroId: string, rotaId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
    });

    if (!rota) {
      throw new AppError(404, 'Rota nao encontrada');
    }

    if (rota.carteiroId !== carteiroId) {
      throw new AppError(403, 'Esta rota nao esta atribuida a voce');
    }

    const agora = new Date();

    const rotaAtualizada = await prisma.rota.update({
      where: { id: rotaId },
      data: {
        statusAtual: 'CONCLUIDA',
        concluidoEm: agora,
      },
    });

    return {
      rotaId: rotaAtualizada.id,
      statusAtual: rotaAtualizada.statusAtual,
      concluidoEm: rotaAtualizada.concluidoEm,
      totalObjetos: rotaAtualizada.totalObjetos,
      totalEntregues: rotaAtualizada.totalEntregues,
      totalInsucessos: rotaAtualizada.totalInsucessos,
      totalPnovs: rotaAtualizada.totalPnovs,
    };
  }

  async getResumoRota(rotaId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        objetos: {
          where: { statusAtual: { not: 'ENTREGUE' } },
        },
        paradas: { orderBy: { sequencia: 'asc' } },
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota nao encontrada');
    }

    // Calculate SPH (stops per hour) and duration
    let duracaoMinutos: number | null = null;
    let sph: number | null = null;

    if (rota.iniciadoEm) {
      const fim = rota.concluidoEm ?? new Date();
      duracaoMinutos = Math.round(
        (fim.getTime() - rota.iniciadoEm.getTime()) / (1000 * 60),
      );
      const duracaoHoras = duracaoMinutos / 60;
      sph = duracaoHoras > 0
        ? Math.round((rota.totalEntregues / duracaoHoras) * 100) / 100
        : 0;
    }

    return {
      rotaId: rota.id,
      codigo: rota.codigo,
      statusAtual: rota.statusAtual,
      totalObjetos: rota.totalObjetos,
      totalEntregues: rota.totalEntregues,
      totalInsucessos: rota.totalInsucessos,
      totalPnovs: rota.totalPnovs,
      duracaoMinutos,
      sph,
      iniciadoEm: rota.iniciadoEm,
      concluidoEm: rota.concluidoEm,
      objetosPendentesRetorno: rota.objetos,
      paradas: rota.paradas,
    };
  }

  async registrarGps(
    carteiroId: string,
    rotaId: string,
    latitude: number,
    longitude: number,
    velocidade?: number,
  ) {
    await prisma.gpsSnapshot.create({
      data: {
        rotaId,
        carteiroId,
        latitude,
        longitude,
        velocidade: velocidade ?? null,
      },
    });

    return { ok: true };
  }
}

export const carteiroService = new CarteiroService();
