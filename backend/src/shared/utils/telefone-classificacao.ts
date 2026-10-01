/**
 * Classificação de telefone lido do rótulo (captura): WhatsApp (celular) × fixo,
 * e igualdade entre formatações. Funções puras sobre `normalizarTelefone`.
 */
import { normalizarTelefone, TelefoneInvalido } from './telefone';

export interface TelefoneClassificado {
  /** Celular em E.164: o número que recebe WhatsApp. */
  whatsappE164: string | null;
  /** Fixo em E.164: guardado, mas o pacote conta como sem WhatsApp. */
  outro: string | null;
}

/** Celular BR em E.164: +55 + DDD + 9 dígitos começando em 9. */
const CELULAR_E164 = /^\+55\d{2}9\d{8}$/;

/**
 * Entrada vazia → os dois nulos. Entrada malformada lança `TelefoneInvalido`
 * (mesma regra de `normalizarTelefone`).
 */
export function classificarTelefone(entrada: string | null | undefined): TelefoneClassificado {
  if (entrada == null || entrada.trim() === '') return { whatsappE164: null, outro: null };
  const e164 = normalizarTelefone(entrada);
  return CELULAR_E164.test(e164) ? { whatsappE164: e164, outro: null } : { whatsappE164: null, outro: e164 };
}

function normalizarOuNulo(entrada: string | null | undefined): string | null | undefined {
  if (entrada == null || entrada.trim() === '') return null;
  try {
    return normalizarTelefone(entrada);
  } catch (err) {
    if (err instanceof TelefoneInvalido) return undefined;
    throw err;
  }
}

/**
 * Mesmo número, independente da formatação. Dois vazios são iguais; vazio × número
 * é diferente. Um lado malformado só é igual se o texto bruto for idêntico.
 */
export function mesmoNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarOuNulo(a);
  const nb = normalizarOuNulo(b);
  if (na === undefined || nb === undefined) return (a ?? '').trim() === (b ?? '').trim();
  return na === nb;
}
