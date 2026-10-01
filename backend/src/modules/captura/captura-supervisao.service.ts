/**
 * Supervisão da captura dentro do módulo `entregas` (ADR-014, TechSpec › API
 * Endpoints › Supervisor): histórico e foto do pacote, remoção, senha do carteiro
 * e os campos que a captura acrescenta ao quadro e à lista de pacotes.
 *
 * O escopo por unidade (`escopo.ts`) é conferido pelo controller antes daqui.
 */
import bcrypt from 'bcryptjs';
import { Prisma, type Carteiro, type Role } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { invalidarCacheUsuario } from '../../shared/middleware/auth.middleware';
import { validarPoliticaSenha } from '../auth/auth.service';
import { dependenciasCaptura } from './captura.contexto';
import { conciliacaoService } from './conciliacao.service';

/** Capturas que esperam o carteiro (conferência ou transferência). */
const PENDENTES = ['PARA_CONFERIR', 'TRANSFERENCIA_PENDENTE'] as const;

const BCRYPT_ROUNDS = 10;

// ——— Extensões da lista e do quadro (aditivas) ————————————————————————

/** `pacoteId` → a foto da última captura salva ainda existe. */
export async function fotosDosPacotes(pacoteIds: string[]): Promise<Map<string, boolean>> {
  const temFoto = new Map<string, boolean>();
  if (pacoteIds.length === 0) return temFoto;
  const capturas = await prisma.captura.findMany({
    where: { pacoteId: { in: pacoteIds }, resultado: 'SALVO', fotoKey: { not: null } },
    orderBy: [{ processadoEm: 'desc' }, { recebidoEm: 'desc' }],
    select: { pacoteId: true, fotoExcluidaEm: true },
  });
  for (const c of capturas) {
    const id = c.pacoteId as string;
    if (!temFoto.has(id)) temFoto.set(id, c.fotoExcluidaEm === null);
  }
  return temFoto;
}

/** `distritoId` → capturas pendentes (PARA_CONFERIR e TRANSFERENCIA_PENDENTE) do dia no distrito. */
export async function pendenciasPorDistrito(distritoIds: string[], data: Date): Promise<Map<string, number>> {
  if (distritoIds.length === 0) return new Map();
  const grupos = await prisma.captura.groupBy({
    by: ['distritoId'],
    where: { distritoId: { in: distritoIds }, data, resultado: { in: [...PENDENTES] } },
    _count: { _all: true },
  });
  return new Map(grupos.map((g) => [g.distritoId, g._count._all]));
}

export interface CarteiroResumo {
  id: string;
  nome: string | null;
}

export interface TransferenciaQuadro {
  pacoteId: string | null;
  codigo: string | null;
  /** Na saída, o distrito de destino; na entrada, o de origem (código, ex.: `D-03`). */
  distrito: string;
  distritoId: string;
  /** Quem transferiu (o carteiro que capturou no destino). */
  carteiro: CarteiroResumo | null;
  /** O carteiro do distrito de origem no momento da transferência. */
  carteiroAnterior: CarteiroResumo | null;
  /** Instante da transferência (ISO). */
  hora: string;
  origemLiberada: boolean;
}

interface LinhaTransferencia {
  pacoteId: string | null;
  criadoEm: Date;
  dados: Prisma.JsonValue;
  codigo: string | null;
}

/**
 * Transferências confirmadas (`EventoPacote` TRANSFERIDO) que saíram ou entraram
 * nas cargas dadas, em ordem cronológica. Ignora as de capturas desfeitas
 * (o pacote voltou à origem ou foi removido).
 */
