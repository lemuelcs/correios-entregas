/**
 * Conciliação da captura com a lista do dia (`PacoteDia`), regras 0–5 da TechSpec
 * (Core Interfaces), mais `desfazer`, `remover` e a edição pelo carteiro.
 *
 * Toda mudança acontece numa transação que serializa o código do dia
 * (`pg_advisory_xact_lock`) e grava o `EventoPacote` junto. O gancho de aviso do
 * monitoramento (`aoAdicionarPacotesEmCargaLiberada`) só é chamado depois do commit:
 * `aplicar` devolve os ids em `avisar`; `desfazer`, `remover` e `editar` chamam
 * `avisarAposCommit` eles mesmos.
 */
import { Prisma, type PacoteDia, type StatusCarga, type StatusPacote } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { normalizeS10 } from '../../shared/utils/s10';
import { classificarTelefone, mesmoNumero, type TelefoneClassificado } from '../../shared/utils/telefone-classificacao';
import * as ganchos from '../entregas/ganchos';
import { avaliarMinimo, motivosDe } from './campos';
import { dependenciasCaptura } from './captura.contexto';
import { capturaGanchoAvisoFalhas, fotosExcluidas } from './captura.metricas';
import type { Ator, CamposLidos, NomeCampo, ResultadoCaptura } from './captura.types';

type Tx = Prisma.TransactionClient;

/** Pontos internos expostos para os testes simularem falhas e corridas. */
export const conciliacaoInternos = {
  /** Depois do update/insert do pacote, antes dos eventos (IT-109). */
  aposAtualizarPacote: async (_tx: Tx): Promise<void> => {},
  /** Entre a leitura do pacote e a transação da remoção (IT-075). */
  antesDeRemover: async (): Promise<void> => {},
};

export const STATUS_LIBERADOS: readonly StatusCarga[] = ['LIBERADO', 'EM_ENTREGA', 'CONCLUIDO'];

export function cargaLiberada(status: StatusCarga | string): boolean {
  return (STATUS_LIBERADOS as readonly string[]).includes(status);
}

const OPCOES_TX = { timeout: 20_000, maxWait: 15_000 };
const ANTES_DO_ENVIO: readonly StatusPacote[] = ['SEM_WHATSAPP', 'AGUARDANDO_LIBERACAO'];

/** Campo lido → coluna do `PacoteDia` (o WhatsApp é tratado à parte). */
const COLUNAS: ReadonlyArray<[NomeCampo, 'nome' | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf']> = [
  ['nome', 'nome'],
  ['cep', 'cep'],
  ['logradouro', 'logradouro'],
  ['numero', 'numero'],
  ['complemento', 'complemento'],
  ['bairro', 'bairro'],
  ['cidade', 'cidade'],
  ['uf', 'uf'],
];

/** Colunas guardadas em `Captura.pacoteAntes` e restauradas por `desfazer`/`remover`. */
const SNAPSHOT = [
  'cargaId', 'nome', 'whatsappE164', 'telefoneOutro', 'logradouro', 'numero', 'complemento',
  'bairro', 'cidade', 'uf', 'cep', 'origem', 'status', 'codigoDigitado', 'capturadoPorId',
] as const;
type Snapshot = Pick<PacoteDia, (typeof SNAPSHOT)[number]>;

function snapshot(p: PacoteDia): Snapshot {
  const s = {} as Record<string, unknown>;
  for (const k of SNAPSHOT) s[k] = p[k];
  return s as Snapshot;
}

export interface AplicarInput {
  capturaId: string;
  carteiroId: string;
  distritoId: string;
  /** Dia civil em America/Sao_Paulo (meia-noite UTC). */
  data: Date;
  campos: CamposLidos;
  codigoDigitado: boolean;
  confirmarTransferencia?: boolean;
  /** Carga de origem vista quando a transferência ficou pendente (checagem otimista). */
  cargaOrigemEsperadaId?: string | null;
}

