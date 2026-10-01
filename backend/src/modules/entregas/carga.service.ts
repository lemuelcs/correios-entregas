/**
 * Carga do dia (Monitoramento › Carregar Dados): prévia sem estado,
 * confirmação transacional, quadro de distritos e lista de pacotes.
 * TechSpec › API Endpoints › Carga; ADR-017.
 */
import { Prisma, type StatusPacote } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { normalizarTelefone, TelefoneInvalido } from '../../shared/utils/telefone';
import { classificarLinhas, consultasPrisma, normalizarEndereco, type LinhaClassificada, type LinhaEntrada, type Motivo } from './carga.validacao';
import { MAX_LINHAS, ParserErro, type AvisoParser, type CamposEndereco } from './planilha.parser';
import { formatarData, hojeBrasilia } from './datas';
import { derivarStatusCarga, lerFiltroStatusQuadro, rotuloStatusPacote, type ContagemPorStatus, type StatusQuadro } from './status';
import { aoAdicionarPacotesEmCargaLiberada } from './ganchos';
import { fotosDosPacotes, pendenciasPorDistrito, transferenciasPorDistrito } from '../captura/captura-supervisao.service';

export const PACOTES_POR_PAGINA = 50;

interface DistritoAlvo {
  id: string;
  unidadeId: string;
  codigo: string;
  ativo: boolean;
}

// ——— Prévia ——————————————————————————————————————————————————————————

export async function gerarPrevia(distrito: DistritoAlvo, entrada: LinhaEntrada[], avisos: AvisoParser[], data: Date) {
  const { linhas, resumo } = await classificarLinhas(entrada, consultasPrisma({ data, unidadeId: distrito.unidadeId }));
  return { data: formatarData(data), linhas, resumo, avisos };
}

// ——— Confirmação ———————————————————————————————————————————————————————

export interface Descarte {
  n: number;
  codigo: string;
  motivo: Motivo;
  detalhe?: string | null;
}

export interface ResultadoConfirmacao {
  cargaId: string | null;
  aceitos: number;
  descartados: number;
  descartes: Descarte[];
  /** Pacotes com WhatsApp que entraram numa carga já liberada (avisados pelo gancho). */
  avisadosNaHora: number;
}

type Tx = Prisma.TransactionClient;

/** Pontos internos da confirmação, expostos para os testes simularem falhas no meio da transação. */
export const cargaInternos = {
  /** Liga as orientações `GUARDADA` vigentes dos códigos aos pacotes recém-criados. */
  async vincularOrientacoesGuardadas(tx: Tx, pacotes: Array<{ id: string; codigo: string }>, data: Date): Promise<number> {
    if (pacotes.length === 0) return 0;
    const guardadas = await tx.orientacao.findMany({
      where: {
        codigo: { in: pacotes.map((p) => p.codigo) },
        estado: 'GUARDADA',
        OR: [{ valeAPartirDe: null }, { valeAPartirDe: { lte: data } }],
      },
      select: { id: true, codigo: true },
    });
    const porCodigo = new Map(pacotes.map((p) => [p.codigo, p.id]));
    for (const o of guardadas) {
      await tx.orientacao.update({ where: { id: o.id }, data: { pacoteId: porCodigo.get(o.codigo)! } });
    }
    return guardadas.length;
  },
};

export function dadosDoPacote(l: LinhaClassificada, cargaId: string, data: Date): Prisma.PacoteDiaCreateManyInput {
  // `corrigir` sem correção entra como "sem WhatsApp".
  const whatsappE164 = l.situacao === 'valida' ? l.whatsapp : null;
  return {
    cargaId,
    data,
    codigo: l.codigo,
    nome: l.nome,
    whatsappE164,
    logradouro: l.logradouro,
    numero: l.numero,
    complemento: l.complemento,
    bairro: l.bairro,
    cidade: l.cidade,
    uf: l.uf,
    cep: l.cep,
    enderecoTexto: l.enderecoTexto,
    referencia: l.referencia,
    status: whatsappE164 ? 'AGUARDANDO_LIBERACAO' : 'SEM_WHATSAPP',
  };
}

