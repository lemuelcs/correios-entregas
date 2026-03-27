import type { ReactNode } from 'react';

type Accent = 'blue' | 'yellow' | 'green' | 'red' | 'amber';

const ACCENT_CLASSES: Record<Accent, string> = {
  blue: 'border-correios-blue',
  yellow: 'border-correios-yellow',
  green: 'border-emerald-500',
  red: 'border-rose-500',
  amber: 'border-amber-500',
};

interface KpiCardProps {
  accent?: Accent;
  delta?: string;
  deltaPositive?: boolean;
  icon?: ReactNode;
  label: string;
  unit?: string;
  value: string;
}

export function KpiCard({
  accent = 'blue',
  delta,
  deltaPositive = true,
  icon,
  label,
  unit,
  value,
}: KpiCardProps) {
  return (
    <article
      className={[
        'surface-enter min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]',
        'border-t-4',
        ACCENT_CLASSES[accent],
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="text-sm font-semibold text-slate-400">{icon}</span> : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-950">{value}</span>
        {unit ? <span className="pb-1 text-sm font-medium text-slate-500">{unit}</span> : null}
      </div>

      {delta ? (
        <p className={['mt-2 text-xs font-semibold', deltaPositive ? 'text-emerald-600' : 'text-rose-600'].join(' ')}>
          {delta}
        </p>
      ) : null}
    </article>
  );
}
