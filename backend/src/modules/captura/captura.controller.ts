/**
 * Controller do app do carteiro (`/api/v1/captura`): valida a entrada (Zod),
 * resolve o carteiro do token e delega ao `CapturaService`.
 */
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { capturaService, type CarteiroAtual } from './captura.service';
import { NOMES_CAMPOS, type NomeCampo } from './captura.types';

export const MAX_BYTES_FOTO = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_FOTO, files: 1, fields: 5, fieldSize: 64 * 1024 },
}).single('foto');

/** `multer` em memória: foto ≤ 2 MB (413 `foto_muito_grande`). */
export function uploadFoto(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(413, 'Foto maior que 2 MB', { code: 'foto_muito_grande', maxBytes: MAX_BYTES_FOTO })
        : new AppError(400, 'Envio inválido', { code: 'upload_invalido', motivo: err.code }));
      return;
    }
    next(err);
  });
}

/** JPEG começa com FF D8 FF. */
export function ehJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'data inválida');

const metaSchema = z.object({
  capturaId: z.string().uuid(),
  distritoId: z.string().min(1).max(64),
  data: dataIso,
  capturadoEm: z.string().datetime({ offset: true }),
  barcodes: z.object({
    objeto: z.string().max(64).nullable().optional().default(null),
    cepLinear: z.string().max(32).nullable().optional().default(null),
    dataMatrixRaw: z.string().max(2000).nullable().optional().default(null),
    multiplos: z.boolean().optional().default(false),
  }),
  codigoDigitado: z.boolean().optional().default(false),
  codigo: z.string().min(1).max(40),
});

/** Aceita o valor cru ou o `Campo` (`{ valor }`) da resposta. */
const valorEditado = z.union([
  z.string().max(300),
  z.null(),
  z.object({ valor: z.string().max(300).nullable() }).passthrough().transform((c) => c.valor),
]);

const camposEditadosSchema = z.object(
  Object.fromEntries(NOMES_CAMPOS.map((n) => [n, valorEditado.optional()])) as Record<NomeCampo, z.ZodOptional<typeof valorEditado>>,
).strict();

const confirmarSchema = z.object({
  campos: camposEditadosSchema.default({}),
  confirmarTransferencia: z.boolean().optional(),
});

const ativoSchema = z.object({ distritoId: z.string().min(1) });

const editarPacoteSchema = z.object({
  codigo: z.string().nullable().optional(),
  nome: z.string().max(200).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  cep: z.string().max(12).nullable().optional(),
  logradouro: z.string().max(200).nullable().optional(),
  numero: z.string().max(20).nullable().optional(),
  complemento: z.string().max(300).nullable().optional(),
  bairro: z.string().max(120).nullable().optional(),
  cidade: z.string().max(120).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
}).strict();

function invalido(err: z.ZodError, code = 'dados_invalidos'): AppError {
  return new AppError(400, 'Dados inválidos', { code, erros: err.issues.map((i) => ({ caminho: i.path.join('.'), mensagem: i.message })) });
}

/** Os campos editados omitidos ficam fora do objeto (o Zod não cria chaves `undefined`). */
function semIndefinidos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function carteiro(req: Request): Promise<CarteiroAtual> {
  if (!req.user) throw new AppError(401, 'Não autenticado');
  return capturaService.carteiroDoUsuario(req.user.sub);
}

function param(req: Request, nome: string): string {
  return String(req.params[nome] ?? '');
}

export const capturaController = {
  async hoje(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await capturaService.hoje(await carteiro(req)));
    } catch (err) {
      next(err);
    }
  },

  async definirAtivo(req: Request, res: Response, next: NextFunction) {
    try {
      const corpo = ativoSchema.safeParse(req.body);
      if (!corpo.success) throw invalido(corpo.error);
      await capturaService.definirAtivo(await carteiro(req), corpo.data.distritoId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const foto = req.file;
      if (!foto) throw new AppError(400, 'Envie a foto', { code: 'foto_ausente' });
      if (!ehJpeg(foto.buffer)) throw new AppError(415, 'A foto precisa ser JPEG', { code: 'foto_invalida' });
      let bruto: unknown;
      try {
        bruto = typeof req.body?.meta === 'string' ? JSON.parse(req.body.meta) : req.body?.meta;
      } catch {
        throw new AppError(400, 'meta inválido', { code: 'meta_invalido' });
      }
      const meta = metaSchema.safeParse(bruto);
      if (!meta.success) throw invalido(meta.error, 'meta_invalido');
      const r = await capturaService.processar(await carteiro(req), meta.data, foto.buffer);
      res.json(r);
    } catch (err) {
      next(err);
    }
  },

  async conferir(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await capturaService.listarConferir(await carteiro(req)));
    } catch (err) {
      next(err);
    }
  },

  async foto(req: Request, res: Response, next: NextFunction) {
    try {
      const bytes = await capturaService.foto(await carteiro(req), param(req, 'id'));
      res.set('Cache-Control', 'private, no-store');
      res.type('image/jpeg').send(bytes);
    } catch (err) {
      next(err);
    }
  },

  async confirmar(req: Request, res: Response, next: NextFunction) {
    try {
      const corpo = confirmarSchema.safeParse(req.body ?? {});
      if (!corpo.success) throw invalido(corpo.error);
      const r = await capturaService.confirmar(await carteiro(req), param(req, 'id'), {
        campos: semIndefinidos(corpo.data.campos),
        confirmarTransferencia: corpo.data.confirmarTransferencia,
      });
      res.json(r);
    } catch (err) {
      next(err);
    }
  },

  async descartar(req: Request, res: Response, next: NextFunction) {
    try {
      await capturaService.descartar(await carteiro(req), param(req, 'id'));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async desfazer(req: Request, res: Response, next: NextFunction) {
    try {
      await capturaService.desfazer(await carteiro(req), param(req, 'id'));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async editarPacote(req: Request, res: Response, next: NextFunction) {
    try {
      const corpo = editarPacoteSchema.safeParse(req.body ?? {});
      if (!corpo.success) throw invalido(corpo.error);
      res.json(await capturaService.editarPacote(await carteiro(req), param(req, 'id'), semIndefinidos(corpo.data)));
    } catch (err) {
      next(err);
    }
  },

  async removerPacote(req: Request, res: Response, next: NextFunction) {
    try {
      await capturaService.removerPacote(await carteiro(req), param(req, 'id'));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async cep(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await capturaService.consultarCepPublico(param(req, 'cep')));
    } catch (err) {
      next(err);
    }
  },
};
