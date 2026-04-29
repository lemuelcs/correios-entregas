import { api } from '@/services/api';

export interface TermDef {
  singular: string;
  plural: string;
}

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export type LocaleTerms = Partial<Record<Locale, TermDef>>;

export interface TerminologyV2 {
  schemaVersion: 'v2';
  terms: Record<string, LocaleTerms>;
}

export const SUPPORTED_TERM_LOCALES: Locale[] = ['pt-BR', 'en-US', 'es-ES'];

const ENDPOINT = '/comunicacao/admin/terminology';

// O api client usa BASE_URL = '/api/v1' internamente.
// O proxy do Vite mapeia '/api/v1/comunicacao' -> hub WhatsApp.

interface MaybeWrappedResponse {
  data?: unknown;
}

export async function getTerminology(): Promise<TerminologyV2> {
  const result = await api.get<TerminologyV2 | MaybeWrappedResponse>(ENDPOINT);
  if (
    result &&
    typeof result === 'object' &&
    'data' in result &&
    (result as MaybeWrappedResponse).data &&
    typeof (result as MaybeWrappedResponse).data === 'object'
  ) {
    return (result as MaybeWrappedResponse).data as TerminologyV2;
  }
  return result as TerminologyV2;
}

export async function updateTerminology(payload: TerminologyV2): Promise<void> {
  await api.put(ENDPOINT, payload);
}
