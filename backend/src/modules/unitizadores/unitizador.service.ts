import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { PaginationParams, paginatedResult } from '../../shared/utils/pagination';

interface ListFilters {
  tipo?: string;
  statusAtual?: string;
  unidadeId: string;
}

interface CreateInput {
  codigo: string;
  tipo: string;
  unidadeId: string;
  larguraCm?: number;
  alturaCm?: number;
  profundidadeCm?: number;
  volumeLitros?: number;
  capacidadeKg?: number;
}

interface UpdateInput {
  statusAtual?: string;
  localizacaoAtual?: object;
  rotaAtualId?: string | null;
  parentId?: string | null;
  ativo?: boolean;
  larguraCm?: number;
  alturaCm?: number;
  profundidadeCm?: number;
  volumeLitros?: number;
  capacidadeKg?: number;
}

interface TransferInput {
  origemIds: string[];
  destinoIds: string[];
  objetoIds: string[];
}

interface CreateVeiculoInput {
  codigo: string;
  unidadeId: string;
  placa: string;
  modeloVeiculo: string;
  modal: string;
  capacidadeKg?: number;
}

interface UpdateVeiculoInput {
  placa?: string;
  modeloVeiculo?: string;
  modal?: string;
  statusVeiculo?: string;
  capacidadeKg?: number;
  ativo?: boolean;
}

