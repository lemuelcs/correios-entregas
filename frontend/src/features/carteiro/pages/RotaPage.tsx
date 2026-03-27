import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { Badge } from '@/shared/ui/Badge';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { api } from '@/services/api';
import { carteiroSummary, routeStops } from '../carteiro.data';

export function RotaPage() {
  const navigate = useNavigate();
  const { rotaAtual, paradaAtual, loading, fetchParadaAtual } = useCarteiroAppStore();

  useEffect(() => {
    if (rotaAtual?.id) {
      fetchParadaAtual(rotaAtual.id);
    }
  }, [rotaAtual?.id, fetchParadaAtual]);

  // Derive from store or fall back to mock
  const totalObjetos = rotaAtual?.totalObjetos ?? carteiroSummary.todayObjects;
  const entregues = rotaAtual?.totalEntregues ?? carteiroSummary.delivered;
  const progress = totalObjetos > 0 ? Math.round((entregues / totalObjetos) * 100) : carteiroSummary.progress;
  const restantes = totalObjetos - entregues - (rotaAtual?.totalInsucessos ?? carteiroSummary.unsuccessful);
  const sph = rotaAtual?.duracaoEstimadaMin && rotaAtual.duracaoEstimadaMin > 0
    ? (entregues / (rotaAtual.duracaoEstimadaMin / 60)).toFixed(1).replace('.', ',')
    : carteiroSummary.sph;

  // Current stop from store or mock
  const storeParadas = rotaAtual?.paradas ?? [];
  const currentStopFromStore = paradaAtual ?? storeParadas.find((p) => p.statusAtual === 'EM_ANDAMENTO' || p.statusAtual === 'PENDENTE');
  const mockCurrentStop = routeStops.find((stop) => stop.current);

  const currentStopAddress = currentStopFromStore?.logradouro ?? mockCurrentStop?.address ?? '';
  const currentStopObjects = currentStopFromStore?.totalObjetos ?? mockCurrentStop?.objects ?? 0;

  // Next stops
  const nextStopsFromStore = storeParadas
    .filter((p) => p.id !== currentStopFromStore?.id && p.statusAtual === 'PENDENTE')
    .slice(0, 5);
  const mockNextStops = routeStops.filter((stop) => !stop.current);

  const hasStoreStops = nextStopsFromStore.length > 0;

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-correios-blue px-4 py-4">
        <div className="flex items-center gap-4">
          <InlineStat label="Restantes" value={`${restantes}`} valueClassName="text-correios-yellow" />
          <div className="flex-1">
            <ProgressBar showPercentage size="sm" tone="amber" value={progress} />
          </div>
          <InlineStat label="SPH" value={sph} valueClassName="text-white" />
        </div>
      </div>

      {loading && !currentStopFromStore ? (
        <div className="px-4 text-center">
          <p className="text-sm text-slate-500">Carregando parada...</p>
        </div>
      ) : null}

      <div className="space-y-4 px-4">
        {(currentStopFromStore || mockCurrentStop) ? (
          <div className="rounded-[28px] bg-correios-blue p-5 text-white shadow-[0_22px_42px_rgba(0,51,153,0.22)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Parada atual</p>
            <p className="mt-2 text-lg font-bold leading-snug">{currentStopAddress}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="yellow">{currentStopObjects} objetos</Badge>
              {currentStopFromStore
                ? <Badge variant="blue">Seq. {currentStopFromStore.sequencia}</Badge>
                : <Badge variant="blue">{mockCurrentStop?.type}</Badge>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="rounded-[20px] bg-correios-yellow px-4 py-3 text-sm font-black text-correios-blue"
                onClick={() => navigate('/carteiro/entrega')}
                type="button"
              >
                Registrar entrega
              </button>
              <button
                className="rounded-[20px] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                onClick={() => navigate('/carteiro/insucesso')}
                type="button"
              >
                Registrar insucesso
              </button>
            </div>
            <ProxyButton
              rotaId={rotaAtual?.id}
              objetoId={rotaAtual?.objetos?.find((o) => o.statusAtual === 'EM_ROTA')?.id}
              destinatarioPhone={rotaAtual?.objetos?.find((o) => o.statusAtual === 'EM_ROTA')?.destinatarioTelefone}
            />
          </div>
        ) : null}

        <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Proximas paradas</p>
          <div className="mt-3 space-y-3">
            {hasStoreStops
              ? nextStopsFromStore.map((stop) => (
                <div key={stop.id} className="flex gap-3 rounded-[20px] bg-slate-50 px-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-correios-blue-50 text-xs font-black text-correios-blue">
                    {stop.sequencia}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-6 text-slate-800">{stop.logradouro ?? `CEP ${stop.cep}`}</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {stop.totalObjetos} obj • Seq. {stop.sequencia}
                    </p>
                  </div>
                </div>
              ))
              : mockNextStops.map((stop) => (
                <div key={stop.id} className="flex gap-3 rounded-[20px] bg-slate-50 px-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-correios-blue-50 text-xs font-black text-correios-blue">
                    {stop.id}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-6 text-slate-800">{stop.address}</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {stop.objects} obj • {stop.type} • {stop.distance}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <button
          className="w-full rounded-[22px] border-2 border-correios-blue px-4 py-3.5 text-sm font-bold text-correios-blue transition hover:bg-correios-blue-50"
          onClick={() => navigate('/carteiro/resumo')}
          type="button"
        >
          Finalizar rota
        </button>
      </div>
    </div>
  );
}

function InlineStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="text-center">
      <p className={['text-lg font-black', valueClassName].join(' ')}>{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/60">{label}</p>
    </div>
  );
}

function ProxyButton({
  rotaId,
  objetoId,
  destinatarioPhone,
}: {
  rotaId?: string;
  objetoId?: string;
  destinatarioPhone?: string;
}) {
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ativo' | 'erro'>('idle');
  const [proxySessionId, setProxySessionId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function iniciarProxy() {
    if (!destinatarioPhone) {
      setErro('Destinatário sem telefone cadastrado');
      setEstado('erro');
      return;
    }
    setEstado('loading');
    setErro(null);
    try {
      const { sessionId } = await api.post<{ sessionId: string }>('/comunicacao/proxy/start', {
        destinatarioPhone,
        rotaId,
        objetoId,
      });
      setProxySessionId(sessionId);
      setEstado('ativo');
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao abrir canal');
      setEstado('erro');
    }
  }

  async function encerrarProxy() {
    if (!proxySessionId) {
      setEstado('idle');
      return;
    }
    try {
      await api.post(`/comunicacao/proxy/${proxySessionId}/end`, {});
    } catch {
      // Encerrar localmente mesmo que falhe
    }
    setProxySessionId(null);
    setEstado('idle');
  }

  if (estado === 'ativo') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-green-400/40 bg-green-500/20 px-3 py-2">
        <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-green-400" />
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Canal aberto com destinatario</p>
          <p className="text-[10px] text-white/60">Envie mensagens pelo seu WhatsApp</p>
        </div>
        <button onClick={encerrarProxy} className="text-xs text-white/60 hover:text-white" type="button">
          Encerrar
        </button>
      </div>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="mt-2 rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-2">
        <p className="text-xs text-red-200">{erro}</p>
        <button onClick={() => setEstado('idle')} className="mt-1 text-[10px] text-white/60 hover:text-white" type="button">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={iniciarProxy}
      disabled={estado === 'loading'}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
      type="button"
    >
      {estado === 'loading' ? 'Abrindo canal...' : 'Chamar Destinatario pelo WhatsApp'}
    </button>
  );
}