export interface EdicaoCarteiro {
  codigo?: string | null;
  nome?: string | null;
  whatsapp?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

async function travarCodigo(tx: Tx, codigo: string, data: Date): Promise<void> {
  const chave = `captura:${codigo}:${data.toISOString().slice(0, 10)}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
}

async function statusCargaTravada(tx: Tx, cargaId: string): Promise<string | null> {
  const linhas = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT status::text AS status FROM cargas_distrito WHERE id = ${cargaId} FOR UPDATE`;
  return linhas[0]?.status ?? null;
}

function json(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

function remocaoNaoPermitida(msg = 'Remoção não permitida'): AppError {
  return new AppError(403, msg, { code: 'remocao_nao_permitida' });
}

/** Chama o gancho de aviso do monitoramento; falha só vira log e métrica. */
export async function avisarAposCommit(pacoteIds: string[]): Promise<void> {
  if (pacoteIds.length === 0) return;
  try {
    await ganchos.aoAdicionarPacotesEmCargaLiberada(pacoteIds);
  } catch (err) {
    capturaGanchoAvisoFalhas.inc();
    logger.error({ pacotes: pacoteIds.length, erro: err instanceof Error ? err.name : 'desconhecido' }, 'captura: falha no gancho de aviso');
  }
}

/** Exclui fotos já marcadas como excluídas no banco (depois do commit). */
export async function excluirFotos(chaves: Array<string | null | undefined>, motivo: string): Promise<void> {
  const { photoStore } = dependenciasCaptura();
  for (const chave of chaves) {
    if (!chave) continue;
    try {
      await photoStore.delete(chave);
      fotosExcluidas.inc({ motivo });
    } catch (err) {
      logger.error({ motivo, erro: err instanceof Error ? err.name : 'desconhecido' }, 'captura: falha ao excluir foto');
    }
  }
}

interface Diferencas {
  dados: Prisma.PacoteDiaUncheckedUpdateInput;
  campos: Record<string, { antes: string | null; depois: string | null }>;
  whatsapp: { antes: string | null; depois: string } | null;
}

/** Regra 3: sobrescreve o que a foto leu sem dúvida; campo nulo mantém o atual. */
function diferencas(p: PacoteDia, campos: CamposLidos, tel: TelefoneClassificado): Diferencas {
  const dados: Prisma.PacoteDiaUncheckedUpdateInput = {};
  const mudancas: Diferencas['campos'] = {};
  for (const [nome, coluna] of COLUNAS) {
    const c = campos[nome];
    if (!c || c.valor == null || c.duvida) continue;
    const novo = coluna === 'uf' ? c.valor.toUpperCase() : c.valor;
    const antes = (p[coluna] as string | null) ?? null;
    if (antes !== novo) {
      (dados as Record<string, unknown>)[coluna] = novo;
      mudancas[nome] = { antes, depois: novo };
    }
  }
  let whatsapp: Diferencas['whatsapp'] = null;
  if (!campos.whatsapp?.duvida) {
    if (tel.whatsappE164 && !mesmoNumero(p.whatsappE164, tel.whatsappE164)) {
      dados.whatsappE164 = tel.whatsappE164;
      whatsapp = { antes: p.whatsappE164, depois: tel.whatsappE164 };
      mudancas.whatsapp = { antes: p.whatsappE164, depois: tel.whatsappE164 };
    }
    if (tel.outro && tel.outro !== p.telefoneOutro) dados.telefoneOutro = tel.outro;
  }
  return { dados, campos: mudancas, whatsapp };
}

export class ConciliacaoService {
  /**
   * Regras 0–5. Grava o resultado na `Captura` (que já existe) na mesma transação.
   * Lança 409 `transferencia_concorrente` quando a origem mudou desde a pergunta.
   */
  async aplicar(input: AplicarInput): Promise<{ resultado: ResultadoCaptura; avisar: string[] }> {
    const { distritoDoDia, now } = dependenciasCaptura();
    const codigo = normalizeS10(input.campos.codigo?.valor ?? '');

    return prisma.$transaction(async (tx) => {
      await travarCodigo(tx, codigo || input.capturaId, input.data);

      // Regra 0: a carga do dia existe (criada como CARREGADO).
      const distrito = await tx.distrito.findUniqueOrThrow({ where: { id: input.distritoId }, select: { id: true, codigo: true, unidadeId: true } });
      const carga = await distritoDoDia.garantirCarga(input.distritoId, input.data, tx);
      const liberada = cargaLiberada(carga.status);
      let campos = input.campos;

      const registrar = (dados: Prisma.CapturaUncheckedUpdateInput) =>
        tx.captura.update({
          where: { id: input.capturaId },
          data: { cargaId: carga.id, codigo: codigo || null, campos: json(campos), processadoEm: now(), ...dados },
        });

      // Regra 1: o mínimo, e nenhum campo em dúvida.
      let tel: TelefoneClassificado = { whatsappE164: null, outro: null };
      try {
        tel = classificarTelefone(campos.whatsapp?.valor);
      } catch {
        campos = { ...campos, whatsapp: { ...campos.whatsapp, duvida: true, motivo: 'telefone_invalido' } };
      }
      if (!avaliarMinimo(campos).ok) {
        await registrar({ resultado: 'PARA_CONFERIR', pacoteId: null, pacoteAntes: Prisma.DbNull, cargaOrigemId: null, recusa: null });
        return { resultado: { tipo: 'PARA_CONFERIR', campos, motivos: motivosDe(campos) }, avisar: [] };
      }

      const existente = await tx.pacoteDia.findUnique({
        where: { codigo_data: { codigo, data: input.data } },
        include: { carga: { include: { distrito: { select: { id: true, codigo: true, unidadeId: true, carteiroPadraoId: true } } } } },
      });

      // Regra 2: o código está em outra carga hoje.
      let transferencia: { de: typeof existente; origemLiberada: boolean; carteiroAnterior: string | null } | null = null;
      if (existente && existente.cargaId !== carga.id) {
        if (existente.carga.distrito.unidadeId !== distrito.unidadeId) {
          await registrar({ resultado: 'RECUSADO', recusa: 'OUTRA_UNIDADE', pacoteId: null, pacoteAntes: Prisma.DbNull });
          return { resultado: { tipo: 'RECUSADO', codigo: 'OUTRA_UNIDADE' }, avisar: [] };
        }
        if (existente.status === 'ENTREGUE') {
          await registrar({ resultado: 'RECUSADO', recusa: 'JA_ENTREGUE', pacoteId: null, pacoteAntes: Prisma.DbNull });
          return { resultado: { tipo: 'RECUSADO', codigo: 'JA_ENTREGUE' }, avisar: [] };
        }
        if (!input.confirmarTransferencia) {
          await registrar({ resultado: 'TRANSFERENCIA_PENDENTE', cargaOrigemId: existente.cargaId, pacoteId: null, pacoteAntes: Prisma.DbNull, recusa: null });
          return {
            resultado: { tipo: 'TRANSFERENCIA_PENDENTE', campos, distritoOrigem: existente.carga.distrito.codigo },
            avisar: [],
          };
        }
        if (input.cargaOrigemEsperadaId && existente.cargaId !== input.cargaOrigemEsperadaId) {
          throw new AppError(409, 'O pacote mudou de rota enquanto a transferência era confirmada', { code: 'transferencia_concorrente' });
        }
        const escalaOrigem = await tx.escalaDistrito.findUnique({
          where: { distritoId_data: { distritoId: existente.carga.distritoId, data: input.data } },
          select: { carteiroId: true },
        });
        transferencia = {
          de: existente,
          origemLiberada: cargaLiberada(existente.carga.status),
          carteiroAnterior: existente.carga.carteiroId ?? escalaOrigem?.carteiroId ?? existente.carga.distrito.carteiroPadraoId ?? null,
        };
      }

      // Regra 3: atualiza (inclusive o pacote transferido).
      if (existente) {
        const d = diferencas(existente, campos, tel);
        const dados: Prisma.PacoteDiaUncheckedUpdateInput = {
          ...d.dados,
          capturadoPorId: input.carteiroId,
          codigoDigitado: existente.codigoDigitado && input.codigoDigitado,
        };
        if (existente.origem === 'PLANILHA') dados.origem = 'PLANILHA_FOTO';
        if (d.whatsapp && existente.status === 'SEM_WHATSAPP') {
          dados.status = 'AGUARDANDO_LIBERACAO';
          dados.naoEnviadoMotivo = null;
        }
        if (transferencia) dados.cargaId = carga.id;

        const atualizado = await tx.pacoteDia.update({ where: { id: existente.id }, data: dados });
        await conciliacaoInternos.aposAtualizarPacote(tx);

        const eventos: Prisma.EventoPacoteCreateManyInput[] = [];
        if (transferencia) {
          eventos.push({
            pacoteId: existente.id,
            tipo: 'TRANSFERIDO',
            dados: json({
              de: existente.carga.distrito.codigo,
              para: distrito.codigo,
              deDistritoId: existente.carga.distritoId,
              paraDistritoId: distrito.id,
              deCargaId: existente.cargaId,
              paraCargaId: carga.id,
              origemLiberada: transferencia.origemLiberada,
              carteiroAnterior: transferencia.carteiroAnterior,
              carteiroId: input.carteiroId,
              capturaId: input.capturaId,
            }),
          });
        }
        const eventoAtualizado: Record<string, unknown> = { capturaId: input.capturaId, carteiroId: input.carteiroId, campos: d.campos };
        if (dados.origem) eventoAtualizado.origem = { antes: existente.origem, depois: dados.origem };
        eventos.push({ pacoteId: existente.id, tipo: 'CAPTURA_ATUALIZADO', dados: json(eventoAtualizado) });
        if (d.whatsapp) eventos.push({ pacoteId: existente.id, tipo: 'WHATSAPP_ALTERADO', dados: json({ antes: d.whatsapp.antes, depois: d.whatsapp.depois }) });
        await tx.eventoPacote.createMany({ data: eventos });

        await registrar({
          resultado: 'SALVO',
          pacoteId: existente.id,
          pacoteAntes: json(snapshot(existente)),
          cargaOrigemId: transferencia ? existente.cargaId : null,
          recusa: null,
        });

        // Regra 5.
        const entrouSemAviso = !!transferencia && !transferencia.origemLiberada && !!atualizado.whatsappE164;
        const avisar = liberada && (!!d.whatsapp || entrouSemAviso) ? [existente.id] : [];
        return { resultado: { tipo: 'SALVO', pacoteId: existente.id, atualizado: true }, avisar };
      }

      // Regra 4: pacote novo, origem FOTO.
      const v = (n: NomeCampo) => campos[n]?.valor ?? null;
      const criado = await tx.pacoteDia.create({
        data: {
          cargaId: carga.id,
          data: input.data,
          codigo,
          nome: v('nome') as string,
          whatsappE164: tel.whatsappE164,
          telefoneOutro: tel.outro,
          cep: v('cep'),
          logradouro: v('logradouro'),
          numero: v('numero'),
          complemento: v('complemento'),
          bairro: v('bairro'),
          cidade: v('cidade'),
          uf: v('uf')?.toUpperCase() ?? null,
          status: tel.whatsappE164 ? 'AGUARDANDO_LIBERACAO' : 'SEM_WHATSAPP',
          origem: 'FOTO',
          codigoDigitado: input.codigoDigitado,
          capturadoPorId: input.carteiroId,
        },
      });
      await conciliacaoInternos.aposAtualizarPacote(tx);
      const fontes: Record<string, string> = {};
      for (const [n, c] of Object.entries(campos)) fontes[n] = c.fonte;
      await tx.eventoPacote.create({
        data: { pacoteId: criado.id, tipo: 'CAPTURA_CRIADO', dados: json({ capturaId: input.capturaId, carteiroId: input.carteiroId, origem: 'FOTO', fontes }) },
      });
      await registrar({ resultado: 'SALVO', pacoteId: criado.id, pacoteAntes: Prisma.DbNull, cargaOrigemId: null, recusa: null });

      return {
        resultado: { tipo: 'SALVO', pacoteId: criado.id, atualizado: false },
        avisar: liberada && tel.whatsappE164 ? [criado.id] : [],
      };
    }, OPCOES_TX);
  }

  /** Desfaz um SALVO do próprio carteiro: remove o pacote criado ou restaura o anterior. */
  async desfazer(capturaId: string, carteiroId: string): Promise<void> {
    const { now } = dependenciasCaptura();
    const cap = await prisma.captura.findFirst({ where: { id: capturaId, carteiroId } });
    if (!cap) throw new AppError(404, 'Captura não encontrada');
    if (cap.resultado !== 'SALVO' || !cap.pacoteId) {
      throw new AppError(409, 'Captura já resolvida', { code: 'captura_ja_resolvida' });
    }
    const pacoteId = cap.pacoteId;

    const { avisar } = await prisma.$transaction(async (tx) => {
      await travarCodigo(tx, cap.codigo ?? cap.id, cap.data);
      const posterior = await tx.captura.findFirst({
        where: { pacoteId, resultado: 'SALVO', id: { not: cap.id }, processadoEm: { gt: cap.processadoEm ?? cap.recebidoEm } },
        select: { id: true },
      });
      if (posterior) throw new AppError(409, 'Uma captura posterior já alterou este pacote', { code: 'remocao_nao_permitida' });

      const pacote = await tx.pacoteDia.findUnique({ where: { id: pacoteId } });
      if (!pacote) throw new AppError(409, 'O pacote não está mais na lista', { code: 'remocao_nao_permitida' });
      const statusCarga = await statusCargaTravada(tx, pacote.cargaId);
      const avisarIds: string[] = [];

      if (!cap.pacoteAntes) {
        if (statusCarga && cargaLiberada(statusCarga)) {
          throw new AppError(409, 'A rota já foi liberada: fale com o supervisor', { code: 'remocao_nao_permitida' });
        }
        await tx.eventoPacote.create({
          data: { pacoteId, tipo: 'DESFEITO', dados: json({ capturaId, carteiroId, codigo: pacote.codigo, removido: true, snapshot: snapshot(pacote) }) },
        });
        await tx.pacoteDia.delete({ where: { id: pacoteId } });
      } else {
        const antes = cap.pacoteAntes as unknown as Snapshot;
        const dados = this.restauracao(pacote, antes);
        await tx.pacoteDia.update({ where: { id: pacoteId }, data: dados });
        await tx.eventoPacote.create({
          data: { pacoteId, tipo: 'DESFEITO', dados: json({ capturaId, carteiroId, codigo: pacote.codigo, removido: false }) },
        });
        if (!mesmoNumero(pacote.whatsappE164, antes.whatsappE164) && antes.whatsappE164) {
          await tx.eventoPacote.create({
            data: { pacoteId, tipo: 'WHATSAPP_ALTERADO', dados: json({ antes: pacote.whatsappE164, depois: antes.whatsappE164 }) },
          });
          const statusDestino = antes.cargaId === pacote.cargaId ? statusCarga : (await statusCargaTravada(tx, antes.cargaId));
          if (statusDestino && cargaLiberada(statusDestino)) avisarIds.push(pacoteId);
        }
      }
      await tx.captura.update({
        where: { id: capturaId },
        data: { resultado: 'DESFEITO', fotoExcluidaEm: cap.fotoKey && !cap.fotoExcluidaEm ? now() : cap.fotoExcluidaEm },
      });
      return { avisar: avisarIds };
    }, OPCOES_TX);

    if (!cap.fotoExcluidaEm) await excluirFotos([cap.fotoKey], 'desfeita');
    await avisarAposCommit(avisar);
  }

  /** Colunas a gravar para voltar ao snapshot; o status só volta enquanto o aviso não saiu. */
  private restauracao(atual: PacoteDia, antes: Snapshot): Prisma.PacoteDiaUncheckedUpdateInput {
    const dados: Record<string, unknown> = {};
    for (const k of SNAPSHOT) {
      if (k === 'status') continue;
      dados[k] = antes[k];
    }
    if (ANTES_DO_ENVIO.includes(atual.status)) {
      dados.status = antes.whatsappE164 ? (ANTES_DO_ENVIO.includes(antes.status) ? antes.status : 'AGUARDANDO_LIBERACAO') : 'SEM_WHATSAPP';
    }
    return dados as Prisma.PacoteDiaUncheckedUpdateInput;
  }

  /**
   * Remove um pacote (US-017 para o carteiro; US-018 para o supervisor, com o escopo
   * conferido pela rota). Carteiro: só o que ele capturou, carga não liberada e origem
   * ≠ PLANILHA; em PLANILHA_FOTO desfaz a foto (volta ao snapshot da planilha).
   * Supervisor: qualquer status exceto ENTREGUE. Fotos excluídas na hora.
   */
  async remover(pacoteId: string, ator: Ator): Promise<void> {
    const { now } = dependenciasCaptura();
    const pacote = await prisma.pacoteDia.findUnique({ where: { id: pacoteId }, include: { carga: { include: { distrito: true } } } });
    if (!pacote) throw new AppError(404, 'Pacote não encontrado');

    const porCarteiro = ator.role === 'CARTEIRO';
    if (porCarteiro) {
      const carteiro = await prisma.carteiro.findUnique({ where: { usuarioId: ator.usuarioId }, select: { id: true, unidadeId: true } });
      if (!carteiro || carteiro.unidadeId !== pacote.carga.distrito.unidadeId) throw new AppError(404, 'Pacote não encontrado');
      if (pacote.origem === 'PLANILHA' || pacote.capturadoPorId !== carteiro.id) {
        throw remocaoNaoPermitida('Só o supervisor remove pacotes da planilha ou de outro carteiro');
      }
      if (cargaLiberada(pacote.carga.status)) throw remocaoNaoPermitida('A rota já foi liberada: fale com o supervisor');
    } else if (pacote.status === 'ENTREGUE') {
      throw new AppError(409, 'Pacote já entregue', { code: 'pacote_entregue' });
    }

    await conciliacaoInternos.antesDeRemover();

    const chaves = await prisma.$transaction(async (tx) => {
      await travarCodigo(tx, pacote.codigo, pacote.data);
      const atual = await tx.pacoteDia.findUnique({ where: { id: pacoteId } });
      if (!atual) throw new AppError(404, 'Pacote não encontrado');
      const statusCarga = await statusCargaTravada(tx, atual.cargaId);
      if (porCarteiro && statusCarga && cargaLiberada(statusCarga)) {
        throw remocaoNaoPermitida('A rota já foi liberada: fale com o supervisor');
      }
      if (!porCarteiro && atual.status === 'ENTREGUE') throw new AppError(409, 'Pacote já entregue', { code: 'pacote_entregue' });

      const capturas = await tx.captura.findMany({
        where: { pacoteId, resultado: 'SALVO' },
        orderBy: [{ processadoEm: 'asc' }, { recebidoEm: 'asc' }],
      });
      const por = { usuarioId: ator.usuarioId, role: ator.role };

      const preFoto = porCarteiro && atual.origem === 'PLANILHA_FOTO'
        ? capturas.map((c) => c.pacoteAntes as unknown as Snapshot | null).find((s) => s?.origem === 'PLANILHA')
        : undefined;

      if (preFoto) {
        await tx.pacoteDia.update({ where: { id: pacoteId }, data: this.restauracao(atual, preFoto) });
        await tx.eventoPacote.create({
          data: { pacoteId, tipo: 'REMOVIDO', dados: json({ modo: 'FOTO_DESFEITA', por, codigo: atual.codigo, snapshot: snapshot(atual) }) },
        });
      } else {
        await tx.eventoPacote.create({
          data: { pacoteId, tipo: 'REMOVIDO', dados: json({ modo: 'EXCLUIDO', por, codigo: atual.codigo, snapshot: snapshot(atual) }) },
        });
        await tx.pacoteDia.delete({ where: { id: pacoteId } });
      }

      const comFoto = capturas.filter((c) => c.fotoKey && !c.fotoExcluidaEm);
      await tx.captura.updateMany({ where: { pacoteId, resultado: 'SALVO' }, data: { resultado: 'DESFEITO' } });
      if (comFoto.length > 0) {
        await tx.captura.updateMany({ where: { id: { in: comFoto.map((c) => c.id) } }, data: { fotoExcluidaEm: now() } });
      }
      return comFoto.map((c) => c.fotoKey);
    }, OPCOES_TX);

    await excluirFotos(chaves, 'removida');
  }

  /**
   * Edição pelo carteiro de um pacote que ele capturou (antes e depois da liberação).
   * O código não é editável (400 `codigo_nao_editavel_use_nova_captura`).
   */
  async editar(pacoteId: string, usuarioId: string, edicao: EdicaoCarteiro): Promise<PacoteDia> {
    if (edicao.codigo !== undefined) {
      throw new AppError(400, 'O código não é editável: faça uma nova captura', { code: 'codigo_nao_editavel_use_nova_captura' });
    }
    const carteiro = await prisma.carteiro.findUnique({ where: { usuarioId }, select: { id: true, unidadeId: true } });
    const pacote = await prisma.pacoteDia.findUnique({ where: { id: pacoteId }, include: { carga: { include: { distrito: true } } } });
    if (!carteiro || !pacote || pacote.carga.distrito.unidadeId !== carteiro.unidadeId) throw new AppError(404, 'Pacote não encontrado');
    if (pacote.capturadoPorId !== carteiro.id) throw new AppError(403, 'Só o carteiro que capturou edita o pacote', { code: 'edicao_nao_permitida' });

    // Valida o resultado como um todo (o mínimo continua valendo).
    const texto = (v: string | null | undefined) => (v == null ? null : v.trim() === '' ? '' : v.trim());
    const final = {
      nome: edicao.nome !== undefined ? texto(edicao.nome) : pacote.nome,
      cep: edicao.cep !== undefined ? (edicao.cep == null ? '' : edicao.cep.replace(/[\s.-]/g, '')) : pacote.cep,
      logradouro: edicao.logradouro !== undefined ? texto(edicao.logradouro) : pacote.logradouro,
      numero: edicao.numero !== undefined ? texto(edicao.numero) : pacote.numero,
      complemento: edicao.complemento !== undefined ? texto(edicao.complemento) || null : pacote.complemento,
      bairro: edicao.bairro !== undefined ? texto(edicao.bairro) || null : pacote.bairro,
      cidade: edicao.cidade !== undefined ? texto(edicao.cidade) : pacote.cidade,
      uf: edicao.uf !== undefined ? texto(edicao.uf)?.toUpperCase() ?? null : pacote.uf,
    };
    const campoFake = (valor: string | null) => ({ valor, duvida: false, fonte: 'CARTEIRO' as const });
    const minimo = avaliarMinimo({
      codigo: campoFake(pacote.codigo),
      nome: campoFake(final.nome),
      whatsapp: campoFake(null),
      cep: campoFake(final.cep),
      logradouro: campoFake(final.logradouro),
      numero: campoFake(final.numero),
      complemento: campoFake(final.complemento),
      bairro: campoFake(final.bairro),
      cidade: campoFake(final.cidade),
      uf: campoFake(final.uf),
    });
    if (!minimo.ok) {
      const code = minimo.motivos[0];
      throw new AppError(400, 'Dados incompletos', { code });
    }

    let novoWhatsapp: string | null | undefined;
    let telefoneOutro: string | null | undefined;
    if (edicao.whatsapp !== undefined) {
      try {
        const t = classificarTelefone(edicao.whatsapp);
        novoWhatsapp = t.whatsappE164;
        telefoneOutro = t.outro ?? undefined;
      } catch {
        throw new AppError(400, 'WhatsApp inválido', { code: 'whatsapp_invalido' });
      }
    }

    const { avisar, atualizado } = await prisma.$transaction(async (tx) => {
      await travarCodigo(tx, pacote.codigo, pacote.data);
      const atual = await tx.pacoteDia.findUnique({ where: { id: pacoteId } });
      if (!atual) throw new AppError(404, 'Pacote não encontrado');
      const statusCarga = (await statusCargaTravada(tx, atual.cargaId)) ?? 'CARREGADO';

      const dados: Record<string, unknown> = {};
      const mudancas: Record<string, { antes: string | null; depois: string | null }> = {};
      for (const [k, v] of Object.entries(final) as Array<[keyof typeof final, string | null]>) {
        const antes = (atual[k] as string | null) ?? null;
        const depois = v === '' ? null : v;
        if (antes !== depois) {
          dados[k] = depois;
          mudancas[k] = { antes, depois };
        }
      }
      let whatsappMudou = false;
      if (novoWhatsapp !== undefined && !mesmoNumero(atual.whatsappE164, novoWhatsapp)) {
        dados.whatsappE164 = novoWhatsapp;
        mudancas.whatsapp = { antes: atual.whatsappE164, depois: novoWhatsapp };
        whatsappMudou = true;
        if (novoWhatsapp && atual.status === 'SEM_WHATSAPP') dados.status = 'AGUARDANDO_LIBERACAO';
        if (!novoWhatsapp && atual.status === 'AGUARDANDO_LIBERACAO') dados.status = 'SEM_WHATSAPP';
      }
      if (telefoneOutro !== undefined && telefoneOutro !== atual.telefoneOutro) dados.telefoneOutro = telefoneOutro;

      const atualizadoTx = await tx.pacoteDia.update({ where: { id: pacoteId }, data: dados as Prisma.PacoteDiaUncheckedUpdateInput });
      await tx.eventoPacote.create({
        data: { pacoteId, tipo: 'CAPTURA_ATUALIZADO', dados: json({ fonte: 'CARTEIRO', carteiroId: carteiro.id, campos: mudancas }) },
      });
      if (whatsappMudou) {
        await tx.eventoPacote.create({
          data: { pacoteId, tipo: 'WHATSAPP_ALTERADO', dados: json({ antes: atual.whatsappE164, depois: novoWhatsapp ?? null }) },
        });
      }
      return { avisar: whatsappMudou && novoWhatsapp && cargaLiberada(statusCarga) ? [pacoteId] : [], atualizado: atualizadoTx };
    }, OPCOES_TX);

    await avisarAposCommit(avisar);
    return atualizado;
  }
}

export const conciliacaoService = new ConciliacaoService();
