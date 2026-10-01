/**
 * Tipos da captura do rótulo (TechSpec › Core Interfaces).
 */
import type { Role } from '@prisma/client';

export type Fonte = 'DATAMATRIX' | 'BARRAS' | 'CEP' | 'LLM' | 'DIGITADO' | 'CARTEIRO';

export interface Campo {
  valor: string | null;
  duvida: boolean;
  motivo?: string;
  fonte: Fonte;
}

export interface CamposLidos {
  codigo: Campo;
  nome: Campo;
  whatsapp: Campo;
  cep: Campo;
  logradouro: Campo;
  numero: Campo;
  complemento: Campo;
  bairro: Campo;
  cidade: Campo;
  uf: Campo;
}

export type NomeCampo = keyof CamposLidos;

/** Ordem canônica dos campos (motivos, schema do LLM, telas). */
export const NOMES_CAMPOS: readonly NomeCampo[] = [
  'codigo',
  'nome',
  'whatsapp',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
];

export type RecusaCaptura =
  | 'DV_INVALIDO'
  | 'MULTIPLOS_ROTULOS'
  | 'OUTRA_UNIDADE'
  | 'JA_ENTREGUE'
  | 'SEM_DISTRITO'
  | 'FOTO_INVALIDA';

export type ResultadoCaptura =
  | { tipo: 'SALVO'; pacoteId: string; atualizado: boolean }
  | { tipo: 'PARA_CONFERIR'; campos: CamposLidos; motivos: string[] }
  | { tipo: 'TRANSFERENCIA_PENDENTE'; campos: CamposLidos; distritoOrigem: string }
  | { tipo: 'RECUSADO'; codigo: RecusaCaptura };

export interface CepInfo {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
}

export type ResultadoCep = CepInfo | 'NAO_ENCONTRADO' | 'INDISPONIVEL';

export interface CepService {
  lookup(cep: string): Promise<ResultadoCep>;
}

export interface UsoLlm {
  inputTokens: number;
  outputTokens: number;
}

export interface LabelExtractor {
  extract(
    jpeg: Buffer,
    pedir: Array<keyof CamposLidos>,
    signal: AbortSignal,
  ): Promise<{ campos: Partial<CamposLidos>; uso: UsoLlm }>;
}

export interface PhotoStore {
  put(key: string, jpeg: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Códigos lidos no aparelho (zxing-wasm). */
export interface BarcodesLidos {
  objeto: string | null;
  cepLinear: string | null;
  dataMatrixRaw: string | null;
  multiplos: boolean;
}

export interface Ator {
  usuarioId: string;
  role: Role;
}

/** Tags de motivo que não vêm de `avaliarMinimo` (gravadas no `motivo` do campo). */
export const MOTIVOS_GLOBAIS = [
  'extracao_indisponivel',
  'cep_nao_encontrado',
  'cep_indisponivel',
  'cep_sem_logradouro',
  'codigos_divergentes',
  'ceps_divergentes',
  'telefone_invalido',
] as const;
