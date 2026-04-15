/**
 * comunicacao.schemas.ts
 * Schemas Zod para validação de entrada dos endpoints do módulo WPP-PILOT.
 */
import { z } from 'zod';

// ── Insucesso ────────────────────────────────────────────────────
export const insucessoNotificarSchema = z.object({
  pacoteInsucessoId: z.string().min(1, 'pacoteInsucessoId é obrigatório'),
  motoristaPhone: z.string().min(1, 'motoristaPhone é obrigatório'),
  motoristaId: z.string().optional(),
  rotaId: z.string().optional(),
});

// ── Proxy ────────────────────────────────────────────────────────
export const proxyStartSchema = z.object({
  motoristaPhone: z.string().min(1, 'motoristaPhone é obrigatório'),
  destinatarioPhone: z.string().min(1, 'destinatarioPhone é obrigatório'),
  motoristaId: z.string().optional(),
  rotaId: z.string().optional(),
  pacoteId: z.string().optional(),
});

// ── Dispatcher ───────────────────────────────────────────────────
export const dispatcherEntrarSchema = z.object({
  wppSessionId: z.string().min(1, 'wppSessionId é obrigatório'),
  dispatcherNome: z.string().min(1, 'dispatcherNome é obrigatório'),
  dispatcherId: z.string().optional(),
});

export const dispatcherMensagemSchema = z.object({
  content: z.string().min(1, 'content é obrigatório'),
});

// ── Notify ───────────────────────────────────────────────────────
export const notifySchema = z.object({
  phone: z.string().min(1, 'phone é obrigatório'),
  text: z.string().min(1, 'text é obrigatório'),
});

// ── Admin Config ─────────────────────────────────────────────────
export const adminConfigSchema = z.object({
  instanceName: z.string().min(1, 'instanceName é obrigatório'),
  phoneNumber: z.string().optional(),
  dspNome: z.string().optional(),
  locale: z.string().default('pt_BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  botEnabled: z.boolean().default(true),
  proxyEnabled: z.boolean().default(true),
  llmEnabled: z.boolean().default(false),
});

// ── Admin Stats Query ────────────────────────────────────────────
export const adminStatsQuerySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Admin Check Instance ─────────────────────────────────────────
export const checkInstanceQuerySchema = z.object({
  instanceName: z.string().min(1, 'instanceName é obrigatório'),
});

// ── LLM Config ───────────────────────────────────────────────────
export const llmConfigSchema = z.object({
  llmEnabled: z.boolean().optional(),
  llmConfig: z.record(z.string(), z.unknown()).optional(),
});
