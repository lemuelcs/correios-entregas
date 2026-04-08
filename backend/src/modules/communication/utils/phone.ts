/**
 * phone.ts
 * Utilitários centralizados de normalização de telefone.
 * Substitui duplicação em evolution.client, participant.service, routes e bot.service.
 */

/** Remove todos os caracteres não numéricos */
export function stripNonDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Extrai número de telefone de um JID do WhatsApp.
 * Ex: "5561999999999@s.whatsapp.net" → "5561999999999"
 */
export function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Normaliza telefone para formato E.164 sem "+" (ex: "5521999992121").
 * Garante que números BR de 10-11 dígitos recebam prefixo "55".
 * Trata o 9º dígito ausente em celulares BR (WhatsApp pode retornar 12 dígitos).
 */
export function normalizePhoneE164(raw: string): string {
  const digits = stripNonDigits(raw);
  if (digits.startsWith('55') && digits.length >= 12) {
    // 12 dígitos = 55 + DDD(2) + 8 dígitos → falta o 9º dígito
    if (digits.length === 12) {
      return digits.slice(0, 4) + '9' + digits.slice(4);
    }
    return digits;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    let local = digits;
    // 10 dígitos = DDD(2) + 8 dígitos → falta o 9º dígito
    if (local.length === 10) {
      local = local.slice(0, 2) + '9' + local.slice(2);
    }
    return '55' + local;
  }
  return digits;
}

/**
 * Normaliza para formato local BR de 11 dígitos (DDD + 9 + 8 dígitos).
 * Trata números E.164 com ou sem código de país 55, e o caso do
 * 9º dígito ausente (formato antigo do WhatsApp/Meta).
 */
export function normalizePhoneBR(phone: string): string {
  const digits = stripNonDigits(phone);
  // Remove código de país 55 se presente (12+ dígitos começando com 55)
  let local =
    digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  // Se 10 dígitos (DDD + 8), insere o 9º dígito
  if (local.length === 10) {
    local = local.slice(0, 2) + '9' + local.slice(2);
  }
  return local;
}

/** Formata telefone para exibição: (XX) XXXXX-XXXX */
export function formatPhoneDisplay(phone: string): string {
  const digits = stripNonDigits(phone);
  const local = digits.length > 11 ? digits.slice(-11) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return phone;
}
