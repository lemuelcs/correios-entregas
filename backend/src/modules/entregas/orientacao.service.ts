/**
 * Máquina de estados da orientação (PRD › Business Rules › Orientação;
 * TechSpec › Core Interfaces):
 *
 *   AGUARDANDO_CONFIRMACAO → ENVIADA → VISTA → FEITA | NAO_FOI_POSSIVEL
 *   GUARDADA (próximo dia de entrega) → reaplicada na próxima lista → ENVIADA → …
 *   qualquer vigente → SUBSTITUIDA (uma mais recente do mesmo código)
 *
 * Regras: uma única orientação vigente por código; texto ≤ 300 sem CPF nem
 * telefone; pacote ENTREGUE não aceita orientação nova; a mensagem ao carteiro
 * sai pelo Prosio com os botões `CE_CT:<id>.VI|FEITO|NAO`,
 * `Idempotency-Key=orient:<id>` e `reference=o:<id>`.
 *
 * Reutilizado pela task_06 (resumo ao carteiro, reaplicação na confirmação).
 */
import type { Carteiro, EstadoOrientacao, Orientacao, OrigemOrientacao, Prisma, TipoOrientacao } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { mascararTelefone, normalizarTelefone } from '../../shared/utils/telefone';
import { prosioClient as prosioPadrao, resolverCanal, type CanalResolvido, type ProsioClient } from '../../integrations/prosio/prosio.client';
import type { BotaoMensagem } from '../../integrations/prosio/prosio.types';
import { classificarEvento } from '../../integrations/seu-rastreio/classificacao';
import { hojeBrasilia } from './datas';
import { proximoDiaDeEntrega } from './calendario';
import { avancarStatusPacote } from './status';
import { cargaInternos } from './carga.service';
import { registrarEvento, escalonarPacote, sinalizarOrientacao, sinalizarPacote } from './sinais';
import { orientacoesTotal } from './metricas';
import {
  LIMITE_TEXTO_ORIENTACAO,
  MOTIVOS_NAO_FOI_POSSIVEL,
  botoesMotivos,
  botoesOrientacaoCarteiro,
  mensagemNaoTentarHoje,
  mensagemOrientacaoCarteiro,
  removerDadosSensiveis,
  textosCarteiro,
  textosDestinatario,
  type MotivoNaoFoiPossivel,
} from './textos';
import { escolherCarteiroDoDia } from './carteiro-do-dia';

export type { TipoOrientacao } from '@prisma/client';

export interface NovaOrientacao {
  pacoteId: string;
  tipo: TipoOrientacao;
  /** ≤ 300 caracteres; CPF, telefone e e-mail são removidos. */
  texto: string;
  pontoRetiradaId?: string;
  vizinhoNome?: string;
  vizinhoCasa?: string;
  origem: OrigemOrientacao;
  criadaPorId?: string;
  /** Guarda para o próximo dia de entrega em vez de enviar hoje. */
  valeParaAmanha?: boolean;
  /**
   * Só para `AMANHA`/guardadas: avisa o carteiro de hoje ("Não tentar hoje").
   * Padrão: `true` para `AMANHA` quando a carga do pacote é de hoje e já foi
   * liberada; `false` nos demais casos. A resposta tardia passa `false`.
   */
  avisarCarteiroHoje?: boolean;
}

export type RespostaDoCarteiro = 'VI' | 'FEITO' | 'NAO' | MotivoNaoFoiPossivel;

export interface OrientacaoLida extends Orientacao {
  pontoDesativado: boolean;
}

export interface OrientacaoService {
  registrar(o: NovaOrientacao): Promise<Orientacao>;
  registrarRespostaCarteiro(orientacaoId: string, telefone: string, resposta: RespostaDoCarteiro): Promise<string>;
  reaplicarGuardadas(cargaId: string): Promise<number>;
}

export interface DepsOrientacao {
  prosio?: ProsioClient;
  agora?: () => Date;
}

/** Estados que contam como "vigente" para a substituição (a pendente só vale depois de confirmada). */
const NAO_VIGENTES: EstadoOrientacao[] = ['SUBSTITUIDA', 'AGUARDANDO_CONFIRMACAO'];
const RESPONDIVEIS: EstadoOrientacao[] = ['ENVIADA', 'VISTA'];

