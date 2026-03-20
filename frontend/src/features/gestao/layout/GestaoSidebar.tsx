import { NavLink, useNavigate } from 'react-router';
import { gestaoSidebarGroups } from '../gestao.config';
import { gestaoUnitName } from '../gestao.data';
import { useAuthStore } from '@/stores/auth.store';

export function GestaoSidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="border-b border-white/10 bg-correios-blue text-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:border-r-correios-blue-dark/40">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-correios-yellow text-sm font-black tracking-[0.25em] text-correios-blue">
            CE
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase tracking-[0.22em] text-correios-yellow">Correios</p>
            <p className="truncate text-sm text-white/75">Gestao de Distribuicao</p>
          </div>
        </div>
      </div>

      <nav className="max-h-[40vh] overflow-y-auto px-3 py-4 lg:max-h-none">
        {gestaoSidebarGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">{group.label}</p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  end={item.end}
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white text-correios-blue shadow-[0_12px_26px_rgba(255,255,255,0.14)]'
                        : 'text-white/78 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={[
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-black tracking-[0.2em]',
                          isActive ? 'bg-correios-blue text-white' : 'bg-white/10 text-correios-yellow',
                        ].join(' ')}
                      >
                        {item.shortLabel}
                      </span>
                      <span className="leading-tight">{item.title}</span>
                      {isActive ? <span className="ml-auto h-2 w-2 rounded-full bg-correios-yellow" /> : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-correios-yellow text-sm font-black text-correios-blue">
            {(user?.nome ?? 'Gestor').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.nome ?? 'Gestor da unidade'}</p>
            <p className="truncate text-xs text-white/60">{gestaoUnitName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title="Sair"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
