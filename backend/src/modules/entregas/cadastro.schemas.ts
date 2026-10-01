/** Schemas (Zod) das rotas de cadastro da unidade: distritos, carteiros, escala e pontos. */
import { z } from 'zod';

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const id = z.string().uuid();
/** `atualizadoEm` lido na tela; divergente → 409 `alterado_por_outro`. */
const atualizadoEm = z.string().datetime({ offset: true }).optional();

// ——— Listagens ———————————————————————————————————————————————————————————

const inteiro = (padrao: number, max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : Number(v)),
    z.number().int().min(1).max(max).default(padrao),
  );

const booleano = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional(),
);

export const listagemSchema = z.object({
  pagina: inteiro(1, 100_000),
  tamanho: inteiro(50, 100),
  busca: z.string().trim().max(80).optional(),
  ativo: booleano,
});
export type Listagem = z.infer<typeof listagemSchema>;

// ——— Distritos ———————————————————————————————————————————————————————————

export const criarDistritoSchema = z.object({
  codigo: texto(1, 20),
  nome: texto(1, 80),
  carteiroPadraoId: id.nullable().optional(),
  ativo: z.boolean().optional(),
}).strict();

export const editarDistritoSchema = z.object({
  codigo: texto(1, 20).optional(),
  nome: texto(1, 80).optional(),
  carteiroPadraoId: id.nullable().optional(),
  ativo: z.boolean().optional(),
  atualizadoEm,
}).strict();

export const escalaSchema = z.object({
  /** `null` desfaz a troca do dia (volta ao carteiro padrão). */
  carteiroId: id.nullable(),
}).strict();

// ——— Carteiros ———————————————————————————————————————————————————————————

export const criarCarteiroSchema = z.object({
  nome: texto(2, 120),
  matricula: texto(1, 20),
  whatsapp: z.string().max(40),
  distritoPadraoId: id.nullable().optional(),
}).strict();

export const editarCarteiroSchema = z.object({
  nome: texto(2, 120).optional(),
  matricula: texto(1, 20).optional(),
  whatsapp: z.string().max(40).optional(),
  distritoPadraoId: id.nullable().optional(),
  ativo: z.boolean().optional(),
  atualizadoEm,
}).strict();

// ——— Pontos de retirada ——————————————————————————————————————————————————

// `nome` sem limite aqui: o limite de 24 responde 400 `nome_longo` (cadastro.validacao).
export const criarPontoSchema = z.object({
  tipo: z.enum(['AGENCIA', 'LOCKER']),
  nome: z.string().max(200),
  endereco: texto(3, 200),
  horario: texto(2, 120),
  ativo: z.boolean().optional(),
}).strict();

export const editarPontoSchema = z.object({
  tipo: z.enum(['AGENCIA', 'LOCKER']).optional(),
  nome: z.string().max(200).optional(),
  endereco: texto(3, 200).optional(),
  horario: texto(2, 120).optional(),
  ativo: z.boolean().optional(),
  atualizadoEm,
}).strict();

export const listagemPontosSchema = z.object({
  tipo: z.enum(['AGENCIA', 'LOCKER']).optional(),
  ativo: booleano,
});

// ——— Atendimento ———————————————————————————————————————————————————————————

export const sessaoAtendimentoSchema = z.object({
  unidadeId: id.optional(),
}).strict();