async function donosDosCodigos(codigos: string[], data: Date, unidadeId: string): Promise<Map<string, string | null>> {
  return consultasPrisma({ data, unidadeId }).codigosNoDia(codigos);
}

/**
 * Revalida tudo e grava as linhas aceitáveis numa transação. Um código já
 * gravado no dia (inclusive por uma confirmação concorrente) é descartado
 * pela unicidade `(codigo, data)`, sem erro.
 */
export async function confirmarCarga(distrito: DistritoAlvo, entrada: LinhaEntrada[], data: Date): Promise<ResultadoConfirmacao> {
  if (entrada.length > MAX_LINHAS) throw new ParserErro('limite_linhas', { max: MAX_LINHAS });
  if (data.getTime() < hojeBrasilia().getTime()) throw new AppError(409, 'somente_leitura');
  if (!distrito.ativo) throw new AppError(409, 'distrito_inativo');

  const { linhas } = await classificarLinhas(entrada, consultasPrisma({ data, unidadeId: distrito.unidadeId }));
  const descartes: Descarte[] = linhas
    .filter((l) => l.situacao === 'invalida')
    .map((l) => ({ n: l.n, codigo: l.codigo, motivo: l.motivo!, detalhe: l.detalhe ?? undefined }));
  const aceitaveis = linhas.filter((l) => l.situacao !== 'invalida');

  if (aceitaveis.length === 0) {
    const existente = await prisma.cargaDistrito.findUnique({
      where: { distritoId_data: { distritoId: distrito.id, data } },
      select: { id: true },
    });
    return { cargaId: existente?.id ?? null, aceitos: 0, descartados: descartes.length, descartes, avisadosNaHora: 0 };
  }

  const { carga, criados } = await prisma.$transaction(async (tx) => {
    // Cria a carga do dia se não existir; concorrentes esperam o commit e reaproveitam.
    await tx.$executeRaw`
      INSERT INTO "cargas_distrito" ("id", "distritoId", "data")
      VALUES (gen_random_uuid()::text, ${distrito.id}, ${formatarData(data)}::date)
      ON CONFLICT ("distritoId", "data") DO NOTHING`;
    const cargaDoDia = await tx.cargaDistrito.findUniqueOrThrow({
      where: { distritoId_data: { distritoId: distrito.id, data } },
    });
    const novos = await tx.pacoteDia.createManyAndReturn({
      data: aceitaveis.map((l) => dadosDoPacote(l, cargaDoDia.id, data)),
      skipDuplicates: true,
      select: { id: true, codigo: true, whatsappE164: true },
    });
    await cargaInternos.vincularOrientacoesGuardadas(tx, novos, data);
    return { carga: cargaDoDia, criados: novos };
  }, { timeout: 30_000, maxWait: 10_000 });

  // Linhas que perderam a corrida para outra confirmação.
  const criadosSet = new Set(criados.map((p) => p.codigo));
  const perdidas = aceitaveis.filter((l) => !criadosSet.has(l.codigo));
  if (perdidas.length > 0) {
    const donos = await donosDosCodigos(perdidas.map((l) => l.codigo), data, distrito.unidadeId);
    for (const l of perdidas) descartes.push({ n: l.n, codigo: l.codigo, motivo: 'ja_no_distrito', detalhe: donos.get(l.codigo) ?? undefined });
  }

  let avisadosNaHora = 0;
  if (carga.status !== 'CARREGADO') {
    const comWhatsapp = criados.filter((p) => p.whatsappE164).map((p) => p.id);
    avisadosNaHora = comWhatsapp.length;
    await aoAdicionarPacotesEmCargaLiberada(comWhatsapp);
  }

  descartes.sort((a, b) => a.n - b.n);
  return { cargaId: carga.id, aceitos: criados.length, descartados: descartes.length, descartes, avisadosNaHora };
}

