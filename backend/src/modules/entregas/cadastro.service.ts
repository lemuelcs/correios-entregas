/**
 * Cadastro da unidade (US-003..US-006): distritos, carteiros, carteiro do dia
 * (`EscalaDistrito`) e pontos de retirada. O escopo por unidade é resolvido no
 * controller (`escopo.ts`); aqui chegam a unidade e os recursos já checados.
 */
import { Prisma, type Carteiro, type Distrito, type PontoRetirada, type TipoPonto } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { formatarData, hojeBrasilia } from './datas';
import { notificarTrocaCarteiro } from './ganchos';
import { naoEncontrado } from './escopo';
import type { Listagem } from './cadastro.schemas';
import { garantirLimitePontos, lerWhatsapp, lerMatricula, normalizarMatricula, validarNomePonto } from './cadastro.validacao';

/** Carga liberada e ainda não encerrada: o distrito está "em operação". */
const STATUS_EM_OPERACAO = ['LIBERADO', 'EM_ENTREGA'] as const;

// ——— Comum ——————————————————————————————————————————————————————————————

/** Unidade desativada não opera (US-001.EC-5): 409 `unidade_inativa`. Usado pela liberação (task_06). */
export async function garantirUnidadeAtiva(unidadeId: string): Promise<void> {
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId }, select: { ativa: true } });
  if (!unidade) throw naoEncontrado();
  if (!unidade.ativa) throw new AppError(409, 'unidade_inativa', { mensagem: 'Unidade desativada' });
}

/** `atualizadoEm` enviado diferente do atual → 409 `alterado_por_outro` com os dados atuais (US-001.EC-4). */
export function conferirVersao(atual: Date, esperado: string | undefined, dadosAtuais: unknown): void {
  if (esperado === undefined) return;
  if (new Date(esperado).getTime() !== atual.getTime()) {
    throw new AppError(409, 'alterado_por_outro', { atual: dadosAtuais });
  }
}

function ehUnicoViolado(err: unknown, campo: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const alvo = (err.meta as { target?: unknown } | undefined)?.target;
  const lista = Array.isArray(alvo) ? alvo.map(String) : [String(alvo ?? '')];
  return lista.some((t) => t.includes(campo));
}

function pagina<T>(itens: T[], total: number, l: Listagem) {
  return { itens, total, pagina: l.pagina, tamanho: l.tamanho, totalPaginas: Math.max(1, Math.ceil(total / l.tamanho)) };
}

/**
 * Matrícula única entre `Usuario` e `Carteiro` (US-002.EC-1, US-004.EC-2/EC-3).
 * `unidadeId` informa de qual unidade é o cadastro: carteiro já em outra
 * unidade → 409 com `detalhe: 'unidade'`.
 */
export async function garantirMatriculaLivre(
  matricula: string,
  opcoes: { unidadeId?: string; ignorarCarteiroId?: string; ignorarUsuarioId?: string | null } = {},
): Promise<void> {
  const normalizada = normalizarMatricula(matricula);
  const variantes = [...new Set([matricula.trim(), normalizada].filter(Boolean))];

  const carteiro = await prisma.carteiro.findFirst({
    where: {
      matricula: { in: variantes },
      ...(opcoes.ignorarCarteiroId ? { id: { not: opcoes.ignorarCarteiroId } } : {}),
    },
    select: { id: true, unidadeId: true, usuarioId: true, unidade: { select: { nome: true } } },
  });
  if (carteiro && !(opcoes.ignorarUsuarioId && carteiro.usuarioId === opcoes.ignorarUsuarioId)) {
    if (opcoes.unidadeId && carteiro.unidadeId !== opcoes.unidadeId) {
      throw new AppError(409, 'matricula_em_uso', {
        campo: 'matricula',
        detalhe: 'unidade',
        unidade: carteiro.unidade.nome,
        mensagem: `Carteiro vinculado à unidade ${carteiro.unidade.nome}; peça transferência à Gestão`,
      });
    }
    throw new AppError(409, 'matricula_em_uso', { campo: 'matricula', detalhe: 'carteiro', mensagem: 'Matrícula já cadastrada' });
  }

  const usuario = await prisma.usuario.findFirst({
    where: {
      matricula: { in: variantes },
      ...(opcoes.ignorarUsuarioId ? { id: { not: opcoes.ignorarUsuarioId } } : {}),
    },
    select: { id: true },
  });
  if (usuario) {
    throw new AppError(409, 'matricula_em_uso', { campo: 'matricula', detalhe: 'usuario', mensagem: 'Matrícula já cadastrada' });
  }
}

