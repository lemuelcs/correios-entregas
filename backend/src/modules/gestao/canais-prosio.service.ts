/**
 * Canais Prosio (ADR-012, ADR-014): uma conta (tenant) do Prosio por canal.
 *
 * - `apiKey` e `callbackSecret` são guardados cifrados (AES-256-GCM) e nunca
 *   voltam em resposta.
 * - O token de entrada (bearer das ações de botão do Prosio) é gerado aqui,
 *   devolvido UMA vez (na criação ou quando regenerado) e guardado só como sha256.
 */
import { createHash, randomBytes } from 'crypto';
import type { CanalProsio, TipoCanal } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { cifrar } from '../../shared/utils/cripto';
import logger from '../../shared/utils/logger';

export interface NovoCanal {
  nome: string;
  baseUrl: string;
  apiKey: string;
  callbackSecret: string;
  tipo?: TipoCanal;
  compartilhado?: boolean;
  ativo?: boolean;
}

export interface EdicaoCanal extends Partial<NovoCanal> {
  regenerarTokenEntrada?: boolean;
  atualizadoEm?: string;
}

export function hashTokenEntrada(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function gerarTokenEntrada(): string {
  return `cet_${randomBytes(32).toString('base64url')}`;
}

/** Só a origem (`https://host[:porta]`): o cliente monta os caminhos. */
function origem(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    throw new AppError(400, 'base_url_invalida', { campo: 'baseUrl' });
  }
}

type CanalComContagem = CanalProsio & { _count?: { unidades: number } };

/** Representação pública: sem nenhum segredo. */
function canalDto(c: CanalComContagem) {
  return {
    id: c.id,
    nome: c.nome,
    baseUrl: c.baseUrl,
    tipo: c.tipo,
    compartilhado: c.compartilhado,
    ativo: c.ativo,
    unidades: c._count?.unidades,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

const comContagem = { _count: { select: { unidades: true } } } as const;

export const canaisProsioService = {
  async listar() {
    const canais = await prisma.canalProsio.findMany({ orderBy: { nome: 'asc' }, include: comContagem });
    return canais.map(canalDto);
  },

  async obter(id: string) {
    const c = await prisma.canalProsio.findUnique({ where: { id }, include: comContagem });
    if (!c) throw new AppError(404, 'Canal não encontrado');
    return canalDto(c);
  },

  async criar(dados: NovoCanal) {
    const tokenEntrada = gerarTokenEntrada();
    const c = await prisma.canalProsio.create({
      data: {
        nome: dados.nome,
        baseUrl: origem(dados.baseUrl),
        apiKeyCifrada: cifrar(dados.apiKey),
        callbackSecretCifrado: cifrar(dados.callbackSecret),
        tokenEntradaHash: hashTokenEntrada(tokenEntrada),
        tipo: dados.tipo ?? 'WAHA',
        compartilhado: dados.compartilhado ?? false,
        ativo: dados.ativo ?? true,
      },
      include: comContagem,
    });
    logger.info({ canalId: c.id, tipo: c.tipo, compartilhado: c.compartilhado }, 'entregas.canal criado');
    return { ...canalDto(c), tokenEntrada };
  },

  async editar(id: string, dados: EdicaoCanal) {
    const atual = await prisma.canalProsio.findUnique({ where: { id }, include: comContagem });
    if (!atual) throw new AppError(404, 'Canal não encontrado');
    if (dados.atualizadoEm !== undefined && new Date(dados.atualizadoEm).getTime() !== atual.atualizadoEm.getTime()) {
      throw new AppError(409, 'alterado_por_outro', { atual: canalDto(atual) });
    }
    if (dados.compartilhado === false && atual.compartilhado && (atual._count?.unidades ?? 0) > 1) {
      throw new AppError(409, 'canal_em_uso_compartilhado', { mensagem: 'Mais de uma unidade usa este canal' });
    }

    const tokenEntrada = dados.regenerarTokenEntrada ? gerarTokenEntrada() : undefined;
    const r = await prisma.canalProsio.updateMany({
      where: { id, atualizadoEm: atual.atualizadoEm },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
        ...(dados.baseUrl !== undefined ? { baseUrl: origem(dados.baseUrl) } : {}),
        ...(dados.apiKey !== undefined ? { apiKeyCifrada: cifrar(dados.apiKey) } : {}),
        ...(dados.callbackSecret !== undefined ? { callbackSecretCifrado: cifrar(dados.callbackSecret) } : {}),
        ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
        ...(dados.compartilhado !== undefined ? { compartilhado: dados.compartilhado } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
        ...(tokenEntrada ? { tokenEntradaHash: hashTokenEntrada(tokenEntrada) } : {}),
      },
    });
    if (r.count === 0) throw new AppError(409, 'alterado_por_outro', { atual: await this.obter(id) });
    const canal = await this.obter(id);
    return tokenEntrada ? { ...canal, tokenEntrada } : canal;
  },
};