export class UnitizadorService {
  async list(pagination: PaginationParams, filters: ListFilters) {
    const where: Prisma.UnitizadorWhereInput = {
      unidadeId: filters.unidadeId,
    };

    if (filters.tipo) {
      where.tipo = filters.tipo as any;
    }

    if (filters.statusAtual) {
      where.statusAtual = filters.statusAtual as any;
    }

    const [data, total] = await Promise.all([
      prisma.unitizador.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { objetos: true } },
        },
      }),
      prisma.unitizador.count({ where }),
    ]);

    return paginatedResult(data, total, pagination);
  }

  async create(data: CreateInput, atorId: string) {
    const qrCode = `QR-${data.codigo}`;

    const unitizador = await prisma.unitizador.create({
      data: {
        codigo: data.codigo,
        qrCode,
        tipo: data.tipo as any,
        unidadeId: data.unidadeId,
        larguraCm: data.larguraCm,
        alturaCm: data.alturaCm,
        profundidadeCm: data.profundidadeCm,
        volumeLitros: data.volumeLitros,
        capacidadeKg: data.capacidadeKg,
      },
    });

    await prisma.unitizadorHistorico.create({
      data: {
        unitizadorId: unitizador.id,
        statusAnterior: 'DISPONIVEL',
        statusNovo: 'DISPONIVEL',
        localizacaoAnterior: {},
        localizacaoNova: unitizador.localizacaoAtual as object,
        atorId,
        motivo: 'Criação do unitizador',
      },
    });

    return unitizador;
  }

  async getById(id: string) {
    const unitizador = await prisma.unitizador.findUnique({
      where: { id },
      include: {
        objetos: true,
        _count: { select: { objetos: true } },
        unidade: true,
      },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador não encontrado');
    }

    return unitizador;
  }

  async update(id: string, data: UpdateInput, atorId: string) {
    const existing = await prisma.unitizador.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Unitizador não encontrado');
    }

    const updateData: Prisma.UnitizadorUpdateInput = {};

    if (data.statusAtual !== undefined) updateData.statusAtual = data.statusAtual as any;
    if (data.localizacaoAtual !== undefined) updateData.localizacaoAtual = data.localizacaoAtual as any;
    if (data.rotaAtualId !== undefined) updateData.rotaAtualId = data.rotaAtualId;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;
    if (data.larguraCm !== undefined) updateData.larguraCm = data.larguraCm;
    if (data.alturaCm !== undefined) updateData.alturaCm = data.alturaCm;
    if (data.profundidadeCm !== undefined) updateData.profundidadeCm = data.profundidadeCm;
    if (data.volumeLitros !== undefined) updateData.volumeLitros = data.volumeLitros;
    if (data.capacidadeKg !== undefined) updateData.capacidadeKg = data.capacidadeKg;

    const unitizador = await prisma.unitizador.update({
      where: { id },
      data: updateData,
    });

    const statusChanged = data.statusAtual && data.statusAtual !== existing.statusAtual;
    const locationChanged = data.localizacaoAtual !== undefined;

    if (statusChanged || locationChanged) {
      await prisma.unitizadorHistorico.create({
        data: {
          unitizadorId: id,
          statusAnterior: existing.statusAtual,
          statusNovo: unitizador.statusAtual,
          localizacaoAnterior: existing.localizacaoAtual as object,
          localizacaoNova: unitizador.localizacaoAtual as object,
          atorId,
          motivo: statusChanged ? `Status alterado de ${existing.statusAtual} para ${data.statusAtual}` : 'Localização atualizada',
        },
      });
    }

    return unitizador;
  }

  async getHistorico(unitizadorId: string, pagination: PaginationParams) {
    const unitizador = await prisma.unitizador.findUnique({
      where: { id: unitizadorId },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador não encontrado');
    }

    const where: Prisma.UnitizadorHistoricoWhereInput = { unitizadorId };

    const [data, total] = await Promise.all([
      prisma.unitizadorHistorico.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { ocorridoEm: 'desc' },
      }),
      prisma.unitizadorHistorico.count({ where }),
    ]);

    return paginatedResult(data, total, pagination);
  }

  async transferir(input: TransferInput, atorId: string) {
    const { origemIds, destinoIds, objetoIds } = input;

    if (origemIds.length === 0) {
      throw new AppError(400, 'origemIds não pode ser vazio');
    }
    if (destinoIds.length === 0) {
      throw new AppError(400, 'destinoIds não pode ser vazio');
    }
    if (objetoIds.length === 0) {
      throw new AppError(400, 'objetoIds não pode ser vazio');
    }

    const origemCount = origemIds.length === 1 ? '1' : 'N';
    const destinoCount = destinoIds.length === 1 ? '1' : 'N';
    const tipo = `${origemCount}_${destinoCount}`;

    const result = await prisma.$transaction(async (tx) => {
      // Validate origens exist
      const origens = await tx.unitizador.findMany({
        where: { id: { in: origemIds } },
      });
      if (origens.length !== origemIds.length) {
        throw new AppError(404, 'Um ou mais unitizadores de origem não encontrados');
      }

      // Validate destinos exist
      const destinos = await tx.unitizador.findMany({
        where: { id: { in: destinoIds } },
      });
      if (destinos.length !== destinoIds.length) {
        throw new AppError(404, 'Um ou mais unitizadores de destino não encontrados');
      }

      // Validate objetos exist
      const objetos = await tx.objeto.findMany({
        where: { id: { in: objetoIds } },
      });
      if (objetos.length !== objetoIds.length) {
        throw new AppError(404, 'Um ou mais objetos não encontrados');
      }

      // Move objects to destination(s)
      // If single destination, assign all objects there
      // If multiple destinations, just clear from origin (manual distribution)
      const targetId = destinoIds.length === 1 ? destinoIds[0] : null;

      await tx.objeto.updateMany({
        where: { id: { in: objetoIds } },
        data: { unitizadorId: targetId },
      });

      const transferencia = await tx.transferenciaCarga.create({
        data: {
          origemIds: origemIds,
          destinoIds: destinoIds,
          objetoIds: objetoIds,
          tipo,
          atorId,
        },
      });

      return transferencia;
    });

    return result;
  }

  async findByQrCode(qrCode: string) {
    const unitizador = await prisma.unitizador.findUnique({
      where: { qrCode },
      include: {
        objetos: true,
        _count: { select: { objetos: true } },
        unidade: true,
      },
    });

    if (!unitizador) {
      throw new AppError(404, 'Unitizador não encontrado para o QR Code informado');
    }

    return unitizador;
  }

  async listVeiculos(unidadeId: string) {
    const veiculos = await prisma.unitizador.findMany({
      where: {
        tipo: 'VEICULO',
        unidadeId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return veiculos;
  }

  async createVeiculo(data: CreateVeiculoInput, atorId: string) {
    const qrCode = `QR-${data.codigo}`;

    const veiculo = await prisma.unitizador.create({
      data: {
        codigo: data.codigo,
        qrCode,
        tipo: 'VEICULO',
        unidadeId: data.unidadeId,
        placa: data.placa,
        modeloVeiculo: data.modeloVeiculo,
        modal: data.modal as any,
        statusVeiculo: 'DISPONIVEL',
        capacidadeKg: data.capacidadeKg,
      },
    });

    await prisma.unitizadorHistorico.create({
      data: {
        unitizadorId: veiculo.id,
        statusAnterior: 'DISPONIVEL',
        statusNovo: 'DISPONIVEL',
        localizacaoAnterior: {},
        localizacaoNova: veiculo.localizacaoAtual as object,
        atorId,
        motivo: 'Criação do veículo',
      },
    });

    return veiculo;
  }

  async updateVeiculo(id: string, data: UpdateVeiculoInput, atorId: string) {
    const existing = await prisma.unitizador.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Veículo não encontrado');
    }

    if (existing.tipo !== 'VEICULO') {
      throw new AppError(400, 'Unitizador informado não é um veículo');
    }

    const updateData: Prisma.UnitizadorUpdateInput = {};

    if (data.placa !== undefined) updateData.placa = data.placa;
    if (data.modeloVeiculo !== undefined) updateData.modeloVeiculo = data.modeloVeiculo;
    if (data.modal !== undefined) updateData.modal = data.modal as any;
    if (data.statusVeiculo !== undefined) updateData.statusVeiculo = data.statusVeiculo as any;
    if (data.capacidadeKg !== undefined) updateData.capacidadeKg = data.capacidadeKg;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    const veiculo = await prisma.unitizador.update({
      where: { id },
      data: updateData,
    });

    if (data.statusVeiculo && data.statusVeiculo !== existing.statusVeiculo) {
      await prisma.unitizadorHistorico.create({
        data: {
          unitizadorId: id,
          statusAnterior: existing.statusAtual,
          statusNovo: existing.statusAtual,
          localizacaoAnterior: existing.localizacaoAtual as object,
          localizacaoNova: veiculo.localizacaoAtual as object,
          atorId,
          motivo: `Status veículo alterado de ${existing.statusVeiculo} para ${data.statusVeiculo}`,
        },
      });
    }

    return veiculo;
  }
}

export const unitizadorService = new UnitizadorService();
