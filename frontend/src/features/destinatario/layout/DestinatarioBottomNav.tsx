import { NavLink } from 'react-router';

interface DestinatarioBottomNavProps {
  activeTab?: 'objetos' | 'rastrear' | 'ajuda' | 'conta';
}

const tabs: Array<{
  id: 'objetos' | 'rastrear' | 'ajuda' | 'conta';
  label: string;
  marker: string;
  path: string;
}> = [
  { id: 'objetos', label: 'Objetos', marker: 'OB', path: '/destinatario' },
  { id: 'rastrear', label: 'Rastrear', marker: 'RA', path: '/destinatario/rastrear' },
  { id: 'ajuda', label: 'Ajuda', marker: 'AJ', path: '/destinatario/ajuda' },
  { id: 'conta', label: 'Conta', marker: 'CT', path: '/destinatario/conta' },
];

export function DestinatarioBottomNav({ activeTab }: DestinatarioBottomNavProps) {
  return (
    <nav className="flex border-t border-slate-200 bg-white">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <NavLink
            key={tab.id}
            end={tab.id === 'objetos'}
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
