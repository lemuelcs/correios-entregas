import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDestinatarioStore } from '@/stores/destinatario.store';

export function NpsPage() {
  const navigate = useNavigate();
  const { objetoDetalhe, responderNps, loading } = useDestinatarioStore();
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === null) return;

    setSubmitting(true);
    try {
      await responderNps({
        score,
        comentario: comentario.trim() || undefined,
        objetoId: objetoDetalhe?.id,
      });
      setSubmitted(true);
    } catch {
      // Error is captured in the store; show success state anyway for UX
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
          OK
        </div>
        <h2 className="mt-5 text-xl font-black text-slate-900">Obrigado pela avaliacao</h2>
        <p className="mt-2 text-sm text-slate-500">Sua opiniao foi registrada com sucesso.</p>
        <button
          className="mt-6 rounded-[22px] bg-correios-blue px-6 py-3.5 text-sm font-bold text-white"
          onClick={() => navigate('/destinatario')}
          type="button"
        >
          Voltar para meus objetos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pt-6 pb-4">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Avaliacao</p>
        <h2 className="mt-3 text-lg font-bold text-slate-900">Como foi sua experiencia?</h2>
        <p className="mt-2 text-xs text-slate-500">
          De 0 a 10, qual a probabilidade de recomendar os Correios para outra pessoa?
        </p>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 11 }, (_, index) => {
          const colorClass =
            index <= 6
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : index <= 8
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200';
          const activeClass =
            index <= 6
              ? 'bg-rose-500 text-white border-rose-500'
              : index <= 8
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-emerald-500 text-white border-emerald-500';

          return (
            <button
              key={index}
              className={[
                'aspect-square rounded-[16px] border-2 text-base font-black transition',
                score === index ? activeClass : colorClass,
              ].join(' ')}
              onClick={() => setScore(index)}
              type="button"
            >
              {index}
            </button>
          );
        })}
      </div>

      {score !== null ? (
        <>
          <div className="flex justify-between px-1 text-[10px] text-slate-400">
            <span>Muito improvavel</span>
            <span>Muito provavel</span>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Comentario opcional</label>
            <textarea
              className="w-full resize-none rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none ring-correios-blue/25 transition focus:ring-2"
              placeholder="Conte um pouco sobre sua experiencia..."
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
          <button
            className="w-full rounded-[22px] bg-correios-blue px-4 py-4 text-sm font-bold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting || loading}
            type="button"
          >
            {submitting ? 'Enviando...' : 'Enviar avaliacao'}
          </button>
        </>
      ) : null}
    </div>
  );
}
