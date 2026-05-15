import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  interface ImportMetaEnv {
    readonly VITE_CHATWOOT_BASE_URL?: string;
    readonly VITE_CHATWOOT_URL?: string;
    readonly VITE_WHATSAPP_CONSOLE_API_URL?: string;
    readonly VITE_WHATSAPP_CONSOLE_CHATWOOT_URL?: string;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'whatsapp-console': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
      'api-url': string;
      'auth-token': string;
      'chatwoot-url'?: string;
      class?: string;
      'cross-tenant-conversations'?: 'true' | 'false';
      'initial-path'?: string;
      locale?: string;
      mode?: 'admin' | 'tenant';
      'platform-admin'?: 'true' | 'false';
      'system-name'?: string;
    };
  }
  }
}

declare module '*.js';

export {};
