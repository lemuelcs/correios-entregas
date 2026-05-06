import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'react-hot-toast';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { UnidadeHeader } from './UnidadeHeader';
import { UnidadeSidebar } from './UnidadeSidebar';
import { getUnidadePageMeta } from '../unidade.config';

export function UnidadeShell() {
  useAuthGuard('UNIDADE');

  const location = useLocation();
  const page = getUnidadePageMeta(location.pathname);
  const isWhatsAppArea = location.pathname === '/unidade/whatsapp' || location.pathname.startsWith('/unidade/whatsapp/');

  return (
    <div className="min-h-screen bg-correios-surface lg:flex">
      <Toaster position="top-right" />
      <UnidadeSidebar />

      <div className="min-w-0 flex-1">
        <UnidadeHeader subtitle={page.subtitle} title={page.title} />
        <main className={isWhatsAppArea ? 'p-0' : 'px-5 py-5 lg:px-8 lg:py-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
