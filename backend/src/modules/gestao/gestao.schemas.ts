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

// Entregas mediadas (ADR-012): canal Prosio, referência no canal compartilhado,
// mediação e a versão lida (`atualizadoEm`) para a concorrência otimista.
const camposCanalUnidade = {
  canalProsioId: z.string().uuid().nullable().optional(),
  /** Tipo escolhido na tela (número atual = WAHA, oficial = WABA); só validado. */
  canal: z.enum(['WAHA', 'WABA']).nullable().optional(),
  prosioUnidadeRef: z.string().trim().min(1).max(64).nullable().optional(),
  mediacaoAtiva: z.boolean().optional(),
};

export const createUnidadeEntregasSchema = createUnidadeSchema.extend(camposCanalUnidade);

export const updateUnidadeEntregasSchema = updateUnidadeSchema.extend({
  ...camposCanalUnidade,
  ativa: z.boolean().optional(),
  atualizadoEm: z.string().datetime({ offset: true }).optional(),
});

// ── Canal Prosio ──────────────────────────────────────────────────────────────

export const createCanalProsioSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  baseUrl: z.string().url().max(200),
  apiKey: z.string().min(8).max(500),
  callbackSecret: z.string().min(16).max(500),
  tipo: z.enum(['WAHA', 'WABA']).optional(),
  compartilhado: z.boolean().optional(),
  ativo: z.boolean().optional(),
}).strict();

export const updateCanalProsioSchema = createCanalProsioSchema.partial().extend({
  regenerarTokenEntrada: z.boolean().optional(),
  atualizadoEm: z.string().datetime({ offset: true }).optional(),
}).strict();

// ── Usuario ───────────────────────────────────────────────────────────────────

/** Matrícula com ou sem máscara (`8.301.552-0` → `83015520`). */
const matriculaSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/[\s.\-/]/g, '').toUpperCase() : v),
  z.string().length(8),
);

export const createUsuarioSchema = z.object({
  cpf: z.string().length(11).optional(),
  email: z.string().email().optional(),
  matricula: matriculaSchema.optional(),
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
  matricula: matriculaSchema.optional(),
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
