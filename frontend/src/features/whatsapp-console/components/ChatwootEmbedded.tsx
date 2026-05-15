import { useEffect, useState } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { api } from '@/services/api';

interface ChatwootSsoResponse {
  url: string;
  expiresAt?: string;
}

export interface ChatwootEmbeddedProps {
  unidadeId?: string;
}

// TODO(correios-backend-sso): o endpoint GET /api/v1/comunicacao/chatwoot/sso
// ainda nao existe no backend do Correios (vide
// `backend/src/modules/communication/`). Quando for criado deve devolver
// `{ url, expiresAt }` apontando para a URL do Chatwoot com o magic-link/SSO
// do usuario autenticado (mesmo contrato do Delivyo em
// `/api/comunicacao/chatwoot/sso`). Enquanto isso o componente exibe um
// placeholder informativo em vez do iframe.
export function ChatwootEmbedded({ unidadeId }: ChatwootEmbeddedProps) {
  const [data, setData] = useState<ChatwootSsoResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setErrorMessage(null);

    const query = unidadeId ? `?unidadeId=${encodeURIComponent(unidadeId)}` : '';

    api
      .get<ChatwootSsoResponse>(`/comunicacao/chatwoot/sso${query}`)
      .then((response) => {
        if (cancelled) return;
        if (!response?.url) {
          setStatus('error');
          setErrorMessage('Resposta de SSO invalida do backend.');
          return;
        }
        setData(response);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Falha ao autenticar no Chatwoot.';
        // 404 indica que o endpoint ainda nao existe — diferenciamos para nao
        // assustar o usuario enquanto a Frente de Backend nao publica o SSO.
        if (/404|not\s*found/i.test(message)) {
          setStatus('unavailable');
        } else {
          setStatus('error');
          setErrorMessage(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [unidadeId]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Conectando ao atendimento Chatwoot...
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="font-semibold">Atendimento Chatwoot ainda nao disponivel.</h2>
              <p>
                O endpoint <code>/api/v1/comunicacao/chatwoot/sso</code> ainda nao foi publicado pelo
                backend do Correios. Assim que a integracao SSO estiver pronta, o painel sera carregado
                automaticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !data?.url) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {errorMessage ?? 'Falha ao autenticar no Chatwoot.'}
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={data.url}
      style={{ width: '100%', height: 'calc(100vh - 96px)', border: 0 }}
      allow="microphone; camera; clipboard-read; clipboard-write"
      title="Chatwoot"
    />
  );
}
