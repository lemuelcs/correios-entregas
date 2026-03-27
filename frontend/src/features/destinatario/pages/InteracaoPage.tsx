import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/shared/ui/Badge';
import { useDestinatarioStore } from '@/stores/destinatario.store';
import { interactionOptions } from '../destinatario.data';

export function InteracaoPage() {
  const navigate = useNavigate();
  const { objetoDetalhe, criarInteracao, loading } = useDestinatarioStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const codigo = objetoDetalhe?.codigoRastreio ?? 'AA123456789BR';
  const objetoId = objetoDetalhe?.id ?? '';

  const handleInteracao = async (optionId: string) => {
    if (optionId === 'reagendar') {
      navigate('/destinatario/reagendar');
      return;
    }

    // For other interaction types, fire the API call
    setActionLoading(optionId);
    try {
      await criarInteracao({
        objetoId,
        tipo: optionId.toUpperCase(),
        dados: {},
      });
      // Navigate back to detalhe after success
      navigate('/destinatario/detalhe');
    } catch {
      // Error is captured in the store
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-3 px-4 pt-4 pb-4">
      <div className="rounded-[24px] bg-correios-blue-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-correios-blue">{codigo}</p>
            <p className="mt-1 text-xs text-correios-blue/70">
              {objetoDetalhe ? `Status: ${objetoDetalhe.statusAtual}` : 'Objeto em saida para entrega'}
            </p>
          </div>
          <Badge variant="info">Hoje</Badge>
        </div>
      </div>

      {interactionOptions.map((option) => {
        const isLoading = actionLoading === option.id || (loading && actionLoading === option.id);

        return (
          <button
            key={option.id}
            className="flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 disabled:opacity-50"
            onClick={() => handleInteracao(option.id)}
            disabled={isLoading}
            type="button"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-correios-blue-50 text-xl">
              {option.accent}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{option.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {isLoading ? 'Processando...' : option.subtitle}
              </p>
            </div>
            <span className="text-slate-300">{isLoading ? '...' : '\u203A'}</span>
          </button>
        );
      })}
    </div>
  );
}