// ——— Quadro —————————————————————————————————————————————————————————

export interface FiltrosQuadro {
  status?: string;
  busca?: string;
}

/** Cartão de uma rota (distrito) no dia: o que o quadro e as saídas mostram. */
export interface CartaoRota {
  distritoId: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  cargaId: string | null;
  carteiro: { id: string; nome: string | null } | null;
  semCarteiro: boolean;
  status: StatusQuadro;
  total: number;
  comWhatsapp: number;
  porStatus: ContagemPorStatus;
  escalonamentos: number;
  liberadoEm: Date | null;
  paraConferir: number;
  transferencias: { entrada: unknown[]; saida: unknown[] };
}

export interface CartaoRotaDoDia {
  cartao: CartaoRota;
  /** Saída que trouxe a rota (ADR-019); `null` = carga sem saída ou rota sem carga. */
  saida: { id: string; numero: number } | null;
  unidade: { id: string; nome: string };
}

/**
 * Cartões das rotas que casam com `where` na `data`. Carteiro do cartão:
 * snapshot da liberação → carteiro do dia (`EscalaDistrito`) → carteiro padrão.
 */
export async function cartoesDoDia(where: Prisma.DistritoWhereInput, data: Date, agora = new Date()): Promise<CartaoRotaDoDia[]> {
  const distritos = await prisma.distrito.findMany({
    where,
    orderBy: { codigo: 'asc' },
    include: {
      unidade: { select: { id: true, nome: true } },
      carteiroPadrao: { select: { id: true, nome: true, ativo: true } },
      escalas: { where: { data }, include: { carteiro: { select: { id: true, nome: true, ativo: true } } } },
      cargas: {
        where: { data },
        include: { carteiro: { select: { id: true, nome: true, ativo: true } }, saida: { select: { id: true, numero: true } } },
      },
    },
  });

  const cargaIds = distritos.flatMap((d) => d.cargas.map((c) => c.id));
  const [porStatusRows, whatsRows, escalRows] = cargaIds.length
    ? await Promise.all([
      prisma.pacoteDia.groupBy({ by: ['cargaId', 'status'], where: { cargaId: { in: cargaIds } }, _count: { _all: true } }),
      prisma.pacoteDia.groupBy({ by: ['cargaId'], where: { cargaId: { in: cargaIds }, whatsappE164: { not: null } }, _count: { _all: true } }),
      prisma.pacoteDia.groupBy({ by: ['cargaId'], where: { cargaId: { in: cargaIds }, escalonado: true }, _count: { _all: true } }),
    ])
    : [[], [], []];

  const porStatusDe = new Map<string, ContagemPorStatus>();
  for (const r of porStatusRows) {
    const m = porStatusDe.get(r.cargaId) ?? {};
    m[r.status as StatusPacote] = r._count._all;
    porStatusDe.set(r.cargaId, m);
  }
  const whatsDe = new Map(whatsRows.map((r) => [r.cargaId, r._count._all]));
  const escalDe = new Map(escalRows.map((r) => [r.cargaId, r._count._all]));
  // Captura do rótulo (extensão aditiva): pendências do carteiro e transferências do dia.
  const [pendenciasDe, transferenciasDe] = await Promise.all([
    pendenciasPorDistrito(distritos.map((d) => d.id), data),
    transferenciasPorDistrito(distritos.flatMap((d) => d.cargas.map((c) => ({ id: c.id, distritoId: d.id })))),
  ]);

  return distritos.map((d) => {
    const carga = d.cargas[0] ?? null;
    const porStatus = carga ? porStatusDe.get(carga.id) ?? {} : {};
    const total = Object.values(porStatus).reduce((a, n) => a + (n ?? 0), 0);
    const liberada = carga !== null && carga.status !== 'CARREGADO';
    const carteiroDoDia = (liberada && carga?.carteiro) || d.escalas[0]?.carteiro || d.carteiroPadrao;
    const carteiro = carteiroDoDia && carteiroDoDia.ativo ? { id: carteiroDoDia.id, nome: carteiroDoDia.nome } : null;
    const status: StatusQuadro = derivarStatusCarga({ carga, porStatus, agora });
    return {
      cartao: {
        distritoId: d.id,
        codigo: d.codigo,
        nome: d.nome,
        ativo: d.ativo,
        cargaId: carga?.id ?? null,
        carteiro,
        semCarteiro: carteiro === null,
        status,
        total,
        comWhatsapp: carga ? whatsDe.get(carga.id) ?? 0 : 0,
        porStatus,
        escalonamentos: carga ? escalDe.get(carga.id) ?? 0 : 0,
        liberadoEm: carga?.liberadoEm ?? null,
        paraConferir: pendenciasDe.get(d.id) ?? 0,
        transferencias: transferenciasDe.get(d.id) ?? { entrada: [], saida: [] },
      },
      saida: carga?.saida ?? null,
      unidade: d.unidade,
    };
  });
}

