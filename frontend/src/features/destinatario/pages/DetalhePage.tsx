import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/shared/ui/Badge';
import { useDestinatarioStore } from '@/stores/destinatario.store';
import { timeline as mockTimeline } from '../destinatario.data';

/** Derive the progress step index from API status */
function progressIndex(status: string): number {
  const steps: Record<string, number> = {
    AGUARDANDO_CHEGADA: 0,
    RECEBIDO_UNIDADE: 1,
    EM_CONFERENCIA: 1,
    TRIADO: 1,
    UNITIZADO: 1,
    DISPONIVEL_COLETA: 2,
    COLETADO_CARTEIRO: 2,
    EM_ROTA: 3,
    ENTREGUE: 4,
    TENTATIVA_SEM_ATENDIMENTO: 3,
    DEVOLVIDO_UNIDADE: 2,
  };
  return steps[status] ?? 0;
}

function statusBadgeVariant(status: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'ENTREGUE') return 'success';
  if (status === 'EM_ROTA') return 'info';
  return 'warning';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    EM_ROTA: 'Saiu para entrega',
    ENTREGUE: 'Entregue',
    RECEBIDO_UNIDADE: 'Na unidade',
    TRIADO: 'Triado',
    COLETADO_CARTEIRO: 'Coletado',
    TENTATIVA_SEM_ATENDIMENTO: 'Tentativa sem atendimento',
  };
  return map[status] ?? status;
}

export function DetalhePage() {
  const navigate = useNavigate();
  const { objetoDetalhe, loading, error, fetchObjetoDetalhe } = useDestinatarioStore();

  // If no detail loaded yet, try to load the first available
  useEffect(() => {
    // The detail is typically pre-loaded from navigation. If not, do nothing.
  }, [fetchObjetoDetalhe]);

  // Determine data source: API or mock fallback
  const hasApiData = !!objetoDetalhe;

  const codigo = hasApiData ? objetoDetalhe.codigoRastreio : 'AA123456789BR';
  const status = hasApiData ? statusLabel(objetoDetalhe.statusAtual) : 'Saiu para entrega';
  const badgeVariant = hasApiData ? statusBadgeVariant(objetoDetalhe.statusAtual) : ('info' as const);
  const remetente = hasApiData ? objetoDetalhe.remetenteNome : 'Amazon Brasil';
  const servico = hasApiData ? objetoDetalhe.servicoCodigo : 'SEDEX';
  const previsao = hasApiData ? (objetoDetalhe.previsaoEntrega ?? 'Hoje, ate 18h') : 'Hoje, ate 18h';
  const step = hasApiData ? progressIndex(objetoDetalhe.statusAtual) : 3;

  // Timeline: use API events if available, fallback to mock
  const timelineItems = hasApiData && objetoDetalhe.eventos && objetoDetalhe.eventos.length > 0
    ? objetoDetalhe.eventos.map((evt, idx) => ({
        event: evt.tipo,
        description: evt.descricao,
        location: evt.localDescricao,
        time: new Date(evt.ocorridoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        current: idx === 0,
      }))
    : mockTimeline;

  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center rounded-[24px] bg-slate-50 py-8 text-xs text-slate-500">
          Carregando detalhes...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
          {error}
        </div>
      )}

      {/* Summary card */}
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs font-bold text-slate-600">{codigo}</p>
          <Badge dot variant={badgeVariant}>
            {status}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {[
            ['Remetente', remetente],
            ['Servico', servico],
            ['Peso', hasApiData ? `${((objetoDetalhe as any)?.pesoGramas ?? 0) / 1000} kg` : '1,2 kg'],
            ['Previsao', previsao],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-500">{label}</p>
              <p className="mt-1 font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Progresso</p>
        <div className="mt-4 flex items-center">
          {['Postado', 'Em transito', 'Na unidade', 'Saiu', 'Entregue'].map((label, index) => {
            const done = index <= step;
            const active = index === step;

            return (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black',
                      active
                        ? 'bg-correios-blue text-white'
                        : done
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400',
                    ].join(' ')}
                  >
                    {done && !active ? 'OK' : index + 1}
                  </div>
                  <p className={['mt-1 w-12 text-center text-[8px]', active ? 'font-bold text-correios-blue' : done ? 'text-emerald-600' : 'text-slate-400'].join(' ')}>
                    {label}
                  </p>
                </div>
                {index < 4 ? (
                  <div className={['mb-4 h-0.5 flex-1', index < step ? 'bg-emerald-500' : 'bg-slate-200'].join(' ')} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Historico SRO</p>
        <div className="mt-4 space-y-3">
          {timelineItems.map((item, index) => (
            <div key={`${item.event}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={['mt-1.5 h-2 w-2 rounded-full', item.current ? 'bg-correios-blue' : 'bg-slate-300'].join(' ')} />
                {index < timelineItems.length - 1 ? <div className="mt-1 w-0.5 flex-1 bg-slate-100" /> : null}
              </div>
              <div className="pb-3">
                <p className={['text-sm font-semibold', item.current ? 'text-correios-blue' : 'text-slate-700'].join(' ')}>{item.description}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.location} • {item.time}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{item.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className="w-full rounded-[22px] bg-correios-blue px-4 py-3.5 text-sm font-bold text-white transition hover:bg-correios-blue-dark"
        onClick={() => navigate('/destinatario/interacao')}
        type="button"
      >
        Gerenciar entrega
      </button>
    </div>
  );
}
