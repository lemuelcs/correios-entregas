const DEFAULT_API_URL = '/api/v1';

function readEnv(key: 'VITE_WHATSAPP_CONSOLE_API_URL' | 'VITE_WHATSAPP_CONSOLE_CHATWOOT_URL' | 'VITE_CHATWOOT_BASE_URL' | 'VITE_CHATWOOT_URL') {
  return import.meta.env[key]?.trim() || '';
}

function normalizeAuthToken(token: string) {
  return token.replace(/^Bearer\s+/i, '').trim();
}

export interface WhatsAppConsoleRuntimeConfigInput {
  apiUrl?: string;
  authToken: string;
  chatwootUrl?: string;
  initialPath: string;
  platformAdmin: boolean;
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
    initialPath: input.initialPath,
    platformAdmin: input.platformAdmin,
  };
}
