/**
 * locale.ts
 * Resolução centralizada de locale, timezone e nome do DSP.
 * Substitui hardcoded defaults espalhados por webhook.handler, session.service, bot.service e routes.
 */

export const DEFAULT_LOCALE = 'pt_BR';
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
export const DEFAULT_DSP_NOME = process.env.DEFAULT_DSP_NOME || 'Correios';

export function resolveLocale(config: { locale?: string | null } | null | undefined): string {
  return config?.locale || DEFAULT_LOCALE;
}

export function resolveTimezone(config: { timezone?: string | null } | null | undefined): string {
  return config?.timezone || DEFAULT_TIMEZONE;
}

export function resolveDspNome(
  config: { unidadeNome?: string | null; dspNome?: string | null } | null | undefined,
): string {
  return config?.unidadeNome || config?.dspNome || DEFAULT_DSP_NOME;
}

/**
 * Extrai código de idioma curto (2 letras) do locale.
 * Ex: 'pt_BR' → 'pt', 'en_US' → 'en', 'es_ES' → 'es'
 */
export function shortLang(locale: string): string {
  return locale.split(/[_-]/)[0].toLowerCase();
}
