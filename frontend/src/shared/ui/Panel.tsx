import type { ReactNode } from 'react';

interface PanelProps {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  icon?: ReactNode;
  title: string;
}

export function Panel({ actions, children, description, icon, title }: PanelProps) {
  return (
    <section className="surface-enter rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-500">{icon}</span> : null}
            <h2 className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
