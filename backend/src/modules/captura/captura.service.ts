/**
 * Orquestra uma captura (TechSpec › Data flow, ADR-012): idempotência por
 * `capturaId`, foto, CEP, extração, montagem dos campos, conciliação e, depois do
 * commit, o gancho de aviso do monitoramento. Também atende a conferência, o
 * descarte, a foto, o CEP e a tela inicial do app.
 *
 * Logs só com ids, resultado, duração e fontes; nunca nome, telefone, endereço,
 * bytes da foto ou texto do LLM.
 */
import { Prisma, type Captura } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import logger from '../../shared/utils/logger';
import { normalizeS10, validateS10 } from '../../shared/utils/s10';
import { parseSigepDataMatrix } from '../../shared/utils/sigep-datamatrix';
import { classificarTelefone } from '../../shared/utils/telefone-classificacao';
import { avaliarMinimo, camposParaPedir, montarCampos, motivosDe } from './campos';
import { dependenciasCaptura } from './captura.contexto';
import { capturaLlmFalhas, capturaLlmTokens, capturaProcessadas, medir } from './captura.metricas';
import { chaveFoto } from './photo-store';
import { avisarAposCommit, conciliacaoService, excluirFotos, type ConciliacaoService, type EdicaoCarteiro } from './conciliacao.service';
import { ExtracaoIndisponivel } from './extraction.service';
import { normalizarCep } from './cep.service';
import {
  NOMES_CAMPOS,
  type BarcodesLidos,
  type Campo,
  type CamposLidos,
  type CepInfo,
  type NomeCampo,
  type RecusaCaptura,
  type ResultadoCaptura,
  type ResultadoCep,
} from './captura.types';

/** Uma captura em PROCESSANDO há mais que isso é reprocessada no reenvio. */
export const PROCESSANDO_EXPIRA_MS = 2 * 60 * 1000;
const PENDENTES = ['PARA_CONFERIR', 'TRANSFERENCIA_PENDENTE'] as const;

export interface CarteiroAtual {
  usuarioId: string;
  carteiroId: string;
  unidadeId: string;
}

export interface MetaCaptura {
  capturaId: string;
  distritoId: string;
  /** `YYYY-MM-DD` (dia civil em que a foto foi tirada). */
  data: string;
  capturadoEm: string;
  barcodes: BarcodesLidos;
  codigoDigitado: boolean;
  codigo: string;
}

export type ValorEditado = string | null;

export interface ConfirmarInput {
  campos: Partial<Record<NomeCampo, ValorEditado>>;
  confirmarTransferencia?: boolean;
}

