import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { carteiroSummary, routeStops } from '../carteiro.data';

export function EntregaOkPage() {
  const navigate = useNavigate();
  const { rotaAtual, paradaAtual } = useCarteiroAppStore();

  // Object code from store or fallback
  const objectCode = rotaAtual?.objetos?.find((o) => o.statusAtual === 'ENTREGUE')?.codigoRastreio
    ?? rotaAtual?.objetos?.[0]?.codigoRastreio
    ?? carteiroSummary.currentObjectCode;

  // Next stop from store or fallback
  const storeParadas = rotaAtual?.paradas ?? [];
  const nextStopFromStore = storeParadas.find(
    (p) => p.statusAtual === 'PENDENTE' && p.id !== paradaAtual?.id,
  );
  const mockNextStop = routeStops.find((stop) => !stop.current);

  const nextStopAddress = nextStopFromStore?.logradouro ?? mockNextStop?.address;
  const nextStopDetail = nextStopFromStore
    ? `Seq. ${nextStopFromStore.sequencia} • ${nextStopFromStore.totalObjetos} objeto`
    : mockNextStop
      ? `${mockNextStop.type} • ${mockNextStop.objects} objeto • ${mockNextStop.distance}`
      : '';

  const hasNextStop = !!(nextStopFromStore || mockNextStop);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pb-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-sm font-black uppercase tracking-[0.2em] text-emerald-700 shadow-[0_14px_28px_rgba(16,185,129,0.18)]">
        OK
      </div>
      <h2 className="mt-5 text-2xl font-black text-slate-950">Entrega registrada</h2>
      <p className="mt-2 text-sm text-slate-500">{objectCode}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Evento BDE_01 • GPS confirmado</p>

      {hasNextStop ? (
        <div className="mt-8 w-full rounded-[24px] bg-white p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Proxima parada</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{nextStopAddress}</p>
          <p className="mt-1 text-xs text-slate-500">{nextStopDetail}</p>
        </div>
      ) : null}

      <button
        className="mt-6 w-full rounded-[22px] bg-correios-blue px-4 py-4 text-sm font-bold text-white transition hover:bg-correios-blue-dark"
        onClick={() => navigate('/carteiro/rota')}
        type="button"
      >
        Ir para a proxima parada
      </button>
    </div>
  );
}
