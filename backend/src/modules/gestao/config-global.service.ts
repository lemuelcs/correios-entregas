import { prisma } from '../../shared/utils/prisma';

export class ConfigGlobalService {
  async list() {
    return prisma.configuracaoGlobal.findMany({
      orderBy: { chave: 'asc' },
    });
  }

  async upsert(chave: string, valor: any, descricao?: string) {
    return prisma.configuracaoGlobal.upsert({
      where: { chave },
      update: { valor, ...(descricao !== undefined ? { descricao } : {}) },
      create: { chave, valor, descricao },
    });
  }
}

export const configGlobalService = new ConfigGlobalService();
