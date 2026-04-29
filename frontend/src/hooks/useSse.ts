import { useEffect, useRef } from 'react';
import type { SseRotaUpdate, SseAlerta, SseGpsUpdate, SseObjetoEntregue } from '../types/api.types';

interface SseOptions {
  onRotaUpdate?: (data: SseRotaUpdate) => void;
  onAlerta?: (data: SseAlerta) => void;
  onGpsUpdate?: (data: SseGpsUpdate) => void;
  onObjetoEntregue?: (data: SseObjetoEntregue) => void;
}

const BASE_URL = '/api/v1';

/**
 * Opens a Server-Sent Events connection to `/events?unidadeId=xxx`.
 *
 * Listens for:
 *   - rota_update
 *   - alerta
 *   - gps_update
 *   - objeto_entregue
 *
 * The connection is established only when `unidadeId` is defined and is
 * automatically closed when the component unmounts or the id changes.
 *
 * Note: EventSource does not support custom headers, so the auth token is
 * passed as a query parameter (`token`). The backend should accept it from
 * either the `Authorization` header or the `token` query param.
 */
export function useSse(unidadeId: string | undefined, options: SseOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!unidadeId) return;

    const token = localStorage.getItem('accessToken') ?? '';
    const url = `${BASE_URL}/events?unidadeId=${encodeURIComponent(unidadeId)}&token=${encodeURIComponent(token)}`;

    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener('rota_update', (event) => {
      try {
        const data = JSON.parse(event.data) as SseRotaUpdate;
        optionsRef.current.onRotaUpdate?.(data);
      } catch { /* ignore malformed messages */ }
    });

    source.addEventListener('alerta', (event) => {
      try {
        const data = JSON.parse(event.data) as SseAlerta;
        optionsRef.current.onAlerta?.(data);
      } catch { /* ignore malformed messages */ }
    });

    source.addEventListener('gps_update', (event) => {
      try {
        const data = JSON.parse(event.data) as SseGpsUpdate;
        optionsRef.current.onGpsUpdate?.(data);
      } catch { /* ignore malformed messages */ }
    });

    source.addEventListener('objeto_entregue', (event) => {
      try {
        const data = JSON.parse(event.data) as SseObjetoEntregue;
        optionsRef.current.onObjetoEntregue?.(data);
      } catch { /* ignore malformed messages */ }
    });

    source.onerror = () => {
      // The browser will automatically try to reconnect.
      // If the connection is permanently broken the caller should handle it
      // (e.g. by watching for a stale unidadeId).
    };

    return () => {
      source.close();
    };
  }, [unidadeId]);
}
