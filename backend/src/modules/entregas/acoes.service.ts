/**
 * Ações de botão do Prosio (ADR-014): `CE_OP`, `CE_PT`, `CE_SN` e `CE_CT`.
 *
 * Duas camadas:
 * - decisões puras (`decidirOpcao`, `decidirPonto`, `decidirRespostaTardia`),
 *   testadas sem banco;
 * - `AcoesService.executar`, que carrega o contexto, aplica a decisão e
 *   devolve SEMPRE um texto ao usuário (nunca erro HTTP por regra de negócio).
 *
 * Toque de número que não é o do pacote (ou o carteiro da orientação) →
 * resposta neutra, sem efeito.
 */
import { createHash } from 'crypto';
import type { Orientacao, PontoRetirada, StatusPacote, TipoOrientacao } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { ProsioError, prosioClient as prosioPadrao, type ProsioClient } from '../../integrations/prosio/prosio.client';
import type { BotaoMensagem, MotivoMediacao } from '../../integrations/prosio/prosio.types';
import type { RastreioClient, ResultadoRastreio } from '../../integrations/seu-rastreio/rastreio.client';
import { hojeBrasilia } from './datas';
import { formatarHora, mesmoDiaBrasilia, proximoDiaDeEntrega } from './calendario';
import { avancarStatusPacote } from './status';
import { consultarEAplicar, instanteDoEvento, type ConsultaRastreio } from './rastreio.service';
import { escalonarPacote, registrarEvento, sinalizarPacote } from './sinais';
import {
  OrientacaoServiceImpl,
  canalDoPacote,
  carregarPacote,
  mascarar,
  mesmoTelefone,
  type NovaOrientacao,
  type PacoteComContexto,
  type RespostaDoCarteiro,
} from './orientacao.service';
import {
  BOTOES_SIM_NAO,
  MOTIVOS_NAO_FOI_POSSIVEL,
  botoesSubLista,
  corpoSubLista,
  textoOrientacaoAmanha,
  textoOrientacaoPonto,
  textosCarteiro,
  textosDestinatario,
  type OpcaoAviso,
  type PontoTexto,
  type TipoPontoTexto,
} from './textos';

export const PREFIXOS = ['CE_OP', 'CE_PT', 'CE_SN', 'CE_CT'] as const;
export type Prefixo = (typeof PREFIXOS)[number];

/** Um código com este número de dias anteriores em `INSUCESSO` não aceita "amanhã" (US-013.EC-4). */
export const LIMITE_INSUCESSOS = 2;

// ——— Decisões puras ————————————————————————————————————————————————————

export type DecisaoOpcao =
  | { acao: 'ja_entregue'; mensagem: string; escalonar: false }
  | { acao: 'limite_tentativas'; mensagem: string; escalonar: true }
  | { acao: 'amanha'; escalonar: false }
  | { acao: 'sem_pontos'; mensagem: string; escalonar: false }
  | { acao: 'confirmar_ponto'; ponto: PontoTexto; escalonar: false }
  | { acao: 'sublista'; tipo: TipoPontoTexto; pontos: PontoTexto[]; escalonar: false }
  | { acao: 'mediacao'; motivoRelatado: MotivoMediacao; pergunta: string; escalonar: false }
  | { acao: 'atendimento_humano'; mensagem: string; escalonar: true; motivo: string };

export interface EntradaOpcao {
  opcao: OpcaoAviso;
  codigo: string;
  pacoteStatus: StatusPacote;
  /** Dias anteriores do código em `INSUCESSO`. */
  insucessosAnteriores: number;
  /** Pontos ativos da unidade do tipo da opção (só AGENCIA/LOCKER). */
  pontosAtivos?: PontoTexto[];
  mediacaoAtiva: boolean;
  temCaso: boolean;
}

