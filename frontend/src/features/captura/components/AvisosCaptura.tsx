import { X } from 'lucide-react';
import { useCapturaStore, type Aviso } from '../captura.store';

const ESTILO: Record<Aviso['tipo'], string> = {
  salvo: 'bg-[#E2F2E8] text-[#1F6F43] border-[#9FD2B3]',
  conferir: 'bg-[#FDF1D6] text-[#7A4E00] border-[#E0A400]',
  recusado: 'bg-red-50 text-red-800 border-red-300',
};

/**
 * Os avisos de resultado das capturas, um por captura (US-005 EC-1):
 * "Pacote OY…BR salvo no D-03 · desfazer" desfaz só aquele pacote.
 */
export function AvisosCaptura() {
  const avisos = useCapturaStore((s) => s.avisos);
  const desfazer = useCapturaStore((s) => s.desfazerCaptura);
  const remover = useCapturaStore((s) => s.removerAviso);

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      {avisos.map((a) => (
        <div
          key={a.capturaId}
          role={a.tipo === 'recusado' ? 'alert' : 'status'}
          className={`pointer-events-auto mx-auto w-full max-w-md flex items-center gap-2 rounded-xl border px-4 py-2 text-[15px] font-semibold shadow-lg ${ESTILO[a.tipo]}`}
        >
          <span className="flex-1">
            {a.texto}
            {a.tipo === 'salvo' && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => void desfazer(a.capturaId)}
                  className="min-h-11 px-1 underline underline-offset-2"
                >
                  desfazer
                </button>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => remover(a.capturaId)}
            aria-label="Fechar aviso"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
