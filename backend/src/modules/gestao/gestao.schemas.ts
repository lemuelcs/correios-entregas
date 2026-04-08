import { z } from 'zod';

// ── SE ────────────────────────────────────────────────────────────────────────

export const createSeSchema = z.object({
  nome: z.string().min(3),
  sigla: z.string().min(2).max(10),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  isSede: z.boolean().optional(),
});

export const updateSeSchema = createSeSchema.partial();

// ── Unidade ───────────────────────────────────────────────────────────────────

export const createUnidadeSchema = z.object({
  codigo: z.string().min(3),
  mcu: z.string().optional(),
  nome: z.string().min(3),
  tipo: z.enum(['CDD', 'CEE', 'HIBRIDA']),
  seId: z.string().uuid().optional(),
  logradouro: z.string().min(3),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(2),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  cep: z.string().length(8),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  faixasCep: z.array(z.object({
    inicio: z.string().length(8),
    fim: z.string().length(8),
    distritoCodigo: z.string().optional(),
  })).optional(),
});

export const updateUnidadeSchema = createUnidadeSchema.partial();

// ── Usuario ───────────────────────────────────────────────────────────────────

export const createUsuarioSchema = z.object({
  cpf: z.string().length(11).optional(),
  email: z.string().email().optional(),
  matricula: z.string().length(8).optional(),
  senha: z.string().min(6),
  nome: z.string().min(3),
  role: z.enum(['GESTAO', 'UNIDADE', 'CARTEIRO', 'DESTINATARIO']),
  unidadeId: z.string().uuid().optional(),
  telefoneCelular: z.string().optional(),
  telefoneComercial: z.string().optional(),
  endResidencialCidade: z.string().optional(),
  endResidencialUf: z.string().length(2).optional(),
  endResidencialCep: z.string().length(8).optional(),
  endResidencialLogradouro: z.string().optional(),
  endResidencialNumero: z.string().optional(),
  endResidencialComplemento: z.string().optional(),
}).refine(data => {
  if (data.role !== 'DESTINATARIO' && !data.matricula) {
    return false;
  }
  return true;
}, { message: 'Matrícula é obrigatória para empregados dos Correios' });

export const updateUsuarioSchema = z.object({
  cpf: z.string().length(11).optional(),
  email: z.string().email().optional(),
  matricula: z.string().length(8).optional(),
  senha: z.string().min(6).optional(),
  nome: z.string().min(3).optional(),
  role: z.enum(['GESTAO', 'UNIDADE', 'CARTEIRO', 'DESTINATARIO']).optional(),
  unidadeId: z.string().uuid().nullable().optional(),
  ativo: z.boolean().optional(),
  telefoneCelular: z.string().optional(),
  telefoneComercial: z.string().optional(),
  endResidencialCidade: z.string().optional(),
  endResidencialUf: z.string().length(2).optional(),
  endResidencialCep: z.string().length(8).optional(),
  endResidencialLogradouro: z.string().optional(),
  endResidencialNumero: z.string().optional(),
  endResidencialComplemento: z.string().optional(),
});

// ── Config ────────────────────────────────────────────────────────────────────

export const upsertConfigSchema = z.object({
  valor: z.any(),
  descricao: z.string().optional(),
});
