import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { Badge } from '@/shared/ui/Badge';
import { expectedUnitizers } from '../carteiro.data';

export function ColetaPage() {
  const navigate = useNavigate();
  const { rotaAtual, loading, coletarUnitizador, confirmarColeta } = useCarteiroAppStore();

  const [scannedCodes, setScannedCodes] = useState<string[]>(['UNI-20260319-001']);
  const allScanned = scannedCodes.length === expectedUnitizers.length;

  const pendingUnitizer = expectedUnitizers.find((item) => !scannedCodes.includes(item.code));

  const handleScan = useCallback(async () => {
    if (!pendingUnitizer) return;

    try {
      await coletarUnitizador(pendingUnitizer.code);
    } catch {
      // API unavailable — continue with local state
    }

    setScannedCodes((currentCodes) => [...currentCodes, pendingUnitizer.code]);
  }, [pendingUnitizer, coletarUnitizador]);

  const handleConfirm = useCallback(async () => {
    const rotaId = rotaAtual?.id ?? '';

    try {
      await confirmarColeta(rotaId, scannedCodes);
    } catch {
      // API unavailable — continue with navigation
    }

    navigate('/carteiro/rota');
  }, [rotaAtual?.id, scannedCodes, confirmarColeta, navigate]);

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-[28px] bg-slate-950">
        <div className="absolute inset-6 rounded-[24px] border-2 border-correios-yellow/70" />
        <div className="absolute left-8 right-8 top-1/2 h-0.5 -translate-y-1/2 bg-correios-yellow/70" />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Leitura QR</p>
          <p className="mt-3 text-sm text-white/75">Aponte a camera para o QR do unitizador</p>
          <p className="mt-2 text-xs text-white/40">Simulacao pronta para demo</p>
        </div>
      </div>

      <button
        className="w-full rounded-[22px] border border-correios-blue/20 bg-correios-blue px-4 py-3.5 text-sm font-bold text-white transition hover:bg-correios-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
        disabled={loading || !pendingUnitizer}
        onClick={handleScan}
        type="button"
      >
        {loading
          ? 'Lendo...'
          : pendingUnitizer
            ? `Simular leitura de ${pendingUnitizer.code}`
            : 'Todos os unitizadores coletados'}
      </button>

      <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        {expectedUnitizers.map((item) => {
          const collected = scannedCodes.includes(item.code);

          return (
            <div key={item.code} className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0">
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  collected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400',
                ].join(' ')}
              >
                {collected ? 'OK' : '--'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-semibold text-slate-900">{item.code}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {item.type} • {item.objects} objetos
                </p>
              </div>
              {collected ? <Badge size="sm" variant="success">Coletado</Badge> : null}
            </div>
          );
        })}
      </div>

      <button
        className="w-full rounded-[22px] bg-correios-yellow px-4 py-4 text-sm font-black text-correios-blue transition disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!allScanned || loading}
        onClick={handleConfirm}
        type="button"
      >
        {loading ? 'Confirmando...' : 'Confirmar coleta e iniciar rota'}
      </button>
    </div>
  );
}
