import { WhatsAppConsoleHost } from '../components/WhatsAppConsoleHost';

export interface GestaoWhatsAppConsolePageProps {
  initialPath?: string;
}

// Gestao = visao administrativa multi-unidade do tenant Correios.
// Mantemos o WC no modo `admin` com configuracoes globais. A aba de Conversas
// fica desabilitada/oculta neste modo (cross-tenant-conversations=false) —
// o atendimento humano por unidade vive em `UnidadeWhatsAppConsolePage` via
// iframe Chatwoot.
export function GestaoWhatsAppConsolePage({
  initialPath = '/configuracoes',
}: GestaoWhatsAppConsolePageProps) {
  return (
    <WhatsAppConsoleHost
      initialPath={initialPath}
      mode="admin"
      platformAdmin
      crossTenantConversations={false}
      systemName="Correios Entregas"
      locale="pt_BR"
    />
  );
}