// ——— Telefone de quem tocou ————————————————————————————————————————————

function normalizarOuNull(t: string | null | undefined): string | null {
  if (!t) return null;
  try {
    return normalizarTelefone(t);
  } catch {
    return null;
  }
}

/** Sem o nono dígito (o jid do WhatsApp pode vir sem ele). */
function semNonoDigito(e164: string): string {
  return e164.length === 14 && e164[5] === '9' ? `${e164.slice(0, 5)}${e164.slice(6)}` : e164;
}

/** Compara dois telefones BR tolerando máscara, `+55` ausente e o nono dígito. */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarOuNull(a);
  const nb = normalizarOuNull(b);
  if (!na || !nb) return false;
  return na === nb || semNonoDigito(na) === semNonoDigito(nb);
}

export function mascarar(t: string | null | undefined): string {
  return t ? mascararTelefone(t) : '';
}

// ——— Leitura do pacote com o contexto ——————————————————————————————————

const INCLUDE_PACOTE = {
  carga: { include: { distrito: { include: { unidade: { include: { canalProsio: true } } } } } },
} satisfies Prisma.PacoteDiaInclude;

export type PacoteComContexto = Prisma.PacoteDiaGetPayload<{ include: typeof INCLUDE_PACOTE }>;

export async function carregarPacote(pacoteId: string): Promise<PacoteComContexto | null> {
  return prisma.pacoteDia.findUnique({ where: { id: pacoteId }, include: INCLUDE_PACOTE });
}

/** Canal Prosio da unidade do pacote (credenciais decifradas), ou `null`. */
export function canalDoPacote(pacote: PacoteComContexto): { canal: CanalResolvido; unidadeRef?: string } | null {
  const unidade = pacote.carga.distrito.unidade;
  const c = unidade.canalProsio;
  if (!c || !c.ativo) return null;
  const canal = resolverCanal(c);
  return { canal, ...(canal.compartilhado && unidade.prosioUnidadeRef ? { unidadeRef: unidade.prosioUnidadeRef } : {}) };
}

/** Carteiro do dia: snapshot da liberação, senão a escala do dia, senão o padrão do distrito. */
export async function carteiroDoDia(pacote: PacoteComContexto): Promise<Carteiro | null> {
  const carga = pacote.carga;
  let id = carga.carteiroId;
  if (!id) {
    const escala = await prisma.escalaDistrito.findUnique({
      where: { distritoId_data: { distritoId: carga.distritoId, data: carga.data } },
    });
    id = escolherCarteiroDoDia({ escala: escala?.carteiroId, padrao: carga.distrito.carteiroPadraoId });
  }
  return id ? prisma.carteiro.findUnique({ where: { id } }) : null;
}

/** Valida e higieniza o texto: sem CPF/telefone, não vazio, ≤ 300. */
export function validarTextoOrientacao(texto: string | null | undefined): string {
  const t = removerDadosSensiveis(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) throw new AppError(400, 'orientacao_vazia');
  if (t.length > LIMITE_TEXTO_ORIENTACAO) throw new AppError(400, 'orientacao_longa', { max: LIMITE_TEXTO_ORIENTACAO });
  return t;
}

// ——— Serviço ————————————————————————————————————————————————————————————

export class OrientacaoServiceImpl implements OrientacaoService {
  private readonly prosio: ProsioClient;
  private readonly agora: () => Date;

  constructor(deps: DepsOrientacao = {}) {
    this.prosio = deps.prosio ?? prosioPadrao;
    this.agora = deps.agora ?? (() => new Date());
  }

  /** Registra uma orientação confirmada: substitui a vigente e decide entre enviar ao carteiro e guardar. */
  async registrar(o: NovaOrientacao): Promise<Orientacao> {
    return this.efetivar(o);
  }

