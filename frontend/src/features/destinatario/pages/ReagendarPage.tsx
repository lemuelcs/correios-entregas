import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDestinatarioStore } from '@/stores/destinatario.store';
import { scheduleDays } from '../destinatario.data';

const periods = ['Manha (08-12h)', 'Tarde (12-18h)'] as const;

export function ReagendarPage() {
  const navigate = useNavigate();
  const { objetoDetalhe, criarInteracao, loading } = useDestinatarioStore();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (selectedDay === null || !selectedPeriod) return;

    const day = scheduleDays[selectedDay];
    const objetoId = objetoDetalhe?.id ?? '';

    setSubmitting(true);
    try {
      await criarInteracao({
        objetoId,
        tipo: 'REAGENDAR',
        dados: {
          data: `${day.day}/${day.month}`,
          periodo: selectedPeriod,
        },
      });
      navigate('/destinatario/nps');
    } catch {
      // Error is captured in the store; navigate anyway for UX
      navigate('/destinatario/nps');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Escolha a data</p>
        <div className="mt-4 flex gap-2">
          {scheduleDays.map((day, index) => {
            const active = selectedDay === index;

            return (
              <button
                key={`${day.label}-${day.day}`}
                className={[
                  'flex flex-1 flex-col items-center rounded-[18px] py-3 transition',
                  !day.available
                    ? 'cursor-not-allowed bg-slate-100 opacity-40'
                    : active
                      ? 'bg-correios-blue text-white'
                      : 'bg-slate-50 hover:bg-correios-blue-50',
                ].join(' ')}
                disabled={!day.available}
                onClick={() => setSelectedDay(index)}
                type="button"
              >
                <span className={['text-[10px] font-semibold uppercase tracking-[0.16em]', active ? 'text-white/70' : 'text-slate-500'].join(' ')}>
                  {day.label}
                </span>
                <span className={['mt-1 text-lg font-black', active ? 'text-white' : 'text-slate-900'].join(' ')}>{day.day}</span>
                <span className={['text-[10px]', active ? 'text-white/60' : 'text-slate-400'].join(' ')}>{day.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay !== null ? (
        <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Periodo</p>
          <div className="mt-4 flex gap-2">
            {periods.map((period) => (
              <button
                key={period}
                className={[
                  'flex-1 rounded-[18px] px-3 py-3 text-xs font-semibold transition',
                  selectedPeriod === period ? 'bg-correios-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
                onClick={() => setSelectedPeriod(period)}
                type="button"
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedPeriod ? (
        <button
          className="w-full rounded-[22px] bg-correios-yellow px-4 py-4 text-sm font-black text-correios-blue disabled:opacity-50"
          onClick={handleConfirm}
          disabled={submitting || loading}
          type="button"
        >
          {submitting ? 'Confirmando...' : 'Confirmar reagendamento'}
        </button>
      ) : null}
    </div>
  );
}
