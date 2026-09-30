import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import type { Role } from '@prisma/client';
import { invalidarCacheUsuario } from '../../shared/middleware/auth.middleware';
import { normalizarTelefone, TelefoneInvalido } from '../../shared/utils/telefone';
import { garantirMatriculaLivre } from '../entregas/cadastro.service';
import { FORMATO_WHATSAPP } from '../entregas/cadastro.validacao';

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

/** Celular do supervisor em E.164 (US-002.EC-2); inválido → 400 `telefone_invalido`. */
function lerCelular(telefone: string): string {
  try {
    return normalizarTelefone(telefone);
  } catch (err) {
    if (err instanceof TelefoneInvalido) {
      throw new AppError(400, 'telefone_invalido', { campo: 'telefoneCelular', motivo: err.codigo, formato: FORMATO_WHATSAPP });
    }
    throw err;
  }
}

/**
 * Supervisor = `role UNIDADE` com unidade existente e celular válido
 * (TechSpec › Cadastro). Devolve o celular normalizado, quando houver.
 */
async function validarSupervisor(dados: { unidadeId?: string | null; telefoneCelular?: string }, criando: boolean) {
  if (criando && !dados.unidadeId) throw new AppError(400, 'unidade_obrigatoria', { campo: 'unidadeId' });
  if (dados.unidadeId) {
    const unidade = await prisma.unidade.findUnique({ where: { id: dados.unidadeId }, select: { id: true } });
    if (!unidade) throw new AppError(400, 'unidade_invalida', { campo: 'unidadeId' });
  }
  if (criando && !dados.telefoneCelular) throw new AppError(400, 'telefone_obrigatorio', { campo: 'telefoneCelular' });
  return dados.telefoneCelular ? lerCelular(dados.telefoneCelular) : undefined;
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

    const { senha, ...withoutPassword } = usuario;
    void senha;
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
    if (data.role === 'UNIDADE') {
      const celular = await validarSupervisor(data, true);
      if (celular) data = { ...data, telefoneCelular: celular };
    }
    // Matrícula única entre usuários e carteiros (US-002.EC-1).
    if (data.matricula) await garantirMatriculaLivre(data.matricula);

    const senhaHash = await bcrypt.hash(data.senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        ...data,
        senha: senhaHash,
      },
    });

    const { senha, ...withoutPassword } = usuario;
    void senha;
    return withoutPassword;
  }

  async update(id: string, data: Partial<CreateUsuarioInput> & { ativo?: boolean }) {
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Usuário não encontrado');

    const role = data.role ?? existing.role;
    if (role === 'UNIDADE') {
      const celular = await validarSupervisor(
        { unidadeId: data.unidadeId, telefoneCelular: data.telefoneCelular },
        false,
      );
      if (celular) data = { ...data, telefoneCelular: celular };
    }
    if (data.matricula && data.matricula !== existing.matricula) {
      await garantirMatriculaLivre(data.matricula, { ignorarUsuarioId: id });
    }

    const updateData: any = { ...data };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: updateData,
      include: { unidade: { select: { id: true, nome: true, codigo: true } } },
    });
    // Desativação, troca de unidade ou de papel valem na próxima requisição (US-002.EC-3/EC-5).
    invalidarCacheUsuario(id);

    const { senha, ...withoutPassword } = usuario;
    void senha;
    return withoutPassword;
  }
}

export const usuariosGestaoService = new UsuariosGestaoService();