  /**
   * Cria uma orientação `AGUARDANDO_CONFIRMACAO` (confirmação de ponto único
   * ou "vale para amanhã?"). Não substitui a vigente; pendentes antigas do
   * mesmo pacote são descartadas. `valeAPartirDe` preenchido = resposta tardia.
   */
  async criarPendente(o: NovaOrientacao, opcoes: { valeAPartirDe?: Date } = {}): Promise<Orientacao> {
    const texto = validarTextoOrientacao(o.texto);
    const pacote = await carregarPacote(o.pacoteId);
    if (!pacote) throw new AppError(404, 'nao_encontrado');
    if (pacote.status === 'ENTREGUE') throw new AppError(409, 'pacote_entregue');
    return prisma.$transaction(async (tx) => {
      await tx.orientacao.deleteMany({ where: { pacoteId: pacote.id, estado: 'AGUARDANDO_CONFIRMACAO' } });
      return tx.orientacao.create({
        data: {
          codigo: pacote.codigo,
          pacoteId: pacote.id,
          tipo: o.tipo,
          texto,
          pontoRetiradaId: o.pontoRetiradaId ?? null,
          vizinhoNome: o.vizinhoNome ?? null,
          vizinhoCasa: o.vizinhoCasa ?? null,
          estado: 'AGUARDANDO_CONFIRMACAO',
          origem: o.origem,
          criadaPorId: o.criadaPorId ?? null,
          valeAPartirDe: opcoes.valeAPartirDe ?? null,
          criadaEm: new Date(),
        },
      });
    });
  }

  /** Confirma uma pendente (CE_SN SIM): passa a valer como uma orientação registrada. */
  async confirmarPendente(orientacaoId: string, opcoes: { valeParaAmanha?: boolean; avisarCarteiroHoje?: boolean } = {}): Promise<Orientacao> {
    const p = await prisma.orientacao.findUnique({ where: { id: orientacaoId } });
    if (!p || p.estado !== 'AGUARDANDO_CONFIRMACAO' || !p.pacoteId) throw new AppError(409, 'orientacao_nao_pendente');
    return this.efetivar(
      {
        pacoteId: p.pacoteId,
        tipo: p.tipo,
        texto: p.texto,
        pontoRetiradaId: p.pontoRetiradaId ?? undefined,
        vizinhoNome: p.vizinhoNome ?? undefined,
        vizinhoCasa: p.vizinhoCasa ?? undefined,
        origem: p.origem,
        criadaPorId: p.criadaPorId ?? undefined,
        valeParaAmanha: opcoes.valeParaAmanha,
        avisarCarteiroHoje: opcoes.avisarCarteiroHoje,
      },
      p.id,
    );
  }

  /** Descarta uma pendente (CE_SN NAO): nada é guardado nem enviado. */
  async descartarPendente(orientacaoId: string): Promise<boolean> {
    const { count } = await prisma.orientacao.deleteMany({ where: { id: orientacaoId, estado: 'AGUARDANDO_CONFIRMACAO' } });
    return count > 0;
  }

