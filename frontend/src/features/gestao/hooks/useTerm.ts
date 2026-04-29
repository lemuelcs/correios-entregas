import { useTerminologiaStore } from '@/stores/terminologia.store';
import type { Locale } from '@/features/gestao/api/terminologia.api';

interface UseTermOptions {
  plural?: boolean;
  locale?: Locale;
}

/**
 * Hook utilitario para consumir a terminologia configurada.
 * Carrega de forma reativa do store. Se a terminologia ainda nao foi
 * carregada ou se o termo nao existir, retorna a propria chave como fallback.
 *
 * Use em conjunto com `useTerminologiaStore.getState().load()` em um ponto
 * raiz da aplicacao (ex: GestaoShell) para garantir que os dados estejam
 * disponiveis.
 */
export function useTerm(key: string, options?: UseTermOptions): string {
  const terminology = useTerminologiaStore((state) => state.terminology);
  const locale: Locale = options?.locale ?? 'pt-BR';
  const plural = options?.plural ?? false;
  const term = terminology?.terms?.[key]?.[locale];
  if (!term) return key;
  return plural ? term.plural : term.singular;
}
