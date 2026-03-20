export interface CarteiroPageMeta {
  backTo?: string;
  bottomTab?: 'home' | 'rota' | 'coleta' | 'historico';
  path: string;
  showBottomNav: boolean;
  title: string;
}

export const carteiroPages: CarteiroPageMeta[] = [
  { path: '/carteiro', title: 'Correios Carteiro', showBottomNav: true, bottomTab: 'home' },
  { path: '/carteiro/coleta', title: 'Coleta de Unitizadores', showBottomNav: true, bottomTab: 'coleta' },
  { path: '/carteiro/rota', title: 'Rota R-01', showBottomNav: true, bottomTab: 'rota' },
  { path: '/carteiro/entrega', title: 'Registrar Entrega', showBottomNav: false, backTo: '/carteiro/rota' },
  { path: '/carteiro/entrega-ok', title: 'Entrega Confirmada', showBottomNav: false, backTo: '/carteiro/rota' },
  { path: '/carteiro/insucesso', title: 'Registrar Insucesso', showBottomNav: false, backTo: '/carteiro/rota' },
  { path: '/carteiro/resumo', title: 'Resumo da Rota', showBottomNav: false, backTo: '/carteiro/rota' },
  { path: '/carteiro/historico', title: 'Historico', showBottomNav: true, bottomTab: 'historico' },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function getCarteiroPageMeta(pathname: string) {
  const normalized = normalizePath(pathname);
  return carteiroPages.find((page) => page.path === normalized) ?? carteiroPages[0];
}
