/** Contratos de `/api/v1/entregas` e de `/api/v1/gestao` usados pela área nova (TechSpec › API Endpoints). */

export type StatusQuadro = 'PENDENTE_UPLOAD' | 'DADOS_CARREGADOS' | 'LIBERADO' | 'EM_ENTREGA' | 'CONCLUIDO';

export type StatusPacote =
  | 'SEM_WHATSAPP'
  | 'AGUARDANDO_LIBERACAO'
  | 'AGENDADO'
  | 'NAO_ENVIADO'
  | 'ENVIADO'
  | 'LIDO'
  | 'INTERAGINDO'
  | 'INSUCESSO'
  | 'ENTREGUE';

export type ContagemPorStatus = Partial<Record<StatusPacote, number>>;

export interface CartaoDistrito {
  distritoId: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  cargaId: string | null;
  carteiro: { id: string; nome: string | null } | null;
  semCarteiro: boolean;
  status: StatusQuadro;
  total: number;
  comWhatsapp: number;
  porStatus: ContagemPorStatus;
  escalonamentos: number;
  liberadoEm: string | null;
  /** Captura (extensão aditiva): capturas do dia que esperam o carteiro (conferência ou transferência). */
  paraConferir?: number;
  /** Captura (extensão aditiva): transferências confirmadas que entraram ou saíram do distrito no dia. */
  transferencias?: { entrada: TransferenciaQuadro[]; saida: TransferenciaQuadro[] };
}

/** Uma transferência entre distritos feita pelo app do carteiro (ADR-001). */
export interface TransferenciaQuadro {
  pacoteId: string | null;
  codigo: string | null;
  /** Na saída, o distrito de destino; na entrada, o de origem (código, ex.: `D-03`). */
  distrito: string;
  distritoId: string;
  /** Quem transferiu (o carteiro que capturou no destino). */
  carteiro: { id: string; nome: string | null } | null;
  /** O carteiro do distrito de origem no momento da transferência. */
  carteiroAnterior: { id: string; nome: string | null } | null;
  /** Instante da transferência (ISO). */
  hora: string;
  origemLiberada: boolean;
}

export interface Quadro {
  data: string;
  somenteLeitura: boolean;
  semDistritos: boolean;
  distritos: CartaoDistrito[];
}

export interface RespostaLiberacao {
  avisosAgendados: number;
  semWhatsapp: number;
  descadastrados: number;
  agendadoPara?: string;
  jaLiberada?: boolean;
}

// ——— Saídas do dia (ADR-019) ———

/** Motivos de descarte de uma linha do arquivo da saída. */
export type MotivoSaida =
  | Motivo
  | 'sem_rota'
  | 'rota_invalida'
  | 'rota_inativa'
  | 'rota_liberada'
  | 'rota_em_outra_saida'
  | 'limite_rota';

/** Linha do arquivo que não entrou: só linha, rota, código e motivo (sem nome nem telefone). */
export interface DescarteSaida {
  n: number;
  rota: string | null;
  codigo: string;
  motivo: MotivoSaida;
  detalhe?: string | null;
}

export interface SaidaDoDia {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  numero: number;
  /** `HH:MM`. */
  horario: string;
  arquivoNome: string;
  importadaEm: string;
  aceitos: number;
  descartados: number;
  /** Ausente na visão de todas as unidades. */
  descartes?: DescarteSaida[];
}

/** Cartão de uma rota no dia. `saidaNumero: null` = carga fora de uma saída (aba "Sem saída"). */
export interface CartaoRota extends CartaoDistrito {
  saidaNumero: number | null;
  unidade: { id: string; nome: string };
}

/** `GET /entregas/saidas`. */
export interface QuadroSaidas {
  data: string;
  somenteLeitura: boolean;
  /** Todas as unidades juntas (Gestão): só leitura. */
  agregado: boolean;
  unidade: { id: string; nome: string } | null;
  saidas: SaidaDoDia[];
  proximaSaida: number;
  rotas: CartaoRota[];
}

