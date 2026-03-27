import { Prisma, TipoUnidade, ModeloTriagem } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { PaginationParams, paginatedResult } from '../../shared/utils/pagination';

interface ListFilters {
  ativa?: boolean;
  pagination: PaginationParams;
}

interface FaixaCep {
  inicio: string;
  fim: string;
  distritoCodigo?: string;
}

interface CreateUnidadeData {
  codigo: string;
  nome: string;
  tipo: TipoUnidade;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: number;
  longitude: number;
  modeloTriagem?: ModeloTriagem;
  configTriagem?: Record<string, unknown>;
}

export class UnidadeService {
  async list(filters: ListFilters) {
    const { pagination, ativa } = filters;

    const where: Prisma.UnidadeWhereInput = {};
    if (ativa !== undefined) {
      where.ativa = ativa;
    }

    const [data, total] = await Promise.all([
      prisma.unidade.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { nome: 'asc' },
      }),
      prisma.unidade.count({ where }),
    ]);

    return paginatedResult(data, total, pagination);
  }

  async getById(id: string) {
    const unidade = await prisma.unidade.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            carteiros: true,
            objetos: true,
            rotas: true,
          },
        },
      },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    return unidade;
  }

  async create(data: CreateUnidadeData) {
    return prisma.unidade.create({
      data: {
        ...data,
        configTriagem: data.configTriagem as unknown as Prisma.InputJsonValue ?? undefined,
      },
    });
  }

  async update(id: string, data: Partial<CreateUnidadeData>) {
    const exists = await prisma.unidade.findUnique({ where: { id } });
    if (!exists) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    const { configTriagem, ...rest } = data;
    return prisma.unidade.update({
      where: { id },
      data: {
        ...rest,
        ...(configTriagem !== undefined && {
          configTriagem: configTriagem as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async getFaixasCep(id: string) {
    const unidade = await prisma.unidade.findUnique({
      where: { id },
      select: { id: true, faixasCep: true },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    return unidade.faixasCep;
  }

  async updateFaixasCep(id: string, faixas: FaixaCep[]) {
    const exists = await prisma.unidade.findUnique({ where: { id } });
    if (!exists) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    const updated = await prisma.unidade.update({
      where: { id },
      data: { faixasCep: faixas as unknown as Prisma.JsonArray },
      select: { id: true, faixasCep: true },
    });

    return updated.faixasCep;
  }

  async getMinhasUnidades(userId: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { unidadeId: true },
    });

    if (!usuario?.unidadeId) {
      return [];
    }

    // For now, return the single unidade the user belongs to.
    // Future: query a many-to-many access table for multi-unit gestors.
    const unidade = await prisma.unidade.findUnique({
      where: { id: usuario.unidadeId },
      select: { id: true, codigo: true, nome: true, tipo: true, ativa: true },
    });

    return unidade ? [unidade] : [];
  }

  async getDashboardData(id: string) {
    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [objetosByStatus, rotasByStatus, carteirosPresentes, unitizadoresByStatus] = await Promise.all([
      prisma.objeto.groupBy({
        by: ['statusAtual'],
        where: { unidadeId: id },
        _count: { _all: true },
      }),
      prisma.rota.groupBy({
        by: ['statusAtual'],
        where: { unidadeId: id },
        _count: { _all: true },
      }),
      prisma.pontoDia.count({
        where: {
          carteiro: { unidadeId: id },
          data: { gte: today, lt: tomorrow },
          presente: true,
        },
      }),
      prisma.unitizador.groupBy({
        by: ['statusAtual'],
        where: { unidadeId: id },
        _count: { _all: true },
      }),
    ]);

    return {
      objetos: objetosByStatus.map((g) => ({
        status: g.statusAtual,
        count: g._count._all,
      })),
      rotas: rotasByStatus.map((g) => ({
        status: g.statusAtual,
        count: g._count._all,
      })),
      carteirosPresentes,
      unitizadores: unitizadoresByStatus.map((g) => ({
        status: g.statusAtual,
        count: g._count._all,
      })),
    };
  }
}

export const unidadeService = new UnidadeService();
