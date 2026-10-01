/**
 * Controller das saídas do dia (ADR-019): valida a entrada (Zod), resolve o
 * escopo por unidade e delega ao `saida.service` e à liberação.
 *
 * Escopo: o supervisor (`UNIDADE`) fica preso à própria unidade. A Gestão vê
 * todas as unidades juntas (`?unidadeId=todas` ou sem o parâmetro, só leitura)
 * e precisa escolher uma (`?unidadeId=<id>`) para importar ou atribuir carteiros.
 */
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { prisma } from '../../shared/utils/prisma';
import { erroHttp } from './carga.controller';
import { resolverUnidade } from './escopo';
import { lerData } from './datas';
import { lerArquivoSaida, MAX_BYTES_ARQUIVO_SAIDA } from './planilha.parser';
import { atribuirCarteiros, importarSaida, listarSaidas, MAX_SAIDAS_DIA } from './saida.service';
import { liberacaoService } from './liberacao.service';

const TODAS = 'todas';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_ARQUIVO_SAIDA, files: 1, fields: 10 },
}).single('arquivo');

/** `multer` em memória (≤ 5 MB) para o arquivo da saída. */
export function uploadSaida(req: Request, res: Response, next: NextFunction): void {
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
        ? new AppError(413, 'arquivo_grande', { maxBytes: MAX_BYTES_ARQUIVO_SAIDA })
        : new AppError(400, 'upload_invalido', { codigo: err.code }));
      return;
    }
    next(err);
  });
}

const importarSchema = z.object({
  numero: z.coerce.number().int().min(1).max(MAX_SAIDAS_DIA),
  horario: z.string().trim().max(5).optional(),
  data: z.string().optional(),
});

const liberarSchema = z.object({
  cargaIds: z.array(z.string().uuid()).min(1).max(200),
}).strict();

const carteirosSchema = z.object({
  data: z.string().optional(),
  atribuicoes: z.array(z.object({
    distritoId: z.string().uuid(),
    carteiroId: z.string().uuid(),
    definirPadrao: z.boolean().optional(),
  }).strict()).min(1).max(200),
}).strict();

type Handler = (req: Request, res: Response) => Promise<void>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction): void => {
  fn(req, res).catch((err) => next(erroHttp(err)));
};

/** Nome do arquivo como veio (o `multer` lê o cabeçalho em latin1), sem caminho e com no máximo 120 caracteres. */
function nomeDoArquivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const nome = utf8.includes('�') ? original : utf8;
  return (nome.split(/[\\/]/).pop() ?? '').trim().slice(0, 120) || 'arquivo';
}

const pediuTodas = (req: Request): boolean => req.query.unidadeId === TODAS;

export const saidaController = {
  /** GET /saidas?data=&unidadeId= — Gestão sem `unidadeId` (ou com `todas`) recebe a visão agregada. */
  listar: rota(async (req, res) => {
    const data = lerData(req.query.data);
    const agregado = req.user?.role === 'GESTAO' && (req.query.unidadeId === undefined || req.query.unidadeId === '' || pediuTodas(req));
    const unidadeId = agregado ? null : await resolverUnidade(req);
    res.json(await listarSaidas({ unidadeId }, data));
  }),

  /** POST /saidas/importar — multipart `arquivo`, `numero`, `horario`, `data?`; grava direto (sem prévia). */
  importar: rota(async (req, res) => {
    if (req.user?.role === 'GESTAO' && pediuTodas(req)) throw new AppError(400, 'unidade_obrigatoria');
    const unidadeId = await resolverUnidade(req);
    const corpo = importarSchema.parse(req.body ?? {});
    if (!corpo.horario) {
      throw new AppError(400, 'horario_obrigatorio', { mensagem: `Confirme o horário da Saída ${corpo.numero} antes de importar.` });
    }
    if (!req.file) throw new AppError(400, 'arquivo_ausente');
    const leitura = await lerArquivoSaida(req.file);
    const resultado = await importarSaida({
      unidadeId,
      data: lerData(corpo.data),
      numero: corpo.numero,
      horario: corpo.horario,
      arquivoNome: nomeDoArquivo(req.file.originalname),
      usuarioId: req.user?.sub ?? null,
      linhas: leitura.linhas,
      avisos: leitura.avisos,
    });
    res.status(201).json(resultado);
  }),

  /** POST /saidas/liberar — `{cargaIds}` → resultado por rota (a mesma liberação de uma rota, uma a uma). */
  liberar: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    const { cargaIds } = liberarSchema.parse(req.body ?? {});
    const pedidas = [...new Set(cargaIds)];
    const cargas = await prisma.cargaDistrito.findMany({
      where: { id: { in: pedidas }, distrito: { unidadeId } },
      select: { id: true, distrito: { select: { codigo: true } } },
    });
    const rotaDe = new Map(cargas.map((c) => [c.id, c.distrito.codigo]));
    const liberadas = await liberacaoService.liberarVarias(pedidas.filter((id) => rotaDe.has(id)), { usuarioId: req.user?.sub });
    const porId = new Map(liberadas.map((r) => [r.cargaId, r]));
    const resultados = pedidas.map((id) => {
      const r = porId.get(id);
      return r ? { rota: rotaDe.get(id) ?? null, ...r } : { rota: null, cargaId: id, ok: false as const, erro: 'nao_encontrado' };
    });
    let avisosAgendados = 0;
    let agendadoPara: string | undefined;
    for (const r of liberadas) {
      if (!r.ok) continue;
      avisosAgendados += r.avisosAgendados;
      agendadoPara ??= r.agendadoPara;
    }
    const ok = resultados.filter((r) => r.ok).length;
    res.json({ resultados, liberadas: ok, falhas: resultados.length - ok, avisosAgendados, ...(agendadoPara ? { agendadoPara } : {}) });
  }),

  /** PUT /saidas/carteiros — `{data?, atribuicoes: [{distritoId, carteiroId, definirPadrao?}]}`. */
  carteiros: rota(async (req, res) => {
    if (req.user?.role === 'GESTAO' && pediuTodas(req)) throw new AppError(400, 'unidade_obrigatoria');
    const unidadeId = await resolverUnidade(req);
    const corpo = carteirosSchema.parse(req.body ?? {});
    const resultados = await atribuirCarteiros(unidadeId, lerData(corpo.data), corpo.atribuicoes);
    const ok = resultados.filter((r) => r.ok).length;
    res.json({ resultados, atribuidas: ok, falhas: resultados.length - ok });
  }),
};
