import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/shared/ui/Badge';
import { useDestinatarioStore } from '@/stores/destinatario.store';
import { objetos as mockObjetos } from '../destinatario.data';

/** Maps API status to display badge variant */
function statusBadge(status: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'ENTREGUE') return 'success';
  if (status === 'EM_ROTA') return 'info';
  return 'warning';
}

/** Maps API status to readable label */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    AGUARDANDO_CHEGADA: 'Aguardando chegada',
    RECEBIDO_UNIDADE: 'Recebido na unidade',
    EM_CONFERENCIA: 'Em conferencia',
    TRIADO: 'Triado',
    UNITIZADO: 'Unitizado',
    DISPONIVEL_COLETA: 'Disponivel para coleta',
    COLETADO_CARTEIRO: 'Coletado',
    EM_ROTA: 'Saiu para entrega',
    ENTREGUE: 'Entregue',
    TENTATIVA_SEM_ATENDIMENTO: 'Tentativa sem atendimento',
    DEVOLVIDO_UNIDADE: 'Devolvido a unidade',
    AGUARDANDO_RETIRADA: 'Aguardando retirada',
    DEVOLVIDO_REMETENTE: 'Devolvido ao remetente',
    AVARIADO: 'Avariado',
    EXTRAVIADO: 'Extraviado',
    CANCELADO: 'Cancelado',
  };
  return map[status] ?? status;
}

function statusAccent(status: string): string {
  if (status === 'ENTREGUE') return '✅';
  if (status === 'EM_ROTA') return '🚚';
  return '📦';
}

export function ObjetosPage() {
  const navigate = useNavigate();
  const { objetos: apiObjetos, loading, error, fetchObjetos } = useDestinatarioStore();

  useEffect(() => {
    fetchObjetos();
  }, [fetchObjetos]);

  // Use API data when available, otherwise fall back to mock
  const hasApiData = apiObjetos.length > 0;
  const displayItems = hasApiData
    ? apiObjetos.map((obj) => ({
        code: obj.codigoRastreio,
        service: obj.servicoCodigo,
        sender: obj.remetenteNome,
        status: statusLabel(obj.statusAtual),
        badge: statusBadge(obj.statusAtual),
        accent: statusAccent(obj.statusAtual),
        estimate: obj.previsaoEntrega ?? '',
      }))
    : mockObjetos;

  const highlighted = displayItems[0];

  return (
    <div className="space-y-4 pb-4">
      {/* Loading indicator */}
      {loading && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-center rounded-[24px] bg-slate-50 py-6 text-xs text-slate-500">
            Carregando objetos...
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div className="mx-4 mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
          {error}
        </div>
      )}

      {/* Highlighted card */}
      {!loading && highlighted && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-[24px] bg-correios-blue p-4 shadow-[0_18px_40px_rgba(0,51,153,0.18)]">
          <span className="text-2xl">{highlighted.accent}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">{highlighted.status}</p>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-white/70">
              {highlighted.code} {highlighted.estimate ? `• ${highlighted.estimate}` : ''}
            </p>
          </div>
          <button
            className="rounded-full bg-correios-yellow px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-correios-blue"
            onClick={() => navigate('/destinatario/interacao')}
            type="button"
          >
            Gerenciar
          </button>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="space-y-3 px-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Todos os objetos ({displayItems.length})</p>
          {displayItems.map((item) => (
            <button
              key={item.code}
              className="flex w-full items-start gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
              onClick={() => navigate('/destinatario/detalhe')}
              type="button"
            >
              <span className="text-2xl">{item.accent}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-xs font-semibold text-slate-700">{item.code}</p>
                  <Badge size="sm" variant={item.badge}>
                    {item.service}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.status}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.sender} {item.estimate ? `• ${item.estimate}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