export async function transferenciasPorDistrito(
  cargas: Array<{ id: string; distritoId: string }>,
): Promise<Map<string, { entrada: TransferenciaQuadro[]; saida: TransferenciaQuadro[] }>> {
  const porDistrito = new Map<string, { entrada: TransferenciaQuadro[]; saida: TransferenciaQuadro[] }>();
  for (const c of cargas) porDistrito.set(c.distritoId, { entrada: [], saida: [] });
  if (cargas.length === 0) return porDistrito;

  const ids = cargas.map((c) => c.id);
  const linhas = await prisma.$queryRaw<LinhaTransferencia[]>`
    SELECT e."pacoteId", e."criadoEm", e.dados, COALESCE(p.codigo, c.codigo) AS codigo
    FROM eventos_pacote e
    LEFT JOIN pacotes_dia p ON p.id = e."pacoteId"
    LEFT JOIN capturas c ON c.id = e.dados->>'capturaId'
    WHERE e.tipo = 'TRANSFERIDO'
      AND (e.dados->>'deCargaId' = ANY(${ids}::text[]) OR e.dados->>'paraCargaId' = ANY(${ids}::text[]))
      AND (c.id IS NULL OR c.resultado <> 'DESFEITO')
    ORDER BY e."criadoEm" ASC, e.id ASC`;
  if (linhas.length === 0) return porDistrito;

  const dadosDe = (l: LinhaTransferencia) => (l.dados ?? {}) as Record<string, unknown>;
  const carteiroIds = new Set<string>();
  for (const l of linhas) {
    const d = dadosDe(l);
    if (typeof d.carteiroId === 'string') carteiroIds.add(d.carteiroId);
    if (typeof d.carteiroAnterior === 'string') carteiroIds.add(d.carteiroAnterior);
  }
  const carteiros = await prisma.carteiro.findMany({ where: { id: { in: [...carteiroIds] } }, select: { id: true, nome: true } });
  const nomeDe = new Map(carteiros.map((c) => [c.id, c.nome]));
  const resumo = (id: unknown): CarteiroResumo | null => (typeof id === 'string' ? { id, nome: nomeDe.get(id) ?? null } : null);

  for (const l of linhas) {
    const d = dadosDe(l);
    const base = {
      pacoteId: l.pacoteId,
      codigo: l.codigo ? l.codigo.trim() : null,
      carteiro: resumo(d.carteiroId),
      carteiroAnterior: resumo(d.carteiroAnterior),
      hora: l.criadoEm.toISOString(),
      origemLiberada: d.origemLiberada === true,
    };
    const de = porDistrito.get(String(d.deDistritoId));
    if (de && ids.includes(String(d.deCargaId))) {
      de.saida.push({ ...base, distrito: String(d.para), distritoId: String(d.paraDistritoId) });
    }
    const para = porDistrito.get(String(d.paraDistritoId));
    if (para && ids.includes(String(d.paraCargaId))) {
      para.entrada.push({ ...base, distrito: String(d.de), distritoId: String(d.deDistritoId) });
    }
  }
  return porDistrito;
}

// ——— Histórico ———————————————————————————————————————————————————————

/** Desempate de eventos gravados na mesma transação (mesmo `criadoEm`), na ordem em que são escritos. */
const ORDEM_NA_TRANSACAO: Record<string, number> = {
  CAPTURA_CRIADO: 0,
  TRANSFERIDO: 1,
  DESFEITO: 1,
  CAPTURA_ATUALIZADO: 2,
  WHATSAPP_ALTERADO: 3,
  REMOVIDO: 4,
};

export interface MudancaCampo {
  campo: string;
  antes: unknown;
  depois: unknown;
}

function mudancasDe(tipo: string, dados: Record<string, unknown>): MudancaCampo[] {
  if (tipo === 'WHATSAPP_ALTERADO') return [{ campo: 'whatsapp', antes: dados.antes ?? null, depois: dados.depois ?? null }];
  const campos = dados.campos;
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) return [];
  const lista = Object.entries(campos as Record<string, { antes?: unknown; depois?: unknown }>).map(([campo, v]) => ({
    campo,
    antes: v?.antes ?? null,
    depois: v?.depois ?? null,
  }));
  const origem = dados.origem as { antes?: unknown; depois?: unknown } | undefined;
  if (tipo === 'CAPTURA_ATUALIZADO' && origem && typeof origem === 'object') {
    lista.push({ campo: 'origem', antes: origem.antes ?? null, depois: origem.depois ?? null });
  }
  return lista;
}

export async function historicoDoPacote(pacote: { id: string; codigo: string }) {
  const eventos = await prisma.eventoPacote.findMany({ where: { pacoteId: pacote.id }, orderBy: [{ criadoEm: 'asc' }] });
  const ordenados = eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      a.e.criadoEm.getTime() - b.e.criadoEm.getTime()
      || (ORDEM_NA_TRANSACAO[a.e.tipo] ?? 9) - (ORDEM_NA_TRANSACAO[b.e.tipo] ?? 9)
      || a.i - b.i)
    .map(({ e }) => e);

  const carteiroIds = new Set<string>();
  for (const e of ordenados) {
    const d = (e.dados ?? {}) as Record<string, unknown>;
    if (typeof d.carteiroId === 'string') carteiroIds.add(d.carteiroId);
  }
  const carteiros = carteiroIds.size
    ? await prisma.carteiro.findMany({ where: { id: { in: [...carteiroIds] } }, select: { id: true, nome: true } })
    : [];
  const nomeDe = new Map(carteiros.map((c) => [c.id, c.nome]));

  return {
    pacoteId: pacote.id,
    codigo: pacote.codigo.trim(),
    eventos: ordenados.map((e) => {
      const dados = (e.dados ?? {}) as Record<string, unknown>;
      const carteiroId = typeof dados.carteiroId === 'string' ? dados.carteiroId : null;
      return {
        id: e.id,
        tipo: e.tipo,
        em: e.criadoEm.toISOString(),
        carteiro: carteiroId ? { id: carteiroId, nome: nomeDe.get(carteiroId) ?? null } : null,
        mudancas: mudancasDe(e.tipo, dados),
        dados,
      };
    }),
  };
}

