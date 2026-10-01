/**
 * Apoio aos testes de integração da captura: dependências falsas (CEP, LLM, fotos
 * em diretório temporário, relógio fixo), semente padrão do `_tests.md` e envio
 * multipart de uma captura.
 */
import { randomUUID } from 'crypto';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import type { Carteiro, Distrito, Unidade, Usuario } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import {
  criarCarteiro,
  criarCarteiroComLogin,
  criarDistrito,
  criarSupervisor,
  criarUnidade,
  dia,
} from '../../../__tests__/fixtures/entregas';
import { tokenPara } from '../../../__tests__/helpers/login';
import { configurarCaptura, redefinirCaptura } from '../captura.contexto';
import type { CepInfo, CepService, ResultadoCep } from '../captura.types';
import { DistritoDoDiaService, MemoriaAtivoStore } from '../distrito-do-dia.service';
import { FakeLabelExtractor } from '../extraction.service';
import { DiskPhotoStore } from '../photo-store';

export const HOJE = dia('2026-09-30');
export const AGORA = new Date('2026-09-30T12:00:00-03:00');
export const DIR_ROTULOS = path.resolve(__dirname, '../../../__tests__/fixtures/rotulos');

// ——— CEP falso ————————————————————————————————————————————————————

export const CEPS: Record<string, CepInfo> = {
  '72115040': { cep: '72115040', logradouro: 'QNC 4', bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF' },
  '71919360': { cep: '71919360', logradouro: 'Rua 25 Norte', bairro: 'Águas Claras', cidade: 'Brasília', uf: 'DF' },
  '73800000': { cep: '73800000', logradouro: null, bairro: null, cidade: 'Formosa', uf: 'GO' },
};

export class FakeCepService implements CepService {
  chamadas: string[] = [];
  private forcado: ResultadoCep | null = null;

  forcar(r: ResultadoCep | null): this {
    this.forcado = r;
    return this;
  }

  async lookup(cep: string): Promise<ResultadoCep> {
    const d = cep.replace(/\D/g, '');
    this.chamadas.push(d);
    if (this.forcado) return this.forcado;
    return CEPS[d] ?? 'NAO_ENCONTRADO';
  }
}

// ——— Dependências ————————————————————————————————————————————————

export interface AmbienteCaptura {
  cep: FakeCepService;
  llm: FakeLabelExtractor;
  fotos: DiskPhotoStore;
  dirFotos: string;
  relogio: { agora: Date };
}

export function prepararAmbiente(): AmbienteCaptura {
  const dirFotos = mkdtempSync(path.join(os.tmpdir(), 'captura-fotos-'));
  const relogio = { agora: AGORA };
  const now = () => relogio.agora;
  const amb: AmbienteCaptura = {
    cep: new FakeCepService(),
    llm: new FakeLabelExtractor(DIR_ROTULOS),
    fotos: new DiskPhotoStore(dirFotos),
    dirFotos,
    relogio,
  };
  configurarCaptura({
    cep: amb.cep,
    extractor: amb.llm,
    photoStore: amb.fotos,
    now,
    distritoDoDia: new DistritoDoDiaService({ now, ativoStore: new MemoriaAtivoStore() }),
  });
  return amb;
}

export function desmontarAmbiente(amb: AmbienteCaptura): void {
  redefinirCaptura();
  rmSync(amb.dirFotos, { recursive: true, force: true });
}

/** Volta os fakes ao padrão entre testes. */
export function redefinirFakes(amb: AmbienteCaptura): void {
  amb.cep.forcar(null);
  amb.cep.chamadas = [];
  amb.llm.redefinir();
  amb.relogio.agora = AGORA;
}

// ——— Semente ——————————————————————————————————————————————————————

export interface CarteiroLogado {
  usuario: Usuario;
  carteiro: Carteiro;
  token: string;
}

export interface Semente {
  u1: Unidade;
  u2: Unidade;
  d01: Distrito;
  d03: Distrito;
  d05: Distrito;
  d90: Distrito;
  c1: CarteiroLogado;
  c2: CarteiroLogado;
  c3: CarteiroLogado;
  c9: CarteiroLogado;
  c4: Carteiro;
  s1: Usuario;
}

async function logado(unidadeId: string, senhaTemporaria = false): Promise<CarteiroLogado> {
  const { usuario, carteiro } = await criarCarteiroComLogin({ unidadeId, senhaTemporaria });
  return { usuario, carteiro, token: tokenPara({ id: usuario.id, role: 'CARTEIRO', unidadeId }) };
}

/**
 * U1 com D-01 (padrão C2), D-03 (padrão C1) e D-05; C3 sem distrito; C4 sem login;
 * S1 supervisor. U2 com D-90 (padrão C9).
 */
export async function semear(): Promise<Semente> {
  const u1 = await criarUnidade();
  const u2 = await criarUnidade();
  const c1 = await logado(u1.id);
  const c2 = await logado(u1.id);
  const c3 = await logado(u1.id);
  const c9 = await logado(u2.id);
  const c4 = await criarCarteiro({ unidadeId: u1.id });
  const s1 = await criarSupervisor({ unidadeId: u1.id });
  const d01 = await criarDistrito({ unidadeId: u1.id, codigo: 'D-01', nome: 'Taguatinga Centro', carteiroPadraoId: c2.carteiro.id });
  const d03 = await criarDistrito({ unidadeId: u1.id, codigo: 'D-03', nome: 'Águas Claras Sul', carteiroPadraoId: c1.carteiro.id });
  const d05 = await criarDistrito({ unidadeId: u1.id, codigo: 'D-05', nome: 'Vicente Pires' });
  const d90 = await criarDistrito({ unidadeId: u2.id, codigo: 'D-90', nome: 'Outra unidade', carteiroPadraoId: c9.carteiro.id });
  return { u1, u2, d01, d03, d05, d90, c1, c2, c3, c9, c4, s1 };
}

// ——— Fixtures de rótulo ——————————————————————————————————————————

interface Esperado {
  objeto: string | null;
  cepLinear: string | null;
  dataMatrixRaw: string | null;
  multiplos: boolean;
}

const indice = JSON.parse(readFileSync(path.join(DIR_ROTULOS, 'rotulos.json'), 'utf8')) as Array<{ arquivo: string; esperado: Esperado }>;

export type NomeRotulo =
  | 'rotulo-completo'
  | 'rotulo-sem-datamatrix'
  | 'rotulo-dm-sem-telefone'
  | 'rotulo-codigo-danificado'
  | 'rotulo-dois'
  | 'rotulo-escuro'
  | 'rotulo-cep-unico';

export function jpegDe(nome: NomeRotulo): Buffer {
  return readFileSync(path.join(DIR_ROTULOS, `${nome}.jpg`));
}

export function barcodesDe(nome: NomeRotulo): Esperado {
  const e = indice.find((i) => i.arquivo === `${nome}.jpg`);
  if (!e) throw new Error(`fixture ${nome} ausente`);
  return { ...e.esperado };
}

export interface MetaTeste {
  capturaId: string;
  distritoId: string;
  data: string;
  capturadoEm: string;
  barcodes: Esperado;
  codigoDigitado: boolean;
  codigo: string;
}

export function meta(distritoId: string, over: Partial<MetaTeste> & { rotulo?: NomeRotulo } = {}): MetaTeste {
  const { rotulo = 'rotulo-completo', ...resto } = over;
  const barcodes = barcodesDe(rotulo);
  return {
    capturaId: randomUUID(),
    distritoId,
    data: '2026-09-30',
    capturadoEm: new Date(AGORA.getTime() - 60_000).toISOString(),
    barcodes,
    codigoDigitado: false,
    codigo: barcodes.objeto ?? 'OY716488072BR',
    ...resto,
  };
}

/** Rótulo "sem códigos": só o código do objeto (sem CEP linear nem DataMatrix). */
export function barcodesSo(objeto: string): Esperado {
  return { objeto, cepLinear: null, dataMatrixRaw: null, multiplos: false };
}

// ——— HTTP —————————————————————————————————————————————————————————

export function auth(token: string) {
  return { Authorization: `Bearer ${token}`, Connection: 'close' };
}

export function enviar(token: string, m: MetaTeste, jpeg: Buffer = jpegDe('rotulo-completo')) {
  return request(app)
    .post('/api/v1/captura/capturas')
    .set(auth(token))
    .field('meta', JSON.stringify(m))
    .attach('foto', jpeg, { filename: 'rotulo.jpg', contentType: 'image/jpeg' });
}

export function api() {
  return request(app);
}

export async function eventos(pacoteId: string | null, tipo?: string) {
  return prisma.eventoPacote.findMany({
    where: { ...(pacoteId ? { pacoteId } : {}), ...(tipo ? { tipo } : {}) },
    orderBy: { criadoEm: 'asc' },
  });
}
