import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, ExternalLink, MessageCircleMore, MessagesSquare } from 'lucide-react';

import { AlertBanner } from '@/shared/ui/AlertBanner';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';

type LegacyCommunicationArea = 'gestao' | 'unidade';

type RedirectKind = 'chatwoot' | 'console' | 'generic';

interface RedirectTarget {
  kind: RedirectKind;
  label: string;
  url: string;
}

interface LegacyCommunicationRedirectProps {
  area: LegacyCommunicationArea;
}

const QUERY_TARGETS: Array<{ kind: RedirectKind; key: string; label: string }> = [
  { kind: 'chatwoot', key: 'chatwootUrl', label: 'Abrir Chatwoot' },
  { kind: 'chatwoot', key: 'chatwoot_url', label: 'Abrir Chatwoot' },
  { kind: 'console', key: 'whatsappUrl', label: 'Abrir central WhatsApp' },
  { kind: 'console', key: 'whatsapp_url', label: 'Abrir central WhatsApp' },
  { kind: 'generic', key: 'redirectTo', label: 'Abrir nova central' },
  { kind: 'generic', key: 'redirect_to', label: 'Abrir nova central' },
];

const ENV_TARGETS: Array<{ kind: RedirectKind; key: string; label: string }> = [
  { kind: 'chatwoot', key: 'VITE_CHATWOOT_URL', label: 'Abrir Chatwoot' },
  { kind: 'chatwoot', key: 'VITE_CHATWOOT_INBOX_URL', label: 'Abrir Chatwoot' },
  { kind: 'console', key: 'VITE_WHATSAPP_CONSOLE_URL', label: 'Abrir central WhatsApp' },
  { kind: 'console', key: 'VITE_WHATSAPP_CHAT_URL', label: 'Abrir central WhatsApp' },
  { kind: 'generic', key: 'VITE_COMUNICACAO_REDIRECT_URL', label: 'Abrir nova central' },
];

const ENV_PATH_TARGETS: Array<{ kind: RedirectKind; key: string; label: string }> = [
  { kind: 'chatwoot', key: 'VITE_CHATWOOT_PATH', label: 'Abrir Chatwoot' },
  { kind: 'console', key: 'VITE_WHATSAPP_CONSOLE_PATH', label: 'Abrir central WhatsApp' },
];

function normalizeTarget(rawValue: string | undefined | null): string | null {
  if (!rawValue) return null;

  const value = rawValue.trim();
  if (!value) return null;

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return null;
  }
}

function uniqueTargets(targets: RedirectTarget[]) {
  const seen = new Set<string>();

  return targets.filter((target) => {
    if (seen.has(target.url)) return false;
    seen.add(target.url);
    return true;
  });
}

function getPageCopy(area: LegacyCommunicationArea) {
  if (area === 'gestao') {
    return {
      badge: 'Tela legada',
      title: 'Gestao de comunicacao migrada',
      description:
        'O atendimento humano e o acompanhamento operacional desta area agora acontecem na nova experiencia WhatsApp/Chatwoot.',
      detail:
        'Esta pagina nao mantem mais inbox local nem fluxo legado de chat. Use a central nova para continuar o atendimento.',
      retired: [
        'Inbox local e operacao de handoff nesta tela',
        'Acompanhamento manual de conversas no frontend legado',
        'Acesso ao atendimento humano fora do Chatwoot',
      ],
    };
  }

  return {
    badge: 'Inbox local desativado',
    title: 'Atendimento movido para o Chatwoot',
    description:
      'As conversas humanas desta unidade nao ficam mais no inbox local. O atendimento segue na nova experiencia WhatsApp/Chatwoot.',
    detail:
      'Esta rota continua existindo apenas para encaminhamento, evitando que operadores caiam na UX antiga de chat.',
    retired: [
      'Lista de conversas e thread local',
      'Entrada manual do dispatcher no chat legado',
      'Envio de mensagens humanas por esta tela',
    ],
  };
}

