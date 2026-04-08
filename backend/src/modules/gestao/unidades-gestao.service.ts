import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import type { TipoUnidade } from '@prisma/client';

interface CreateUnidadeInput {
  codigo: string;
  mcu?: string;
  nome: string;
  tipo: TipoUnidade;
  seId?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: number;
  longitude: number;
  faixasCep?: Array<{ inicio: string; fim: string; distritoCodigo?: string }>;
}

export class UnidadesGestaoService {
  async list(filters: { seId?: string; uf?: string; ativa?: boolean }) {
    const where: any = {};
    if (filters.seId) where.seId = filters.seId;
    if (filters.uf) where.uf = filters.uf;
    if (filters.ativa !== undefined) where.ativa = filters.ativa;

    return prisma.unidade.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { se: { select: { id: true, nome: true, sigla: true } } },
    });
  }

  async getById(id: string) {
    const unidade = await prisma.unidade.findUnique({
      where: { id },
      include: {
        se: true,
        _count: { select: { usuarios: true, carteiros: true } },
      },
    });
    if (!unidade) throw new AppError(404, 'Unidade não encontrada');
    return unidade;
  }

  async create(data: CreateUnidadeInput) {
    const exists = await prisma.unidade.findUnique({ where: { codigo: data.codigo } });
    if (exists) throw new AppError(409, 'Código de unidade já cadastrado');

    if (data.mcu) {
      const mcuExists = await prisma.unidade.findUnique({ where: { mcu: data.mcu } });
      if (mcuExists) throw new AppError(409, 'MCU já cadastrado');
    }

    return prisma.unidade.create({
      data: {
        ...data,
        faixasCep: data.faixasCep ?? [],
      },
    });
  }

  async update(id: string, data: Partial<CreateUnidadeInput>) {
    await this.getById(id);

    const updateData: any = { ...data };
    if (data.faixasCep !== undefined) {
      updateData.faixasCep = data.faixasCep;
    }

    return prisma.unidade.update({
      where: { id },
      data: updateData,
      include: { se: true },
    });
  }
}

export const unidadesGestaoService = new UnidadesGestaoService();
