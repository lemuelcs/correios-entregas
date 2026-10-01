/**
 * Chamadas da área Entregas. Sem dado fictício de reserva: qualquer falha
 * sobe como `ApiError` para o store e a tela mostra o aviso.
 *
 * `unidadeId` só é enviado pela Gestão (o supervisor fica na unidade do token).
 */
import { api } from '@/services/api';
import type {
  CanalProsio,
  CarteiroCadastro,
  Distrito,
  LinhaPrevia,
  ListaPacotes,
  Pagina,
  PontoRetirada,
  Previa,
  Quadro,
  RespostaLiberacao,
  ResultadoConfirmacao,
  HistoricoPacote,
  SessaoAtendimento,
  Supervisor,
  TipoPonto,
  UnidadeGestao,
} from './entregas.types';

type Parametros = Record<string, string | number | undefined | null>;

function query(params: Parametros): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Campos de uma linha da prévia que o backend aceita de volta (correção e confirmação). */
export function linhaParaEnvio(l: LinhaPrevia) {
  return {
    n: l.n,
    codigo: l.codigo,
    nome: l.nome,
    whatsapp: l.whatsapp,
    logradouro: l.logradouro,
    numero: l.numero,
    complemento: l.complemento,
    bairro: l.bairro,
    cidade: l.cidade,
    uf: l.uf,
    cep: l.cep,
    enderecoTexto: l.enderecoTexto,
    referencia: l.referencia,
  };
}