/** WhatsApp (E.164) de carteiro único (US-004.EC-5). */
export async function garantirWhatsappLivre(whatsappE164: string, ignorarCarteiroId?: string): Promise<void> {
  const outro = await prisma.carteiro.findFirst({
    where: { whatsappE164, ...(ignorarCarteiroId ? { id: { not: ignorarCarteiroId } } : {}) },
    select: { id: true },
  });
  if (outro) throw new AppError(409, 'whatsapp_em_uso', { campo: 'whatsapp', mensagem: 'WhatsApp já cadastrado para outro carteiro' });
}

// ——— Carteiro do dia ———————————————————————————————————————————————————————

interface DistritoDoDia {
  id: string;
  carteiroPadraoId: string | null;
  carteiroPadrao: { ativo: boolean } | null;
  escalas: { carteiroId: string }[];
  cargas: { status: string; carteiroId: string | null }[];
}

const incluirDoDia = (data: Date) => ({
  carteiroPadrao: { select: { ativo: true } },
  escalas: { where: { data }, select: { carteiroId: true } },
  cargas: { where: { data }, select: { status: true, carteiroId: true } },
}) satisfies Prisma.DistritoInclude;

/** Mesma regra do quadro: carga liberada (snapshot) → troca do dia → padrão ativo. */
function carteiroEfetivo(d: DistritoDoDia): string | null {
  const carga = d.cargas[0];
  if (carga && carga.status !== 'CARREGADO' && carga.carteiroId) return carga.carteiroId;
  if (d.escalas[0]) return d.escalas[0].carteiroId;
  return d.carteiroPadrao?.ativo ? d.carteiroPadraoId : null;
}

/** Distritos da unidade liberados hoje (em operação) em que o carteiro é o do dia. */
async function distritosEmOperacaoDoCarteiro(carteiro: Pick<Carteiro, 'id' | 'unidadeId'>): Promise<string[]> {
  const hoje = hojeBrasilia();
  const distritos = await prisma.distrito.findMany({
    where: {
      unidadeId: carteiro.unidadeId,
      cargas: { some: { data: hoje, status: { in: [...STATUS_EM_OPERACAO] } } },
    },
    include: incluirDoDia(hoje),
  });
  return distritos.filter((d) => carteiroEfetivo(d) === carteiro.id).map((d) => d.codigo);
}

// ——— Distritos ——————————————————————————————————————————————————————————————

const incluirDistrito = {
  carteiroPadrao: { select: { id: true, nome: true, ativo: true } },
} satisfies Prisma.DistritoInclude;

type DistritoComCarteiro = Prisma.DistritoGetPayload<{ include: typeof incluirDistrito }>;

function distritoDto(d: DistritoComCarteiro) {
  return {
    id: d.id,
    unidadeId: d.unidadeId,
    codigo: d.codigo,
    nome: d.nome,
    ativo: d.ativo,
    carteiroPadrao: d.carteiroPadrao,
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm,
  };
}

async function carteiroDaUnidade(unidadeId: string, carteiroId: string, campo: string) {
  const c = await prisma.carteiro.findUnique({ where: { id: carteiroId } });
  if (!c || c.unidadeId !== unidadeId) throw new AppError(400, 'carteiro_invalido', { campo });
  if (!c.ativo) throw new AppError(400, 'carteiro_inativo', { campo });
  return c;
}

export async function listarDistritos(unidadeId: string, l: Listagem) {
  const where: Prisma.DistritoWhereInput = {
    unidadeId,
    ...(l.ativo !== undefined ? { ativo: l.ativo } : {}),
    ...(l.busca
      ? { OR: [{ codigo: { contains: l.busca, mode: 'insensitive' } }, { nome: { contains: l.busca, mode: 'insensitive' } }] }
      : {}),
  };
  const [total, itens] = await Promise.all([
    prisma.distrito.count({ where }),
    prisma.distrito.findMany({
      where,
      orderBy: { codigo: 'asc' },
      skip: (l.pagina - 1) * l.tamanho,
      take: l.tamanho,
      include: incluirDistrito,
    }),
  ]);
  return pagina(itens.map(distritoDto), total, l);
}