export async function montarQuadro(unidadeId: string, data: Date, filtros: FiltrosQuadro = {}, agora = new Date()) {
  const doDia = await cartoesDoDia({ unidadeId, OR: [{ ativo: true }, { cargas: { some: { data } } }] }, data, agora);
  const cartoes = doDia.map((c) => c.cartao);

  let filtrados = cartoes;
  if (filtros.status) {
    const aceitos = filtros.status.split(',').map(lerFiltroStatusQuadro);
    if (aceitos.some((s) => s === null)) throw new AppError(400, 'status_invalido');
    filtrados = filtrados.filter((c) => aceitos.includes(c.status));
  }
  const busca = filtros.busca?.trim().toLowerCase();
  if (busca) {
    filtrados = filtrados.filter((c) => c.codigo.toLowerCase().includes(busca) || c.nome.toLowerCase().includes(busca));
  }

  return {
    data: formatarData(data),
    somenteLeitura: data.getTime() < hojeBrasilia(agora).getTime(),
    semDistritos: !cartoes.some((c) => c.ativo),
    distritos: filtrados,
  };
}

// ——— Lista de pacotes ————————————————————————————————————————————————

const STATUS_PACOTE: readonly StatusPacote[] = [
  'SEM_WHATSAPP', 'AGUARDANDO_LIBERACAO', 'AGENDADO', 'NAO_ENVIADO', 'ENVIADO', 'LIDO', 'INTERAGINDO', 'INSUCESSO', 'ENTREGUE',
];

export interface FiltrosPacotes {
  status?: string;
  busca?: string;
  pagina?: number;
}

interface CargaAlvo {
  id: string;
  data: Date;
  status: string;
  liberadoEm: Date | null;
  distrito: { id: string; codigo: string; nome: string };
}