  private async efetivar(o: NovaOrientacao, pendenteId?: string): Promise<Orientacao> {
    const texto = validarTextoOrientacao(o.texto);
    const pacote = await carregarPacote(o.pacoteId);
    if (!pacote) throw new AppError(404, 'nao_encontrado');
    if (pacote.status === 'ENTREGUE') throw new AppError(409, 'pacote_entregue');

    const agora = this.agora();
    const hoje = hojeBrasilia(agora);
    const guardar = o.valeParaAmanha === true || o.tipo === 'AMANHA';
    const cargaDeHojeEmRota = pacote.carga.status !== 'CARREGADO' && pacote.carga.data.getTime() === hoje.getTime();
    const avisarHoje = guardar ? (o.avisarCarteiroHoje ?? (o.tipo === 'AMANHA' && cargaDeHojeEmRota)) : true;
    const carteiro = avisarHoje ? await carteiroDoDia(pacote) : null;

    const { orientacao, atualizada } = await prisma.$transaction(async (tx) => {
      // Serializa registros concorrentes do mesmo pacote (a mais recente vale).
      await tx.$queryRaw`SELECT "id" FROM "pacotes_dia" WHERE "id" = ${pacote.id} FOR UPDATE`;
      const anteriores = await tx.orientacao.findMany({
        where: { codigo: pacote.codigo, estado: { notIn: NAO_VIGENTES }, ...(pendenteId ? { id: { not: pendenteId } } : {}) },
        select: { id: true, pacoteId: true },
      });
      if (anteriores.length > 0) {
        await tx.orientacao.updateMany({ where: { id: { in: anteriores.map((a) => a.id) } }, data: { estado: 'SUBSTITUIDA' } });
      }
      const dados = {
        codigo: pacote.codigo,
        pacoteId: pacote.id,
        tipo: o.tipo,
        texto,
        pontoRetiradaId: o.pontoRetiradaId ?? null,
        vizinhoNome: o.vizinhoNome ?? null,
        vizinhoCasa: o.vizinhoCasa ?? null,
        estado: (guardar ? 'GUARDADA' : 'ENVIADA') as EstadoOrientacao,
        origem: o.origem,
        criadaPorId: o.criadaPorId ?? null,
        carteiroId: carteiro?.id ?? null,
        valeAPartirDe: guardar ? proximoDiaDeEntrega(hoje) : null,
        // Lido depois do lock: a ordem de `criadaEm` é a ordem em que as orientações passaram a valer.
        criadaEm: new Date(),
      };
      const orientacao = pendenteId
        ? await tx.orientacao.update({ where: { id: pendenteId }, data: dados })
        : await tx.orientacao.create({ data: dados });

      const atual = await tx.pacoteDia.findUniqueOrThrow({ where: { id: pacote.id }, select: { status: true } });
      const avanco = avancarStatusPacote(atual.status, { tipo: 'interacao' });
      if (avanco.mudou) await tx.pacoteDia.update({ where: { id: pacote.id }, data: { status: avanco.status } });
      await registrarEvento(
        pacote.id,
        'orientacao',
        { orientacaoId: orientacao.id, tipo: o.tipo, origem: o.origem, estado: orientacao.estado, substituidas: anteriores.length },
        tx,
      );
      return { orientacao, atualizada: anteriores.some((a) => a.pacoteId === pacote.id) };
    });

    orientacoesTotal.inc({ tipo: o.tipo, origem: o.origem });
    logger.info(
      { pacoteId: pacote.id, cargaId: pacote.cargaId, orientacaoId: orientacao.id, tipo: o.tipo, origem: o.origem, estado: orientacao.estado },
      'entregas.orientacao',
    );

    if (orientacao.estado === 'ENVIADA') {
      await this.enviarAoCarteiro(pacote, orientacao, carteiro, {
        body: mensagemOrientacaoCarteiro({ codigo: pacote.codigo, nomeDestinatario: pacote.nome, texto, atualizada }),
        buttons: botoesOrientacaoCarteiro(orientacao.id),
      });
    } else if (avisarHoje) {
      await this.enviarAoCarteiro(pacote, orientacao, carteiro, {
        body: mensagemNaoTentarHoje({ codigo: pacote.codigo, nomeDestinatario: pacote.nome, atualizada, dia: orientacao.valeAPartirDe ?? proximoDiaDeEntrega(hoje) }),
      });
    }
    return (await prisma.orientacao.findUnique({ where: { id: orientacao.id } })) ?? orientacao;
  }