export async function obterDistrito(distritoId: string) {
  return distritoDto(await prisma.distrito.findUniqueOrThrow({ where: { id: distritoId }, include: incluirDistrito }));
}

export interface DadosDistrito {
  codigo?: string;
  nome?: string;
  carteiroPadraoId?: string | null;
  ativo?: boolean;
  atualizadoEm?: string;
}

function codigoEmUso(): AppError {
  return new AppError(409, 'codigo_em_uso', { campo: 'codigo', mensagem: 'Código de distrito já cadastrado nesta unidade' });
}

export async function criarDistrito(unidadeId: string, dados: Required<Pick<DadosDistrito, 'codigo' | 'nome'>> & DadosDistrito) {
  const codigo = dados.codigo.toUpperCase();
  if (await prisma.distrito.findUnique({ where: { unidadeId_codigo: { unidadeId, codigo } } })) throw codigoEmUso();
  if (dados.carteiroPadraoId) await carteiroDaUnidade(unidadeId, dados.carteiroPadraoId, 'carteiroPadraoId');
  try {
    const d = await prisma.distrito.create({
      data: { unidadeId, codigo, nome: dados.nome, carteiroPadraoId: dados.carteiroPadraoId ?? null, ativo: dados.ativo ?? true },
      include: incluirDistrito,
    });
    return distritoDto(d);
  } catch (err) {
    if (ehUnicoViolado(err, 'codigo')) throw codigoEmUso();
    throw err;
  }
}