export async function listarPacotes(carga: CargaAlvo, filtros: FiltrosPacotes = {}, agora = new Date()) {
  const where: Prisma.PacoteDiaWhereInput = { cargaId: carga.id };
  if (filtros.status) {
    const lista = filtros.status.split(',').map((s) => s.trim().toUpperCase());
    if (lista.some((s) => !STATUS_PACOTE.includes(s as StatusPacote))) throw new AppError(400, 'status_invalido');
    where.status = { in: lista as StatusPacote[] };
  }
  const busca = filtros.busca?.trim();
  if (busca) {
    const digitos = busca.replace(/\D/g, '');
    where.OR = [
      { codigo: { contains: busca.toUpperCase().replace(/\s/g, '') } },
      { nome: { contains: busca, mode: 'insensitive' } },
      ...(digitos.length >= 4 ? [{ whatsappE164: { contains: digitos } }] : []),
    ];
  }
  const pagina = Math.max(1, Math.floor(filtros.pagina ?? 1));

  const [total, pacotes, grupos, comWhatsapp] = await Promise.all([
    prisma.pacoteDia.count({ where }),
    prisma.pacoteDia.findMany({
      where,
      orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }],
      skip: (pagina - 1) * PACOTES_POR_PAGINA,
      take: PACOTES_POR_PAGINA,
      include: {
        orientacoes: {
          // A pendente (aguardando o "sim" do destinatário) ainda não vale.
          where: { estado: { notIn: ['SUBSTITUIDA', 'AGUARDANDO_CONFIRMACAO'] } },
          orderBy: { criadaEm: 'desc' },
          take: 1,
          include: { pontoRetirada: { select: { ativo: true } } },
        },
      },
    }),
    prisma.pacoteDia.groupBy({ by: ['status'], where: { cargaId: carga.id }, _count: { _all: true } }),
    prisma.pacoteDia.count({ where: { cargaId: carga.id, whatsappE164: { not: null } } }),
  ]);

  const numeros = pacotes.map((p) => p.whatsappE164).filter((n): n is string => !!n);
  const descadastrados = numeros.length
    ? new Set((await prisma.descadastroWhatsapp.findMany({ where: { whatsappE164: { in: numeros } } })).map((d) => d.whatsappE164))
    : new Set<string>();

  const porStatus: ContagemPorStatus = {};
  for (const g of grupos) porStatus[g.status] = g._count._all;
  const liberada = carga.status !== 'CARREGADO';
  const temFotoDe = await fotosDosPacotes(pacotes.map((p) => p.id)); // captura (extensão aditiva)

  return {
    cargaId: carga.id,
    data: formatarData(carga.data),
    somenteLeitura: carga.data.getTime() < hojeBrasilia(agora).getTime(),
    distrito: { id: carga.distrito.id, codigo: carga.distrito.codigo, nome: carga.distrito.nome },
    statusCarga: derivarStatusCarga({ carga: { status: carga.status as never, data: carga.data }, porStatus, agora }),
    liberada,
    resumo: { total: Object.values(porStatus).reduce((a, n) => a + (n ?? 0), 0), comWhatsapp, porStatus },
    pagina,
    porPagina: PACOTES_POR_PAGINA,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / PACOTES_POR_PAGINA)),
    pacotes: pacotes.map((p) => {
      const o = p.orientacoes[0] ?? null;
      return {
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        whatsapp: p.whatsappE164,
        endereco: {
          logradouro: p.logradouro,
          numero: p.numero,
          complemento: p.complemento,
          bairro: p.bairro,
          cidade: p.cidade,
          uf: p.uf,
          cep: p.cep,
          enderecoTexto: p.enderecoTexto,
          referencia: p.referencia,
        },
        status: p.status,
        rotulo: rotuloStatusPacote(p.status, liberada),
        naoEnviadoMotivo: p.naoEnviadoMotivo,
        escalonado: p.escalonado,
        sinais: p.sinais,
        descadastrado: p.whatsappE164 ? descadastrados.has(p.whatsappE164) : false,
        rastreio: p.rastreioDescricao ? { descricao: p.rastreioDescricao, em: p.rastreioEm } : null,
        orientacaoVigente: o && {
          id: o.id,
          tipo: o.tipo,
          texto: o.texto,
          estado: o.estado,
          origem: o.origem,
          vizinhoNome: o.vizinhoNome,
          vizinhoCasa: o.vizinhoCasa,
          pontoRetiradaId: o.pontoRetiradaId,
          pontoDesativado: !!o.pontoRetirada && !o.pontoRetirada.ativo,
          sinais: o.sinais,
          valeAPartirDe: o.valeAPartirDe ? formatarData(o.valeAPartirDe) : null,
          criadaEm: o.criadaEm,
        },
        respostaCarteiro: o?.respostaCarteiro ? { resposta: o.respostaCarteiro, em: o.respondidoEm } : null,
        // Captura do rótulo (extensão aditiva).
        origem: p.origem,
        codigoDigitado: p.codigoDigitado,
        temFoto: temFotoDe.get(p.id) ?? false,
      };
    }),
  };
}

