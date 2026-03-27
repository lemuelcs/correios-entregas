import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T>;
  reset: () => void;
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

const initialState = { data: null, loading: false, error: null };

/**
 * Generic hook that wraps api.get/post/put/delete with loading and error states.
 *
 * Usage:
 *   const objetos = useApi<PaginatedResponse<Objeto>>('get', '/objetos');
 *   useEffect(() => { objetos.execute(); }, []);
 *
 *   const criar = useApi<Objeto>('post', '/objetos');
 *   await criar.execute(body);
 */
export function useApi<T>(method: HttpMethod, path: string): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>(initialState);
  const activeRef = useRef(0);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T> => {
      const callId = ++activeRef.current;
      setState({ data: null, loading: true, error: null });

      try {
        let result: T;

        switch (method) {
          case 'get':
            result = await api.get<T>(path);
            break;
          case 'post':
            result = await api.post<T>(path, args[0]);
            break;
          case 'put':
            result = await api.put<T>(path, args[0]);
            break;
          case 'delete':
            result = await api.delete<T>(path);
            break;
        }

        // Only update state if this is still the latest call
        if (callId === activeRef.current) {
          setState({ data: result, loading: false, error: null });
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        if (callId === activeRef.current) {
          setState({ data: null, loading: false, error: message });
        }
        throw err;
      }
    },
    [method, path],
  );

  const reset = useCallback(() => {
    activeRef.current++;
    setState(initialState);
  }, []);

  return { ...state, execute, reset };
}

/**
 * Lazy variant — accepts a path builder so you can compose the URL at call time.
 *
 * Usage:
 *   const buscar = useLazyApi<Objeto>('get');
 *   const obj = await buscar.execute('/objetos/ABC123');
 */
export function useLazyApi<T>(method: HttpMethod): {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (path: string, body?: unknown) => Promise<T>;
  reset: () => void;
} {
  const [state, setState] = useState<UseApiState<T>>(initialState);
  const activeRef = useRef(0);

  const execute = useCallback(
    async (path: string, body?: unknown): Promise<T> => {
      const callId = ++activeRef.current;
      setState({ data: null, loading: true, error: null });

      try {
        let result: T;

        switch (method) {
          case 'get':
            result = await api.get<T>(path);
            break;
          case 'post':
            result = await api.post<T>(path, body);
            break;
          case 'put':
            result = await api.put<T>(path, body);
            break;
          case 'delete':
            result = await api.delete<T>(path);
            break;
        }

        if (callId === activeRef.current) {
          setState({ data: result, loading: false, error: null });
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        if (callId === activeRef.current) {
          setState({ data: null, loading: false, error: message });
        }
        throw err;
      }
    },
    [method],
  );

  const reset = useCallback(() => {
    activeRef.current++;
    setState(initialState);
  }, []);

  return { ...state, execute, reset };
}
