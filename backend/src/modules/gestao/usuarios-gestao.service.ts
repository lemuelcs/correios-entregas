import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import type { Role } from '@prisma/client';

interface CreateUsuarioInput {
  cpf?: string;
  email?: string;
  matricula?: string;
  senha: string;
  nome: string;
  role: Role;
  unidadeId?: string;
  telefoneCelular?: string;
  telefoneComercial?: string;
  endResidencialCidade?: string;
  endResidencialUf?: string;
  endResidencialCep?: string;
  endResidencialLogradouro?: string;
  endResidencialNumero?: string;
  endResidencialComplemento?: string;
}

export class UsuariosGestaoService {
  async list(filters: { role?: Role; unidadeId?: string; ativo?: boolean }) {
    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.unidadeId) where.unidadeId = filters.unidadeId;
    if (filters.ativo !== undefined) where.ativo = filters.ativo;

    return prisma.usuario.findMany({
      where,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        cpf: true,
        email: true,
        matricula: true,
        nome: true,
        role: true,
        unidadeId: true,
        unidade: { select: { id: true, nome: true, codigo: true } },
        telefoneCelular: true,
        telefoneComercial: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async getById(id: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        unidade: { select: { id: true, nome: true, codigo: true } },
        carteiro: true,
      },
    });
    if (!usuario) throw new AppError(404, 'Usuário não encontrado');

    const { senha: _, ...withoutPassword } = usuario;
    return withoutPassword;
  }

  async create(data: CreateUsuarioInput) {
    if (data.cpf) {
      const exists = await prisma.usuario.findUnique({ where: { cpf: data.cpf } });
      if (exists) throw new AppError(409, 'CPF já cadastrado');
    }
    if (data.email) {
      const exists = await prisma.usuario.findUnique({ where: { email: data.email } });
      if (exists) throw new AppError(409, 'Email já cadastrado');
    }
    if (data.matricula) {
      const exists = await prisma.usuario.findUnique({ where: { matricula: data.matricula } });
      if (exists) throw new AppError(409, 'Matrícula já cadastrada');
    }

    const senhaHash = await bcrypt.hash(data.senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        ...data,
        senha: senhaHash,
      },
    });

    const { senha: _, ...withoutPassword } = usuario;
    return withoutPassword;
  }

  async update(id: string, data: Partial<CreateUsuarioInput> & { ativo?: boolean }) {
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Usuário não encontrado');

    const updateData: any = { ...data };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: updateData,
      include: { unidade: { select: { id: true, nome: true, codigo: true } } },
    });

    const { senha: _, ...withoutPassword } = usuario;
    return withoutPassword;
  }
}

export const usuariosGestaoService = new UsuariosGestaoService();
