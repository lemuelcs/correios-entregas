import { Badge } from '@/shared/ui/Badge';
import { useAuthStore } from '@/stores/auth.store';

interface UnidadeHeaderProps {
  subtitle: string;
  title: string;
}

export function UnidadeHeader({ subtitle, title }: UnidadeHeaderProps) {
  const unidadeNome = useAuthStore((s) => s.unidadeNome);

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
            <Badge variant="blue">OPERACAO</Badge>
            <Badge dot variant="success">
              SLA monitorado
            </Badge>
            {unidadeNome && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
                {unidadeNome}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Data de operacao</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-700">{now}</p>
          </div>
          <div className="rounded-2xl border border-correios-blue/10 bg-correios-blue-50 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-correios-blue/60">Janela critica</p>
            <p className="mt-1 text-sm font-semibold text-correios-blue">Despacho ate 09:40</p>
          </div>
        </div>
      </div>
    </header>
  );
}
