/**
 * Saídas do dia (ADR-019; Monitoramento › Carregar Dados).
 *
 * A carga do dia é organizada por saída (onda de expedição) da unidade: número
 * (1, 2, …) e horário. Cada saída vem de UM arquivo com todas as rotas; a
 * importação grava direto (sem prévia) as linhas válidas e guarda o resumo das
 * linhas descartadas (linha, rota, código e motivo — sem nome nem telefone).
 *
 * - `importarSaida`: importa ou reimporta. Reimportar substitui os dados das
 *   rotas ainda não liberadas; as liberadas ficam intocadas.
 * - `listarSaidas`: saídas e rotas do dia de uma unidade, ou de todas (Gestão).
 * - `atribuirCarteiros`: carteiro do dia das rotas sem carteiro (e, se pedido,
 *   também o padrão da rota).
 *
 * "Rota" é o `Distrito` do banco; a carga da rota no dia é a `CargaDistrito`.
 */
import type { Carteiro, Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { classificarLinhas, consultasPrisma, type LinhaClassificada, type Motivo } from './carga.validacao';
import { MAX_LINHAS, MAX_LINHAS_SAIDA, ParserErro, limparTexto, type AvisoParser, type LinhaLida } from './planilha.parser';
import { cargaInternos, cartoesDoDia, dadosDoPacote, type CartaoRota } from './carga.service';
import { definirEscala, garantirUnidadeAtiva } from './cadastro.service';
import { normalizarMatricula } from './cadastro.validacao';
import { formatarData, hojeBrasilia } from './datas';

export const MAX_SAIDAS_DIA = 20;
export const MAX_CODIGO_ROTA = 20;
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODIGO_ROTA = /^[A-Z0-9][A-Z0-9._/-]*$/;
/** Inserções em lotes: o Postgres aceita no máximo 32.767 parâmetros por comando. */
const LOTE_INSERCAO = 500;

/** Motivos de descarte de uma linha do arquivo da saída (os de `carga.validacao` e os da rota). */
export type MotivoSaida =
  | Motivo
  | 'sem_rota'
  | 'rota_invalida'
  | 'rota_inativa'
  | 'rota_liberada'
  | 'rota_em_outra_saida'
  | 'limite_rota';

/** Linha descartada. Só linha, rota, código e motivo: nada de nome ou telefone. */
export interface DescarteSaida {
  n: number;
  rota: string | null;
  codigo: string;
  motivo: MotivoSaida;
  /** Complemento do motivo: a rota onde o pacote já está, o número da outra saída, o limite. */
  detalhe?: string | null;
}

export interface SaidaDto {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  numero: number;
  horario: string;
  arquivoNome: string;
  importadaEm: Date;
  aceitos: number;
  descartados: number;
  /** Ausente na visão agregada (todas as unidades). */
  descartes?: DescarteSaida[];
}

export interface EntradaImportacao {
  unidadeId: string;
  data: Date;
  numero: number;
  horario: string;
  arquivoNome: string;
  usuarioId?: string | null;
  linhas: LinhaLida[];
  avisos?: AvisoParser[];
}

export interface ResultadoImportacao {
  saida: SaidaDto;
  reimportacao: boolean;
  aceitos: number;
  descartados: number;
  descartes: DescarteSaida[];
  /** Rotas da saída depois da importação. */
  rotas: number;
  /** Rotas do arquivo que não existiam no Cadastro e foram criadas. */
  rotasCriadas: string[];
  /** Rotas da saída sem carteiro (nem do arquivo, nem do dia, nem padrão). */
  rotasSemCarteiro: string[];
  /** Rotas já liberadas: ficaram intocadas e as linhas delas foram descartadas. */
  rotasLiberadas: string[];
  /** Valor da coluna `carteiro` que não casou com nenhum carteiro ativo da unidade. */
  carteirosNaoEncontrados: Array<{ rota: string; valor: string }>;
  avisos: AvisoParser[];
}

// ——— Normalização ———————————————————————————————————————————————————————

/** Código da rota como o Cadastro grava: sem espaços nas pontas, em maiúsculas. */
export function normalizarRota(valor: string | null | undefined): string {
  return limparTexto(valor).toUpperCase();
}

/**
 * Código de rastreio para o resumo de descartes. Só passa o que tem cara de
 * código (letras E dígitos, sem espaço): uma coluna trocada não leva nome nem
 * telefone para o registro.
 */
export function codigoParaDescarte(valor: string | null | undefined): string {
  const c = limparTexto(valor).toUpperCase().replace(/\s/g, '');
  return /^[A-Z0-9]{4,20}$/.test(c) && /[A-Z]/.test(c) && /\d/.test(c) ? c : '';
}

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

type CarteiroDaUnidade = Pick<Carteiro, 'id' | 'nome' | 'matricula'>;

/**
 * Carteiro da coluna `carteiro`: pela matrícula (com ou sem máscara) ou pelo
 * nome completo (sem acento nem caixa). Nome repetido na unidade não casa.
 */
export function casarCarteiro(valor: string, carteiros: readonly CarteiroDaUnidade[]): CarteiroDaUnidade | null {
  const matricula = normalizarMatricula(valor);
  const porMatricula = carteiros.filter((c) => normalizarMatricula(c.matricula) === matricula);
  if (matricula && porMatricula.length === 1) return porMatricula[0];
  const nome = semAcento(valor);
  const porNome = carteiros.filter((c) => c.nome && semAcento(c.nome) === nome);
  return nome && porNome.length === 1 ? porNome[0] : null;
}

function saidaDto(
  s: { id: string; unidadeId: string; numero: number; horario: string; arquivoNome: string; importadaEm: Date; aceitos: number; descartados: number; descartes: Prisma.JsonValue; unidade: { nome: string } },
  comDescartes: boolean,
): SaidaDto {
  return {
    id: s.id,
    unidadeId: s.unidadeId,
    unidadeNome: s.unidade.nome,
    numero: s.numero,
    horario: s.horario,
    arquivoNome: s.arquivoNome,
    importadaEm: s.importadaEm,
    aceitos: s.aceitos,
    descartados: s.descartados,
    ...(comDescartes ? { descartes: (Array.isArray(s.descartes) ? s.descartes : []) as unknown as DescarteSaida[] } : {}),
  };
}

// ——— Importação —————————————————————————————————————————————————————————

interface AlvoRota {
  codigo: string;
  distritoId: string | null;
  cargaId: string | null;
}

const CAMPOS_COMPARADOS = ['nome', 'whatsappE164', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'enderecoTexto', 'referencia'] as const;

/**
 * Importa (ou reimporta) o arquivo da saída `numero` da unidade na `data`.
 *
 * Regras (ADR-019):
 * - a rota do arquivo que não existe no Cadastro é criada (`Rota <código>`);
 * - a rota pertence a UMA saída no dia: se já está em outra, as linhas são descartadas;
 * - reimportar substitui os pacotes de planilha das rotas ainda não liberadas
 *   (atualiza os que continuam, cria os novos, apaga os que saíram do arquivo);
 *   rota liberada fica intocada e as linhas dela são descartadas;
 * - o pacote já conferido pela foto do carteiro é mantido como está;
 * - WhatsApp malformado descarta a linha (sem prévia, não há como corrigir na hora);
 * - carteiro da rota: coluna `carteiro` casada → carteiro do dia; senão o padrão
 *   da rota; senão a rota fica sem carteiro.
 */
export async function importarSaida(e: EntradaImportacao, agora = new Date()): Promise<ResultadoImportacao> {
  if (!Number.isInteger(e.numero) || e.numero < 1 || e.numero > MAX_SAIDAS_DIA) {
    throw new AppError(400, 'saida_invalida', { max: MAX_SAIDAS_DIA });
  }
  if (!HORARIO.test(e.horario)) {
    throw new AppError(400, 'horario_obrigatorio', { mensagem: `Confirme o horário da Saída ${e.numero} antes de importar.` });
  }
  if (e.data.getTime() < hojeBrasilia(agora).getTime()) throw new AppError(409, 'somente_leitura');
  if (e.linhas.length > MAX_LINHAS_SAIDA) throw new ParserErro('limite_linhas', { max: MAX_LINHAS_SAIDA });
  await garantirUnidadeAtiva(e.unidadeId);

  const { unidadeId, data } = e;
  const descartes: DescarteSaida[] = [];
  const rotaDe = new Map<number, string>();
  const porRota = new Map<string, LinhaLida[]>();

  for (const l of e.linhas) {
    const rota = normalizarRota(l.rota);
    const descartar = (motivo: MotivoSaida, detalhe?: string) =>
      descartes.push({ n: l.n, rota: motivo === 'limite_rota' ? rota : null, codigo: codigoParaDescarte(l.codigo), motivo, ...(detalhe ? { detalhe } : {}) });
    if (!rota) {
      descartar('sem_rota');
      continue;
    }
    if (rota.length > MAX_CODIGO_ROTA || !CODIGO_ROTA.test(rota)) {
      descartar('rota_invalida');
      continue;
    }
    const lista = porRota.get(rota) ?? [];
    if (lista.length >= MAX_LINHAS) {
      descartar('limite_rota', String(MAX_LINHAS));
      continue;
    }
    lista.push(l);
    porRota.set(rota, lista);
    rotaDe.set(l.n, rota);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Uma importação por unidade e dia de cada vez.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`saida:${unidadeId}:${formatarData(data)}`}))`;

    const doDia = await tx.saida.findMany({ where: { unidadeId, data }, select: { id: true, numero: true } });
    const existente = doDia.find((s) => s.numero === e.numero) ?? null;
    const proxima = Math.max(0, ...doDia.map((s) => s.numero)) + 1;
    if (!existente && e.numero > proxima) throw new AppError(409, 'saida_fora_de_ordem', { proxima });

    const saidaId = existente?.id ?? (await tx.saida.create({
      data: { unidadeId, data, numero: e.numero, horario: e.horario, arquivoNome: e.arquivoNome, importadaEm: agora, importadaPorId: e.usuarioId ?? null },
      select: { id: true },
    })).id;

    // ——— Rotas do arquivo ———
    const codigos = [...porRota.keys()];
    const distritos = codigos.length
      ? await tx.distrito.findMany({
        where: { unidadeId, codigo: { in: codigos } },
        select: {
          id: true,
          codigo: true,
          ativo: true,
          cargas: { where: { data }, select: { id: true, status: true, saidaId: true, saida: { select: { numero: true } } } },
        },
      })
      : [];
    const distritoDe = new Map(distritos.map((d) => [d.codigo, d]));

    // Cargas que já eram desta saída e ainda não foram liberadas: os dados delas são substituídos.
    const daSaida = await tx.cargaDistrito.findMany({
      where: { saidaId },
      select: { id: true, status: true, distrito: { select: { codigo: true } } },
    });
    const substituiveis = new Set(daSaida.filter((c) => c.status === 'CARREGADO').map((c) => c.id));
    const rotaDaCarga = new Map(daSaida.map((c) => [c.id, c.distrito.codigo]));

    const alvos = new Map<string, AlvoRota>();
    const rotasLiberadas: string[] = [];
    const candidatas: LinhaLida[] = [];
    for (const [rota, linhas] of porRota) {
      const d = distritoDe.get(rota);
      const carga = d?.cargas[0] ?? null;
      let motivo: MotivoSaida | null = null;
      let detalhe: string | null = null;
      if (d && !d.ativo) {
        motivo = 'rota_inativa';
      } else if (carga?.saidaId && carga.saidaId !== saidaId) {
        motivo = 'rota_em_outra_saida';
        detalhe = carga.saida ? String(carga.saida.numero) : null;
      } else if (carga && carga.status !== 'CARREGADO') {
        motivo = 'rota_liberada';
        rotasLiberadas.push(rota);
      }
      if (motivo) {
        for (const l of linhas) descartes.push({ n: l.n, rota, codigo: codigoParaDescarte(l.codigo), motivo, ...(detalhe ? { detalhe } : {}) });
        // Rota barrada inteira: o que ela já tinha nesta saída fica como está.
        if (carga) substituiveis.delete(carga.id);
        continue;
      }
      alvos.set(rota, { codigo: rota, distritoId: d?.id ?? null, cargaId: carga?.id ?? null });
      if (carga) rotaDaCarga.set(carga.id, rota);
      candidatas.push(...linhas);
    }

    // Pacotes das cargas substituíveis e das adotadas (carga sem saída, ainda não liberada) são tratados aqui.
    const cargasEmJogo = [...new Set([...substituiveis, ...[...alvos.values()].flatMap((a) => (a.cargaId ? [a.cargaId] : []))])];

    // ——— Validação das linhas (S10, nome, duplicidade, "já está no dia") ———
    candidatas.sort((a, b) => a.n - b.n);
    const { linhas: classificadas } = await classificarLinhas(
      candidatas,
      consultasPrisma({ data, unidadeId, db: tx, ignorarCargaIds: cargasEmJogo }),
    );
    const aceitaveis: LinhaClassificada[] = [];
    for (const l of classificadas) {
      const rota = rotaDe.get(l.n)!;
      if (l.situacao === 'invalida' || l.situacao === 'corrigir') {
        const codigo = l.motivo === 'faltam_campos' || l.motivo === 'codigo_invalido' ? codigoParaDescarte(l.codigo) : l.codigo;
        descartes.push({ n: l.n, rota, codigo, motivo: l.motivo!, ...(l.situacao === 'invalida' && l.detalhe ? { detalhe: l.detalhe } : {}) });
      } else {
        aceitaveis.push(l);
      }
    }

    // ——— Rotas novas e cargas ———
    const rotasComLinhas = [...new Set(aceitaveis.map((l) => rotaDe.get(l.n)!))];
    const rotasCriadas = rotasComLinhas.filter((r) => !alvos.get(r)!.distritoId);
    if (rotasCriadas.length > 0) {
      await tx.distrito.createMany({
        data: rotasCriadas.map((codigo) => ({ unidadeId, codigo, nome: `Rota ${codigo}` })),
        skipDuplicates: true,
      });
      const criados = await tx.distrito.findMany({ where: { unidadeId, codigo: { in: rotasCriadas } }, select: { id: true, codigo: true } });
      for (const d of criados) alvos.get(d.codigo)!.distritoId = d.id;
    }
    const distritoIds = rotasComLinhas.map((r) => alvos.get(r)!.distritoId!);
    const semCarga = rotasComLinhas.map((r) => alvos.get(r)!).filter((a) => !a.cargaId);
    if (semCarga.length > 0) {
      await tx.cargaDistrito.createMany({
        data: semCarga.map((a) => ({ distritoId: a.distritoId!, data, saidaId })),
        skipDuplicates: true,
      });
    }
    if (distritoIds.length > 0) {
      const cargas = await tx.cargaDistrito.findMany({
        where: { data, distritoId: { in: distritoIds } },
        select: { id: true, saidaId: true, distrito: { select: { codigo: true } } },
      });
      for (const c of cargas) {
        alvos.get(c.distrito.codigo)!.cargaId = c.id;
        rotaDaCarga.set(c.id, c.distrito.codigo);
      }
      // Carga sem saída (captura do rótulo, lista por rota) passa a ser desta saída.
      const adotar = cargas.filter((c) => !c.saidaId).map((c) => c.id);
      if (adotar.length > 0) {
        await tx.cargaDistrito.updateMany({ where: { id: { in: adotar }, saidaId: null }, data: { saidaId } });
      }
    }

    // ——— Pacotes ———
    const existentes = cargasEmJogo.length
      ? await tx.pacoteDia.findMany({ where: { cargaId: { in: cargasEmJogo } } })
      : [];
    const existentePorCodigo = new Map(existentes.map((p) => [p.codigo, p]));
    const manter = new Set<string>();
    const criar: Prisma.PacoteDiaCreateManyInput[] = [];
    const linhaDoCodigo = new Map<string, LinhaClassificada>();
    let aceitos = 0;

    for (const l of aceitaveis) {
      const rota = rotaDe.get(l.n)!;
      const cargaId = alvos.get(rota)!.cargaId!;
      const dados = dadosDoPacote(l, cargaId, data);
      const atual = existentePorCodigo.get(l.codigo);
      if (!atual) {
        criar.push(dados);
        linhaDoCodigo.set(l.codigo, l);
        continue;
      }
      if (atual.origem !== 'PLANILHA') {
        // Conferido pela foto do carteiro: fica como está. Em outra rota, a linha não entra.
        if (atual.cargaId === cargaId) {
          manter.add(atual.id);
          aceitos += 1;
        } else {
          descartes.push({ n: l.n, rota, codigo: l.codigo, motivo: 'ja_no_distrito', detalhe: rotaDaCarga.get(atual.cargaId) ?? null });
        }
        continue;
      }
      manter.add(atual.id);
      aceitos += 1;
      const antesDoEnvio = atual.status === 'AGUARDANDO_LIBERACAO' || atual.status === 'SEM_WHATSAPP';
      const mudou = atual.cargaId !== cargaId
        || CAMPOS_COMPARADOS.some((c) => (atual[c] ?? null) !== ((dados as Record<string, unknown>)[c] ?? null))
        || (antesDoEnvio && atual.status !== dados.status);
      if (mudou) {
        const campos = Object.fromEntries(CAMPOS_COMPARADOS.map((c) => [c, (dados as Record<string, unknown>)[c] ?? null]));
        await tx.pacoteDia.update({ where: { id: atual.id }, data: { ...campos, cargaId, ...(antesDoEnvio ? { status: dados.status } : {}) } });
      }
    }

    // Reimportação: o pacote de planilha que saiu do arquivo sai da rota (só nas não liberadas).
    const apagar = existentes.filter((p) => substituiveis.has(p.cargaId) && p.origem === 'PLANILHA' && !manter.has(p.id)).map((p) => p.id);
    if (apagar.length > 0) await tx.pacoteDia.deleteMany({ where: { id: { in: apagar } } });

    const novos: Array<{ id: string; codigo: string }> = [];
    for (let i = 0; i < criar.length; i += LOTE_INSERCAO) {
      novos.push(...await tx.pacoteDia.createManyAndReturn({
        data: criar.slice(i, i + LOTE_INSERCAO),
        skipDuplicates: true,
        select: { id: true, codigo: true },
      }));
    }
    await cargaInternos.vincularOrientacoesGuardadas(tx, novos, data);
    aceitos += novos.length;
    // Linhas que perderam a corrida para outra gravação do mesmo código no dia.
    const gravados = new Set(novos.map((p) => p.codigo));
    for (const c of criar) {
      if (gravados.has(c.codigo)) continue;
      const l = linhaDoCodigo.get(c.codigo)!;
      descartes.push({ n: l.n, rota: rotaDe.get(l.n)!, codigo: l.codigo, motivo: 'ja_no_distrito' });
    }

    // Rota que ficou sem nenhum pacote sai da saída (a menos que a captura do rótulo a referencie).
    const vazias = (await tx.cargaDistrito.findMany({
      where: { saidaId, status: 'CARREGADO', pacotes: { none: {} } },
      select: { id: true },
    })).map((c) => c.id);
    if (vazias.length > 0) {
      const comCaptura = new Set((await tx.captura.findMany({ where: { cargaId: { in: vazias } }, select: { cargaId: true } })).map((c) => c.cargaId));
      await tx.cargaDistrito.deleteMany({ where: { id: { in: vazias.filter((id) => !comCaptura.has(id)) } } });
    }

    // ——— Carteiro das rotas ———
    const rotasDaSaida = await tx.cargaDistrito.findMany({
      where: { saidaId },
      select: {
        status: true,
        distrito: {
          select: {
            id: true,
            codigo: true,
            carteiroPadrao: { select: { id: true, ativo: true } },
            escalas: { where: { data }, select: { carteiroId: true, carteiro: { select: { ativo: true } } } },
          },
        },
      },
    });
    const carteiros = await tx.carteiro.findMany({ where: { unidadeId, ativo: true }, select: { id: true, nome: true, matricula: true } });
    const carteirosNaoEncontrados: Array<{ rota: string; valor: string }> = [];
    const rotasSemCarteiro: string[] = [];
    for (const { status, distrito: d } of rotasDaSaida) {
      const padrao = d.carteiroPadrao?.ativo ? d.carteiroPadrao.id : null;
      let doDia = d.escalas[0]?.carteiro.ativo ? d.escalas[0].carteiroId : null;
      const valor = status === 'CARREGADO' && rotasComLinhas.includes(d.codigo)
        ? limparTexto(porRota.get(d.codigo)?.find((l) => limparTexto(l.carteiro))?.carteiro)
        : '';
      if (valor) {
        const c = casarCarteiro(valor, carteiros);
        if (!c) {
          carteirosNaoEncontrados.push({ rota: d.codigo, valor: valor.slice(0, 80) });
        } else if (c.id !== (doDia ?? padrao)) {
          await tx.escalaDistrito.upsert({
            where: { distritoId_data: { distritoId: d.id, data } },
            create: { distritoId: d.id, data, carteiroId: c.id },
            update: { carteiroId: c.id },
          });
          doDia = c.id;
        }
      }
      if (status === 'CARREGADO' && !doDia && !padrao) rotasSemCarteiro.push(d.codigo);
    }

    descartes.sort((a, b) => a.n - b.n);
    const saida = await tx.saida.update({
      where: { id: saidaId },
      data: {
        horario: e.horario,
        arquivoNome: e.arquivoNome,
        importadaEm: agora,
        importadaPorId: e.usuarioId ?? null,
        aceitos,
        descartados: descartes.length,
        descartes: descartes as unknown as Prisma.InputJsonValue,
      },
      include: { unidade: { select: { nome: true } } },
    });

    return {
      saida: saidaDto(saida, false),
      reimportacao: existente !== null,
      aceitos,
      rotas: rotasDaSaida.length,
      rotasCriadas: rotasCriadas.sort(),
      rotasSemCarteiro: rotasSemCarteiro.sort(),
      rotasLiberadas: rotasLiberadas.sort(),
      carteirosNaoEncontrados,
    };
  }, { timeout: 120_000, maxWait: 15_000 });

  return { ...resultado, descartados: descartes.length, descartes, avisos: e.avisos ?? [] };
}

// ——— Listagem ——————————————————————————————————————————————————————————

export interface CartaoRotaSaida extends CartaoRota {
  /** Número da saída da rota; `null` = carga sem saída (aba "Sem saída"). */
  saidaNumero: number | null;
  unidade: { id: string; nome: string };
}

const ordemNatural = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Saídas e rotas do dia. `unidadeId: null` = todas as unidades ativas (visão
 * agregada da Gestão, só leitura, sem a lista de descartes).
 *
 * Uma rota só aparece quando um arquivo (ou a captura do rótulo) a trouxe:
 * rotas do Cadastro sem carga no dia não entram. Cargas sem saída vão com
 * `saidaNumero: null`.
 */
export async function listarSaidas(escopo: { unidadeId: string | null }, data: Date, agora = new Date()) {
  const agregado = escopo.unidadeId === null;
  const daUnidade = agregado ? { unidade: { ativa: true } } : { unidadeId: escopo.unidadeId! };

  const [saidas, doDia, unidade] = await Promise.all([
    prisma.saida.findMany({
      where: { data, ...daUnidade },
      orderBy: [{ numero: 'asc' }, { unidade: { nome: 'asc' } }],
      include: { unidade: { select: { nome: true } } },
    }),
    cartoesDoDia({ ...daUnidade, OR: [{ cargas: { some: { data } } }, { ativo: true }] }, data, agora),
    agregado ? null : prisma.unidade.findUnique({ where: { id: escopo.unidadeId! }, select: { id: true, nome: true } }),
  ]);

  const rotas: CartaoRotaSaida[] = doDia
    .filter(({ cartao: c, saida }) => {
      if (saida) return true;
      // Sem saída: só o que tem pacote ou pendência da captura do rótulo.
      const t = c.transferencias;
      return c.total > 0 || c.paraConferir > 0 || t.entrada.length > 0 || t.saida.length > 0;
    })
    .map(({ cartao, saida, unidade: u }) => ({
      ...cartao,
      // Rota existe porque um arquivo a trouxe: carga sem pacote conta como carregada (0 pacotes).
      status: cartao.status === 'PENDENTE_UPLOAD' ? 'DADOS_CARREGADOS' as const : cartao.status,
      saidaNumero: saida?.numero ?? null,
      unidade: u,
    }))
    .sort((a, b) => ordemNatural.compare(a.unidade.nome, b.unidade.nome) || ordemNatural.compare(a.codigo, b.codigo));

  return {
    data: formatarData(data),
    somenteLeitura: data.getTime() < hojeBrasilia(agora).getTime(),
    agregado,
    unidade,
    saidas: saidas.map((s) => saidaDto(s, !agregado)),
    proximaSaida: Math.max(0, ...saidas.map((s) => s.numero)) + 1,
    rotas,
  };
}

// ——— Carteiros das rotas ————————————————————————————————————————————————

export interface AtribuicaoCarteiro {
  distritoId: string;
  carteiroId: string;
  /** Também vira o carteiro padrão da rota no Cadastro. */
  definirPadrao?: boolean;
}

export type ResultadoAtribuicao =
  | { distritoId: string; rota: string | null; ok: true; carteiro: { id: string; nome: string | null } | null }
  | { distritoId: string; rota: string | null; ok: false; erro: string };

/**
 * Define o carteiro do dia das rotas (modal "Atribuir carteiros"). Reusa a
 * regra do Cadastro (`definirEscala`: carteiro ativo da unidade, snapshot e
 * aviso de troca se a rota já foi liberada). Uma falha não impede as demais.
 */
export async function atribuirCarteiros(unidadeId: string, data: Date, atribuicoes: readonly AtribuicaoCarteiro[]): Promise<ResultadoAtribuicao[]> {
  const distritos = await prisma.distrito.findMany({ where: { unidadeId, id: { in: atribuicoes.map((a) => a.distritoId) } } });
  const distritoDe = new Map(distritos.map((d) => [d.id, d]));
  const resultados: ResultadoAtribuicao[] = [];
  for (const a of atribuicoes) {
    const d = distritoDe.get(a.distritoId);
    if (!d) {
      resultados.push({ distritoId: a.distritoId, rota: null, ok: false, erro: 'nao_encontrado' });
      continue;
    }
    try {
      const r = await definirEscala(d, data, a.carteiroId);
      if (a.definirPadrao) await prisma.distrito.update({ where: { id: d.id }, data: { carteiroPadraoId: a.carteiroId } });
      resultados.push({ distritoId: d.id, rota: d.codigo, ok: true, carteiro: r.carteiro });
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      resultados.push({ distritoId: d.id, rota: d.codigo, ok: false, erro: err.message });
    }
  }
  return resultados;
}
