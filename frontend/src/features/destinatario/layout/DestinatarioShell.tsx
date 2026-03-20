import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/stores/auth.store';
import { getDestinatarioPageMeta } from '../destinatario.config';
import { DestinatarioBottomNav } from './DestinatarioBottomNav';
import { DestinatarioTopBar } from './DestinatarioTopBar';

export function DestinatarioShell() {
  useAuthGuard('DESTINATARIO');

  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const page = getDestinatarioPageMeta(location.pathname);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(214,228,255,0.92),_transparent_32%),linear-gradient(180deg,_#f3f5fa_0%,_#e2e8f0_100%)] px-0 py-0 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-screen max-w-[390px] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] md:min-h-[844px] md:rounded-[34px] md:border md:border-slate-300/80">
        <div className="flex h-10 items-center justify-between bg-correios-blue px-6 text-[11px] font-semibold text-white">
          <span>09:41</span>
          <span className="tracking-[0.18em] text-white/70">4G BAT</span>
        </div>

        <DestinatarioTopBar
          onBack={page.backTo ? () => navigate(page.backTo!) : undefined}
          right={
            page.showBottomNav ? (
              <button
                className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10"
                onClick={handleLogout}
                type="button"
              >
                Sair
              </button>
            ) : undefined
          }
          title={page.title}
        />

        <div className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </div>

        {page.showBottomNav ? <DestinatarioBottomNav activeTab={page.bottomTab} /> : null}

        <div className="flex h-6 items-center justify-center bg-white">
          <div className="h-1 w-24 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
}
