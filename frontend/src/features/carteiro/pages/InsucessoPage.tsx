import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { failureReasons } from '../carteiro.data';

export function InsucessoPage() {
  const navigate = useNavigate();
  const { rotaAtual, paradaAtual, loading, registrarInsucesso } = useCarteiroAppStore();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  // Derive object info from store or fallback
  const objectCode = rotaAtual?.objetos?.find((o) => o.statusAtual === 'EM_ROTA')?.codigoRastreio ?? 'AA123456789BR';
  const paradaAddress = paradaAtual?.logradouro ?? 'Rua das Flores, 234';

  const handleConfirm = useCallback(async () => {
    if (!selectedReason) return;

    try {
      await registrarInsucesso({
        rotaId: rotaAtual?.id,
        paradaId: paradaAtual?.id,
        codigoRastreio: objectCode,
        motivoCodigo: selectedReason,
      });
    } catch {
      // API unavailable — continue with navigation
    }

    navigate('/carteiro/rota');
  }, [selectedReason, rotaAtual?.id, paradaAtual?.id, objectCode, registrarInsucesso, navigate]);

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Objeto</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{objectCode} • {paradaAddress}</p>
      </div>

      <div className="space-y-2">
        {failureReasons.map((reason) => {
          const active = selectedReason === reason.code;

          return (
            <button
              key={reason.code}
              className={[
                'w-full rounded-[24px] border-2 px-4 py-4 text-left transition',
                active ? 'border-correios-blue bg-correios-blue-50' : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
              onClick={() => setSelectedReason(reason.code)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    active ? 'border-correios-blue bg-correios-blue' : 'border-slate-300',
                  ].join(' ')}
                >
                  {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{reason.label}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{reason.code}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedReason ? (
        <>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs leading-6 text-amber-800">
              Tentativa 1/2 registrada. Se a segunda tentativa falhar, o prototipo considera tratativa de devolucao.
            </p>
          </div>

          <button
            className="w-full rounded-[22px] bg-correios-blue px-4 py-4 text-sm font-bold text-white transition hover:bg-correios-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
            disabled={loading}
            onClick={handleConfirm}
            type="button"
          >
            {loading ? 'Registrando...' : 'Confirmar insucesso e continuar'}
          </button>
        </>
      ) : null}
    </div>
  );
}
