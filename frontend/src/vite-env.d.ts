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
      'initial-path'?: string;
      'platform-admin'?: 'true' | 'false';
    };
  }
}