export function decidirOpcao(e: EntradaOpcao): DecisaoOpcao {
  if (e.pacoteStatus === 'ENTREGUE') return { acao: 'ja_entregue', mensagem: textosDestinatario.jaEntregue, escalonar: false };
  switch (e.opcao) {
    case 'AMANHA':
      if (e.insucessosAnteriores >= LIMITE_INSUCESSOS) {
        return { acao: 'limite_tentativas', mensagem: textosDestinatario.limiteTentativas(e.codigo), escalonar: true };
      }
      return { acao: 'amanha', escalonar: false };
    case 'AGENCIA':
    case 'LOCKER': {
      const pontos = e.pontosAtivos ?? [];
      if (pontos.length === 0) return { acao: 'sem_pontos', mensagem: textosDestinatario.semPontos(e.opcao), escalonar: false };
      if (pontos.length === 1) return { acao: 'confirmar_ponto', ponto: pontos[0], escalonar: false };
      return { acao: 'sublista', tipo: e.opcao, pontos, escalonar: false };
    }
    case 'VIZINHO':
    case 'OUTRA': {
      if (!e.mediacaoAtiva || !e.temCaso) {
        return {
          acao: 'atendimento_humano',
          mensagem: textosDestinatario.atendimentoHumano,
          escalonar: true,
          motivo: e.mediacaoAtiva ? 'sem_caso_mediacao' : 'mediacao_desligada',
        };
      }
      return e.opcao === 'VIZINHO'
        ? { acao: 'mediacao', motivoRelatado: 'entrega_indireta', pergunta: textosDestinatario.perguntaVizinho, escalonar: false }
        : { acao: 'mediacao', motivoRelatado: 'outro', pergunta: textosDestinatario.perguntaOutra, escalonar: false };
    }
  }
}

export type DecisaoPonto =
  | { acao: 'escolher'; ponto: PontoTexto }
  | { acao: 'indisponivel'; mensagem: string; pontos: PontoTexto[] }
  | { acao: 'sem_pontos'; mensagem: string };

/** `CE_PT`: ponto escolhido ativo → escolha; inativo → aviso e sub-lista só com os ativos (US-015.EC-2). */
export function decidirPonto(ponto: (PontoTexto & { ativo: boolean }) | null, tipo: TipoPontoTexto, ativos: PontoTexto[]): DecisaoPonto {
  if (ponto && ponto.ativo) return { acao: 'escolher', ponto };
  const doTipo = ativos.filter((p) => p.tipo === tipo);
  if (doTipo.length === 0) return { acao: 'sem_pontos', mensagem: textosDestinatario.semPontos(tipo) };
  return { acao: 'indisponivel', mensagem: textosDestinatario.pontoIndisponivel(tipo), pontos: doTipo };
}

export type DecisaoTardia =
  | { acao: 'repassar' }
  | { acao: 'guardar'; hora: string | null; fonte: 'rastreio' | 'carteiro' }
  | { acao: 'entregue'; hora: string | null }
  | { acao: 'transferir'; motivo: 'divergencia' };

export interface EntradaTardia {
  rastreio: ConsultaRastreio;
  /** Última resposta do carteiro (FEITO ou motivo de "não foi possível") sobre o código. */
  ultimaRespostaCarteiro: { resposta: string; em: Date } | null;
  agora: Date;
}

/**
 * Resposta tardia (ADR-005, US-019):
 * - rastreio "entregue" → informa a entrega; com o carteiro dizendo "não foi possível" hoje → transfere;
 * - rastreio de insucesso hoje → guarda para o próximo dia (pede confirmação); com "feito" do carteiro → transfere;
 * - rastreio indisponível (ou sem tentativa) → vale a última resposta do carteiro de hoje; sem ela, repassa.
 */
export function decidirRespostaTardia(e: EntradaTardia): DecisaoTardia {
  const hoje = hojeBrasilia(e.agora);
  const carteiroHoje = e.ultimaRespostaCarteiro && mesmoDiaBrasilia(e.ultimaRespostaCarteiro.em, hoje) ? e.ultimaRespostaCarteiro : null;
  const carteiroInsucesso = !!carteiroHoje && (MOTIVOS_NAO_FOI_POSSIVEL as readonly string[]).includes(carteiroHoje.resposta);
  const carteiroFeito = carteiroHoje?.resposta === 'FEITO';

  const resultado: ResultadoRastreio | null = e.rastreio.ok ? e.rastreio.resultado : null;
  const instante = instanteDoEvento(resultado);
  const hora = instante ? formatarHora(instante) : null;

  if (resultado?.classificacao === 'ENTREGUE') {
    if (carteiroInsucesso) return { acao: 'transferir', motivo: 'divergencia' };
    return { acao: 'entregue', hora };
  }
  if (resultado?.classificacao === 'INSUCESSO' && (!instante || mesmoDiaBrasilia(instante, hoje))) {
    if (carteiroFeito) return { acao: 'transferir', motivo: 'divergencia' };
    return { acao: 'guardar', hora, fonte: 'rastreio' };
  }
  if (carteiroInsucesso) return { acao: 'guardar', hora: formatarHora(carteiroHoje!.em), fonte: 'carteiro' };
  return { acao: 'repassar' };
}

