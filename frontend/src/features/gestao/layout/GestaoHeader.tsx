import { Badge } from '@/shared/ui/Badge';

interface GestaoHeaderProps {
  subtitle: string;
  title: string;
}

export function GestaoHeader({ subtitle, title }: GestaoHeaderProps) {
  const now = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="blue">GESTAO CENTRAL</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Data</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-700">{now}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
