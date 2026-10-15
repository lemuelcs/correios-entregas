/**
 * Chamadas da área Entregas. Sem dado fictício de reserva: qualquer falha
 * sobe como `ApiError` para o store e a tela mostra o aviso.
 *
 * `unidadeId` só é enviado pela Gestão (o supervisor fica na unidade do token).
 */
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import type {
  CanalProsio,
  CarteiroCadastro,
  Distrito,
  EscalaDefinida,
  FiltroListagem,
  LinhaPrevia,
  ListaPacotes,
  PacoteEditado,
  Pagina,
  PontoRetirada,
  Previa,
  Quadro,
  QuadroSaidas,
  AtribuicaoCarteiro,
  RespostaAtribuicao,
  RespostaLiberacao,
  RespostaLiberacaoLote,
  ResultadoImportacaoSaida,
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


/**
 * A Gestão escreve na unidade em foco: sem `unidadeId` na rota, o backend responde
 * 400 `unidade_obrigatoria`. O supervisor não envia (fica na unidade do token).
 */
function comUnidade(caminho: string): string {
  if (useAuthStore.getState().user?.role !== 'GESTAO' || !caminho.startsWith('/entregas/') || caminho.includes('unidadeId=')) return caminho;
  const unidadeId = useEntregasContextoStore.getState().unidadeGestaoId;
  if (!unidadeId) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}unidadeId=${encodeURIComponent(unidadeId)}`;
}

const escrita = {
  post: <T>(caminho: string, corpo?: unknown) => api.post<T>(comUnidade(caminho), corpo),
  put: <T>(caminho: string, corpo?: unknown) => api.put<T>(comUnidade(caminho), corpo),
  patch: <T>(caminho: string, corpo?: unknown) => api.patch<T>(comUnidade(caminho), corpo),
  delete: <T>(caminho: string) => api.delete<T>(comUnidade(caminho)),
  postForm: <T>(caminho: string, form: FormData) => api.postForm<T>(comUnidade(caminho), form),
};

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

  // Saídas do dia (ADR-019). `unidadeId: 'todas'` (Gestão) devolve todas as unidades juntas, só leitura.
  saidas: (p: { data?: string; unidadeId?: string }) => api.get<QuadroSaidas>(`/entregas/saidas${query(p)}`),
  /** Importa direto (sem prévia): 400 `horario_obrigatorio` / `coluna_ausente`, 409 `saida_fora_de_ordem`. */
  importarSaida(p: { arquivo: File; numero: number; horario: string; data?: string; unidadeId?: string }) {
    const form = new FormData();
    form.append('numero', String(p.numero));
    form.append('horario', p.horario);
    if (p.data) form.append('data', p.data);
    form.append('arquivo', p.arquivo);
    return escrita.postForm<ResultadoImportacaoSaida>(`/entregas/saidas/importar${query({ unidadeId: p.unidadeId })}`, form);
  },
  liberarRotas: (cargaIds: string[]) => escrita.post<RespostaLiberacaoLote>('/entregas/saidas/liberar', { cargaIds }),
  atribuirCarteiros: (atribuicoes: AtribuicaoCarteiro[], p: { data?: string; unidadeId?: string } = {}) =>
    escrita.put<RespostaAtribuicao>(`/entregas/saidas/carteiros${query({ unidadeId: p.unidadeId })}`, { ...(p.data ? { data: p.data } : {}), atribuicoes }),

  previaArquivo(distritoId: string, arquivo: File) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return escrita.postForm<Previa>(`/entregas/cargas/${distritoId}/previa`, form);
  },
  previaTexto: (distritoId: string, texto: string) => escrita.post<Previa>(`/entregas/cargas/${distritoId}/previa`, { texto }),
  previaLinhas: (distritoId: string, linhas: LinhaPrevia[]) =>
    escrita.post<Previa>(`/entregas/cargas/${distritoId}/previa`, { linhas: linhas.map(linhaParaEnvio) }),
  confirmar: (distritoId: string, linhas: LinhaPrevia[]) =>
    escrita.post<ResultadoConfirmacao>(`/entregas/cargas/${distritoId}/confirmar`, { linhas: linhas.map(linhaParaEnvio) }),

  liberar: (cargaId: string, confirmarSemAvisos = false) =>
    escrita.post<RespostaLiberacao>(`/entregas/cargas/${cargaId}/liberar`, confirmarSemAvisos ? { confirmarSemAvisos: true } : {}),

  /** Dispara a consulta ao Seu Rastreio de todos os pacotes da rota. */
  atualizarRastreio: (cargaId: string) =>
    escrita.post<{ consultados: number; atualizados: number; falhas: number; erro: string | null; recente: boolean }>(`/entregas/cargas/${cargaId}/rastreio/atualizar`, {}),
  pacotes: (cargaId: string, p: { status?: string; busca?: string; pagina?: number; unidadeId?: string }) =>
    api.get<ListaPacotes>(`/entregas/cargas/${cargaId}/pacotes${query(p)}`),

  /** Orientação manual do supervisor (US-026): 409 `pacote_entregue`, 400 `orientacao_vazia` / `orientacao_longa`. */
  registrarOrientacao: (pacoteId: string, dados: { texto: string; valeParaAmanha: boolean }, unidadeId?: string) =>
    escrita.post(`/entregas/pacotes/${pacoteId}/orientacao${query({ unidadeId })}`, dados),

  // ——— Cadastro da unidade ———
  distritos: (unidadeId?: string) => api.get<Pagina<Distrito>>(`/entregas/cadastro/distritos${query({ unidadeId, tamanho: 100 })}`),
  distrito: (id: string, unidadeId?: string) => api.get<Distrito>(`/entregas/cadastro/distritos/${id}${query({ unidadeId })}`),
  criarDistrito: (dados: { codigo: string; nome: string; carteiroPadraoId?: string | null }) =>
    escrita.post<Distrito>('/entregas/cadastro/distritos', dados),
  editarDistrito: (id: string, dados: { codigo?: string; nome?: string; carteiroPadraoId?: string | null; ativo?: boolean; atualizadoEm?: string }) =>
    escrita.put<Distrito>(`/entregas/cadastro/distritos/${id}`, dados),
  definirEscala: (distritoId: string, data: string, carteiroId: string | null) =>
    escrita.put(`/entregas/cadastro/distritos/${distritoId}/escala/${data}`, { carteiroId }),

  carteiros: (unidadeId?: string) => api.get<Pagina<CarteiroCadastro>>(`/entregas/cadastro/carteiros${query({ unidadeId, tamanho: 100 })}`),
  criarCarteiro: (dados: { nome: string; matricula: string; whatsapp: string; distritoPadraoId?: string | null }) =>
    escrita.post<CarteiroCadastro>('/entregas/cadastro/carteiros', dados),
  editarCarteiro: (id: string, dados: { nome?: string; matricula?: string; whatsapp?: string; distritoPadraoId?: string | null; ativo?: boolean; atualizadoEm?: string }) =>
    escrita.put<CarteiroCadastro>(`/entregas/cadastro/carteiros/${id}`, dados),

  pontos: (unidadeId?: string) =>
    api.get<{ itens: PontoRetirada[]; ativosPorTipo: Record<TipoPonto, number> }>(`/entregas/cadastro/pontos${query({ unidadeId })}`),
  criarPonto: (dados: { tipo: TipoPonto; nome: string; endereco: string; horario: string }) =>
    escrita.post<PontoRetirada>('/entregas/cadastro/pontos', dados),
  editarPonto: (id: string, dados: { tipo?: TipoPonto; nome?: string; endereco?: string; horario?: string; ativo?: boolean; atualizadoEm?: string }) =>
    escrita.put<PontoRetirada>(`/entregas/cadastro/pontos/${id}`, dados),

  // ——— Atendimento ———
  sessaoAtendimento: (unidadeId?: string) =>
    escrita.post<SessaoAtendimento>('/entregas/atendimento/sessao', unidadeId ? { unidadeId } : {}),

  // ——— Supervisor da captura (TechSpec da captura › API Endpoints › Supervisor) ———
  historicoPacote: (pacoteId: string, unidadeId?: string) =>
    api.get<HistoricoPacote>(`/entregas/captura/pacotes/${pacoteId}/historico${query({ unidadeId })}`),
  /** JPEG do rótulo; 404 `sem_foto`, 410 `foto_excluida` com `fotoExcluidaEm`. */
  fotoPacote: (pacoteId: string, unidadeId?: string) => api.getBlob(`/entregas/captura/pacotes/${pacoteId}/foto${query({ unidadeId })}`),
  removerPacote: (pacoteId: string) => escrita.delete(`/entregas/captura/pacotes/${pacoteId}`),
  definirSenhaCarteiro: (carteiroId: string, senha: string) => escrita.put(`/entregas/captura/carteiros/${carteiroId}/senha`, { senha }),

  // ——— Gestão ———
  canais: () => api.get<CanalProsio[]>('/gestao/canais-prosio'),
  criarCanal: (dados: { nome: string; baseUrl: string; apiKey: string; callbackSecret: string; tipo: 'WAHA' | 'WABA'; compartilhado: boolean }) =>
    escrita.post<CanalProsio>('/gestao/canais-prosio', dados),
  unidades: () => api.get<UnidadeGestao[]>('/gestao/unidades'),
  criarUnidade: (dados: Record<string, unknown>) => escrita.post<UnidadeGestao>('/gestao/unidades', dados),
  editarUnidade: (id: string, dados: Record<string, unknown>) => escrita.put<UnidadeGestao>(`/gestao/unidades/${id}`, dados),
  supervisores: () => api.get<Supervisor[]>('/gestao/usuarios?role=UNIDADE'),
  criarSupervisor: (dados: { nome: string; email: string; matricula: string; senha: string; unidadeId: string; telefoneCelular: string }) =>
    escrita.post<Supervisor>('/gestao/usuarios', { ...dados, role: 'UNIDADE' }),

  // ——— Auditoria da interface (aditivo) ———
  /** WhatsApp e/ou endereço de um pacote (só o supervisor). `avisoSolicitado` = o aviso saiu agora. */
  editarPacote: (pacoteId: string, dados: { whatsapp?: string | null; endereco?: Partial<Record<'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep' | 'enderecoTexto' | 'referencia', string | null>> }) =>
    escrita.patch<PacoteEditado>(`/entregas/pacotes/${pacoteId}`, dados),
  /** Listagens paginadas do cadastro, com busca (`busca`, `pagina`, `tamanho`). */
  distritosPagina: (f: FiltroListagem) => api.get<Pagina<Distrito>>(`/entregas/cadastro/distritos${query({ ...f })}`),
  carteirosPagina: (f: FiltroListagem) => api.get<Pagina<CarteiroCadastro>>(`/entregas/cadastro/carteiros${query({ ...f })}`),
  /** Troca do carteiro do dia, com os `avisos` da resposta (ex.: `carteiro_em_dois_distritos`). */
  definirEscalaComAvisos: (distritoId: string, data: string, carteiroId: string | null) =>
    escrita.put<EscalaDefinida>(`/entregas/cadastro/distritos/${distritoId}/escala/${data}`, { carteiroId }),
  /** Edição do canal; com `regenerarTokenEntrada` a resposta traz o `tokenEntrada` novo, uma única vez. */
  editarCanal: (id: string, dados: { nome?: string; baseUrl?: string; apiKey?: string; callbackSecret?: string; tipo?: 'WAHA' | 'WABA'; compartilhado?: boolean; ativo?: boolean; regenerarTokenEntrada?: boolean; atualizadoEm?: string }) =>
    escrita.put<CanalProsio>(`/gestao/canais-prosio/${id}`, dados),
  editarSupervisor: (id: string, dados: { nome?: string; ativo?: boolean; unidadeId?: string; telefoneCelular?: string }) =>
    escrita.put<Supervisor>(`/gestao/usuarios/${id}`, dados),
};
