/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module '*.css' {
  const content: string;
  export default content;
}

declare namespace JSX {
  interface IntrinsicElements {
    'whatsapp-console': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
      'api-url'?: string;
      'auth-token'?: string;
      'chatwoot-url'?: string;
      'cross-tenant-conversations'?: 'true' | 'false';
      'initial-path'?: string;
      locale?: string;
      mode?: 'admin' | 'tenant';
      'platform-admin'?: 'true' | 'false';
      'system-name'?: string;
    };
  }
}
