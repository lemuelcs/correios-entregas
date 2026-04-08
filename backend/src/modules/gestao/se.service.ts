import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

export class SeService {
  async list(filters: { ativa?: boolean; uf?: string }) {
    const where: any = {};
    if (filters.ativa !== undefined) where.ativa = filters.ativa;
    if (filters.uf) where.uf = filters.uf;

    return prisma.superintendenciaEstadual.findMany({
      where,
      orderBy: { sigla: 'asc' },
      include: { _count: { select: { unidades: true } } },
    });
  }

  async getById(id: string) {
    const se = await prisma.superintendenciaEstadual.findUnique({
      where: { id },
      include: { unidades: { select: { id: true, codigo: true, nome: true, cidade: true, uf: true, ativa: true } } },
    });
    if (!se) throw new AppError(404, 'SE não encontrada');
    return se;
  }

  async create(data: {
    nome: string;
    sigla: string;
    cidade: string;
    uf: string;
    isSede?: boolean;
  }) {
    const exists = await prisma.superintendenciaEstadual.findUnique({ where: { sigla: data.sigla } });
    if (exists) throw new AppError(409, 'Sigla já cadastrada');

    return prisma.superintendenciaEstadual.create({ data });
  }

  async update(id: string, data: Partial<{
    nome: string;
    sigla: string;
    cidade: string;
    uf: string;
    isSede: boolean;
  }>) {
    await this.getById(id);
    return prisma.superintendenciaEstadual.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.getById(id);
    return prisma.superintendenciaEstadual.update({
      where: { id },
      data: { ativa: false },
    });
  }
}

export const seService = new SeService();
