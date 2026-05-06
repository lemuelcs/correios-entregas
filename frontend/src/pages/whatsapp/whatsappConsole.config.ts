export interface WhatsAppConsoleSection {
  consolePath: string;
  path: string;
  shortLabel: string;
  subtitle: string;
  title: string;
}

export const unidadeWhatsAppSections: WhatsAppConsoleSection[] = [
  {
    path: '/unidade/whatsapp/conversas',
    consolePath: '/conversas',
    title: 'WhatsApp Conversas',
    subtitle: 'Atendimento humano e acompanhamento das conversas em andamento.',
    shortLabel: 'CV',
  },
  {
    path: '/unidade/whatsapp/configuracoes',
    consolePath: '/configuracoes',
    title: 'WhatsApp Configuracoes',
    subtitle: 'Instancia, conexao, bot e parametros operacionais do canal.',
    shortLabel: 'CF',
  },
  {
    path: '/unidade/whatsapp/terminologia',
    consolePath: '/terminologia',
    title: 'WhatsApp Terminologia',
    subtitle: 'Nomes, textos e taxonomia exibidos ao longo da experiencia.',
    shortLabel: 'TM',
  },
  {
    path: '/unidade/whatsapp/flows',
    consolePath: '/flows',
    title: 'WhatsApp Flows',
    subtitle: 'Editor visual dos fluxos de automacao e handoff operacional.',
    shortLabel: 'FW',
  },
  {
    path: '/unidade/whatsapp/marketplace',
    consolePath: '/marketplace',
    title: 'WhatsApp Marketplace',
    subtitle: 'Catalogo de templates e aceleradores para jornadas do canal.',
    shortLabel: 'MP',
  },
  {
    path: '/unidade/whatsapp/knowledge-bases',
    consolePath: '/knowledge-bases',
    title: 'WhatsApp Bases de Conhecimento',
    subtitle: 'Colecoes RAG, chunks e base operacional para respostas do bot.',
    shortLabel: 'KB',
  },
  {
    path: '/unidade/whatsapp/integrations',
    consolePath: '/integrations',
    title: 'WhatsApp Integracoes',
    subtitle: 'Conectores, credenciais e pontos de extensao do ecossistema.',
    shortLabel: 'IN',
  },
  {
    path: '/unidade/whatsapp/analytics',
    consolePath: '/analytics',
    title: 'WhatsApp Analytics',
    subtitle: 'Custos, uso de LLM e desempenho das automacoes do canal.',
    shortLabel: 'AN',
  },
];

export const gestaoWhatsAppSections: WhatsAppConsoleSection[] = [
  {
    path: '/gestao/whatsapp/configuracoes',
    consolePath: '/configuracoes',
    title: 'WhatsApp Configuracoes',
    subtitle: 'Governanca da instancia, webhook e parametros centrais do tenant.',
    shortLabel: 'CF',
  },
  {
    path: '/gestao/whatsapp/terminologia',
    consolePath: '/terminologia',
    title: 'WhatsApp Terminologia',
    subtitle: 'White-label e padrao terminologico compartilhado entre operacoes.',
    shortLabel: 'TM',
  },
  {
    path: '/gestao/whatsapp/flows',
    consolePath: '/flows',
    title: 'WhatsApp Flows',
    subtitle: 'Fluxos corporativos, automacoes e governanca das jornadas.',
    shortLabel: 'FW',
  },
  {
    path: '/gestao/whatsapp/marketplace',
    consolePath: '/marketplace',
    title: 'WhatsApp Marketplace',
    subtitle: 'Curadoria, aprovacao e publicacao de templates do tenant.',
    shortLabel: 'MP',
  },
  {
    path: '/gestao/whatsapp/knowledge-bases',
    consolePath: '/knowledge-bases',
    title: 'WhatsApp Bases de Conhecimento',
    subtitle: 'Gestao central das bases RAG e do conhecimento compartilhado.',
    shortLabel: 'KB',
  },
  {
    path: '/gestao/whatsapp/integrations',
    consolePath: '/integrations',
    title: 'WhatsApp Integracoes',
    subtitle: 'Credenciais, conectores e padroes de integracao por tenant.',
    shortLabel: 'IN',
  },
  {
    path: '/gestao/whatsapp/analytics',
    consolePath: '/analytics',
    title: 'WhatsApp Analytics',
    subtitle: 'Visao consolidada de custos, uso de LLM e performance do canal.',
    shortLabel: 'AN',
  },
  {
    path: '/gestao/whatsapp/conversas',
    consolePath: '/conversas',
    title: 'WhatsApp Conversas',
    subtitle: 'Acesso rapido ao atendimento humano embutido via Chatwoot.',
    shortLabel: 'CV',
  },
];

export function findWhatsAppSection(pathname: string, sections: WhatsAppConsoleSection[]) {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return sections.find((section) => section.path === normalizedPath);
}