export async function editarDistrito(distrito: Distrito, dados: DadosDistrito) {
  const atual = await prisma.distrito.findUniqueOrThrow({ where: { id: distrito.id }, include: incluirDistrito });
  conferirVersao(atual.atualizadoEm, dados.atualizadoEm, distritoDto(atual));

  const codigo = dados.codigo?.toUpperCase();
  if (codigo && codigo !== atual.codigo) {
    const outro = await prisma.distrito.findUnique({ where: { unidadeId_codigo: { unidadeId: atual.unidadeId, codigo } } });
    if (outro) throw codigoEmUso();
  }
  if (dados.carteiroPadraoId) await carteiroDaUnidade(atual.unidadeId, dados.carteiroPadraoId, 'carteiroPadraoId');

  if (dados.ativo === false && atual.ativo) {
    const emOperacao = await prisma.cargaDistrito.findFirst({
      where: { distritoId: atual.id, data: hojeBrasilia(), status: { in: [...STATUS_EM_OPERACAO] } },
      select: { id: true },
    });
    if (emOperacao) throw new AppError(409, 'distrito_em_operacao', { mensagem: 'Distrito em operação hoje' });
  }

  try {
    const r = await prisma.distrito.updateMany({
      where: { id: atual.id, atualizadoEm: atual.atualizadoEm },
      data: {
        ...(codigo !== undefined ? { codigo } : {}),
        ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
        ...(dados.carteiroPadraoId !== undefined ? { carteiroPadraoId: dados.carteiroPadraoId } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      },
    });
    if (r.count === 0) throw new AppError(409, 'alterado_por_outro', { atual: await obterDistrito(atual.id) });
  } catch (err) {
    if (ehUnicoViolado(err, 'codigo')) throw codigoEmUso();
    throw err;
  }
  return obterDistrito(atual.id);
}

/**
 * Carteiro do distrito só na `data` (US-005). `carteiroId: null` desfaz a troca.
 * Se a carga da data já foi liberada, o snapshot da carga passa ao novo
 * carteiro e o gancho `notificarTrocaCarteiro` reenvia o resumo (task_06).
 */
export async function definirEscala(distrito: Distrito, data: Date, carteiroId: string | null) {
  if (data.getTime() < hojeBrasilia().getTime()) throw new AppError(400, 'data_passada');
  if (!distrito.ativo) throw new AppError(409, 'distrito_inativo');
  if (carteiroId) await carteiroDaUnidade(distrito.unidadeId, carteiroId, 'carteiroId');

  const { novoEfetivo, notificar } = await prisma.$transaction(async (tx) => {
    if (carteiroId) {
      await tx.escalaDistrito.upsert({
        where: { distritoId_data: { distritoId: distrito.id, data } },
        create: { distritoId: distrito.id, data, carteiroId },
        update: { carteiroId },
      });
    } else {
      await tx.escalaDistrito.deleteMany({ where: { distritoId: distrito.id, data } });
    }

    const d = await tx.distrito.findUniqueOrThrow({ where: { id: distrito.id }, include: incluirDoDia(data) });
    const semSnapshot = { ...d, cargas: [] };
    const efetivo = carteiroEfetivo(semSnapshot);
    const carga = await tx.cargaDistrito.findUnique({ where: { distritoId_data: { distritoId: distrito.id, data } } });
    let avisar = false;
    if (carga && carga.status !== 'CARREGADO' && carga.carteiroId !== efetivo) {
      await tx.cargaDistrito.update({ where: { id: carga.id }, data: { carteiroId: efetivo } });
      avisar = efetivo !== null && (STATUS_EM_OPERACAO as readonly string[]).includes(carga.status);
    }
    return { novoEfetivo: efetivo, notificar: avisar };
  });

  if (notificar && novoEfetivo) await notificarTrocaCarteiro(distrito.id, data, novoEfetivo);

  const avisos: string[] = [];
  if (novoEfetivo) {
    const outros = await prisma.distrito.findMany({
      where: { unidadeId: distrito.unidadeId, ativo: true, id: { not: distrito.id } },
      include: incluirDoDia(data),
    });
    if (outros.some((o) => carteiroEfetivo(o) === novoEfetivo)) avisos.push('carteiro_em_dois_distritos');
  }

  const carteiro = novoEfetivo
    ? await prisma.carteiro.findUnique({ where: { id: novoEfetivo }, select: { id: true, nome: true } })
    : null;
  return { distritoId: distrito.id, data: formatarData(data), carteiro, trocado: carteiroId !== null, avisos };
}

// ——— Carteiros ——————————————————————————————————————————————————————————————

const incluirCarteiro = {
  distritosPadrao: { select: { id: true, codigo: true, nome: true }, orderBy: { codigo: 'asc' } },
} satisfies Prisma.CarteiroInclude;

type CarteiroComDistritos = Prisma.CarteiroGetPayload<{ include: typeof incluirCarteiro }>;

function carteiroDto(c: CarteiroComDistritos) {
  return {
    id: c.id,
    unidadeId: c.unidadeId,
    nome: c.nome,
    matricula: c.matricula,
    whatsapp: c.whatsappE164,
    ativo: c.ativo,
    possuiLogin: c.usuarioId !== null,
    distritosPadrao: c.distritosPadrao,
    atualizadoEm: c.updatedAt,
  };
}

async function distritoDaUnidade(unidadeId: string, distritoId: string) {
  const d = await prisma.distrito.findUnique({ where: { id: distritoId } });
  if (!d || d.unidadeId !== unidadeId) throw new AppError(400, 'distrito_invalido', { campo: 'distritoPadraoId' });
  return d;
}

function mapearUnicoCarteiro(err: unknown): unknown {
  if (ehUnicoViolado(err, 'matricula')) return new AppError(409, 'matricula_em_uso', { campo: 'matricula', mensagem: 'Matrícula já cadastrada' });
  if (ehUnicoViolado(err, 'whatsapp')) return new AppError(409, 'whatsapp_em_uso', { campo: 'whatsapp' });
  return err;
}

export async function listarCarteiros(unidadeId: string, l: Listagem) {
  const where: Prisma.CarteiroWhereInput = {
    unidadeId,
    ...(l.ativo !== undefined ? { ativo: l.ativo } : {}),
    ...(l.busca
      ? { OR: [{ nome: { contains: l.busca, mode: 'insensitive' } }, { matricula: { contains: normalizarMatricula(l.busca) } }] }
      : {}),
  };
  const [total, itens] = await Promise.all([
    prisma.carteiro.count({ where }),
    prisma.carteiro.findMany({
      where,
      orderBy: [{ nome: 'asc' }, { matricula: 'asc' }],
      skip: (l.pagina - 1) * l.tamanho,
      take: l.tamanho,
      include: incluirCarteiro,
    }),
  ]);
  return pagina(itens.map(carteiroDto), total, l);
}

/** Carteiro visível ao usuário (mesma unidade), ou 404. */
export async function carteiroNaUnidade(carteiroId: string, garantir: (unidadeId: string) => void): Promise<Carteiro> {
  const c = await prisma.carteiro.findUnique({ where: { id: carteiroId } });
  if (!c) throw naoEncontrado();
  garantir(c.unidadeId);
  return c;
}

export async function obterCarteiro(carteiroId: string) {
  return carteiroDto(await prisma.carteiro.findUniqueOrThrow({ where: { id: carteiroId }, include: incluirCarteiro }));
}

export interface NovoCarteiro {
  nome: string;
  matricula: string;
  whatsapp: string;
  distritoPadraoId?: string | null;
}

export async function criarCarteiro(unidadeId: string, dados: NovoCarteiro) {
  const whatsappE164 = lerWhatsapp(dados.whatsapp);
  const matricula = lerMatricula(dados.matricula);
  await garantirMatriculaLivre(dados.matricula, { unidadeId });
  await garantirWhatsappLivre(whatsappE164);
  if (dados.distritoPadraoId) await distritoDaUnidade(unidadeId, dados.distritoPadraoId);

  try {
    const criado = await prisma.$transaction(async (tx) => {
      const c = await tx.carteiro.create({ data: { unidadeId, nome: dados.nome, matricula, whatsappE164 } });
      if (dados.distritoPadraoId) {
        await tx.distrito.update({ where: { id: dados.distritoPadraoId }, data: { carteiroPadraoId: c.id } });
      }
      return c;
    });
    return obterCarteiro(criado.id);
  } catch (err) {
    throw mapearUnicoCarteiro(err);
  }
}

export interface EdicaoCarteiro {
  nome?: string;
  matricula?: string;
  whatsapp?: string;
  distritoPadraoId?: string | null;
  ativo?: boolean;
  atualizadoEm?: string;
}

export async function editarCarteiro(carteiro: Carteiro, dados: EdicaoCarteiro) {
  const atual = await prisma.carteiro.findUniqueOrThrow({ where: { id: carteiro.id }, include: incluirCarteiro });
  conferirVersao(atual.updatedAt, dados.atualizadoEm, carteiroDto(atual));

  const data: Prisma.CarteiroUncheckedUpdateInput = {};
  if (dados.nome !== undefined) data.nome = dados.nome;
  if (dados.matricula !== undefined) {
    const matricula = lerMatricula(dados.matricula);
    if (matricula !== atual.matricula) {
      await garantirMatriculaLivre(dados.matricula, { unidadeId: atual.unidadeId, ignorarCarteiroId: atual.id, ignorarUsuarioId: atual.usuarioId });
      data.matricula = matricula;
    }
  }
  if (dados.whatsapp !== undefined) {
    const whatsappE164 = lerWhatsapp(dados.whatsapp);
    if (whatsappE164 !== atual.whatsappE164) {
      await garantirWhatsappLivre(whatsappE164, atual.id);
      data.whatsappE164 = whatsappE164;
    }
  }
  if (dados.distritoPadraoId) await distritoDaUnidade(atual.unidadeId, dados.distritoPadraoId);
  if (dados.ativo === false && atual.ativo) {
    const emOperacao = await distritosEmOperacaoDoCarteiro(atual);
    if (emOperacao.length > 0) {
      throw new AppError(409, 'carteiro_em_operacao', {
        distritos: emOperacao,
        mensagem: 'Carteiro de distrito liberado hoje; troque o carteiro do dia ou aguarde o encerramento',
      });
    }
  }
  if (dados.ativo !== undefined) data.ativo = dados.ativo;

  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.carteiro.updateMany({ where: { id: atual.id, updatedAt: atual.updatedAt }, data: data as Prisma.CarteiroUpdateManyMutationInput });
      if (r.count === 0) throw new AppError(409, 'alterado_por_outro', { atual: carteiroDto(atual) });
      if (dados.distritoPadraoId === null) {
        await tx.distrito.updateMany({ where: { carteiroPadraoId: atual.id }, data: { carteiroPadraoId: null } });
      } else if (dados.distritoPadraoId) {
        await tx.distrito.update({ where: { id: dados.distritoPadraoId }, data: { carteiroPadraoId: atual.id } });
      }
    });
  } catch (err) {
    throw mapearUnicoCarteiro(err);
  }
  return obterCarteiro(atual.id);
}

