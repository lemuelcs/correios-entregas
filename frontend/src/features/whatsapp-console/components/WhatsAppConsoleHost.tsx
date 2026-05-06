import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { loadWhatsAppConsoleElement } from '../utils/loadWhatsAppConsoleElement';
import { getWhatsAppConsoleRuntimeConfig } from '../utils/runtime-config';

export interface WhatsAppConsoleHostProps {
  apiUrl?: string;
  chatwootUrl?: string;
  initialPath?: string;
  platformAdmin?: boolean;
}

export function WhatsAppConsoleHost({
  apiUrl,
  chatwootUrl,
  initialPath = '/configuracoes',
  platformAdmin = false,
}: WhatsAppConsoleHostProps) {
  const accessToken = useAuthStore((state) => state.accessToken) ?? localStorage.getItem('accessToken') ?? '';
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const runtimeConfig = useMemo(
    () => getWhatsAppConsoleRuntimeConfig({
      apiUrl,
      authToken: accessToken,
      chatwootUrl,
      initialPath,
      platformAdmin,
    }),
    [accessToken, apiUrl, chatwootUrl, initialPath, platformAdmin],
  );

  useEffect(() => {
    let active = true;

    loadWhatsAppConsoleElement()
      .then(() => {
        if (active) {
          setStatus('ready');
        }
      })
      .catch((error) => {
        console.error('Falha ao carregar <whatsapp-console>.', error);
        if (active) {
          setStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === 'error') {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold">Nao foi possivel carregar o console do WhatsApp.</h2>
            <p className="text-sm text-red-600">
              Verifique se o bundle do Web Component foi gerado em
              {' '}
              <code>/root/dev/delivyo-services/apps/whatsapp-console/dist</code>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Carregando console do WhatsApp...
          </div>
        </div>
      )}

      <whatsapp-console
        key={`${runtimeConfig.initialPath}:${runtimeConfig.platformAdmin ? 'admin' : 'workspace'}`}
        api-url={runtimeConfig.apiUrl}
        chatwoot-url={runtimeConfig.chatwootUrl}
        auth-token={runtimeConfig.authToken}
        initial-path={runtimeConfig.initialPath}
        platform-admin={runtimeConfig.platformAdmin ? 'true' : 'false'}
        className="block min-h-[78vh] w-full"
      />
    </section>
  );
}
