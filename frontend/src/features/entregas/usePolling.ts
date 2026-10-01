import { useEffect, useRef } from 'react';

/** Intervalo de atualização das telas de acompanhamento (ADR-015: "até 1 minuto"). */
export const INTERVALO_POLLING_MS = 30_000;

/**
 * Chama `fn` a cada `intervaloMs` enquanto a aba está visível. Com a aba
 * oculta (`visibilitychange`), pausa; ao voltar, atualiza na hora e retoma.
 * A primeira carga fica a cargo da tela.
 */
export function usePolling(fn: () => void, intervaloMs = INTERVALO_POLLING_MS, ativo = true): void {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!ativo) return undefined;
    let timer: number | null = null;

    const parar = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const iniciar = () => {
      parar();
      timer = window.setInterval(() => ref.current(), intervaloMs);
    };
    const aoMudarVisibilidade = () => {
      if (document.hidden) {
        parar();
      } else {
        ref.current();
        iniciar();
      }
    };

    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [intervaloMs, ativo]);
}
