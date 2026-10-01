/**
 * Ajuda dos testes das telas da captura: fetch falso por rota, o `GET /hoje`
 * de exemplo e o carteiro logado.
 */
import { vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import type { CamposLidos, Campo } from '../captureQueue';
import { diaCivilSP, useCapturaStore, type Hoje } from '../captura.store';
import { obterCaptureQueue } from '../captureQueue';

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export interface Chamada {
  metodo: string;
  caminho: string;
  corpo: unknown;
}

type Resposta = Response | ((c: Chamada) => Response | Promise<Response>);

/**
 * `fetch` falso: `rotas['GET /captura/hoje']` responde por método e caminho
 * (sem o prefixo `/api/v1`). Rotas sem resposta → 404. Guarda as chamadas.
 */
export function fetchFalso(rotas: Record<string, Resposta>) {
  const chamadas: Chamada[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const bruto = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
    const caminho = bruto.replace(/^\/api\/v1/, '');
    const metodo = (init.method ?? 'GET').toUpperCase();
    let corpo: unknown = init.body;
    if (typeof init.body === 'string') {
      try {
        corpo = JSON.parse(init.body);
      } catch {
        corpo = init.body;
      }
    }
    const chamada = { metodo, caminho, corpo };
    chamadas.push(chamada);
    const r = rotas[`${metodo} ${caminho}`];
    if (!r) return json(404, { error: 'não encontrado' });
    const resp = typeof r === 'function' ? await r(chamada) : r;
    return resp.clone();
  });
  vi.stubGlobal('fetch', fn);
  return { fn, chamadas };
}

export const CARTEIRO = {
  id: 'u1',
  nome: 'Renato Alves Costa',
  role: 'CARTEIRO' as const,
  unidadeId: 'un1',
  unidade: { id: 'un1', nome: 'CDD Taguatinga' },
  senhaTemporaria: false,
};

export function logarCarteiro() {
  localStorage.setItem('accessToken', 'token-de-teste');
  useAuthStore.setState({ user: CARTEIRO, accessToken: 'token-de-teste', unidadeId: 'un1', unidadeNome: 'CDD Taguatinga' });
}

export const D03 = { distritoId: 'distrito-1', codigo: 'D-03', nome: 'Águas Claras Sul', cargaStatus: 'CARREGADO' as const };

export function hojeExemplo(over: Partial<Hoje> = {}): Hoje {
  return {
    data: diaCivilSP(),
    distritos: [D03],
    ativo: D03.distritoId,
    contadores: { capturados: 0, paraConferir: 0 },
    recentes: [],
    ...over,
  };
}

/** Estado limpo entre testes: a store da captura e a fila do aparelho. */
export async function limparCaptura() {
  useCapturaStore.getState().reiniciar();
  await obterCaptureQueue().limpar();
}

function c(valor: string | null, extra: Partial<Campo> = {}): Campo {
  return { valor, duvida: false, fonte: 'LLM', ...extra };
}

export function camposExemplo(over: Partial<CamposLidos> = {}): CamposLidos {
  return {
    codigo: c('OY716488072BR', { fonte: 'BARRAS' }),
    nome: c('ALINE RODRIGUES'),
    whatsapp: c('(61) 99340-1287', { fonte: 'DATAMATRIX' }),
    cep: c('72115040', { fonte: 'DATAMATRIX' }),
    logradouro: c('QNC 4', { fonte: 'CEP' }),
    numero: c('17', { fonte: 'DATAMATRIX' }),
    complemento: c('CASA', { fonte: 'DATAMATRIX' }),
    bairro: c('Taguatinga Norte', { fonte: 'CEP' }),
    cidade: c('Brasília', { fonte: 'CEP' }),
    uf: c('DF', { fonte: 'CEP' }),
    ...over,
  };
}
