import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { Badge } from '@/shared/ui/Badge';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { carteiroSummary } from '../carteiro.data';

export function CarteiroHomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { rotaAtual, loading, fetchRotaAtual } = useCarteiroAppStore();

  useEffect(() => {
    fetchRotaAtual();
  }, [fetchRotaAtual]);

  const totalObjetos = rotaAtual?.totalObjetos ?? carteiroSummary.todayObjects;
  const entregues = rotaAtual?.totalEntregues ?? carteiroSummary.delivered;
  const insucessos = rotaAtual?.totalInsucessos ?? carteiroSummary.unsuccessful;
  const pendentes = totalObjetos - entregues - insucessos;
  const progress = totalObjetos > 0 ? Math.round((entregues / totalObjetos) * 100) : carteiroSummary.progress;
  const sph = rotaAtual?.duracaoEstimadaMin && rotaAtual.duracaoEstimadaMin > 0
    ? (entregues / (rotaAtual.duracaoEstimadaMin / 60)).toFixed(1).replace('.', ',')
    : carteiroSummary.sph;
  const routeCode = rotaAtual?.codigo ?? carteiroSummary.route;

  const paradaAtualLabel = rotaAtual?.paradas?.find((p) => p.statusAtual === 'EM_ANDAMENTO')?.logradouro
    ?? rotaAtual?.paradas?.find((p) => p.statusAtual === 'PENDENTE')?.logradouro
    ?? carteiroSummary.currentStop;

  const statusLabel = rotaAtual?.statusAtual === 'EM_ANDAMENTO'
    ? 'Em rota'
    : rotaAtual?.statusAtual === 'CONCLUIDA'
      ? 'Concluida'
      : rotaAtual?.statusAtual === 'COLETADA'
        ? 'Coletada'
        : 'Em rota';

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-6">
      <div className="bg-correios-blue px-4 pb-8 pt-4">
        <p className="text-xs text-white/70">Bom dia,</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{user?.nome ?? 'Carteiro'}</h2>
        <p className="mt-1 text-xs text-white/60">
          {routeCode} • {carteiroSummary.unit}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-[22px] bg-white/10 p-3">
          <SummaryMetric label="Objetos hoje" value={`${totalObjetos}`} valueClassName="text-white" />
          <SummaryMetric label="Entregues" value={`${entregues}`} valueClassName="text-white" />
          <SummaryMetric label="SPH" value={sph} valueClassName="text-correios-yellow" />
        </div>
      </div>

      <div className="-mt-4 space-y-4 px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Progresso da rota</p>
            <Badge dot variant="info">
              {loading ? 'Carregando...' : statusLabel}
            </Badge>
          </div>
          <div className="mt-3">
            <ProgressBar showPercentage tone="blue" value={progress} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Parada atual: {paradaAtualLabel}</p>
        </div>

        <button
          className="w-full rounded-[24px] bg-correios-blue px-4 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(0,51,153,0.28)] transition hover:bg-correios-blue-dark"
          onClick={() => navigate('/carteiro/rota')}
          type="button"
        >
          Ver rota atual
        </button>

        <button
          className="w-full rounded-[24px] bg-correios-yellow px-4 py-4 text-sm font-bold text-correios-blue transition hover:bg-correios-yellow-dark"
          onClick={() => navigate('/carteiro/coleta')}
          type="button"
        >
          Coletar unitizadores
        </button>

        <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo do dia</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <DayMetric colorClassName="text-emerald-600" label="Entregues" value={`${entregues}`} />
            <DayMetric colorClassName="text-rose-500" label="Insucessos" value={`${insucessos}`} />
            <DayMetric colorClassName="text-amber-500" label="Pendentes" value={`${pendentes}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="text-left">
      <p className="text-[10px] font-medium text-white/70">{label}</p>
      <p className={['mt-1 text-2xl font-black', valueClassName].join(' ')}>{value}</p>
    </div>
  );
}

function DayMetric({
  colorClassName,
  label,
  value,
}: {
  colorClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 py-3">
      <p className={['text-2xl font-black', colorClassName].join(' ')}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  );
}
