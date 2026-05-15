import { useAuthStore } from '@/stores/auth.store';
import { ChatwootEmbedded } from '../components/ChatwootEmbedded';

export interface UnidadeWhatsAppConsolePageProps {
  initialPath?: string;
}

// No modelo Delivyo/Correios, a pagina de WhatsApp da Unidade entrega o
// atendimento humano direto no Chatwoot via iframe + SSO. O console
// administrativo (configuracoes, flows, KBs, etc.) fica restrito ao modo
// Gestao/admin (vide `GestaoWhatsAppConsolePage`).
export function UnidadeWhatsAppConsolePage(_props: UnidadeWhatsAppConsolePageProps) {
  const unidadeId = useAuthStore((state) => state.unidadeId) ?? undefined;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <ChatwootEmbedded unidadeId={unidadeId} />
    </section>
  );
}