// ——— Execução ——————————————————————————————————————————————————————————

export interface ResultadoAcao {
  mensagem: string;
  /** Rótulo curto para log/métrica (ex.: `sublista`, `neutra`, `guardar`). */
  resultado: string;
}

export interface DepsAcoes {
  prosio?: ProsioClient;
  rastreio?: RastreioClient;
  agora?: () => Date;
}

const NEUTRA: ResultadoAcao = { mensagem: textosDestinatario.neutra, resultado: 'neutra' };

function lerAcao(acao: unknown): { id: string; valor: string } | null {
  if (typeof acao !== 'string') return null;
  const t = acao.trim();
  const i = t.lastIndexOf('.');
  if (i <= 0 || i === t.length - 1) return null;
  return { id: t.slice(0, i), valor: t.slice(i + 1).toUpperCase() };
}

function comoPontoTexto(p: PontoRetirada): PontoTexto & { ativo: boolean } {
  return { id: p.id, tipo: p.tipo, nome: p.nome, endereco: p.endereco, horario: p.horario, ativo: p.ativo };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AcoesService {
  private readonly prosio: ProsioClient;
  private readonly agora: () => Date;
  private readonly orientacoes: OrientacaoServiceImpl;
  private readonly rastreio?: RastreioClient;

  constructor(deps: DepsAcoes = {}) {
    this.prosio = deps.prosio ?? prosioPadrao;
    this.agora = deps.agora ?? (() => new Date());
    this.rastreio = deps.rastreio;
    this.orientacoes = new OrientacaoServiceImpl({ prosio: this.prosio, agora: this.agora });
  }

  async executar(canalId: string, prefixo: string, acao: unknown, telefone: string | undefined): Promise<ResultadoAcao> {
    const partes = lerAcao(acao);
    if (!partes || !telefone || !UUID.test(partes.id)) return NEUTRA;
    try {
      switch (prefixo) {
        case 'CE_OP':
          return await this.opcao(canalId, partes.id, partes.valor, telefone);
        case 'CE_PT':
          return await this.ponto(canalId, partes.id, partes.valor, telefone);
        case 'CE_SN':
          return await this.simNao(canalId, partes.id, partes.valor, telefone);
        case 'CE_CT':
          return await this.carteiro(canalId, partes.id, partes.valor, telefone);
        default:
          return NEUTRA;
      }
    } catch (err) {
      if (err instanceof AppError) {
        if (err.message === 'pacote_entregue') return { mensagem: textosDestinatario.jaEntregue, resultado: 'ja_entregue' };
        logger.warn({ canalId, prefixo, erro: err.message }, 'entregas.acao regra de negócio');
        return NEUTRA;
      }
      throw err;
    }
  }

  // ——— Contexto ———

  /** Pacote do canal cujo destinatário é `telefone`; senão `null` (resposta neutra). */
  private async pacoteDoDestinatario(canalId: string, pacoteId: string, telefone: string): Promise<PacoteComContexto | null> {
    if (!UUID.test(pacoteId)) return null;
    const pacote = await carregarPacote(pacoteId);
    if (!pacote || pacote.carga.distrito.unidade.canalProsioId !== canalId) return null;
    if (!mesmoTelefone(pacote.whatsappE164, telefone)) {
      logger.info({ pacoteId, canalId, telefone: mascarar(telefone) }, 'entregas.acao telefone divergente do pacote');
      return null;
    }
    return pacote;
  }

  private async marcarInteracao(pacote: PacoteComContexto, prefixo: string, valor: string): Promise<void> {
    const avanco = avancarStatusPacote(pacote.status, { tipo: 'interacao' });
    if (avanco.mudou) {
      await prisma.pacoteDia.updateMany({ where: { id: pacote.id, status: pacote.status }, data: { status: avanco.status } });
    }
    await registrarEvento(pacote.id, 'interacao', { prefixo, valor });
  }

  private async pontosAtivos(unidadeId: string, tipo?: TipoPontoTexto): Promise<PontoTexto[]> {
    const pontos = await prisma.pontoRetirada.findMany({
      where: { unidadeId, ativo: true, ...(tipo ? { tipo } : {}) },
      orderBy: [{ nome: 'asc' }],
      take: 10,
    });
    return pontos.map(comoPontoTexto);
  }

  private async enviarAoDestinatario(
    pacote: PacoteComContexto,
    msg: { body: string; idempotencyKey: string; buttons?: BotaoMensagem[]; sufixoRef: string },
  ): Promise<boolean> {
    const alvo = canalDoPacote(pacote);
    if (!alvo || !pacote.whatsappE164) return false;
    try {
      await this.prosio.enviarMensagem(alvo.canal, {
        to: pacote.whatsappE164,
        body: msg.body,
        reference: `p:${pacote.id}:${msg.sufixoRef}`,
        idempotencyKey: msg.idempotencyKey,
        ...(msg.buttons ? { buttons: msg.buttons } : {}),
        ...(alvo.unidadeRef ? { unidadeRef: alvo.unidadeRef } : {}),
      });
      return true;
    } catch (err) {
      logger.error({ pacoteId: pacote.id, canalId: alvo.canal.id, erro: (err as Error).message }, 'entregas.acao falha ao enviar ao destinatário');
      return false;
    }
  }

  /** Envia a sub-lista uma vez por conjunto de pontos (toque repetido não reenvia; IT-039). */
  private async enviarSubLista(pacote: PacoteComContexto, tipo: TipoPontoTexto, pontos: PontoTexto[]): Promise<void> {
    const assinatura = createHash('sha256').update(pontos.map((p) => p.id).sort().join(',')).digest('hex').slice(0, 16);
    const chave = `sublista:${pacote.id}:${tipo}:${assinatura}`;
    const jaEnviada = await prisma.eventoPacote.findFirst({
      where: { pacoteId: pacote.id, tipo: 'sublista', dados: { path: ['chave'], equals: chave } },
      select: { id: true },
    });
    if (jaEnviada) return;
    const ok = await this.enviarAoDestinatario(pacote, {
      body: corpoSubLista(tipo, pontos),
      buttons: botoesSubLista(pacote.id, pontos),
      idempotencyKey: chave,
      sufixoRef: 'sublista',
    });
    if (ok) await registrarEvento(pacote.id, 'sublista', { chave, tipo, pontos: pontos.map((p) => p.id) });
  }

  private async insucessosAnteriores(codigo: string, hoje: Date): Promise<number> {
    const dias = await prisma.pacoteDia.findMany({
      where: { codigo, status: 'INSUCESSO', data: { lt: hoje } },
      select: { data: true },
      distinct: ['data'],
    });
    return dias.length;
  }

  private async ultimaRespostaCarteiro(codigo: string): Promise<{ resposta: string; em: Date } | null> {
    const o = await prisma.orientacao.findFirst({
      where: { codigo, respondidoEm: { not: null }, respostaCarteiro: { in: ['FEITO', ...MOTIVOS_NAO_FOI_POSSIVEL] } },
      orderBy: { respondidoEm: 'desc' },
      select: { respostaCarteiro: true, respondidoEm: true },
    });
    return o?.respostaCarteiro && o.respondidoEm ? { resposta: o.respostaCarteiro, em: o.respondidoEm } : null;
  }

  // ——— CE_OP ———

  private async opcao(canalId: string, pacoteId: string, valor: string, telefone: string): Promise<ResultadoAcao> {
    const opcoes: OpcaoAviso[] = ['AMANHA', 'VIZINHO', 'AGENCIA', 'LOCKER', 'OUTRA'];
    if (!(opcoes as string[]).includes(valor)) return NEUTRA;
    const opcao = valor as OpcaoAviso;
    const pacote = await this.pacoteDoDestinatario(canalId, pacoteId, telefone);
    if (!pacote) return NEUTRA;
    const unidade = pacote.carga.distrito.unidade;
    const hoje = hojeBrasilia(this.agora());

    const decisao = decidirOpcao({
      opcao,
      codigo: pacote.codigo,
      pacoteStatus: pacote.status,
      insucessosAnteriores: opcao === 'AMANHA' ? await this.insucessosAnteriores(pacote.codigo, hoje) : 0,
      pontosAtivos: opcao === 'AGENCIA' || opcao === 'LOCKER' ? await this.pontosAtivos(unidade.id, opcao) : undefined,
      mediacaoAtiva: unidade.mediacaoAtiva,
      temCaso: !!pacote.mediacaoCaseId,
    });
    if (decisao.acao === 'ja_entregue') return { mensagem: decisao.mensagem, resultado: decisao.acao };
    await this.marcarInteracao(pacote, 'CE_OP', opcao);

    switch (decisao.acao) {
      case 'limite_tentativas':
        await escalonarPacote(pacote.id, 'limite_tentativas');
        return { mensagem: decisao.mensagem, resultado: decisao.acao };
      case 'sem_pontos':
        return { mensagem: decisao.mensagem, resultado: decisao.acao };
      case 'sublista':
        await this.enviarSubLista(pacote, decisao.tipo, decisao.pontos);
        return { mensagem: textosDestinatario.subListaEnviada(decisao.tipo), resultado: decisao.acao };
      case 'confirmar_ponto': {
        const vigente = await this.vigenteDoPacote(pacote.id);
        if (vigente && vigente.pontoRetiradaId === decisao.ponto.id && vigente.estado !== 'GUARDADA') {
          return { mensagem: textosDestinatario.confirmacaoPonto(decisao.ponto), resultado: 'repetida' };
        }
        const pendente = await this.orientacoes.criarPendente({
          pacoteId: pacote.id,
          tipo: decisao.ponto.tipo,
          texto: textoOrientacaoPonto(decisao.ponto),
          pontoRetiradaId: decisao.ponto.id,
          origem: 'BOTAO',
        });
        await this.enviarAoDestinatario(pacote, {
          body: textosDestinatario.confirmarPontoUnico(decisao.ponto),
          buttons: BOTOES_SIM_NAO(pendente.id),
          idempotencyKey: `confirmar:${pendente.id}`,
          sufixoRef: 'confirmar',
        });
        return { mensagem: textosDestinatario.confirmarPontoUnicoResposta, resultado: decisao.acao };
      }
      case 'mediacao': {
        const alvo = canalDoPacote(pacote);
        try {
          if (!alvo) throw new ProsioError(503, 'sem_canal', { tentavel: false });
          await this.prosio.atualizarFatosCaso(alvo.canal, pacote.mediacaoCaseId!, {
            motivoRelatado: decisao.motivoRelatado,
            perguntaAberta: decisao.pergunta,
          });
          await registrarEvento(pacote.id, 'fatos_atualizados', { caseId: pacote.mediacaoCaseId, motivoRelatado: decisao.motivoRelatado });
          return { mensagem: decisao.pergunta, resultado: decisao.acao };
        } catch (err) {
          const code = err instanceof ProsioError ? err.code : 'erro';
          logger.warn({ pacoteId: pacote.id, canalId, code }, 'entregas.acao mediação indisponível: atendimento humano');
          await escalonarPacote(pacote.id, 'mediacao_indisponivel', { code });
          return { mensagem: textosDestinatario.atendimentoHumano, resultado: 'atendimento_humano' };
        }
      }
      case 'atendimento_humano':
        await escalonarPacote(pacote.id, decisao.motivo, { opcao });
        return { mensagem: decisao.mensagem, resultado: decisao.acao };
      case 'amanha': {
        const vigente = await this.vigenteDoPacote(pacote.id);
        const proximo = proximoDiaDeEntrega(hoje);
        if (vigente && vigente.tipo === 'AMANHA' && vigente.estado === 'GUARDADA') {
          return { mensagem: textosDestinatario.confirmacaoAmanha(vigente.valeAPartirDe ?? proximo), resultado: 'repetida' };
        }
        return this.concluirEscolha(pacote, {
          pacoteId: pacote.id,
          tipo: 'AMANHA',
          texto: textoOrientacaoAmanha(proximo),
          origem: 'BOTAO',
        });
      }
    }
  }

  private async vigenteDoPacote(pacoteId: string): Promise<Orientacao | null> {
    return prisma.orientacao.findFirst({
      where: { pacoteId, estado: { notIn: ['SUBSTITUIDA', 'AGUARDANDO_CONFIRMACAO'] } },
      orderBy: { criadaEm: 'desc' },
    });
  }

  /**
   * Escolha confirmada pelo destinatário: consulta o rastreio (resposta tardia)
   * e registra, guarda (pedindo "vale para amanhã?"), informa a entrega ou transfere.
   */
  private async concluirEscolha(pacote: PacoteComContexto, nova: NovaOrientacao, pendenteId?: string): Promise<ResultadoAcao> {
    const agora = this.agora();
    const hoje = hojeBrasilia(agora);
    const rastreio = await consultarEAplicar(pacote, { prosio: this.prosio, ...(this.rastreio ? { rastreio: this.rastreio } : {}) });
    const decisao = decidirRespostaTardia({ rastreio, ultimaRespostaCarteiro: await this.ultimaRespostaCarteiro(pacote.codigo), agora });
    logger.info({ pacoteId: pacote.id, decisao: decisao.acao, rastreioOk: rastreio.ok }, 'entregas.acao resposta tardia');

    switch (decisao.acao) {
      case 'entregue':
        if (pendenteId) await this.orientacoes.descartarPendente(pendenteId);
        return { mensagem: textosDestinatario.entregueAs(decisao.hora), resultado: 'entregue' };
      case 'transferir':
        if (pendenteId) await this.orientacoes.descartarPendente(pendenteId);
        await sinalizarPacote(pacote.id, 'divergencia');
        await registrarEvento(pacote.id, 'divergencia', { fonte: 'resposta_tardia' });
        await escalonarPacote(pacote.id, 'divergencia_rastreio_carteiro');
        return { mensagem: textosDestinatario.atendimentoHumano, resultado: 'transferir' };
      case 'guardar': {
        if (pendenteId) await this.orientacoes.descartarPendente(pendenteId);
        const pendente = await this.orientacoes.criarPendente(nova, { valeAPartirDe: proximoDiaDeEntrega(hoje) });
        await this.enviarAoDestinatario(pacote, {
          body: textosDestinatario.perguntaValeParaAmanha,
          buttons: BOTOES_SIM_NAO(pendente.id),
          idempotencyKey: `amanha:${pendente.id}`,
          sufixoRef: 'amanha',
        });
        return { mensagem: textosDestinatario.tentativaSemSucesso(decisao.hora, pendente.texto), resultado: 'guardar' };
      }
      case 'repassar': {
        const o = pendenteId ? await this.orientacoes.confirmarPendente(pendenteId) : await this.orientacoes.registrar(nova);
        return { mensagem: await this.confirmacaoAoDestinatario(o), resultado: 'registrada' };
      }
    }
  }

  private async confirmacaoAoDestinatario(o: Orientacao): Promise<string> {
    if (o.tipo === 'AMANHA') return textosDestinatario.confirmacaoAmanha(o.valeAPartirDe ?? proximoDiaDeEntrega(hojeBrasilia(this.agora())));
    if (o.pontoRetiradaId && (o.tipo === 'AGENCIA' || o.tipo === 'LOCKER')) {
      const p = await prisma.pontoRetirada.findUnique({ where: { id: o.pontoRetiradaId } });
      if (p) return textosDestinatario.confirmacaoPonto(comoPontoTexto(p));
    }
    return textosDestinatario.confirmacaoOrientacao(o.texto);
  }

  // ——— CE_PT ———

  private async ponto(canalId: string, pacoteId: string, pontoId: string, telefone: string): Promise<ResultadoAcao> {
    const pacote = await this.pacoteDoDestinatario(canalId, pacoteId, telefone);
    if (!pacote) return NEUTRA;
    if (pacote.status === 'ENTREGUE') return { mensagem: textosDestinatario.jaEntregue, resultado: 'ja_entregue' };
    const unidadeId = pacote.carga.distrito.unidade.id;
    const bruto = UUID.test(pontoId.toLowerCase())
      ? await prisma.pontoRetirada.findUnique({ where: { id: pontoId.toLowerCase() } })
      : null;
    const ponto = bruto && bruto.unidadeId === unidadeId ? comoPontoTexto(bruto) : null;
    const tipo: TipoPontoTexto = ponto?.tipo ?? 'AGENCIA';
    await this.marcarInteracao(pacote, 'CE_PT', ponto ? ponto.tipo : 'desconhecido');

    const decisao = decidirPonto(ponto, tipo, ponto?.ativo ? [] : await this.pontosAtivos(unidadeId, tipo));
    if (decisao.acao === 'sem_pontos') return { mensagem: decisao.mensagem, resultado: 'sem_pontos' };
    if (decisao.acao === 'indisponivel') {
      await this.enviarSubLista(pacote, tipo, decisao.pontos);
      return { mensagem: decisao.mensagem, resultado: 'ponto_indisponivel' };
    }
    const vigente = await this.vigenteDoPacote(pacote.id);
    if (vigente && vigente.pontoRetiradaId === decisao.ponto.id && vigente.estado !== 'GUARDADA') {
      return { mensagem: textosDestinatario.confirmacaoPonto(decisao.ponto), resultado: 'repetida' };
    }
    return this.concluirEscolha(pacote, {
      pacoteId: pacote.id,
      tipo: decisao.ponto.tipo as TipoOrientacao,
      texto: textoOrientacaoPonto(decisao.ponto),
      pontoRetiradaId: decisao.ponto.id,
      origem: 'BOTAO',
    });
  }

  // ——— CE_SN ———

  private async simNao(canalId: string, orientacaoId: string, valor: string, telefone: string): Promise<ResultadoAcao> {
    if (valor !== 'SIM' && valor !== 'NAO') return NEUTRA;
    const o = await prisma.orientacao.findUnique({ where: { id: orientacaoId } });
    if (!o?.pacoteId) return NEUTRA;
    const pacote = await this.pacoteDoDestinatario(canalId, o.pacoteId, telefone);
    if (!pacote) return NEUTRA;
    if (o.estado !== 'AGUARDANDO_CONFIRMACAO') return { mensagem: textosDestinatario.jaRegistrada, resultado: 'repetida' };
    await this.marcarInteracao(pacote, 'CE_SN', valor);

    if (valor === 'NAO') {
      await this.orientacoes.descartarPendente(o.id);
      return { mensagem: textosDestinatario.negouConfirmacao, resultado: 'negada' };
    }
    if (o.valeAPartirDe) {
      // Resposta tardia confirmada: guarda para o próximo dia, sem avisar o carteiro de hoje.
      const guardada = await this.orientacoes.confirmarPendente(o.id, { valeParaAmanha: true, avisarCarteiroHoje: false });
      return { mensagem: textosDestinatario.guardadaParaAmanha(guardada.valeAPartirDe ?? o.valeAPartirDe), resultado: 'guardada' };
    }
    return this.concluirEscolha(
      pacote,
      {
        pacoteId: pacote.id,
        tipo: o.tipo,
        texto: o.texto,
        pontoRetiradaId: o.pontoRetiradaId ?? undefined,
        vizinhoNome: o.vizinhoNome ?? undefined,
        vizinhoCasa: o.vizinhoCasa ?? undefined,
        origem: o.origem,
      },
      o.id,
    );
  }

  // ——— CE_CT ———

  private async carteiro(canalId: string, orientacaoId: string, valor: string, telefone: string): Promise<ResultadoAcao> {
    const validos: string[] = ['VI', 'FEITO', 'NAO', ...MOTIVOS_NAO_FOI_POSSIVEL];
    if (!validos.includes(valor)) return { mensagem: textosCarteiro.neutra, resultado: 'neutra' };
    const o = await prisma.orientacao.findUnique({
      where: { id: orientacaoId },
      select: { pacote: { select: { carga: { select: { distrito: { select: { unidade: { select: { canalProsioId: true } } } } } } } } },
    });
    if (!o || o.pacote?.carga.distrito.unidade.canalProsioId !== canalId) return { mensagem: textosCarteiro.neutra, resultado: 'neutra' };
    const mensagem = await this.orientacoes.registrarRespostaCarteiro(orientacaoId, telefone, valor as RespostaDoCarteiro);
    return { mensagem, resultado: mensagem === textosCarteiro.neutra ? 'neutra' : valor.toLowerCase() };
  }
}

export const acoesService = new AcoesService();
