/**
 * Atendimento (US-027..US-029, ADR-006/010): abre a sessão de login único do
 * Chatwoot pelo Prosio e devolve a URL que o frontend põe no `src` do iframe.
 *
 * - GESTAO → `papel: 'administrador'`, sem `unidadeRef` (vê todas as caixas).
 * - UNIDADE → `papel: 'agente'`; em canal compartilhado, com a
 *   `prosioUnidadeRef` da unidade (P3: o Prosio põe o agente só nessa caixa).
 * - Outros papéis → 403.
 */
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import {
  prosioClient,
  ProsioError,
  resolverCanal,
  type PapelAtendimento,
  type ProsioClient,
  type SessaoAtendimento,
} from '../../integrations/prosio/prosio.client';
import { naoEncontrado } from './escopo';

export interface PerfilAtendimento {
  papel: PapelAtendimento;
  unidadeRef?: string;
}

export interface UnidadeAtendimento {
  prosioUnidadeRef: string | null;
  canal: { compartilhado: boolean } | null;
}

/** Papel e `unidadeRef` da sessão (UT-089). */
export function perfilAtendimento(role: Role, unidade: UnidadeAtendimento | null): PerfilAtendimento {
  if (role === 'GESTAO') return { papel: 'administrador' };
  if (role === 'UNIDADE') {
    const ref = unidade?.prosioUnidadeRef?.trim();
    return unidade?.canal?.compartilhado && ref ? { papel: 'agente', unidadeRef: ref } : { papel: 'agente' };
  }
  throw new AppError(403, 'Acesso negado');
}

export interface UsuarioSessao {
  sub: string;
  role: Role;
  unidadeId?: string;
}

const selecionarCanal = {
  id: true, nome: true, baseUrl: true, tipo: true, compartilhado: true, ativo: true,
  apiKeyCifrada: true, callbackSecretCifrado: true,
} as const;

type CanalAtendimento = Prisma.CanalProsioGetPayload<{ select: typeof selecionarCanal }>;

async function canalDaUnidade(unidadeId: string) {
  const unidade = await prisma.unidade.findUnique({
    where: { id: unidadeId },
    select: { id: true, prosioUnidadeRef: true, canalProsio: { select: selecionarCanal } },
  });
  if (!unidade) throw naoEncontrado();
  return { unidade, canal: unidade.canalProsio };
}

/** GESTAO sem unidade escolhida: o único canal ativo; com vários, pede a unidade. */
async function canalUnicoAtivo(): Promise<CanalAtendimento | null> {
  const canais = await prisma.canalProsio.findMany({ where: { ativo: true }, select: selecionarCanal, take: 2 });
  if (canais.length > 1) throw new AppError(400, 'unidade_obrigatoria', { mensagem: 'Escolha a unidade para abrir o atendimento' });
  return canais[0] ?? null;
}

export async function abrirSessaoAtendimento(
  usuario: UsuarioSessao,
  pedido: { unidadeId?: string },
  cliente: ProsioClient = prosioClient,
): Promise<SessaoAtendimento> {
  if (usuario.role !== 'GESTAO' && usuario.role !== 'UNIDADE') throw new AppError(403, 'Acesso negado');

  let unidade: UnidadeAtendimento & { id: string } | null = null;
  let canal: CanalAtendimento | null;
  if (usuario.role === 'UNIDADE') {
    if (!usuario.unidadeId) throw new AppError(403, 'sem_unidade');
    if (pedido.unidadeId && pedido.unidadeId !== usuario.unidadeId) throw naoEncontrado();
    const r = await canalDaUnidade(usuario.unidadeId);
    unidade = { id: r.unidade.id, prosioUnidadeRef: r.unidade.prosioUnidadeRef, canal: r.canal };
    canal = r.canal;
  } else if (pedido.unidadeId) {
    canal = (await canalDaUnidade(pedido.unidadeId)).canal;
  } else {
    canal = await canalUnicoAtivo();
  }
  if (!canal || !canal.ativo) {
    throw new AppError(409, 'sem_canal', { mensagem: 'A unidade não tem canal de atendimento configurado' });
  }

  const perfil = perfilAtendimento(usuario.role, unidade);
  const u = await prisma.usuario.findUnique({ where: { id: usuario.sub }, select: { id: true, nome: true, email: true } });
  if (!u) throw new AppError(401, 'Não autenticado');

  const log = { usuarioId: u.id, unidadeId: unidade?.id ?? pedido.unidadeId ?? null, canalId: canal.id, papel: perfil.papel };
  try {
    const sessao = await cliente.criarSessaoAtendimento(resolverCanal(canal), {
      idExterno: u.id,
      nome: u.nome,
      // O Chatwoot exige e-mail; supervisor que entra por matrícula ganha um sintético estável.
      email: u.email ?? `usuario-${u.id}@usuarios.correios-entregas.local`,
      papel: perfil.papel,
      ...(perfil.unidadeRef ? { unidadeRef: perfil.unidadeRef } : {}),
    });
    logger.info({ ...log, unidadeRef: perfil.unidadeRef ?? null }, 'entregas.atendimento.sessao');
    return sessao;
  } catch (err) {
    if (err instanceof ProsioError) {
      logger.warn({ ...log, status: err.status, code: err.code }, 'entregas.atendimento.sessao falhou');
      throw new AppError(503, 'atendimento_indisponivel', {
        mensagem: 'Atendimento indisponível no momento',
        motivo: err.code,
      });
    }
    throw err;
  }
}