// ——— Pontos de retirada ——————————————————————————————————————————————————

function pontoDto(p: PontoRetirada) {
  return {
    id: p.id,
    unidadeId: p.unidadeId,
    tipo: p.tipo,
    nome: p.nome,
    endereco: p.endereco,
    horario: p.horario,
    ativo: p.ativo,
    atualizadoEm: p.atualizadoEm,
  };
}

export async function listarPontos(unidadeId: string, filtros: { tipo?: TipoPonto; ativo?: boolean }) {
  const itens = await prisma.pontoRetirada.findMany({
    where: { unidadeId, ...(filtros.tipo ? { tipo: filtros.tipo } : {}), ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}) },
    orderBy: [{ tipo: 'asc' }, { ativo: 'desc' }, { nome: 'asc' }],
  });
  const ativos = { AGENCIA: 0, LOCKER: 0 };
  for (const p of itens) if (p.ativo) ativos[p.tipo] += 1;
  return { itens: itens.map(pontoDto), ativosPorTipo: ativos };
}

export async function pontoNaUnidade(pontoId: string, garantir: (unidadeId: string) => void): Promise<PontoRetirada> {
  const p = await prisma.pontoRetirada.findUnique({ where: { id: pontoId } });
  if (!p) throw naoEncontrado();
  garantir(p.unidadeId);
  return p;
}

