import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'react-hot-toast';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { GestaoHeader } from './GestaoHeader';
import { GestaoSidebar } from './GestaoSidebar';
import { getGestaoPageMeta } from '../gestao.config';

export function GestaoShell() {
  useAuthGuard('GESTAO');

  const location = useLocation();
  const page = getGestaoPageMeta(location.pathname);
  const isWhatsAppArea = location.pathname === '/gestao/whatsapp' || location.pathname.startsWith('/gestao/whatsapp/');

  return (
    <div className="min-h-screen bg-correios-surface lg:flex">
      <Toaster position="top-right" />
      <GestaoSidebar />

      <div className="min-w-0 flex-1">
        <GestaoHeader subtitle={page.subtitle} title={page.title} />
        <main className={isWhatsAppArea ? 'p-0' : 'px-5 py-5 lg:px-8 lg:py-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
