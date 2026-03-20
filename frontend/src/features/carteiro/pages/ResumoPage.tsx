import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { finalRouteStats } from '../carteiro.data';

export function ResumoPage() {
  const navigate = useNavigate();
  const { rotaAtual, loading, fetchResumoRota, confirmarRetorno } = useCarteiroAppStore();

  useEffect(() => {
    if (rotaAtual?.id) {
      fetchResumoRota(rotaAtual.id);
    }
  }, [rotaAtual?.id, fetchResumoRota]);

  // Derive from store or fallback to mock
  const totalObjetos = rotaAtual?.totalObjetos ?? 0;
  const entregues = rotaAtual?.totalEntregues ?? finalRouteStats.delivered;
  const insucessos = rotaAtual?.totalInsucessos ?? finalRouteStats.unsuccessful;
  const devolvidos = rotaAtual?.totalPnovs ?? finalRouteStats.returned;
  const successRate = totalObjetos > 0
    ? `${((entregues / totalObjetos) * 100).toFixed(1).replace('.', ',')}%`
    : finalRouteStats.successRate;
  const sph = rotaAtual?.duracaoEstimadaMin && rotaAtual.duracaoEstimadaMin > 0
    ? `${(entregues / (rotaAtual.duracaoEstimadaMin / 60)).toFixed(1).replace('.', ',')} obj/h`
    : finalRouteStats.sph;
  const routeCode = rotaAtual?.codigo ?? 'R-01';

  const handleFinalize = useCallback(async () => {
    try {
      if (rotaAtual?.id) {
        await confirmarRetorno(rotaAtual.id);
      }
    } catch {
      // API unavailable — continue with navigation
    }

    navigate('/carteiro/historico');
  }, [rotaAtual?.id, confirmarRetorno, navigate]);

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-correios-blue px-4 py-5 text-center">
        <p className="text-xs text-white/70">Rota {routeCode} finalizada</p>
        <p className="mt-2 text-5xl font-black text-white">{successRate}</p>
        <p className="mt-1 text-sm font-semibold text-correios-yellow">Taxa de entrega</p>
      </div>

      <div className="space-y-4 px-4">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile colorClassName="text-emerald-600" label="Entregues" value={`${entregues}`} />
          <SummaryTile colorClassName="text-rose-500" label="Insucessos" value={`${insucessos}`} />
          <SummaryTile colorClassName="text-amber-500" label="Devolvidos" value={`${devolvidos}`} />
        </div>

        <div className="rounded-[24px] bg-white px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">SPH final</span>
            <span className="text-lg font-black text-correios-blue">{sph}</span>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-900">Confirmacao de retorno a unidade</p>
          <div className="mt-3 flex h-28 items-center justify-center rounded-[20px] bg-slate-950 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-correios-yellow">Scan retorno</p>
              <p className="mt-2 text-xs text-white/60">Pronto para registrar OEC_P e encerrar o turno</p>
            </div>
          </div>
        </div>

        <button
          className="w-full rounded-[22px] bg-correios-yellow px-4 py-4 text-sm font-black text-correios-blue disabled:cursor-not-allowed disabled:opacity-40"
          disabled={loading}
          onClick={handleFinalize}
          type="button"
        >
          {loading ? 'Finalizando...' : 'Finalizar e encerrar turno'}
        </button>
      </div>
    </div>
  );
}

function SummaryTile({
  colorClassName,
  label,
  value,
}: {
  colorClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-white p-3 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <p className={['text-2xl font-black', colorClassName].join(' ')}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  );
}
