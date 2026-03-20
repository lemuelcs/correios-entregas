import { NavLink } from 'react-router';

interface CarteiroBottomNavProps {
  activeTab?: 'home' | 'rota' | 'coleta' | 'historico';
}

const tabs: Array<{ id: 'home' | 'rota' | 'coleta' | 'historico'; label: string; path: string; marker: string }> = [
  { id: 'home', label: 'Inicio', path: '/carteiro', marker: 'IN' },
  { id: 'rota', label: 'Rota', path: '/carteiro/rota', marker: 'RT' },
  { id: 'coleta', label: 'Coleta', path: '/carteiro/coleta', marker: 'CL' },
  { id: 'historico', label: 'Historico', path: '/carteiro/historico', marker: 'HI' },
];

export function CarteiroBottomNav({ activeTab }: CarteiroBottomNavProps) {
  return (
    <nav className="flex border-t border-slate-200 bg-white">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <NavLink
            key={tab.id}
            end={tab.id === 'home'}
            to={tab.path}
            className={[
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
              isActive ? 'text-correios-blue' : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black tracking-[0.16em]',
                isActive ? 'bg-correios-blue text-white' : 'bg-slate-100 text-slate-400',
              ].join(' ')}
            >
              {tab.marker}
            </span>
            {tab.label}
            {isActive ? <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-correios-blue" /> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
