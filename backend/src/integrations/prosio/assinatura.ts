/**
 * Assinatura dos callbacks do Prosio (ADR-014): `X-Webhook-Signature:
 * sha256=<hex>`, HMAC-SHA256 do corpo CRU com o `callbackSecret` do canal —
 * o mesmo formato de `messaging-status-callback-consumer` e
 * `mediation-outcome-consumer` do Prosio.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const PREFIXO = 'sha256=';
const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/** Valor do header `X-Webhook-Signature` para `corpo` (usado pelos falsos dos testes). */
export function assinarCorpo(corpo: Buffer | string, segredo: string): string {
  return `${PREFIXO}${createHmac('sha256', segredo).update(corpo).digest('hex')}`;
}

/**
 * `true` só quando `header` é `sha256=<64 hex>` e bate com o HMAC do corpo.
 * Nunca lança: header ausente, sem prefixo, com hex inválido ou de tamanho
 * errado, e segredo vazio, respondem `false`. A comparação é em tempo constante.
 */
export function verificarAssinatura(corpoCru: Buffer, header: string, segredo: string): boolean {
  try {
    if (typeof header !== 'string' || typeof segredo !== 'string' || segredo.length === 0) return false;
    if (!Buffer.isBuffer(corpoCru)) return false;
    const valor = header.trim();
    if (!valor.startsWith(PREFIXO)) return false;
    const hex = valor.slice(PREFIXO.length);
    if (!HEX_SHA256.test(hex)) return false;

    const recebido = Buffer.from(hex, 'hex');
    const esperado = createHmac('sha256', segredo).update(corpoCru).digest();
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  } catch {
    return false;
  }
}
