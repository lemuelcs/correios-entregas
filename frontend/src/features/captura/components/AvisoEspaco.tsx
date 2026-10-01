import { useEffect, useState } from 'react';
import { obterCaptureQueue, type CaptureQueue } from '../captureQueue';

/** Aviso de espaço do aparelho acabando (US-013.EC-4), disparado pela fila. */
export function AvisoEspaco({ fila = obterCaptureQueue() }: { fila?: CaptureQueue }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(
    () =>
      fila.on((e) => {
        if (e.tipo === 'espaco_insuficiente') setVisivel(true);
      }),
    [fila],
  );

  if (!visivel) return null;
  return (
    <div role="alert" className="bg-amber-50 text-amber-900 border border-amber-300 px-4 py-3 rounded-lg text-sm">
      Espaço do aparelho acabando. Envie os pacotes da fila antes de fotografar mais.
      <button type="button" className="ml-2 underline" onClick={() => setVisivel(false)}>
        Entendi
      </button>
    </div>
  );
}
