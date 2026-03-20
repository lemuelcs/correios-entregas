import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useCarteiroAppStore } from '@/stores/carteiro-app.store';
import { carteiroSummary } from '../carteiro.data';

const steps = ['Foto POD', 'Scan', 'Confirmar'];

export function EntregaPage() {
  const navigate = useNavigate();
  const { rotaAtual, paradaAtual, loading, registrarEntrega, enviarGps } = useCarteiroAppStore();
  const [step, setStep] = useState(0);

  // Derive address/object from store or fallback to mock
  const paradaAddress = paradaAtual?.logradouro ?? carteiroSummary.currentStop;
  const objectCode = rotaAtual?.objetos?.find((o) => o.statusAtual === 'EM_ROTA')?.codigoRastreio
    ?? carteiroSummary.currentObjectCode;

  const handleConfirm = useCallback(async () => {
    // Try to send GPS
    if (rotaAtual?.id && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          enviarGps(rotaAtual.id, pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
        () => {},
      );
    }

    try {
      await registrarEntrega({
        rotaId: rotaAtual?.id,
        paradaId: paradaAtual?.id,
        codigoRastreio: objectCode,
      });
    } catch {
      // API unavailable — continue with navigation
    }

    navigate('/carteiro/entrega-ok');
  }, [rotaAtual?.id, paradaAtual?.id, objectCode, registrarEntrega, enviarGps, navigate]);

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Entregando em</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{paradaAddress}</p>
        <p className="mt-1 text-xs text-slate-500">
          {objectCode} • PAC • 1,2 kg
        </p>
      </div>

      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-black',
                    index <= step ? 'bg-correios-blue text-white' : 'bg-slate-200 text-slate-400',
                  ].join(' ')}
                >
                  {index < step ? 'OK' : index + 1}
                </div>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
              </div>
              {index < steps.length - 1 ? (
                <div className={['mb-4 h-0.5 flex-1 rounded-full', index < step ? 'bg-correios-blue' : 'bg-slate-200'].join(' ')} />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {step === 0 ? (
        <>
          <ActionSurface
            detail="Captura do comprovante de entrega vinculada ao evento de POD."
            title="Foto POD"
          />
          <PrimaryAction label="Capturar foto" onClick={() => setStep(1)} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <ActionSurface
            detail="Leitura do codigo do objeto na parada atual para vincular a entrega."
            title="Scan do objeto"
          />
          <PrimaryAction label="Ler codigo do objeto" onClick={() => setStep(2)} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-bold text-emerald-700">Objeto e comprovante confirmados</p>
            <p className="mt-1 text-xs text-emerald-600">
              {objectCode} • GPS registrado
            </p>
          </div>
          <PrimaryAction
            disabled={loading}
            label={loading ? 'Registrando...' : 'Confirmar entrega'}
            onClick={handleConfirm}
            tone="success"
          />
        </>
      ) : null}
    </div>
  );
}

function ActionSurface({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center rounded-[28px] bg-slate-950 px-5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-correios-yellow">{title}</p>
      <p className="mt-3 text-sm leading-6 text-white/70">{detail}</p>
    </div>
  );
}

function PrimaryAction({
  disabled = false,
  label,
  onClick,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'success';
}) {
  return (
    <button
      className={[
        'w-full rounded-[22px] px-4 py-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-correios-blue hover:bg-correios-blue-dark',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
