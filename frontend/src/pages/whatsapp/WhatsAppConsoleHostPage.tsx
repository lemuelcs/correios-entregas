import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';

const WHATSAPP_CONSOLE_SCRIPT_ID = 'whatsapp-console-element-script';
const WHATSAPP_CONSOLE_SCRIPT_SRC = '/whatsapp-console-element.js';

let scriptPromise: Promise<void> | null = null;

function loadWhatsAppConsoleScript() {
  if (typeof window === 'undefined' || customElements.get('whatsapp-console')) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(WHATSAPP_CONSOLE_SCRIPT_ID) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Nao foi possivel carregar o WhatsApp Console.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = WHATSAPP_CONSOLE_SCRIPT_ID;
      script.type = 'module';
      script.src = WHATSAPP_CONSOLE_SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Nao foi possivel carregar o WhatsApp Console.'));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

interface WhatsAppConsoleHostPageProps {
  initialPath: string;
  platformAdmin?: boolean;
}

export function WhatsAppConsoleHostPage({
  initialPath,
  platformAdmin = false,
}: WhatsAppConsoleHostPageProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(() => typeof window !== 'undefined' && !!customElements.get('whatsapp-console'));

  // Proxy do ms-whatsapp no backend Correios fica em /api/v1/comunicacao.
  const apiUrl = useMemo(() => `${window.location.origin}/api/v1/comunicacao`, []);
  const chatwootUrl = import.meta.env.VITE_CHATWOOT_BASE_URL || '';
  const mode = platformAdmin ? 'admin' : 'tenant';

  useEffect(() => {
    let cancelled = false;

    loadWhatsAppConsoleScript()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setIsReady(false);
          setLoadError(error instanceof Error ? error.message : 'Nao foi possivel carregar o WhatsApp Console.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500 shadow-sm">
          Carregando WhatsApp Console...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-12rem)]">
      <whatsapp-console
        key={initialPath}
        api-url={apiUrl}
        auth-token={accessToken || ''}
        chatwoot-url={chatwootUrl}
        className="block min-h-[calc(100vh-12rem)] w-full"
        cross-tenant-conversations="false"
        initial-path={initialPath}
        locale="pt_BR"
        mode={mode}
        platform-admin={platformAdmin ? 'true' : 'false'}
        system-name="Correios Entregas"
      />
    </div>
  );
}

interface WhatsAppFlowEditorHostPageProps {
  platformAdmin?: boolean;
}

export function WhatsAppFlowEditorHostPage({
  platformAdmin = false,
}: WhatsAppFlowEditorHostPageProps) {
  const { flowId } = useParams();
  const initialPath = flowId ? `/flows/${flowId}/edit` : '/flows';

  return <WhatsAppConsoleHostPage initialPath={initialPath} platformAdmin={platformAdmin} />;
}
