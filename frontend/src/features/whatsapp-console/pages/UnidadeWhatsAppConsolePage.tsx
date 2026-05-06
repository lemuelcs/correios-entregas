import { WhatsAppConsoleHost } from '../components/WhatsAppConsoleHost';

export interface UnidadeWhatsAppConsolePageProps {
  initialPath?: string;
}

export function UnidadeWhatsAppConsolePage({
  initialPath = '/conversas',
}: UnidadeWhatsAppConsolePageProps) {
  return <WhatsAppConsoleHost initialPath={initialPath} platformAdmin={false} />;
}
