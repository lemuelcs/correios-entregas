export interface DestinatarioPageMeta {
  backTo?: string;
  bottomTab?: 'objetos' | 'rastrear' | 'ajuda' | 'conta';
  path: string;
  showBottomNav: boolean;
  title: string;
}

export const destinatarioPages: DestinatarioPageMeta[] = [
  { path: '/destinatario', title: 'Meus Objetos', showBottomNav: true, bottomTab: 'objetos' },
  { path: '/destinatario/login', title: 'Correios Entregas', showBottomNav: false },
  { path: '/destinatario/rastrear', title: 'Rastrear Objeto', showBottomNav: true, bottomTab: 'rastrear' },
  { path: '/destinatario/detalhe', title: 'Detalhes do Objeto', showBottomNav: false, backTo: '/destinatario' },
  { path: '/destinatario/interacao', title: 'Gerenciar Entrega', showBottomNav: false, backTo: '/destinatario/detalhe' },
  { path: '/destinatario/reagendar', title: 'Reagendar Entrega', showBottomNav: false, backTo: '/destinatario/interacao' },
  { path: '/destinatario/nps', title: 'Avaliacao', showBottomNav: false, backTo: '/destinatario' },
  { path: '/destinatario/ajuda', title: 'Ajuda', showBottomNav: true, bottomTab: 'ajuda' },
  { path: '/destinatario/conta', title: 'Minha Conta', showBottomNav: true, bottomTab: 'conta' },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function getDestinatarioPageMeta(pathname: string) {
  const normalized = normalizePath(pathname);
  return destinatarioPages.find((page) => page.path === normalized) ?? destinatarioPages[0];
}