export const entregasApi = {
  // ——— Monitoramento › Carregar Dados ———
  quadro: (p: { data?: string; unidadeId?: string }) => api.get<Quadro>(`/entregas/quadro${query(p)}`),

  previaArquivo(distritoId: string, arquivo: File) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return api.postForm<Previa>(`/entregas/cargas/${distritoId}/previa`, form);
  },
  previaTexto: (distritoId: string, texto: string) => api.post<Previa>(`/entregas/cargas/${distritoId}/previa`, { texto }),
  previaLinhas: (distritoId: string, linhas: LinhaPrevia[]) =>
    api.post<Previa>(`/entregas/cargas/${distritoId}/previa`, { linhas: linhas.map(linhaParaEnvio) }),
  confirmar: (distritoId: string, linhas: LinhaPrevia[]) =>
    api.post<ResultadoConfirmacao>(`/entregas/cargas/${distritoId}/confirmar`, { linhas: linhas.map(linhaParaEnvio) }),

  liberar: (cargaId: string, confirmarSemAvisos = false) =>
    api.post<RespostaLiberacao>(`/entregas/cargas/${cargaId}/liberar`, confirmarSemAvisos ? { confirmarSemAvisos: true } : {}),

  pacotes: (cargaId: string, p: { status?: string; busca?: string; pagina?: number; unidadeId?: string }) =>
    api.get<ListaPacotes>(`/entregas/cargas/${cargaId}/pacotes${query(p)}`),

  /** Orientação manual do supervisor (US-026): 409 `pacote_entregue`, 400 `orientacao_vazia` / `orientacao_longa`. */
  registrarOrientacao: (pacoteId: string, dados: { texto: string; valeParaAmanha: boolean }, unidadeId?: string) =>
    api.post(`/entregas/pacotes/${pacoteId}/orientacao${query({ unidadeId })}`, dados),

  // ——— Cadastro da unidade ———
  distritos: (unidadeId?: string) => api.get<Pagina<Distrito>>(`/entregas/cadastro/distritos${query({ unidadeId, tamanho: 100 })}`),
  distrito: (id: string, unidadeId?: string) => api.get<Distrito>(`/entregas/cadastro/distritos/${id}${query({ unidadeId })}`),
  criarDistrito: (dados: { codigo: string; nome: string; carteiroPadraoId?: string | null }) =>
    api.post<Distrito>('/entregas/cadastro/distritos', dados),
  editarDistrito: (id: string, dados: { codigo?: string; nome?: string; carteiroPadraoId?: string | null; ativo?: boolean; atualizadoEm?: string }) =>
    api.put<Distrito>(`/entregas/cadastro/distritos/${id}`, dados),
  definirEscala: (distritoId: string, data: string, carteiroId: string | null) =>
    api.put(`/entregas/cadastro/distritos/${distritoId}/escala/${data}`, { carteiroId }),

  carteiros: (unidadeId?: string) => api.get<Pagina<CarteiroCadastro>>(`/entregas/cadastro/carteiros${query({ unidadeId, tamanho: 100 })}`),
  criarCarteiro: (dados: { nome: string; matricula: string; whatsapp: string; distritoPadraoId?: string | null }) =>
    api.post<CarteiroCadastro>('/entregas/cadastro/carteiros', dados),
  editarCarteiro: (id: string, dados: { nome?: string; matricula?: string; whatsapp?: string; distritoPadraoId?: string | null; ativo?: boolean; atualizadoEm?: string }) =>
    api.put<CarteiroCadastro>(`/entregas/cadastro/carteiros/${id}`, dados),

  pontos: (unidadeId?: string) =>
    api.get<{ itens: PontoRetirada[]; ativosPorTipo: Record<TipoPonto, number> }>(`/entregas/cadastro/pontos${query({ unidadeId })}`),
  criarPonto: (dados: { tipo: TipoPonto; nome: string; endereco: string; horario: string }) =>
    api.post<PontoRetirada>('/entregas/cadastro/pontos', dados),
  editarPonto: (id: string, dados: { tipo?: TipoPonto; nome?: string; endereco?: string; horario?: string; ativo?: boolean; atualizadoEm?: string }) =>
    api.put<PontoRetirada>(`/entregas/cadastro/pontos/${id}`, dados),

  // ——— Atendimento ———
  sessaoAtendimento: (unidadeId?: string) =>
    api.post<SessaoAtendimento>('/entregas/atendimento/sessao', unidadeId ? { unidadeId } : {}),

  // ——— Supervisor da captura (TechSpec da captura › API Endpoints › Supervisor) ———
  historicoPacote: (pacoteId: string, unidadeId?: string) =>
    api.get<HistoricoPacote>(`/entregas/captura/pacotes/${pacoteId}/historico${query({ unidadeId })}`),
  /** JPEG do rótulo; 404 `sem_foto`, 410 `foto_excluida` com `fotoExcluidaEm`. */
  fotoPacote: (pacoteId: string, unidadeId?: string) => api.getBlob(`/entregas/captura/pacotes/${pacoteId}/foto${query({ unidadeId })}`),
  removerPacote: (pacoteId: string) => api.delete(`/entregas/captura/pacotes/${pacoteId}`),
  definirSenhaCarteiro: (carteiroId: string, senha: string) => api.put(`/entregas/captura/carteiros/${carteiroId}/senha`, { senha }),

  // ——— Gestão ———
  canais: () => api.get<CanalProsio[]>('/gestao/canais-prosio'),
  criarCanal: (dados: { nome: string; baseUrl: string; apiKey: string; callbackSecret: string; tipo: 'WAHA' | 'WABA'; compartilhado: boolean }) =>
    api.post<CanalProsio>('/gestao/canais-prosio', dados),
  unidades: () => api.get<UnidadeGestao[]>('/gestao/unidades'),
  criarUnidade: (dados: Record<string, unknown>) => api.post<UnidadeGestao>('/gestao/unidades', dados),
  editarUnidade: (id: string, dados: Record<string, unknown>) => api.put<UnidadeGestao>(`/gestao/unidades/${id}`, dados),
  supervisores: () => api.get<Supervisor[]>('/gestao/usuarios?role=UNIDADE'),
  criarSupervisor: (dados: { nome: string; email: string; matricula: string; senha: string; unidadeId: string; telefoneCelular: string }) =>
    api.post<Supervisor>('/gestao/usuarios', { ...dados, role: 'UNIDADE' }),
};