// ——— Foto ————————————————————————————————————————————————————————————

/** JPEG da última captura salva do pacote. Sem captura com foto → 404; excluída → 410 com `fotoExcluidaEm`. */
export async function fotoDoPacote(pacoteId: string): Promise<Buffer> {
  const { photoStore } = dependenciasCaptura();
  const cap = await prisma.captura.findFirst({
    where: { pacoteId, resultado: 'SALVO', fotoKey: { not: null } },
    orderBy: [{ processadoEm: 'desc' }, { recebidoEm: 'desc' }],
  });
  if (!cap) throw new AppError(404, 'O pacote não tem foto', { code: 'sem_foto' });
  const excluida = () =>
    new AppError(410, 'Foto excluída', { code: 'foto_excluida', fotoExcluidaEm: cap.fotoExcluidaEm?.toISOString() ?? null });
  if (cap.fotoExcluidaEm) throw excluida();
  const bytes = await photoStore.get(cap.fotoKey as string);
  if (!bytes) throw excluida();
  return bytes;
}

// ——— Remoção —————————————————————————————————————————————————————————

/** Remoção pelo supervisor (qualquer status, exceto ENTREGUE → 409 `pacote_entregue`). */
export async function removerPacote(pacoteId: string, ator: { usuarioId: string; role: Role }): Promise<void> {
  await conciliacaoService.remover(pacoteId, ator);
}

// ——— Senha do carteiro ———————————————————————————————————————————————

/**
 * Define (ou redefine) a senha temporária do carteiro. Sem login, cria o `Usuario`
 * (CARTEIRO, matrícula e unidade do carteiro) e o vincula. Revoga os refresh tokens.
 * A linha do carteiro fica travada na transação: redefinições concorrentes se
 * serializam e a última gravação vence (é a de maior `updatedAt`).
 */
export async function definirSenhaCarteiro(carteiro: Carteiro, senha: string): Promise<void> {
  validarPoliticaSenha(senha);
  if (!carteiro.matricula?.trim()) {
    throw new AppError(409, 'O carteiro não tem matrícula cadastrada', { code: 'matricula_ausente' });
  }
  const hash = await bcrypt.hash(senha, BCRYPT_ROUNDS);

  const usuarioId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM carteiros WHERE id = ${carteiro.id} FOR UPDATE`;
    const atual = await tx.carteiro.findUniqueOrThrow({ where: { id: carteiro.id } });
    const matricula = atual.matricula.trim();
    if (!matricula) throw new AppError(409, 'O carteiro não tem matrícula cadastrada', { code: 'matricula_ausente' });
    // O login exige exatamente 8 caracteres: um login com outra matrícula nunca entraria.
    if (matricula.length !== 8) {
      throw new AppError(409, 'A matrícula do carteiro deve ter 8 caracteres; corrija no cadastro', { code: 'matricula_invalida' });
    }

    if (atual.usuarioId) {
      await tx.usuario.update({
        where: { id: atual.usuarioId },
        data: { senha: hash, senhaTemporaria: true, tentativasFalhas: 0, bloqueadoAte: null, updatedAt: new Date() },
      });
      await tx.refreshToken.updateMany({ where: { usuarioId: atual.usuarioId, revogado: false }, data: { revogado: true } });
      return atual.usuarioId;
    }

    const ocupada = await tx.usuario.findUnique({ where: { matricula }, select: { id: true } });
    if (ocupada) {
      throw new AppError(409, 'A matrícula já pertence a outro usuário', { code: 'matricula_em_uso', campo: 'matricula' });
    }
    const usuario = await tx.usuario.create({
      data: {
        nome: atual.nome?.trim() || `Carteiro ${matricula}`,
        matricula,
        role: 'CARTEIRO',
        unidadeId: atual.unidadeId,
        senha: hash,
        senhaTemporaria: true,
        ativo: atual.ativo,
      },
    });
    await tx.carteiro.update({ where: { id: atual.id }, data: { usuarioId: usuario.id } });
    return usuario.id;
  });

  invalidarCacheUsuario(usuarioId);
}
