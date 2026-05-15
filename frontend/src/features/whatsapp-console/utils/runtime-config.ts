// Backend Correios expoe o proxy do ms-whatsapp em /api/v1/comunicacao.
// Espelha a estrategia do Delivyo que usa /api/comunicacao.
const DEFAULT_API_URL = '/api/v1/comunicacao';
const DEFAULT_SYSTEM_NAME = 'Correios Entregas';
const DEFAULT_LOCALE = 'pt_BR';

function readEnv(key: 'VITE_WHATSAPP_CONSOLE_API_URL' | 'VITE_WHATSAPP_CONSOLE_CHATWOOT_URL' | 'VITE_CHATWOOT_BASE_URL' | 'VITE_CHATWOOT_URL') {
  return import.meta.env[key]?.trim() || '';
}

function normalizeAuthToken(token: string) {
  return token.replace(/^Bearer\s+/i, '').trim();
}

export type WhatsAppConsoleMode = 'admin' | 'tenant';

export interface WhatsAppConsoleRuntimeConfigInput {
  apiUrl?: string;
  authToken: string;
  chatwootUrl?: string;
  crossTenantConversations?: boolean;
  initialPath: string;
  locale?: string;
  mode?: WhatsAppConsoleMode;
  platformAdmin: boolean;
  systemName?: string;
}

export function getWhatsAppConsoleRuntimeConfig(input: WhatsAppConsoleRuntimeConfigInput) {
  return {
    apiUrl: input.apiUrl?.trim() || readEnv('VITE_WHATSAPP_CONSOLE_API_URL') || DEFAULT_API_URL,
    chatwootUrl:
      input.chatwootUrl?.trim() ||
      readEnv('VITE_WHATSAPP_CONSOLE_CHATWOOT_URL') ||
      readEnv('VITE_CHATWOOT_BASE_URL') ||
      readEnv('VITE_CHATWOOT_URL'),
    authToken: normalizeAuthToken(input.authToken),
    crossTenantConversations: input.crossTenantConversations ?? false,
    initialPath: input.initialPath,
    locale: input.locale?.trim() || DEFAULT_LOCALE,
    mode: input.mode ?? (input.platformAdmin ? 'admin' : 'tenant'),
    platformAdmin: input.platformAdmin,
    systemName: input.systemName?.trim() || DEFAULT_SYSTEM_NAME,
  };
}
