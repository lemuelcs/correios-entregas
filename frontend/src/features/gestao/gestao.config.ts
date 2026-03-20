export interface GestaoNavItem {
  end?: boolean;
  group: string;
  path: string;
  shortLabel: string;
  subtitle: string;
  title: string;
}

export const gestaoNavItems: GestaoNavItem[] = [
  {
    path: '/gestao',
    title: 'Dashboard',
    subtitle: 'Visao geral da operacao do dia, nivel de servico e rotas em curso.',
    group: 'Operacao do Dia',
    shortLabel: 'DG',
    end: true,
  },
  {
    path: '/gestao/recebimento',
    title: 'Recebimento',
    subtitle: 'Conferencia de unitizadores recebidos, janelas e divergencias.',
    group: 'Operacao do Dia',
    shortLabel: 'RC',
  },
  {
    path: '/gestao/triagem',
    title: 'Triagem',
    subtitle: 'Sort wall, ondas de triagem e balanceamento de esteiras.',
    group: 'Operacao do Dia',
    shortLabel: 'TR',
  },
  {
    path: '/gestao/roteirizacao',
    title: 'Roteirizacao',
    subtitle: 'Parametros do solver, cenarios e consolidacao das rotas do dia.',
    group: 'Operacao do Dia',
    shortLabel: 'RT',
  },
  {
    path: '/gestao/despacho',
    title: 'Despacho',
    subtitle: 'Liberacao das rotas para campo com checklist operacional.',
    group: 'Operacao do Dia',
    shortLabel: 'DP',
  },
  {
    path: '/gestao/monitoramento',
    title: 'Monitoramento',
    subtitle: 'Acompanhamento em tempo real das rotas e desvios de execucao.',
    group: 'Operacao do Dia',
    shortLabel: 'MO',
  },
  {
    path: '/gestao/reconciliacao',
    title: 'Reconciliacao',
    subtitle: 'Retorno a unidade, scans de fechamento e pendencias de rota.',
    group: 'Operacao do Dia',
    shortLabel: 'RE',
  },
  {
    path: '/gestao/previsao',
    title: 'Previsao de Volume',
    subtitle: 'Serie de 14 dias e simulacao de dimensionamento da operacao.',
    group: 'Planejamento',
    shortLabel: 'PV',
  },
  {
    path: '/gestao/unitizadores',
    title: 'Unitizadores',
    subtitle: 'Inventario operacional de bags, sacolas e conteineres.',
    group: 'Cadastros',
    shortLabel: 'UN',
  },
  {
    path: '/gestao/veiculos',
    title: 'Veiculos',
    subtitle: 'Disponibilidade da frota, alocacao e manutencoes abertas.',
    group: 'Cadastros',
    shortLabel: 'VE',
  },
  {
    path: '/gestao/carteiros',
    title: 'Carteiros',
    subtitle: 'Equipe ativa, modais e distribuicao de experiencia por rota.',
    group: 'Cadastros',
    shortLabel: 'CA',
  },
  {
    path: '/gestao/ponto',
    title: 'Ponto do Dia',
    subtitle: 'Presenca da equipe, cobertura e ausencias criticas.',
    group: 'Cadastros',
    shortLabel: 'PT',
  },
  {
    path: '/gestao/comunicacao',
    title: 'WhatsApp',
    subtitle: 'Visao geral da comunicacao WhatsApp e conversas recentes.',
    group: 'Comunicacao',
    shortLabel: 'WA',
    end: true,
  },
  {
    path: '/gestao/comunicacao/configuracao',
    title: 'Configuracao',
    subtitle: 'Conexao, LLM, Chatwoot e horarios.',
    group: 'Comunicacao',
    shortLabel: 'CG',
  },
  {
    path: '/gestao/comunicacao/conversas',
    title: 'Conversas',
    subtitle: 'Historico de conversas com carteiros e destinatarios.',
    group: 'Comunicacao',
    shortLabel: 'CV',
  },
  {
    path: '/gestao/comunicacao/proxy',
    title: 'Sessoes Proxy',
    subtitle: 'Monitor de sessoes proxy ativas.',
    group: 'Comunicacao',
    shortLabel: 'PX',
  },
  {
    path: '/gestao/comunicacao/templates',
    title: 'Templates HSM',
    subtitle: 'Templates aprovados pela Meta.',
    group: 'Comunicacao',
    shortLabel: 'TM',
  },
  {
    path: '/gestao/comunicacao/analytics',
    title: 'Analytics',
    subtitle: 'Resolucao bot, custo LLM e LGPD.',
    group: 'Comunicacao',
    shortLabel: 'AN',
  },
  {
    path: '/gestao/configuracoes',
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

export function getGestaoPageMeta(pathname: string) {
  const normalizedPath = normalizePath(pathname);

  const exact = gestaoNavItems.find((item) => item.path === normalizedPath);
  if (exact) return exact;

  // Prefix match for sub-routes (e.g. /gestao/comunicacao/conversas/123)
  const prefix = gestaoNavItems
    .filter((item) => normalizedPath.startsWith(item.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return prefix ?? gestaoNavItems[0];
}

export const gestaoSidebarGroups = gestaoNavItems.reduce<Array<{ label: string; items: GestaoNavItem[] }>>(
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