/** `POST /entregas/saidas/importar`. */
export interface ResultadoImportacaoSaida {
  saida: SaidaDoDia;
  reimportacao: boolean;
  aceitos: number;
  descartados: number;
  descartes: DescarteSaida[];
  rotas: number;
  rotasCriadas: string[];
  rotasSemCarteiro: string[];
  rotasLiberadas: string[];
  carteirosNaoEncontrados: Array<{ rota: string; valor: string }>;
  avisos: AvisoPlanilha[];
}

export type ResultadoLiberacaoRota =
  | ({ rota: string | null; cargaId: string; ok: true } & RespostaLiberacao)
  | { rota: string | null; cargaId: string; ok: false; erro: string };

/** `POST /entregas/saidas/liberar`. */
export interface RespostaLiberacaoLote {
  resultados: ResultadoLiberacaoRota[];
  liberadas: number;
  falhas: number;
  avisosAgendados: number;
  agendadoPara?: string;
}

export interface AtribuicaoCarteiro {
  distritoId: string;
  carteiroId: string;
  definirPadrao?: boolean;
}

/** `PUT /entregas/saidas/carteiros`. */
export interface RespostaAtribuicao {
  resultados: Array<
    | { distritoId: string; rota: string | null; ok: true; carteiro: { id: string; nome: string | null } | null }
    | { distritoId: string; rota: string | null; ok: false; erro: string }
  >;
  atribuidas: number;
  falhas: number;
}

// ——— Carga ———

export type Situacao = 'valida' | 'sem_whatsapp' | 'corrigir' | 'invalida';

export type Motivo =
  | 'faltam_campos'
  | 'codigo_invalido'
  | 'digito_invalido'
  | 'duplicado_planilha'
  | 'ja_no_distrito'
  | 'sem_ddd'
  | 'whatsapp_invalido';

export interface CamposEndereco {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  enderecoTexto: string | null;
  referencia: string | null;
}

export interface LinhaPrevia extends CamposEndereco {
  n: number;
  codigo: string;
  nome: string;
  whatsapp: string | null;
  situacao: Situacao;
  motivo?: Motivo;
  detalhe?: string | null;
  descadastrado?: boolean;
  semEndereco?: boolean;
  orientacaoGuardada?: { tipo: string; texto: string };
}

export interface ResumoPrevia {
  total: number;
  validas: number;
  semWhatsapp: number;
  corrigir: number;
  invalidas: number;
  aceitaveis: number;
  comWhatsapp: number;
  descadastrados: number;
  orientacoesGuardadas: number;
}

export type AvisoPlanilha = 'varias_abas' | 'sem_coluna_whatsapp' | 'sem_coluna_endereco';

export interface Previa {
  data: string;
  linhas: LinhaPrevia[];
  resumo: ResumoPrevia;
  avisos: AvisoPlanilha[];
}

export interface ResultadoConfirmacao {
  cargaId: string | null;
  aceitos: number;
  descartados: number;
  descartes: Array<{ n: number; codigo: string; motivo: Motivo; detalhe?: string | null }>;
  avisadosNaHora: number;
}

// ——— Pacotes do distrito ———

export interface PacoteDistrito {
  id: string;
  codigo: string;
  nome: string;
  whatsapp: string | null;
  endereco: CamposEndereco;
  status: StatusPacote;
  rotulo: string;
  naoEnviadoMotivo: string | null;
  escalonado: boolean;
  sinais: unknown;
  descadastrado: boolean;
  rastreio: { descricao: string; em: string | null } | null;
  orientacaoVigente: {
    id: string;
    tipo: string;
    texto: string;
    estado: string;
    origem: string;
    valeAPartirDe: string | null;
    pontoDesativado: boolean;
    /** Sinalizações da orientação (ex.: `nao_entregue_carteiro`, `falha_envio_carteiro`). */
    sinais?: string[] | null;
  } | null;
  respostaCarteiro: { resposta: string; em: string | null } | null;
  /** Captura (extensão aditiva): de onde vieram os dados do pacote. */
  origem?: OrigemPacote;
  /** Captura: o carteiro digitou o código (não foi lido do rótulo). */
  codigoDigitado?: boolean;
  /** Captura: a foto da última captura salva ainda está retida. */
  temFoto?: boolean;
}

