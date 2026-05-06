import { WhatsAppConsoleHost } from '../components/WhatsAppConsoleHost';

export interface GestaoWhatsAppConsolePageProps {
  initialPath?: string;
}

export function GestaoWhatsAppConsolePage({
  initialPath = '/configuracoes',
}: GestaoWhatsAppConsolePageProps) {
  return <WhatsAppConsoleHost initialPath={initialPath} platformAdmin />;
}
