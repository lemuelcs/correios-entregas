// Cópia de backend/src/shared/utils/sigep-datamatrix.ts para validar offline no aparelho.
// Manter idêntica à origem (o teste de paridade compara as duas).

/**
 * DataMatrix do rótulo SIGEP dos Correios (ADR-011).
 *
 * Módulo puro (sem Node, sem I/O): o app do carteiro usa uma cópia dele para
 * validar offline, e o servidor revalida o que o aparelho mandou.
 *
 * Um DataMatrix que não segue o layout devolve `null` — o fluxo cai para o
 * código linear mais o LLM. Nunca lança exceção.
 */
import { normalizeS10, validateS10 } from './s10';

/**
 * Posições (0-based, fim exclusivo) do layout de postagem eletrônica SIGEP.
 *
 * Fonte: manual de implementação do SIGEP WEB (DataMatrix 2D da etiqueta) e a
 * montagem de referência do php-sigep. A posição do complemento (20 caracteres,
 * depois do número do logradouro) e o preenchimento do telefone (12 dígitos,
 * zeros à esquerda) PRECISAM SER CONFIRMADOS com rótulos reais anonimizados.
 */
export const LAYOUT_SIGEP = {
  cepDestino: [0, 8],
  complementoCepDestino: [8, 13], // número do destinatário, 5 dígitos
  cepOrigem: [13, 21],
  complementoCepOrigem: [21, 26],
  validadorCepDestino: [26, 27],
  idv: [27, 29],
  codigo: [29, 42], // código do objeto (S10)
  servicosAdicionais: [42, 54],
  cartaoPostagem: [54, 64],
  codigoServico: [64, 69],
  agrupamento: [69, 71],
  numero: [71, 76], // número do logradouro do destinatário
  complemento: [76, 96],
  valorDeclarado: [96, 101],
  telefone: [101, 113], // DDD + telefone do destinatário; zerado quando ausente
  latitude: [113, 123],
  longitude: [123, 133],
} as const satisfies Record<string, readonly [number, number]>;

type CampoLayout = keyof typeof LAYOUT_SIGEP;

/** O parser só lê até o telefone; o resto (coordenadas, `|`, reserva do cliente) é opcional. */
export const TAMANHO_MINIMO_SIGEP = LAYOUT_SIGEP.telefone[1];

export interface SigepDataMatrix {
  cepDestino: string;
  /** Código S10 com DV válido; `null` quando o DV não confere. */
  codigo: string | null;
  numero: string | null;
  complemento: string | null;
  /** Só dígitos (DDD + número), sem zeros de preenchimento; `null` quando zerado. */
  telefone: string | null;
}

function fatia(raw: string, campo: CampoLayout): string {
  const [ini, fim] = LAYOUT_SIGEP[campo];
  return raw.slice(ini, fim);
}

function semZerosAEsquerda(valor: string): string | null {
  const limpo = valor.trim().replace(/^0+/, '');
  return limpo === '' ? null : limpo;
}

export function parseSigepDataMatrix(raw: string | null | undefined): SigepDataMatrix | null {
  if (typeof raw !== 'string' || raw.length < TAMANHO_MINIMO_SIGEP) return null;

  const cepDestino = fatia(raw, 'cepDestino');
  if (!/^\d{8}$/.test(cepDestino)) return null;

  const codigoBruto = normalizeS10(fatia(raw, 'codigo'));
  const codigo = validateS10(codigoBruto, { qualquerPais: true }).valid ? codigoBruto : null;

  const numeroBruto = fatia(raw, 'numero').trim();
  const numero = /^\d+$/.test(numeroBruto) ? semZerosAEsquerda(numeroBruto) : numeroBruto || null;

  const complemento = fatia(raw, 'complemento').trim() || null;

  const telefoneBruto = fatia(raw, 'telefone').trim();
  const telefone = /^\d+$/.test(telefoneBruto) ? semZerosAEsquerda(telefoneBruto) : null;

  return { cepDestino, codigo, numero, complemento, telefone };
}

export interface MontarSigepInput {
  cepDestino: string;
  codigo: string;
  numero?: string | null;
  complemento?: string | null;
  telefone?: string | null;
  cepOrigem?: string;
  numeroOrigem?: string;
  servicosAdicionais?: string;
  cartaoPostagem?: string;
  codigoServico?: string;
  valorDeclarado?: string;
  /** Reserva do cliente, depois do `|`. */
  reserva?: string;
}

/** Dígito validador do CEP: o que falta para a soma dos dígitos chegar à dezena seguinte. */
export function validadorCep(cep: string): number {
  const soma = cep.split('').reduce((acc, d) => acc + Number(d), 0);
  return (10 - (soma % 10)) % 10;
}

function numerico(valor: string | null | undefined, tamanho: number): string {
  return (valor ?? '').replace(/\D/g, '').padStart(tamanho, '0').slice(-tamanho);
}

function texto(valor: string | null | undefined, tamanho: number): string {
  return (valor ?? '').padEnd(tamanho, ' ').slice(0, tamanho);
}

/**
 * Inverso de `parseSigepDataMatrix`: monta a string do DataMatrix no mesmo layout.
 * Usado pelas fixtures de rótulo e pelos testes.
 */
export function montarSigepDataMatrix(input: MontarSigepInput): string {
  const numero = numerico(input.numero, 5);
  return [
    numerico(input.cepDestino, 8),
    numero,
    numerico(input.cepOrigem ?? '70002900', 8),
    numerico(input.numeroOrigem ?? '1', 5),
    String(validadorCep(numerico(input.cepDestino, 8))),
    '51',
    texto(input.codigo, 13),
    numerico(input.servicosAdicionais ?? '250000000000', 12),
    numerico(input.cartaoPostagem ?? '0067599079', 10),
    numerico(input.codigoServico ?? '03220', 5),
    '01',
    numero,
    texto(input.complemento, 20),
    numerico(input.valorDeclarado, 5),
    numerico(input.telefone, 12),
    '-00.000000',
    '-00.000000',
    '|',
    texto(input.reserva, 30),
  ].join('');
}