// ——— Edição de pacote ————————————————————————————————————————————————

export interface EdicaoPacote {
  /** Novo WhatsApp; `null` ou `''` remove. */
  whatsapp?: string | null;
  endereco?: CamposEndereco;
}

/** Estados em que o aviso ainda não saiu: trocar o WhatsApp muda só o destino. */
const ANTES_DO_ENVIO: readonly StatusPacote[] = ['SEM_WHATSAPP', 'AGUARDANDO_LIBERACAO', 'AGENDADO', 'NAO_ENVIADO'];

interface PacoteAlvo {
  id: string;
  status: StatusPacote;
  whatsappE164: string | null;
  carga: { status: string; data: Date };
}

/**
 * Atualiza WhatsApp e/ou endereço. Não envia aviso: se o pacote ganha WhatsApp
 * numa carga já liberada, chama `aoAdicionarPacotesEmCargaLiberada` (task_06).
 */
export async function editarPacote(pacote: PacoteAlvo, edicao: EdicaoPacote) {
  if (pacote.carga.data.getTime() < hojeBrasilia().getTime()) throw new AppError(409, 'somente_leitura');

  const dados: Prisma.PacoteDiaUpdateInput = {};
  let ganhouWhatsapp = false;

  if (edicao.whatsapp !== undefined) {
    const texto = (edicao.whatsapp ?? '').trim();
    let novo: string | null = null;
    if (texto) {
      try {
        novo = normalizarTelefone(texto);
      } catch (err) {
        const motivo = err instanceof TelefoneInvalido && err.codigo === 'sem_ddd' ? 'sem_ddd' : 'whatsapp_invalido';
        throw new AppError(400, 'whatsapp_invalido', { motivo });
      }
    }
    dados.whatsappE164 = novo;
    if (novo && pacote.status === 'SEM_WHATSAPP') {
      dados.status = 'AGUARDANDO_LIBERACAO';
      ganhouWhatsapp = true;
    } else if (!novo && ANTES_DO_ENVIO.includes(pacote.status)) {
      dados.status = 'SEM_WHATSAPP';
      dados.naoEnviadoMotivo = null;
    }
  }

  if (edicao.endereco) {
    const e = normalizarEndereco(edicao.endereco);
    for (const campo of Object.keys(edicao.endereco) as Array<keyof CamposEndereco>) {
      (dados as Record<string, unknown>)[campo] = e[campo];
    }
  }

  const atualizado = await prisma.pacoteDia.update({ where: { id: pacote.id }, data: dados });

  const cargaLiberada = pacote.carga.status !== 'CARREGADO';
  if (ganhouWhatsapp && cargaLiberada) await aoAdicionarPacotesEmCargaLiberada([pacote.id]);

  const descadastrado = atualizado.whatsappE164
    ? !!(await prisma.descadastroWhatsapp.findUnique({ where: { whatsappE164: atualizado.whatsappE164 } }))
    : false;

  return {
    id: atualizado.id,
    codigo: atualizado.codigo,
    whatsapp: atualizado.whatsappE164,
    status: atualizado.status,
    rotulo: rotuloStatusPacote(atualizado.status, cargaLiberada),
    descadastrado,
    avisoSolicitado: ganhouWhatsapp && cargaLiberada,
    endereco: {
      logradouro: atualizado.logradouro,
      numero: atualizado.numero,
      complemento: atualizado.complemento,
      bairro: atualizado.bairro,
      cidade: atualizado.cidade,
      uf: atualizado.uf,
      cep: atualizado.cep,
      enderecoTexto: atualizado.enderecoTexto,
      referencia: atualizado.referencia,
    },
  };
}
