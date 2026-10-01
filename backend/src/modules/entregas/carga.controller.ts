/**
 * Controller da carga do dia: valida a entrada (Zod), resolve o escopo por
 * unidade e delega ao `carga.service`.
 */
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { cargaNoEscopo, distritoNoEscopo, pacoteNoEscopo, resolverUnidade } from './escopo';
import { lerArquivo, lerTexto, MAX_BYTES_ARQUIVO, MAX_LINHAS, ParserErro, type CodigoParserErro } from './planilha.parser';
import type { LinhaEntrada } from './carga.validacao';
import { lerData } from './datas';
import { confirmarCarga, editarPacote, gerarPrevia, listarPacotes, montarQuadro } from './carga.service';

const STATUS_PARSER: Record<CodigoParserErro, number> = {
  coluna_ausente: 400,
  nenhuma_encomenda: 400,
  arquivo_invalido: 400,
  limite_linhas: 413,
  formato_nao_suportado: 415,
};

/** Converte `ParserErro` em `AppError` (400/413/415) com o código na mensagem. */
export function erroHttp(err: unknown): unknown {
  if (err instanceof ParserErro) return new AppError(STATUS_PARSER[err.codigo], err.codigo, err.detalhes);
  return err;
}

// ——— Upload ——————————————————————————————————————————————————————————

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_ARQUIVO, files: 1, fields: 10 },
}).single('arquivo');

/** `multer` em memória (≤ 2 MB), só quando a requisição é multipart. */
export function uploadPlanilha(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(413, 'arquivo_grande', { maxBytes: MAX_BYTES_ARQUIVO })
        : new AppError(400, 'upload_invalido', { codigo: err.code }));
      return;
    }
    next(err);
  });
}

// ——— Schemas ——————————————————————————————————————————————————————————

const campo = (max: number) => z.string().max(max).nullable().optional();

const linhaSchema = z.object({
  n: z.number().int().positive().optional(),
  codigo: z.string().max(64),
  nome: z.string().max(300),
  whatsapp: campo(40),
  logradouro: campo(300),
  numero: campo(40),
  complemento: campo(200),
  bairro: campo(200),
  cidade: campo(200),
  uf: campo(40),
  cep: campo(20),
  enderecoTexto: campo(1000),
  referencia: campo(500),
});

const linhasSchema = z.array(linhaSchema);

const confirmarSchema = z.object({
  data: z.string().optional(),
  linhas: z.array(z.unknown()),
});

const enderecoSchema = z.object({
  logradouro: campo(300),
  numero: campo(40),
  complemento: campo(200),
  bairro: campo(200),
  cidade: campo(200),
  uf: campo(40),
  cep: campo(20),
  enderecoTexto: campo(1000),
  referencia: campo(500),
}).strict();

const editarSchema = z.object({
  whatsapp: z.string().max(40).nullable().optional(),
  endereco: enderecoSchema.optional(),
}).strict();

function lerLinhas(bruto: unknown[]): LinhaEntrada[] {
  if (bruto.length > MAX_LINHAS) throw new ParserErro('limite_linhas', { max: MAX_LINHAS });
  return linhasSchema.parse(bruto).map((l, i) => ({ ...l, n: l.n ?? i + 1 }));
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

// ——— Handlers ———————————————————————————————————————————————————————————

type Handler = (req: Request, res: Response) => Promise<void>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction): void => {
  fn(req, res).catch((err) => next(erroHttp(err)));
};

export const cargaController = {
  /** POST /cargas/:distritoId/previa — multipart `arquivo`, `{texto}` ou `{linhas}`; nada é gravado. */
  previa: rota(async (req, res) => {
    const distrito = await distritoNoEscopo(req, String(req.params.distritoId));
    const data = lerData(req.body?.data ?? req.query.data);
    let leitura: { linhas: LinhaEntrada[]; avisos: Awaited<ReturnType<typeof lerArquivo>>['avisos'] };
    if (req.file) {
      leitura = await lerArquivo(req.file);
    } else if (req.is('multipart/form-data') && !texto(req.body?.texto)) {
      throw new AppError(400, 'arquivo_ausente');
    } else if (texto(req.body?.texto)) {
      leitura = lerTexto(req.body.texto);
    } else if (Array.isArray(req.body?.linhas)) {
      leitura = { linhas: lerLinhas(req.body.linhas), avisos: [] };
    } else {
      throw new AppError(400, 'entrada_ausente');
    }
    res.json(await gerarPrevia(distrito, leitura.linhas, leitura.avisos, data));
  }),

  /** POST /cargas/:distritoId/confirmar — `{data?, linhas}` → `{aceitos, descartados, cargaId}`. */
  confirmar: rota(async (req, res) => {
    const distrito = await distritoNoEscopo(req, String(req.params.distritoId));
    const corpo = confirmarSchema.parse(req.body ?? {});
    const linhas = lerLinhas(corpo.linhas);
    const resultado = await confirmarCarga(distrito, linhas, lerData(corpo.data));
    res.json(resultado);
  }),

  /** GET /quadro?data=&status=&busca=&unidadeId= */
  quadro: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    const data = lerData(req.query.data);
    res.json(await montarQuadro(unidadeId, data, { status: texto(req.query.status), busca: texto(req.query.busca) }));
  }),

  /** GET /cargas/:cargaId/pacotes?status=&busca=&pagina= */
  pacotes: rota(async (req, res) => {
    const carga = await cargaNoEscopo(req, String(req.params.cargaId));
    const pagina = Number.parseInt(String(req.query.pagina ?? '1'), 10);
    res.json(await listarPacotes(carga, {
      status: texto(req.query.status),
      busca: texto(req.query.busca),
      pagina: Number.isFinite(pagina) ? pagina : 1,
    }));
  }),

  /** PATCH /pacotes/:id — `{whatsapp?, endereco?}`; não envia aviso (gancho da task_06). */
  editarPacote: rota(async (req, res) => {
    const pacote = await pacoteNoEscopo(req, String(req.params.id));
    const edicao = editarSchema.parse(req.body ?? {});
    res.json(await editarPacote(pacote, edicao));
  }),
};
