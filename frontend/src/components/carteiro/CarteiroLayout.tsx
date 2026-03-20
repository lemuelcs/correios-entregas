import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/auth.store';

export function CarteiroLayout() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-correios-blue text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-correios-yellow">Correios Entregas</h1>
          <p className="text-xs text-correios-blue-light">{user?.nome || 'Carteiro'}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-correios-blue-light">
          Sair
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-200 flex">
        <NavLink
          to="/carteiro"
          end
          className={({ isActive }) =>
            `flex-1 text-center py-3 text-xs font-medium ${
              isActive ? 'text-correios-blue border-t-2 border-correios-blue' : 'text-gray-500'
            }`
          }
        >
          Início
        </NavLink>
        <NavLink
          to="/carteiro/coleta"
          className={({ isActive }) =>
            `flex-1 text-center py-3 text-xs font-medium ${
              isActive ? 'text-correios-blue border-t-2 border-correios-blue' : 'text-gray-500'
            }`
          }
        >
          Coleta
        </NavLink>
        <NavLink
          to="/carteiro/historico"
          className={({ isActive }) =>
            `flex-1 text-center py-3 text-xs font-medium ${
              isActive ? 'text-correios-blue border-t-2 border-correios-blue' : 'text-gray-500'
            }`
          }
        >
          Histórico
        </NavLink>
      </nav>
    </div>
  );
}
