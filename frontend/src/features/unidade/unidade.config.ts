import { unidadeWhatsAppSections } from '@/pages/whatsapp/whatsappConsole.config';

export interface UnidadeNavItem {
  end?: boolean;
  group: string;
  path: string;
  shortLabel: string;
  subtitle: string;
  title: string;
}

export const unidadeNavItems: UnidadeNavItem[] = [
  ...unidadeWhatsAppSections.map((section) => ({
    path: section.path,
    title: section.title,
    subtitle: section.subtitle,
    group: 'WhatsApp',
    shortLabel: section.shortLabel,
  })),
  {
    path: '/unidade',
    title: 'Dashboard',
    subtitle: 'Visao geral da operacao do dia, nivel de servico e rotas em curso.',
    group: 'Operacao do Dia',
    shortLabel: 'DG',
    end: true,
  },
  {
    path: '/unidade/recebimento',
    title: 'Recebimento',
    subtitle: 'Conferencia de unitizadores recebidos, janelas e divergencias.',
    group: 'Operacao do Dia',
    shortLabel: 'RC',
  },
  {
    path: '/unidade/triagem',
    title: 'Triagem',
    subtitle: 'Sort wall, ondas de triagem e balanceamento de esteiras.',
    group: 'Operacao do Dia',
    shortLabel: 'TR',
  },
  {
    path: '/unidade/roteirizacao',
    title: 'Roteirizacao',
    subtitle: 'Parametros do solver, cenarios e consolidacao das rotas do dia.',
    group: 'Operacao do Dia',
    shortLabel: 'RT',
  },
  {
    path: '/unidade/despacho',
    title: 'Despacho',
    subtitle: 'Liberacao das rotas para campo com checklist operacional.',
    group: 'Operacao do Dia',
    shortLabel: 'DP',
  },
  {
    path: '/unidade/monitoramento',
    title: 'Monitoramento',
    subtitle: 'Acompanhamento em tempo real das rotas e desvios de execucao.',
    group: 'Operacao do Dia',
    shortLabel: 'MO',
  },
  {
    path: '/unidade/reconciliacao',
    title: 'Reconciliacao',
    subtitle: 'Retorno a unidade, scans de fechamento e pendencias de rota.',
    group: 'Operacao do Dia',
    shortLabel: 'RE',
  },
  {
    path: '/unidade/previsao',
    title: 'Previsao de Volume',
    subtitle: 'Serie de 14 dias e simulacao de dimensionamento da operacao.',
    group: 'Planejamento',
    shortLabel: 'PV',
  },
  {
    path: '/unidade/unitizadores',
    title: 'Unitizadores',
    subtitle: 'Inventario operacional de bags, sacolas e conteineres.',
    group: 'Cadastros',
    shortLabel: 'UN',
  },
  {
    path: '/unidade/veiculos',
    title: 'Veiculos',
    subtitle: 'Disponibilidade da frota, alocacao e manutencoes abertas.',
    group: 'Cadastros',
    shortLabel: 'VE',
  },
  {
    path: '/unidade/carteiros',
    title: 'Carteiros',
    subtitle: 'Equipe ativa, modais e distribuicao de experiencia por rota.',
    group: 'Cadastros',
    shortLabel: 'CA',
  },
  {
    path: '/unidade/ponto',
    title: 'Ponto do Dia',
    subtitle: 'Presenca da equipe, cobertura e ausencias criticas.',
    group: 'Cadastros',
    shortLabel: 'PT',
  },
  {
    path: '/unidade/configuracoes',
    title: 'Configuracoes',
    subtitle: 'Dados da unidade, faixas de CEP e integracoes do ecossistema.',
    group: 'Sistema',
    shortLabel: 'CF',
  },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function getUnidadePageMeta(pathname: string) {
  const normalizedPath = normalizePath(pathname);

  const exact = unidadeNavItems.find((item) => item.path === normalizedPath);
  if (exact) return exact;

  // Prefix match for sub-routes (e.g. /gestao/comunicacao/conversas/123)
  const prefix = unidadeNavItems
    .filter((item) => normalizedPath.startsWith(item.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return prefix ?? unidadeNavItems[0];
}

export const unidadeSidebarGroups = unidadeNavItems.reduce<Array<{ label: string; items: UnidadeNavItem[] }>>(
  (groups, item) => {
    const group = groups.find((currentGroup) => currentGroup.label === item.group);
    if (group) {
      group.items.push(item);
      return groups;
    }

    groups.push({ label: item.group, items: [item] });
    return groups;
  },
  [],
);