export type OrigemPacote = 'PLANILHA' | 'FOTO' | 'PLANILHA_FOTO';

/** `GET /entregas/captura/pacotes/:id/historico`. */
export interface HistoricoPacote {
  pacoteId: string;
  codigo: string;
  eventos: EventoHistorico[];
}

export interface EventoHistorico {
  id: string;
  tipo: string;
  em: string;
  carteiro: { id: string; nome: string | null } | null;
  mudancas: Array<{ campo: string; antes: unknown; depois: unknown }>;
  dados: Record<string, unknown>;
}

export interface ListaPacotes {
  cargaId: string;
  data: string;
  somenteLeitura: boolean;
  distrito: { id: string; codigo: string; nome: string };
  statusCarga: StatusQuadro;
  liberada: boolean;
  resumo: { total: number; comWhatsapp: number; porStatus: ContagemPorStatus };
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  pacotes: PacoteDistrito[];
}

// ——— Cadastro ———

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
  totalPaginas: number;
}

export interface Distrito {
  id: string;
  unidadeId: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  carteiroPadrao: { id: string; nome: string | null; ativo: boolean } | null;
  atualizadoEm: string;
}

export interface CarteiroCadastro {
  id: string;
  unidadeId: string;
  nome: string | null;
  matricula: string;
  whatsapp: string | null;
  ativo: boolean;
  possuiLogin: boolean;
  distritosPadrao: Array<{ id: string; codigo: string; nome: string }>;
  atualizadoEm: string;
}

export type TipoPonto = 'AGENCIA' | 'LOCKER';

export interface PontoRetirada {
  id: string;
  unidadeId: string;
  tipo: TipoPonto;
  nome: string;
  endereco: string;
  horario: string;
  ativo: boolean;
  atualizadoEm: string;
}

// ——— Gestão ———

export type TipoCanal = 'WAHA' | 'WABA';

export interface CanalProsio {
  id: string;
  nome: string;
  baseUrl: string;
  tipo: TipoCanal;
  compartilhado: boolean;
  ativo: boolean;
  unidades?: number;
  tokenEntrada?: string;
  atualizadoEm?: string;
}

export interface UnidadeGestao {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'CDD' | 'CEE' | 'HIBRIDA';
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativa: boolean;
  canalProsioId: string | null;
  prosioUnidadeRef: string | null;
  mediacaoAtiva: boolean;
  canalProsio: { id: string; nome: string; tipo: TipoCanal; compartilhado: boolean; ativo: boolean } | null;
  supervisoresAtivos: number;
  semSupervisor: boolean;
  complemento?: string | null;
  cep?: string;
  /** Decimal do banco: chega como texto no JSON. */
  latitude?: number | string;
  longitude?: number | string;
  atualizadoEm?: string;
}

export interface Supervisor {
  id: string;
  nome: string;
  email: string | null;
  matricula: string | null;
  role: string;
  unidadeId: string | null;
  unidade: { id: string; nome: string; codigo: string } | null;
  telefoneCelular: string | null;
  ativo: boolean;
}

export interface SessaoAtendimento {
  url: string;
  expiraEm: string;
}

// ——— Auditoria da interface (aditivo) ———

/** Resposta de `PATCH /entregas/pacotes/:id`. */
export interface PacoteEditado {
  id: string;
  codigo: string;
  whatsapp: string | null;
  status: StatusPacote;
  rotulo: string;
  descadastrado: boolean;
  /** O pacote ganhou WhatsApp numa rota já liberada: o aviso ao destinatário sai agora. */
  avisoSolicitado: boolean;
  endereco: CamposEndereco;
}

/** Resposta de `PUT /entregas/cadastro/distritos/:id/escala/:data`. */
export interface EscalaDefinida {
  distritoId: string;
  data: string;
  carteiro: { id: string; nome: string | null } | null;
  trocado: boolean;
  avisos: string[];
}

export interface FiltroListagem {
  unidadeId?: string;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}
