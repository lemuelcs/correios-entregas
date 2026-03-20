import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/auth.store';

const navItems = [
  { to: '/gestao', label: 'Dashboard', end: true },
  { to: '/gestao/recebimento', label: 'Recebimento' },
  { to: '/gestao/triagem', label: 'Triagem' },
  { to: '/gestao/roteirizacao', label: 'Roteirização' },
  { to: '/gestao/unitizadores', label: 'Unitizadores' },
  { to: '/gestao/veiculos', label: 'Veículos' },
  { to: '/gestao/carteiros', label: 'Carteiros' },
  { to: '/gestao/despacho', label: 'Despacho' },
  { to: '/gestao/monitoramento', label: 'Monitoramento' },
  { to: '/gestao/reconciliacao', label: 'Reconciliação' },
];

export function GestaoLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-correios-blue text-white flex flex-col">
        <div className="p-4 border-b border-correios-blue-mid">
          <h1 className="text-lg font-bold text-correios-yellow">Correios Entregas</h1>
          <p className="text-sm text-correios-blue-light">Gestão da Unidade</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/20 text-correios-yellow font-semibold'
                    : 'text-correios-blue-light hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-correios-blue-mid">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-correios-blue-light hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-50 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
