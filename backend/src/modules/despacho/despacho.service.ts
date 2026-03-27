import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

export class DespachoService {
  async getPontoDia(unidadeId: string, data?: string) {
    const dataRef = data ? new Date(data + 'T00:00:00.000Z') : this.todayUTC();

    const carteiros = await prisma.carteiro.findMany({
      where: { unidadeId, ativo: true },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        pontos: {
          where: { data: dataRef },
        },
      },
      orderBy: { usuario: { nome: 'asc' } },
    });

    return carteiros.map((c) => ({
      id: c.id,
      matricula: c.matricula,
      modalPrincipal: c.modalPrincipal,
      usuario: c.usuario,
      ponto: c.pontos[0] ?? null,
    }));
  }

  async registrarPonto(
    carteiroId: string,
    data: string,
    presente: boolean,
    horaEntrada?: string,
    observacao?: string,
  ) {
    const carteiro = await prisma.carteiro.findUnique({ where: { id: carteiroId } });
    if (!carteiro) {
      throw new AppError(404, 'Carteiro não encontrado');
    }

    const dataRef = new Date(data + 'T00:00:00.000Z');

    const ponto = await prisma.pontoDia.upsert({
      where: {
        carteiroId_data: { carteiroId, data: dataRef },
      },
      update: {
        presente,
        horaEntrada: horaEntrada ? new Date(horaEntrada) : undefined,
        observacao,
      },
      create: {
        carteiroId,
        data: dataRef,
        presente,
        horaEntrada: horaEntrada ? new Date(horaEntrada) : null,
        observacao: observacao ?? null,
      },
    });

    return ponto;
  }

  async listCarteiros(unidadeId: string) {
    const carteiros = await prisma.carteiro.findMany({
      where: { unidadeId },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        _count: {
          select: {
            rotas: {
              where: {
                statusAtual: { in: ['CRIADA', 'DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO'] },
              },
            },
          },
        },
      },
      orderBy: { usuario: { nome: 'asc' } },
    });

    return carteiros.map((c) => ({
      id: c.id,
      matricula: c.matricula,
      modalPrincipal: c.modalPrincipal,
      cnh: c.cnh,
      ativo: c.ativo,
      usuario: c.usuario,
      rotasAtivas: c._count.rotas,
    }));
  }

  async getRotasPendentes(unidadeId: string) {
    const rotas = await prisma.rota.findMany({
      where: {
        unidadeId,
        statusAtual: { in: ['CRIADA', 'DISPONIVEL'] },
      },
      include: {
        carteiro: {
          include: {
            usuario: { select: { id: true, nome: true } },
          },
        },
        veiculo: {
          select: { id: true, codigo: true, tipo: true, placa: true, modal: true },
        },
        _count: {
          select: {
            paradas: true,
            objetos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rotas.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      statusAtual: r.statusAtual,
      totalParadas: r._count.paradas,
      totalObjetos: r._count.objetos,
      distanciaEstimadaKm: r.distanciaEstimadaKm,
      duracaoEstimadaMin: r.duracaoEstimadaMin,
      carteiro: {
        id: r.carteiro.id,
        matricula: r.carteiro.matricula,
        modalPrincipal: r.carteiro.modalPrincipal,
        usuario: r.carteiro.usuario,
      },
      veiculo: r.veiculo,
      createdAt: r.createdAt,
    }));
  }

  async liberarRota(
    rotaId: string,
    posicaoEstacao: string,
    unitizadorIds: string[],
    atorId: string,
  ) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        objetos: { select: { id: true } },
        unidade: { select: { nome: true } },
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    if (rota.statusAtual !== 'CRIADA') {
      throw new AppError(422, 'Só é possível liberar rotas com status CRIADA');
    }

    const agora = new Date();
    const nomeUnidade = rota.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      // Update rota to DISPONIVEL
      const rotaAtualizada = await tx.rota.update({
        where: { id: rotaId },
        data: {
          statusAtual: 'DISPONIVEL',
          posicaoEstacao,
          unitizadorIds,
          horarioDespachoAlvo: agora,
        },
        include: {
          carteiro: {
            include: {
              usuario: { select: { id: true, nome: true } },
            },
          },
          veiculo: {
            select: { id: true, codigo: true, tipo: true, placa: true, modal: true },
          },
          _count: { select: { paradas: true, objetos: true } },
        },
      });

      // Update each unitizador to EM_USO and link to this rota
      for (const unitizadorId of unitizadorIds) {
        await tx.unitizador.update({
          where: { id: unitizadorId },
          data: {
            rotaAtualId: rotaId,
            statusAtual: 'EM_USO',
          },
        });
      }

      // Create ObjetoEvento for each object in rota
      if (rota.objetos.length > 0) {
        await tx.objetoEvento.createMany({
          data: rota.objetos.map((obj) => ({
            objetoId: obj.id,
            tipo: 'DO',
            descricao: 'Objeto disponível para despacho',
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'GESTOR' as const,
            atorId,
          })),
        });
      }

      return rotaAtualizada;
    });

    return resultado;
  }

  async cancelarRota(rotaId: string, atorId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      select: {
        id: true,
        statusAtual: true,
        veiculoId: true,
        unitizadorIds: true,
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    if (rota.statusAtual !== 'CRIADA' && rota.statusAtual !== 'DISPONIVEL') {
      throw new AppError(422, 'Só é possível cancelar rotas com status CRIADA ou DISPONIVEL');
    }

    const unitizadorIds = (rota.unitizadorIds as string[]) ?? [];

    await prisma.$transaction(async (tx) => {
      // Unassign all objects from this route and reset status
      await tx.objeto.updateMany({
        where: { rotaId },
        data: {
          rotaId: null,
          stopSequence: null,
          statusAtual: 'RECEBIDO_UNIDADE',
        },
      });

      // Delete all paradas
      await tx.parada.deleteMany({
        where: { rotaId },
      });

      // Delete sort plan if exists
      await tx.sortPlan.deleteMany({
        where: { rotaId },
      });

      // Return vehicle to DISPONIVEL
      await tx.unitizador.update({
        where: { id: rota.veiculoId },
        data: { statusVeiculo: 'DISPONIVEL' },
      });

      // Release unitizadores
      for (const unitizadorId of unitizadorIds) {
        await tx.unitizador.update({
          where: { id: unitizadorId },
          data: {
            rotaAtualId: null,
            statusAtual: 'DISPONIVEL',
          },
        });
      }

      // Delete the rota
      await tx.rota.delete({
        where: { id: rotaId },
      });
    });

    return { message: 'Rota cancelada com sucesso' };
  }

  async criarPrevisaoVolume(
    unidadeId: string,
    faixa: string,
    quantidadeEstimada: number,
    data: string,
  ) {
    const dataRef = new Date(data + 'T00:00:00.000Z');

    const previsao = await prisma.volumePrevisao.upsert({
      where: {
        unidadeId_faixa_data: { unidadeId, faixa, data: dataRef },
      },
      update: { quantidadeEstimada },
      create: {
        unidadeId,
        faixa,
        quantidadeEstimada,
        data: dataRef,
      },
    });

    return previsao;
  }

  async getPrevisaoVolume(unidadeId: string, data?: string) {
    const dataRef = data ? new Date(data + 'T00:00:00.000Z') : this.todayUTC();

    const previsoes = await prisma.volumePrevisao.findMany({
      where: { unidadeId, data: dataRef },
      orderBy: { faixa: 'asc' },
    });

    return previsoes;
  }

  async getSimulacao(unidadeId: string) {
    const today = this.todayUTC();

    const [carteirosPresentes, veiculosDisponiveis, objetosProntos] = await Promise.all([
      prisma.pontoDia.count({
        where: {
          carteiro: { unidadeId },
          data: today,
          presente: true,
        },
      }),
      prisma.unitizador.count({
        where: {
          unidadeId,
          tipo: 'VEICULO',
          statusVeiculo: 'DISPONIVEL',
          ativo: true,
        },
      }),
      prisma.objeto.count({
        where: {
          unidadeId,
          statusAtual: { in: ['TRIADO', 'UNITIZADO', 'DISPONIVEL_COLETA'] },
        },
      }),
    ]);

    const capacidadeOperacional = Math.min(carteirosPresentes, veiculosDisponiveis);
    const objetosPorCarteiro = carteirosPresentes > 0
      ? Math.round(objetosProntos / carteirosPresentes)
      : 0;

    return {
      data: today.toISOString().split('T')[0],
      carteirosPresentes,
      veiculosDisponiveis,
      objetosProntos,
      capacidadeOperacional,
      objetosPorCarteiro,
      alerta: carteirosPresentes === 0
        ? 'Nenhum carteiro registrado como presente'
        : veiculosDisponiveis < carteirosPresentes
          ? 'Veículos insuficientes para todos os carteiros presentes'
          : null,
    };
  }

  private todayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}

export const despachoService = new DespachoService();
