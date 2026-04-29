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
    title: 'Unidades',
    subtitle: 'Gerenciamento de todas as unidades operacionais dos Correios.',
    group: 'Administracao',
    shortLabel: 'UN',
    end: true,
  },
  {
    path: '/gestao/ses',
    title: 'Superintendencias',
    subtitle: 'Superintendencias Estaduais e Correios Sede.',
    group: 'Administracao',
    shortLabel: 'SE',
  },
  {
    path: '/gestao/usuarios',
    title: 'Usuarios',
    subtitle: 'Gerenciamento de todos os usuarios do sistema.',
    group: 'Administracao',
    shortLabel: 'US',
  },
  {
    path: '/gestao/comunicacao',
    title: 'Comunicação',
    subtitle: 'Gestão de WhatsApp, Bot e White-Label do Tenant.',
    group: 'Sistema',
    shortLabel: 'CM',
  },
  {
    path: '/gestao/terminologia',
    title: 'Terminologia',
    subtitle: 'Personalize os nomes usados pelo sistema (ex.: Carteiro vs Motorista).',
    group: 'Sistema',
    shortLabel: 'TM',
  },
  {
    path: '/gestao/ajustes',
    title: 'Ajustes',
    subtitle: 'Integracoes, VROOM/OSRM e configuracoes globais.',
    group: 'Sistema',
    shortLabel: 'AJ',
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
