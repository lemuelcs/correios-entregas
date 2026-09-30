/**
 * Normalização de telefones brasileiros para E.164 (+55DDNNNNNNNNN).
 *
 * Aceita máscaras comuns ("(61) 99812-4412", "+55 61 99812-4412", "061 9812-4412").
 * Celular antigo com 8 dígitos começando em 6–9 ganha o nono dígito.
 * Fixo (8 dígitos começando em 2–5) é mantido com 8 dígitos.
 */

export type CodigoTelefoneInvalido = 'sem_ddd' | 'formato';

export class TelefoneInvalido extends Error {
  readonly codigo: CodigoTelefoneInvalido;

  constructor(codigo: CodigoTelefoneInvalido) {
    super(codigo);
    this.name = 'TelefoneInvalido';
    this.codigo = codigo;
  }
}

/** DDDs em uso no Brasil (Anatel). */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const CARACTERES_PERMITIDOS = /^\+?[\d\s().-]+$/;

export function normalizarTelefone(entrada: string): string {
  const bruto = (entrada ?? '').trim();
  if (!bruto || !CARACTERES_PERMITIDOS.test(bruto)) {
    throw new TelefoneInvalido('formato');
  }

  const comMais = bruto.startsWith('+');
  let digitos = bruto.replace(/\D/g, '');

  if (comMais) {
    // E.164 explícito: só Brasil.
    if (!digitos.startsWith('55')) throw new TelefoneInvalido('formato');
    digitos = digitos.slice(2);
  } else if (digitos.length >= 12 && digitos.startsWith('55')) {
    // 55 + DDD + 8 ou 9 dígitos, sem o "+".
    digitos = digitos.slice(2);
  } else if (digitos.startsWith('0')) {
    // Prefixo de discagem interurbana (0DD…).
    digitos = digitos.slice(1);
  }

  if (digitos.length === 8 || digitos.length === 9) {
    throw new TelefoneInvalido('sem_ddd');
  }
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new TelefoneInvalido('formato');
  }

  const ddd = Number(digitos.slice(0, 2));
  let numero = digitos.slice(2);
  if (!DDDS_VALIDOS.has(ddd)) throw new TelefoneInvalido('formato');

  if (numero.length === 9) {
    if (numero[0] !== '9') throw new TelefoneInvalido('formato');
  } else if (/^[6-9]/.test(numero)) {
    numero = `9${numero}`; // celular antigo: insere o nono dígito
  } else if (!/^[2-5]/.test(numero)) {
    throw new TelefoneInvalido('formato');
  }

  return `+55${ddd}${numero}`;
}

/** Máscara para logs: mantém DDD e os 4 últimos dígitos. */
export function mascararTelefone(e164: string): string {
  if (e164.length < 8) return '***';
  return `${e164.slice(0, 5)}*****${e164.slice(-4)}`;
}