/** Serializa as ativações por (unidade, tipo) para o limite de 10 valer sob concorrência. */
async function travarTipo(tx: Prisma.TransactionClient, unidadeId: string, tipo: TipoPonto): Promise<void> {
  const chave = `pontos:${unidadeId}:${tipo}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`;
}

export interface DadosPonto {
  tipo?: TipoPonto;
  nome?: string;
  endereco?: string;
  horario?: string;
  ativo?: boolean;
  atualizadoEm?: string;
}

export async function criarPonto(unidadeId: string, dados: Required<Pick<DadosPonto, 'tipo' | 'nome' | 'endereco' | 'horario'>> & DadosPonto) {
  const nome = validarNomePonto(dados.nome);
  const ativo = dados.ativo ?? true;
  const p = await prisma.$transaction(async (tx) => {
    if (ativo) {
      await travarTipo(tx, unidadeId, dados.tipo);
      garantirLimitePontos(await tx.pontoRetirada.count({ where: { unidadeId, tipo: dados.tipo, ativo: true } }));
    }
    return tx.pontoRetirada.create({
      data: { unidadeId, tipo: dados.tipo, nome, endereco: dados.endereco, horario: dados.horario, ativo },
    });
  });
  return pontoDto(p);
}

export async function editarPonto(ponto: PontoRetirada, dados: DadosPonto) {
  conferirVersao(ponto.atualizadoEm, dados.atualizadoEm, pontoDto(ponto));
  const nome = dados.nome !== undefined ? validarNomePonto(dados.nome) : undefined;
  const tipo = dados.tipo ?? ponto.tipo;
  const ativo = dados.ativo ?? ponto.ativo;
  const passaAContar = ativo && (!ponto.ativo || tipo !== ponto.tipo);

  const p = await prisma.$transaction(async (tx) => {
    if (passaAContar) {
      await travarTipo(tx, ponto.unidadeId, tipo);
      garantirLimitePontos(await tx.pontoRetirada.count({
        where: { unidadeId: ponto.unidadeId, tipo, ativo: true, id: { not: ponto.id } },
      }));
    }
    const r = await tx.pontoRetirada.updateMany({
      where: { id: ponto.id, atualizadoEm: ponto.atualizadoEm },
      data: {
        tipo,
        ativo,
        ...(nome !== undefined ? { nome } : {}),
        ...(dados.endereco !== undefined ? { endereco: dados.endereco } : {}),
        ...(dados.horario !== undefined ? { horario: dados.horario } : {}),
      },
    });
    if (r.count === 0) throw new AppError(409, 'alterado_por_outro', { atual: pontoDto(ponto) });
    return tx.pontoRetirada.findUniqueOrThrow({ where: { id: ponto.id } });
  });
  return pontoDto(p);
}
