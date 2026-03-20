import { Outlet, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/auth.store';

export function DestinatarioLayout() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-correios-blue text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-correios-yellow">Correios Entregas</h1>
          <p className="text-xs text-correios-blue-light">{user?.nome || 'Meus Objetos'}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-correios-blue-light">
          Sair
        </button>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