  /** Envia a orientação ao carteiro. Sem WhatsApp → sinal `nao_entregue_carteiro`, sem chamar o Prosio. */
  private async enviarAoCarteiro(
    pacote: PacoteComContexto,
    orientacao: Orientacao,
    carteiro: Carteiro | null,
    msg: { body: string; buttons?: BotaoMensagem[] },
  ): Promise<void> {
    if (!carteiro?.whatsappE164) {
      await sinalizarOrientacao(orientacao.id, 'nao_entregue_carteiro');
      await sinalizarPacote(pacote.id, 'nao_entregue_carteiro');
      logger.warn({ pacoteId: pacote.id, orientacaoId: orientacao.id, carteiroId: carteiro?.id ?? null }, 'entregas.orientacao carteiro sem WhatsApp');
      return;
    }
    const alvo = canalDoPacote(pacote);
    if (!alvo) {
      await sinalizarOrientacao(orientacao.id, 'falha_envio_carteiro');
      logger.warn({ pacoteId: pacote.id, orientacaoId: orientacao.id }, 'entregas.orientacao unidade sem canal Prosio ativo');
      return;
    }
    try {
      await this.prosio.enviarMensagem(alvo.canal, {
        to: carteiro.whatsappE164,
        body: msg.body,
        reference: `o:${orientacao.id}`,
        idempotencyKey: `orient:${orientacao.id}`,
        ...(msg.buttons ? { buttons: msg.buttons } : {}),
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
    } catch (err) {
      await sinalizarOrientacao(orientacao.id, 'falha_envio_carteiro');
      logger.error(
        { pacoteId: pacote.id, orientacaoId: orientacao.id, canalId: alvo.canal.id, telefone: mascarar(carteiro.whatsappE164), erro: (err as Error).message },
        'entregas.orientacao falha ao enviar ao carteiro',
      );
    }
  }

  /** Vi / Feito / Não foi possível (com motivo) — US-022. Devolve o texto de resposta ao carteiro. */
  async registrarRespostaCarteiro(orientacaoId: string, telefone: string, resposta: RespostaDoCarteiro): Promise<string> {
    const o = await prisma.orientacao.findUnique({
      where: { id: orientacaoId },
      include: { carteiro: true, pontoRetirada: true },
    });
    if (!o || !o.carteiro || !mesmoTelefone(o.carteiro.whatsappE164, telefone)) {
      logger.info({ orientacaoId, telefone: mascarar(telefone) }, 'entregas.orientacao resposta de número que não é o carteiro');
      return textosCarteiro.neutra;
    }
    if (o.estado === 'SUBSTITUIDA') return textosCarteiro.substituida;
    const agora = this.agora();

    const transitar = async (de: EstadoOrientacao[], para: EstadoOrientacao, gravar: string): Promise<boolean> => {
      const { count } = await prisma.orientacao.updateMany({
        where: { id: o.id, estado: { in: de } },
        data: { estado: para, respostaCarteiro: gravar, respondidoEm: agora },
      });
      if (count > 0 && o.pacoteId) {
        await registrarEvento(o.pacoteId, 'resposta_carteiro', { orientacaoId: o.id, resposta: gravar, estado: para });
        logger.info({ pacoteId: o.pacoteId, orientacaoId: o.id, de: o.estado, para }, 'entregas.orientacao');
      }
      return count > 0;
    };

    if (resposta === 'VI') {
      if (o.estado === 'ENVIADA') await transitar(['ENVIADA'], 'VISTA', 'VI');
      return o.estado === 'ENVIADA' || o.estado === 'VISTA' ? textosCarteiro.vista : textosCarteiro.jaRespondida;
    }

    if (resposta === 'FEITO') {
      if (o.estado === 'FEITA') return textosCarteiro.feita;
      if (!RESPONDIVEIS.includes(o.estado)) return textosCarteiro.jaRespondida;
      const mudou = await transitar(RESPONDIVEIS, 'FEITA', 'FEITO');
      if (mudou && o.pacoteId) {
        const pacote = await prisma.pacoteDia.findUnique({ where: { id: o.pacoteId } });
        if (pacote && (pacote.status === 'INSUCESSO' || classificarEvento(pacote.rastreioDescricao) === 'INSUCESSO')) {
          await registrarEvento(pacote.id, 'divergencia', { orientacaoId: o.id, carteiro: 'FEITO', rastreio: pacote.rastreioDescricao });
          await sinalizarPacote(pacote.id, 'divergencia');
          logger.warn({ pacoteId: pacote.id, orientacaoId: o.id }, 'entregas.orientacao divergência: feito × rastreio de insucesso');
        }
      }
      return textosCarteiro.feita;
    }

    if (resposta === 'NAO') {
      if (!RESPONDIVEIS.includes(o.estado)) return textosCarteiro.jaRespondida;
      await this.enviarMotivos(o);
      return textosCarteiro.perguntaMotivo;
    }

    if (!(MOTIVOS_NAO_FOI_POSSIVEL as readonly string[]).includes(resposta)) return textosCarteiro.neutra;
    if (!RESPONDIVEIS.includes(o.estado)) return textosCarteiro.jaRespondida;
    const mudou = await transitar(RESPONDIVEIS, 'NAO_FOI_POSSIVEL', resposta);
    if (mudou && o.pacoteId) {
      await sinalizarPacote(o.pacoteId, 'nao_foi_possivel');
      if (resposta === 'FECHADO' && o.tipo === 'LOCKER') await this.lockerFechado(o.pacoteId, o.pontoRetirada?.nome ?? null, o.id);
    }
    return textosCarteiro.naoFoiPossivel(resposta);
  }

  private async enviarMotivos(o: Orientacao & { carteiro: Carteiro | null }): Promise<void> {
    if (!o.pacoteId || !o.carteiro?.whatsappE164) return;
    const pacote = await carregarPacote(o.pacoteId);
    const alvo = pacote && canalDoPacote(pacote);
    if (!alvo) return;
    try {
      await this.prosio.enviarMensagem(alvo.canal, {
        to: o.carteiro.whatsappE164,
        body: textosCarteiro.perguntaMotivo,
        reference: `o:${o.id}`,
        idempotencyKey: `motivos:${o.id}`,
        buttons: botoesMotivos(o.id),
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
    } catch (err) {
      logger.error({ orientacaoId: o.id, erro: (err as Error).message }, 'entregas.orientacao falha ao enviar motivos');
    }
  }

  /** Locker fechado/cheio: avisa o destinatário que a encomenda segue para a unidade e escalona (US-016.EC-3). */
  private async lockerFechado(pacoteId: string, nomePonto: string | null, orientacaoId: string): Promise<void> {
    const pacote = await carregarPacote(pacoteId);
    if (!pacote) return;
    await escalonarPacote(pacote.id, 'locker_fechado', { orientacaoId });
    const alvo = canalDoPacote(pacote);
    if (!alvo || !pacote.whatsappE164) return;
    try {
      await this.prosio.enviarMensagem(alvo.canal, {
        to: pacote.whatsappE164,
        body: textosDestinatario.lockerFechado(pacote.codigo, nomePonto),
        reference: pacote.id,
        idempotencyKey: `locker-fechado:${orientacaoId}`,
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
    } catch (err) {
      logger.error({ pacoteId, erro: (err as Error).message }, 'entregas.orientacao falha ao avisar destinatário (locker fechado)');
    }
  }

  /** Liga as orientações `GUARDADA` dos códigos da carga aos pacotes dela (mesmo em outro distrito). */
  async reaplicarGuardadas(cargaId: string): Promise<number> {
    const carga = await prisma.cargaDistrito.findUnique({
      where: { id: cargaId },
      include: { pacotes: { select: { id: true, codigo: true } } },
    });
    if (!carga) throw new AppError(404, 'nao_encontrado');
    return prisma.$transaction((tx) => cargaInternos.vincularOrientacoesGuardadas(tx, carga.pacotes, carga.data));
  }

  /** Orientação vigente de um código (inclui `GUARDADA` de dias anteriores); `null` se o código já foi entregue. */
  async vigentePorCodigo(codigo: string): Promise<Orientacao | null> {
    const entregue = await prisma.pacoteDia.findFirst({ where: { codigo, status: 'ENTREGUE' }, select: { id: true } });
    if (entregue) return null;
    return prisma.orientacao.findFirst({
      where: { codigo, estado: { notIn: NAO_VIGENTES } },
      orderBy: { criadaEm: 'desc' },
    });
  }

  /** Leitura com `pontoDesativado` (o ponto foi desativado depois da orientação). */
  async obter(orientacaoId: string): Promise<OrientacaoLida | null> {
    const o = await prisma.orientacao.findUnique({ where: { id: orientacaoId }, include: { pontoRetirada: true } });
    if (!o) return null;
    const { pontoRetirada, ...resto } = o;
    return { ...resto, pontoDesativado: !!pontoRetirada && !pontoRetirada.ativo };
  }
}

export const orientacaoService = new OrientacaoServiceImpl();