function dataDe(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function erroCapturaJaResolvida(): AppError {
  return new AppError(409, 'Captura já resolvida', { code: 'captura_ja_resolvida' });
}

export class CapturaService {
  constructor(private readonly conciliacao: ConciliacaoService = conciliacaoService) {}

  // ——— Carteiro ——————————————————————————————————————————————————

  /** O `Carteiro` do usuário logado; sem cadastro → 403. */
  async carteiroDoUsuario(usuarioId: string): Promise<CarteiroAtual> {
    const c = await prisma.carteiro.findUnique({ where: { usuarioId }, select: { id: true, unidadeId: true, ativo: true } });
    if (!c || !c.ativo) throw new AppError(403, 'Carteiro não cadastrado', { code: 'carteiro_nao_cadastrado' });
    return { usuarioId, carteiroId: c.id, unidadeId: c.unidadeId };
  }

  /**
   * O carteiro pode capturar no distrito nessa data: escala do dia dele, ou ele é o
   * padrão e o distrito não tem escala para outro (IT-006).
   */
  async autorizadoNaData(carteiro: CarteiroAtual, distritoId: string, data: Date): Promise<boolean> {
    const d = await prisma.distrito.findUnique({
      where: { id: distritoId },
      select: { unidadeId: true, ativo: true, carteiroPadraoId: true, escalas: { where: { data }, select: { carteiroId: true } } },
    });
    if (!d || !d.ativo || d.unidadeId !== carteiro.unidadeId) return false;
    const escala = d.escalas[0];
    return escala ? escala.carteiroId === carteiro.carteiroId : d.carteiroPadraoId === carteiro.carteiroId;
  }

  // ——— POST /capturas ——————————————————————————————————————————————

  async processar(carteiro: CarteiroAtual, meta: MetaCaptura, jpeg: Buffer): Promise<ResultadoCaptura> {
    const { now, photoStore, cep, extractor } = dependenciasCaptura();
    const inicio = Date.now();
    const data = dataDe(meta.data);

    // Idempotência (ADR-012).
    const anterior = await prisma.captura.findUnique({ where: { id: meta.capturaId } });
    if (anterior) {
      if (anterior.carteiroId !== carteiro.carteiroId) {
        throw new AppError(409, 'capturaId já usado', { code: 'captura_em_processamento' });
      }
      if (anterior.resultado !== 'PROCESSANDO') return this.resultadoGravado(anterior);
      const assumiu = await prisma.captura.updateMany({
        where: { id: meta.capturaId, resultado: 'PROCESSANDO', recebidoEm: { lt: new Date(now().getTime() - PROCESSANDO_EXPIRA_MS) } },
        data: { recebidoEm: now() },
      });
      if (assumiu.count === 0) throw new AppError(409, 'Captura em processamento', { code: 'captura_em_processamento' });
    }

    if (!(await this.autorizadoNaData(carteiro, meta.distritoId, data))) {
      if (anterior) await prisma.captura.delete({ where: { id: meta.capturaId } }).catch(() => undefined);
      throw new AppError(403, 'Distrito fora da sua designação', { code: 'distrito_nao_autorizado' });
    }

    const base = {
      carteiroId: carteiro.carteiroId,
      distritoId: meta.distritoId,
      data,
      capturadoEm: new Date(meta.capturadoEm),
    };
    const codigo = normalizeS10(meta.codigo ?? '');

    // Recusas antes de guardar a foto.
    let recusa: RecusaCaptura | null = null;
    if (meta.barcodes.multiplos) recusa = 'MULTIPLOS_ROTULOS';
    else if (!validateS10(codigo, { qualquerPais: true }).valid) recusa = 'DV_INVALIDO';
    if (recusa) {
      const dados = { ...base, codigo: codigo || null, resultado: 'RECUSADO' as const, recusa, processadoEm: now(), recebidoEm: now() };
      if (anterior) await prisma.captura.update({ where: { id: meta.capturaId }, data: dados });
      else await this.criarOuConflito({ id: meta.capturaId, ...dados });
      this.registrarFim(meta, carteiro, 'RECUSADO', inicio, {});
      return { tipo: 'RECUSADO', codigo: recusa };
    }

    if (!anterior) {
      await this.criarOuConflito({ id: meta.capturaId, ...base, codigo, resultado: 'PROCESSANDO', recebidoEm: now() });
    }

    let fotoKey: string | null = null;
    try {
      const distrito = await prisma.distrito.findUniqueOrThrow({ where: { id: meta.distritoId }, select: { unidadeId: true } });
      fotoKey = chaveFoto(distrito.unidadeId, data, meta.capturaId);
      await medir('foto', () => photoStore.put(fotoKey as string, jpeg));
      await prisma.captura.update({ where: { id: meta.capturaId }, data: { fotoKey } });

      const dm = parseSigepDataMatrix(meta.barcodes.dataMatrixRaw);
      const cepConhecido = dm?.cepDestino ?? meta.barcodes.cepLinear?.replace(/\D/g, '') ?? null;
      let resultadoCep: ResultadoCep | null = null;
      if (cepConhecido && /^\d{8}$/.test(cepConhecido)) {
        resultadoCep = await medir('cep', () => this.consultarCep(cep, cepConhecido));
      }

      // Extração só dos campos que o DataMatrix e o CEP não cobriram.
      const pedir = camposParaPedir({ dataMatrix: dm, cepLinear: meta.barcodes.cepLinear, cep: resultadoCep });
      let llm: Partial<CamposLidos> | null = null;
      let uso = { inputTokens: 0, outputTokens: 0 };
      try {
        const r = await medir('llm', () => extractor.extract(jpeg, pedir, new AbortController().signal));
        llm = r.campos;
        uso = r.uso;
      } catch (err) {
        const motivo = err instanceof ExtracaoIndisponivel ? err.motivo : 'erro';
        capturaLlmFalhas.inc({ motivo });
        llm = null;
      }
      if (uso.inputTokens) capturaLlmTokens.inc({ tipo: 'input' }, uso.inputTokens);
      if (uso.outputTokens) capturaLlmTokens.inc({ tipo: 'output' }, uso.outputTokens);

      // Sem CEP nos códigos: consulta o CEP lido do texto.
      if (!resultadoCep && llm?.cep?.valor) {
        const doTexto = llm.cep.valor.replace(/\D/g, '');
        if (/^\d{8}$/.test(doTexto)) resultadoCep = await medir('cep', () => this.consultarCep(cep, doTexto));
      }

      const campos = montarCampos({
        codigo,
        codigoDigitado: meta.codigoDigitado,
        cepLinear: meta.barcodes.cepLinear,
        dataMatrix: dm,
        cep: resultadoCep,
        llm,
      });

      await prisma.captura.update({
        where: { id: meta.capturaId },
        data: { llmInputTokens: uso.inputTokens, llmOutputTokens: uso.outputTokens },
      });

      const { resultado, avisar } = await medir('conciliacao', () => this.conciliacao.aplicar({
        capturaId: meta.capturaId,
        carteiroId: carteiro.carteiroId,
        distritoId: meta.distritoId,
        data,
        campos,
        codigoDigitado: meta.codigoDigitado,
      }));

      if (resultado.tipo === 'RECUSADO') await this.descartarFoto(meta.capturaId, fotoKey, 'recusada', false);

      const fontes: Record<string, string> = {};
      for (const n of NOMES_CAMPOS) fontes[n] = campos[n].fonte;
      this.registrarFim(meta, carteiro, resultado.tipo, inicio, fontes);
      await avisarAposCommit(avisar);
      return resultado;
    } catch (err) {
      // Falha inesperada: apaga o rascunho para o reenvio reprocessar na hora.
      await prisma.captura.deleteMany({ where: { id: meta.capturaId, resultado: 'PROCESSANDO' } }).catch(() => undefined);
      if (fotoKey) await photoStore.delete(fotoKey).catch(() => undefined);
      logger.error({ capturaId: meta.capturaId, carteiroId: carteiro.carteiroId, erro: err instanceof Error ? err.name : 'desconhecido' }, 'captura: falha no processamento');
      throw err;
    }
  }

  private async criarOuConflito(dados: Prisma.CapturaUncheckedCreateInput): Promise<void> {
    try {
      await prisma.captura.create({ data: dados });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(409, 'Captura em processamento', { code: 'captura_em_processamento' });
      }
      throw err;
    }
  }

  private async consultarCep(cep: { lookup(c: string): Promise<ResultadoCep> }, valor: string): Promise<ResultadoCep> {
    try {
      return await cep.lookup(valor);
    } catch {
      return 'INDISPONIVEL';
    }
  }

  private registrarFim(meta: MetaCaptura, carteiro: CarteiroAtual, resultado: string, inicio: number, fontes: Record<string, string>): void {
    capturaProcessadas.inc({ resultado });
    logger.info({
      capturaId: meta.capturaId,
      carteiroId: carteiro.carteiroId,
      distritoId: meta.distritoId,
      resultado,
      duracaoMs: Date.now() - inicio,
      fontes,
    }, 'captura: processada');
  }

  /** Exclui a foto e marca a captura (recusada, descartada). */
  private async descartarFoto(capturaId: string, fotoKey: string | null, motivo: string, manterChave: boolean): Promise<void> {
    if (!fotoKey) return;
    const { now } = dependenciasCaptura();
    await prisma.captura.update({
      where: { id: capturaId },
      data: manterChave ? { fotoExcluidaEm: now() } : { fotoKey: null },
    });
    await excluirFotos([fotoKey], motivo);
  }

  /** O corpo de resposta de uma captura já processada (reenvio idempotente). */
  async resultadoGravado(c: Captura): Promise<ResultadoCaptura> {
    switch (c.resultado) {
      case 'SALVO':
        return { tipo: 'SALVO', pacoteId: c.pacoteId as string, atualizado: c.pacoteAntes != null };
      case 'PARA_CONFERIR': {
        const campos = c.campos as unknown as CamposLidos;
        return { tipo: 'PARA_CONFERIR', campos, motivos: motivosDe(campos) };
      }
      case 'TRANSFERENCIA_PENDENTE':
        return { tipo: 'TRANSFERENCIA_PENDENTE', campos: c.campos as unknown as CamposLidos, distritoOrigem: await this.codigoDistritoDaCarga(c.cargaOrigemId) };
      case 'RECUSADO':
        return { tipo: 'RECUSADO', codigo: c.recusa as RecusaCaptura };
      default:
        throw erroCapturaJaResolvida();
    }
  }

  private async codigoDistritoDaCarga(cargaId: string | null): Promise<string> {
    if (!cargaId) return '';
    const carga = await prisma.cargaDistrito.findUnique({ where: { id: cargaId }, select: { distrito: { select: { codigo: true } } } });
    return carga?.distrito.codigo ?? '';
  }

  // ——— Conferência ————————————————————————————————————————————————

  async listarConferir(carteiro: CarteiroAtual) {
    const capturas = await prisma.captura.findMany({
      where: { carteiroId: carteiro.carteiroId, resultado: { in: [...PENDENTES] } },
      orderBy: [{ capturadoEm: 'asc' }, { recebidoEm: 'asc' }],
    });
    const origens = new Map<string, string>();
    for (const id of new Set(capturas.map((c) => c.cargaOrigemId).filter((x): x is string => !!x))) {
      origens.set(id, await this.codigoDistritoDaCarga(id));
    }
    return capturas.map((c) => {
      const campos = c.campos as unknown as CamposLidos;
      return {
        capturaId: c.id,
        tipo: c.resultado,
        distritoId: c.distritoId,
        data: c.data.toISOString().slice(0, 10),
        codigo: c.codigo,
        capturadoEm: c.capturadoEm.toISOString(),
        campos,
        motivos: campos ? motivosDe(campos) : [],
        distritoOrigem: c.cargaOrigemId ? origens.get(c.cargaOrigemId) ?? null : null,
        temFoto: !!c.fotoKey && !c.fotoExcluidaEm,
      };
    });
  }

  private async capturaDoCarteiro(capturaId: string, carteiro: CarteiroAtual): Promise<Captura> {
    const c = await prisma.captura.findFirst({ where: { id: capturaId, carteiroId: carteiro.carteiroId } });
    if (!c) throw new AppError(404, 'Captura não encontrada');
    return c;
  }

  async confirmar(carteiro: CarteiroAtual, capturaId: string, input: ConfirmarInput): Promise<ResultadoCaptura> {
    const { cep } = dependenciasCaptura();
    const cap = await this.capturaDoCarteiro(capturaId, carteiro);
    if (!(PENDENTES as readonly string[]).includes(cap.resultado)) throw erroCapturaJaResolvida();

    const guardados = (cap.campos ?? {}) as unknown as Partial<CamposLidos>;
    const editados = input.campos ?? {};
    const campos = {} as CamposLidos;
    for (const n of NOMES_CAMPOS) {
      if (n in editados) {
        const v = editados[n];
        const valor = v == null ? null : v.trim() === '' ? null : v.trim();
        campos[n] = { valor, duvida: false, fonte: 'CARTEIRO' };
      } else {
        const g: Campo = guardados[n] ?? { valor: null, duvida: false, fonte: 'CARTEIRO' };
        campos[n] = { valor: g.valor, duvida: false, fonte: g.fonte };
      }
    }

    // Código (US-006 EC-7): revalida.
    const codigo = normalizeS10(campos.codigo.valor ?? '');
    if (!validateS10(codigo, { qualquerPais: true }).valid) {
      throw new AppError(400, 'Código não confere', { code: 'dv_invalido' });
    }
    campos.codigo = { ...campos.codigo, valor: codigo };

    // CEP editado sem o endereço: reconsulta e preenche (US-006 EC-5).
    if ('cep' in editados && campos.cep.valor) {
      let cepNorm: string;
      try {
        cepNorm = normalizarCep(campos.cep.valor);
      } catch {
        throw new AppError(400, 'CEP deve ter 8 dígitos', { code: 'cep_invalido' });
      }
      campos.cep = { ...campos.cep, valor: cepNorm };
      if (cepNorm !== guardados.cep?.valor && !('logradouro' in editados)) {
        const r = await this.consultarCep(cep, cepNorm);
        if (typeof r === 'object') {
          const info: CepInfo = r;
          if (info.logradouro) campos.logradouro = { valor: info.logradouro, duvida: false, fonte: 'CEP' };
          if (info.bairro && !('bairro' in editados)) campos.bairro = { valor: info.bairro, duvida: false, fonte: 'CEP' };
          if (!('cidade' in editados)) campos.cidade = { valor: info.cidade, duvida: false, fonte: 'CEP' };
          if (!('uf' in editados)) campos.uf = { valor: info.uf, duvida: false, fonte: 'CEP' };
        }
      }
    }

    const minimo = avaliarMinimo(campos);
    if (!minimo.ok) {
      const code = minimo.motivos.find((m) => m !== 'codigo_invalido') ?? minimo.motivos[0];
      throw new AppError(400, 'Dados incompletos', { code });
    }
    if (campos.whatsapp.valor) {
      try {
        classificarTelefone(campos.whatsapp.valor);
      } catch {
        throw new AppError(400, 'Número incompleto: corrija ou deixe em branco', { code: 'whatsapp_invalido' });
      }
    }

    const codigoOriginal = guardados.codigo?.valor ?? null;
    const codigoDigitado = codigo !== codigoOriginal ? true : guardados.codigo?.fonte === 'DIGITADO';

    const { resultado, avisar } = await this.conciliacao.aplicar({
      capturaId: cap.id,
      carteiroId: carteiro.carteiroId,
      distritoId: cap.distritoId,
      data: cap.data,
      campos,
      codigoDigitado,
      confirmarTransferencia: input.confirmarTransferencia ?? false,
      cargaOrigemEsperadaId: cap.cargaOrigemId,
    });
    if (resultado.tipo === 'RECUSADO') await this.descartarFoto(cap.id, cap.fotoKey, 'recusada', false);
    capturaProcessadas.inc({ resultado: resultado.tipo });
    logger.info({ capturaId: cap.id, carteiroId: carteiro.carteiroId, distritoId: cap.distritoId, resultado: resultado.tipo, etapa: 'confirmar' }, 'captura: conferida');
    await avisarAposCommit(avisar);
    return resultado;
  }

  async descartar(carteiro: CarteiroAtual, capturaId: string): Promise<void> {
    const { now } = dependenciasCaptura();
    const cap = await this.capturaDoCarteiro(capturaId, carteiro);
    if (!(PENDENTES as readonly string[]).includes(cap.resultado)) throw erroCapturaJaResolvida();
    const r = await prisma.captura.updateMany({
      where: { id: cap.id, resultado: { in: [...PENDENTES] } },
      data: { resultado: 'DESCARTADO', fotoExcluidaEm: cap.fotoKey ? now() : null },
    });
    if (r.count === 0) throw erroCapturaJaResolvida();
    await excluirFotos([cap.fotoKey], 'descartada');
  }

  async desfazer(carteiro: CarteiroAtual, capturaId: string): Promise<void> {
    await this.conciliacao.desfazer(capturaId, carteiro.carteiroId);
  }

  async foto(carteiro: CarteiroAtual, capturaId: string): Promise<Buffer> {
    const { photoStore } = dependenciasCaptura();
    const cap = await this.capturaDoCarteiro(capturaId, carteiro);
    const excluida = () => new AppError(410, 'Foto excluída', { code: 'foto_excluida', fotoExcluidaEm: cap.fotoExcluidaEm?.toISOString() ?? null });
    if (!cap.fotoKey || cap.fotoExcluidaEm) throw excluida();
    const bytes = await photoStore.get(cap.fotoKey);
    if (!bytes) throw excluida();
    return bytes;
  }

  // ——— Pacotes do carteiro ————————————————————————————————————————

  async editarPacote(carteiro: CarteiroAtual, pacoteId: string, edicao: EdicaoCarteiro) {
    const p = await this.conciliacao.editar(pacoteId, carteiro.usuarioId, edicao);
    return {
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      whatsapp: p.whatsappE164,
      status: p.status,
      origem: p.origem,
      codigoDigitado: p.codigoDigitado,
      endereco: { cep: p.cep, logradouro: p.logradouro, numero: p.numero, complemento: p.complemento, bairro: p.bairro, cidade: p.cidade, uf: p.uf },
    };
  }

  async removerPacote(carteiro: CarteiroAtual, pacoteId: string): Promise<void> {
    await this.conciliacao.remover(pacoteId, { usuarioId: carteiro.usuarioId, role: 'CARTEIRO' });
  }

  // ——— CEP ————————————————————————————————————————————————————————

  async consultarCepPublico(valor: string): Promise<CepInfo> {
    const { cep } = dependenciasCaptura();
    const normalizado = normalizarCep(valor);
    const r = await cep.lookup(normalizado);
    if (r === 'NAO_ENCONTRADO') throw new AppError(404, 'CEP não encontrado', { code: 'cep_nao_encontrado' });
    if (r === 'INDISPONIVEL') throw new AppError(503, 'Consulta de CEP indisponível', { code: 'cep_indisponivel' });
    return r;
  }

  // ——— Início ——————————————————————————————————————————————————————

  async hoje(carteiro: CarteiroAtual) {
    const { distritoDoDia } = dependenciasCaptura();
    const r = await distritoDoDia.resolver(carteiro.carteiroId);
    const [capturados, paraConferir, salvas] = await Promise.all([
      prisma.pacoteDia.count({ where: { data: r.data, capturadoPorId: carteiro.carteiroId } }),
      prisma.captura.count({ where: { carteiroId: carteiro.carteiroId, resultado: { in: [...PENDENTES] } } }),
      prisma.captura.findMany({
        where: { carteiroId: carteiro.carteiroId, data: r.data, resultado: 'SALVO', pacoteId: { not: null } },
        orderBy: [{ processadoEm: 'desc' }],
        take: 60,
        select: { id: true, pacoteId: true, distritoId: true, processadoEm: true, pacoteAntes: true },
      }),
    ]);
    const vistos = new Set<string>();
    const ultimas = salvas.filter((c) => {
      if (vistos.has(c.pacoteId as string)) return false;
      vistos.add(c.pacoteId as string);
      return true;
    });
    const pacotes = await prisma.pacoteDia.findMany({
      where: { id: { in: ultimas.map((c) => c.pacoteId as string) } },
      select: { id: true, codigo: true, nome: true, whatsappE164: true, codigoDigitado: true, origem: true },
    });
    const porId = new Map(pacotes.map((p) => [p.id, p]));
    const recentes = ultimas
      .filter((c) => porId.has(c.pacoteId as string))
      .slice(0, 20)
      .map((c) => {
        const p = porId.get(c.pacoteId as string)!;
        return {
          capturaId: c.id,
          pacoteId: p.id,
          distritoId: c.distritoId,
          codigo: p.codigo,
          nome: p.nome,
          semWhatsapp: !p.whatsappE164,
          codigoDigitado: p.codigoDigitado,
          origem: p.origem,
          atualizado: c.pacoteAntes != null,
          processadoEm: c.processadoEm?.toISOString() ?? null,
        };
      });
    return {
      data: r.data.toISOString().slice(0, 10),
      distritos: r.distritos,
      ativo: r.ativo,
      contadores: { capturados, paraConferir },
      recentes,
    };
  }

  async definirAtivo(carteiro: CarteiroAtual, distritoId: string): Promise<void> {
    const { distritoDoDia } = dependenciasCaptura();
    await distritoDoDia.definirAtivo(carteiro.carteiroId, distritoId);
  }
}

export const capturaService = new CapturaService();