function resolveRedirectTargets() {
  const query = new URLSearchParams(window.location.search);
  const env = import.meta.env as Record<string, string | undefined>;
  const currentUrl = new URL(window.location.href).toString();
  const targets: RedirectTarget[] = [];

  for (const candidate of QUERY_TARGETS) {
    const url = normalizeTarget(query.get(candidate.key));
    if (url) {
      targets.push({ kind: candidate.kind, label: candidate.label, url });
    }
  }

  for (const candidate of ENV_TARGETS) {
    const url = normalizeTarget(env[candidate.key]);
    if (url) {
      targets.push({ kind: candidate.kind, label: candidate.label, url });
    }
  }

  for (const candidate of ENV_PATH_TARGETS) {
    const url = normalizeTarget(env[candidate.key]);
    if (url) {
      targets.push({ kind: candidate.kind, label: candidate.label, url });
    }
  }

  return uniqueTargets(targets).filter((target) => target.url !== currentUrl).sort((left, right) => {
    const priority: Record<RedirectKind, number> = {
      chatwoot: 0,
      console: 1,
      generic: 2,
    };

    return priority[left.kind] - priority[right.kind];
  });
}

export default function LegacyCommunicationRedirect({ area }: LegacyCommunicationRedirectProps) {
  const copy = getPageCopy(area);
  const targets = useMemo(() => resolveRedirectTargets(), []);
  const [redirecting, setRedirecting] = useState(false);

  const primaryTarget = targets[0] ?? null;
  const autoRedirectDisabled = new URLSearchParams(window.location.search).get('autoRedirect') === '0';

  useEffect(() => {
    if (!primaryTarget || autoRedirectDisabled) return;

    const timer = window.setTimeout(() => {
      setRedirecting(true);
      window.location.assign(primaryTarget.url);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [autoRedirectDisabled, primaryTarget]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-3">
        <Badge variant="warning">{copy.badge}</Badge>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-bold text-slate-950">{copy.title}</h1>
            <p className="text-sm leading-6 text-slate-600">{copy.description}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <MessageCircleMore className="h-7 w-7" />
          </div>
        </div>
      </header>

      <AlertBanner title="Diretriz aplicada" variant="warning">
        Conversas e atendimento humano passam pela nova central WhatsApp/Chatwoot. A UX legada foi retirada desta rota.
      </AlertBanner>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel
          title="Abrir nova experiencia"
          description={copy.detail}
          icon={<MessagesSquare className="h-5 w-5" />}
          actions={
            primaryTarget ? (
              <button
                type="button"
                onClick={() => {
                  setRedirecting(true);
                  window.location.assign(primaryTarget.url);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-correios-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-correios-blue-mid"
              >
                {redirecting ? 'Abrindo...' : primaryTarget.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null
          }
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {primaryTarget ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {autoRedirectDisabled ? 'Redirecionamento pronto' : 'Redirecionando automaticamente'}
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    {autoRedirectDisabled
                      ? 'Use o botao acima para abrir a nova central neste ambiente.'
                      : 'Se nada acontecer em instantes, use o botao acima para seguir manualmente.'}
                  </p>
                  <p className="break-all text-xs text-slate-400">{primaryTarget.url}</p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Destino ainda nao configurado neste ambiente</p>
                    <p className="text-sm leading-6 text-slate-600">
                      O encaminhamento para a nova central fica disponivel assim que a URL do Chatwoot ou do console WhatsApp
                      for publicada na aplicacao.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Descontinuado nesta rota</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {copy.retired.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Links disponiveis" icon={<ExternalLink className="h-5 w-5" />}>
          <div className="space-y-3">
            {targets.length > 0 ? (
              targets.map((target) => (
                <a
                  key={`${target.kind}:${target.url}`}
                  href={target.url}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-correios-blue hover:text-correios-blue"
                >
                  <span>{target.label}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Sem links configurados no momento. A pagina permanece apenas como ponto de compatibilidade para a rota antiga.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
