/**
 * Fábricas de dados das entregas mediadas para os testes de integração.
 *
 * Cada fábrica grava no banco de teste (via o singleton do Prisma, que o
 * `env-integracao` aponta para TEST_DATABASE_URL) e aceita sobrescritas.
 * Use `limparBanco()` no `beforeAll`/`beforeEach` de cada arquivo.
 */
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Prisma,
  type CanalProsio,
  type CargaDistrito,
  type Carteiro,
  type Distrito,
  type PacoteDia,
  type Unidade,
  type Usuario,
} from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { cifrar } from '../../shared/utils/cripto';
import { calculateS10CheckDigit } from '../../shared/utils/s10';

let seq = 0;
const lote = randomBytes(2).toString('hex');

/** Sequencial único no processo, para campos `@unique`. */
export function proximo(): number {
  seq += 1;
  return seq;
}

/** Data (sem hora) em UTC, no formato que as colunas `@db.Date` gravam. */
export function dia(iso?: string): Date {
  const base = iso ? new Date(`${iso}T00:00:00.000Z`) : new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

/** Código S10 com dígito verificador válido (regra da UPU). */
export function codigoS10(serial?: number, prefixo = 'AA', pais = 'BR'): string {
  const n = String(serial ?? 10_000_000 + proximo()).padStart(8, '0').slice(-8);
  return `${prefixo}${n}${calculateS10CheckDigit(n)}${pais}`;
}

/** Celular E.164 BR único (+5561 9XXXX-XXXX). */
export function whatsappUnico(): string {
  return `+55619${String(proximo()).padStart(8, '0')}`;
}

/** Apaga todas as tabelas do schema de teste, exceto o histórico de migrations. */
export async function limparBanco(): Promise<void> {
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

// ——— Canal Prosio ——————————————————————————————————————————————

export interface CanalCriado {
  canal: CanalProsio;
  apiKey: string;
  callbackSecret: string;
  tokenEntrada: string;
}

export async function criarCanal(
  over: Partial<Prisma.CanalProsioUncheckedCreateInput> & {
    apiKey?: string;
    callbackSecret?: string;
    tokenEntrada?: string;
  } = {},
): Promise<CanalCriado> {
  const { apiKey = `psk_test_${randomBytes(8).toString('hex')}`,
    callbackSecret = randomBytes(16).toString('hex'),
    tokenEntrada = randomBytes(24).toString('hex'),
    ...dados } = over;
  const canal = await prisma.canalProsio.create({
    data: {
      nome: `Canal ${lote}-${proximo()}`,
      baseUrl: 'http://127.0.0.1:0',
      apiKeyCifrada: cifrar(apiKey),
      callbackSecretCifrado: cifrar(callbackSecret),
      tokenEntradaHash: createHash('sha256').update(tokenEntrada).digest('hex'),
      ...dados,
    },
  });
  return { canal, apiKey, callbackSecret, tokenEntrada };
}

// ——— Unidade e supervisor ————————————————————————————————————————

export async function criarUnidade(over: Partial<Prisma.UnidadeUncheckedCreateInput> = {}): Promise<Unidade> {
  const n = proximo();
  return prisma.unidade.create({
    data: {
      codigo: `CDD-${lote}-${n}`,
      nome: `CDD Teste ${n}`,
      tipo: 'CDD',
      logradouro: 'SQN 308 Bloco A',
      numero: '1',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '70747090',
      latitude: new Prisma.Decimal(-15.7631),
      longitude: new Prisma.Decimal(-47.8827),
      ...over,
    },
  });
}

export const SENHA_PADRAO = 'senha-de-teste';
let hashSenhaPadrao: string | null = null;

async function hashDe(senha: string): Promise<string> {
  if (senha === SENHA_PADRAO) {
    hashSenhaPadrao ??= await bcrypt.hash(SENHA_PADRAO, 4);
    return hashSenhaPadrao;
  }
  return bcrypt.hash(senha, 4);
}

/** Supervisor = `Usuario` com `role UNIDADE`, matrícula e celular. */
export async function criarSupervisor(
  over: Partial<Prisma.UsuarioUncheckedCreateInput> & { unidadeId: string },
): Promise<Usuario> {
  const n = proximo();
  const { senha = SENHA_PADRAO, ...dados } = over;
  return prisma.usuario.create({
    data: {
      nome: `Supervisor ${n}`,
      email: `supervisor-${lote}-${n}@teste.local`,
      matricula: `S${lote}${n}`,
      telefoneCelular: whatsappUnico(),
      role: 'UNIDADE',
      senha: await hashDe(senha),
      ...dados,
    },
  });
}

export async function criarGestor(over: Partial<Prisma.UsuarioUncheckedCreateInput> = {}): Promise<Usuario> {
  const n = proximo();
  const { senha = SENHA_PADRAO, ...dados } = over;
  return prisma.usuario.create({
    data: {
      nome: `Gestor ${n}`,
      email: `gestor-${lote}-${n}@teste.local`,
      role: 'GESTAO',
      senha: await hashDe(senha),
      ...dados,
    },
  });
}

// ——— Cadastro operacional ————————————————————————————————————————

export async function criarCarteiro(
  over: Partial<Prisma.CarteiroUncheckedCreateInput> & { unidadeId: string },
): Promise<Carteiro> {
  const n = proximo();
  return prisma.carteiro.create({
    data: {
      nome: `Carteiro ${n}`,
      matricula: `C${lote}${n}`,
      whatsappE164: whatsappUnico(),
      ...over,
    },
  });
}

export async function criarDistrito(
  over: Partial<Prisma.DistritoUncheckedCreateInput> & { unidadeId: string },
): Promise<Distrito> {
  const n = proximo();
  return prisma.distrito.create({
    data: {
      codigo: `D${String(n).padStart(3, '0')}`,
      nome: `Distrito ${n}`,
      ...over,
    },
  });
}

export async function criarCarga(
  over: Partial<Prisma.CargaDistritoUncheckedCreateInput> & { distritoId: string },
): Promise<CargaDistrito> {
  return prisma.cargaDistrito.create({
    data: {
      data: dia(),
      ...over,
    },
  });
}

export async function criarPacote(
  over: Partial<Prisma.PacoteDiaUncheckedCreateInput> & { cargaId: string },
): Promise<PacoteDia> {
  const n = proximo();
  const data = over.data ?? (await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: over.cargaId } })).data;
  const whatsappE164 = over.whatsappE164 === undefined ? whatsappUnico() : over.whatsappE164;
  return prisma.pacoteDia.create({
    data: {
      codigo: codigoS10(),
      nome: `Maria Teste ${n}`,
      logradouro: 'QNA 12',
      numero: String(n),
      bairro: 'Taguatinga',
      cidade: 'Brasília',
      uf: 'DF',
      status: whatsappE164 ? 'AGUARDANDO_LIBERACAO' : 'SEM_WHATSAPP',
      ...over,
      data,
      whatsappE164,
    },
  });
}

// ——— Cenário pronto ———————————————————————————————————————————

export interface CenarioDistrito {
  canal: CanalCriado;
  unidade: Unidade;
  supervisor: Usuario;
  carteiro: Carteiro;
  distrito: Distrito;
  carga: CargaDistrito;
  pacotes: PacoteDia[];
}

/** Canal → unidade → supervisor, carteiro, distrito → carga do dia com `pacotes` pacotes. */
export async function criarCenarioDistrito(opcoes: { pacotes?: number; data?: Date } = {}): Promise<CenarioDistrito> {
  const canal = await criarCanal();
  const unidade = await criarUnidade({ canalProsioId: canal.canal.id });
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  const carteiro = await criarCarteiro({ unidadeId: unidade.id });
  const distrito = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: carteiro.id });
  const carga = await criarCarga({ distritoId: distrito.id, data: opcoes.data ?? dia() });
  const pacotes: PacoteDia[] = [];
  for (let i = 0; i < (opcoes.pacotes ?? 3); i += 1) {
    pacotes.push(await criarPacote({ cargaId: carga.id, data: carga.data }));
  }
  return { canal, unidade, supervisor, carteiro, distrito, carga, pacotes };
}
