// ── Enums matching Prisma schema ──────────────────────────────────────

export type TipoUnidade = 'CDD' | 'CEE' | 'HIBRIDA';
export type ModeloTriagem = 'MANUAL' | 'PTL' | 'ADTA';
export type Role = 'GESTAO' | 'UNIDADE' | 'CARTEIRO' | 'DESTINATARIO';

export type ModalEntrega =
  | 'A_PE'
  | 'BICICLETA'
  | 'BICICLETA_ELETRICA'
  | 'MOTOCICLETA'
  | 'CARRO'
  | 'FURGAO'
  | 'VAN'
  | 'SPRINTER';

export type TipoUnitizador =
  | 'BAG'
  | 'SACOLA'
  | 'CARRINHO'
  | 'CAIXETA'
  | 'CDL'
  | 'CAF'
  | 'VEICULO';

export type StatusUnitizador = 'DISPONIVEL' | 'EM_USO' | 'EM_MANUTENCAO' | 'INATIVO';
export type StatusVeiculo = 'DISPONIVEL' | 'EM_ROTA' | 'MANUTENCAO' | 'INATIVO';

export type StatusObjeto =
  | 'AGUARDANDO_CHEGADA'
  | 'RECEBIDO_UNIDADE'
  | 'EM_CONFERENCIA'
  | 'TRIADO'
  | 'UNITIZADO'
  | 'DISPONIVEL_COLETA'
  | 'COLETADO_CARTEIRO'
  | 'EM_ROTA'
  | 'ENTREGUE'
  | 'TENTATIVA_SEM_ATENDIMENTO'
  | 'DEVOLVIDO_UNIDADE'
  | 'AGUARDANDO_RETIRADA'
  | 'DEVOLVIDO_REMETENTE'
  | 'AVARIADO'
  | 'EXTRAVIADO'
  | 'CANCELADO';

export type StatusRota =
  | 'CRIADA'
  | 'DISPONIVEL'
  | 'COLETADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'FINALIZADA';

export type StatusParada = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';
export type ModoOtimizacao = 'ABSOLUTO' | 'LARGE_VAN' | 'BALANCEADO';
export type SolverUsado = 'VROOM' | 'PYVRP';

// ── Entity interfaces ─────────────────────────────────────────────────

export interface User {
  id: string;
  nome: string;
  cpf?: string;
  email?: string;
  role: Role;
  unidadeId?: string;
  unidade?: Unidade;
  carteiro?: Carteiro;
}

export interface SuperintendenciaEstadual {
  id: string;
  nome: string;
  sigla: string;
  cidade: string;
  uf: string;
  isSede: boolean;
  ativa: boolean;
}

export interface Unidade {
  id: string;
  codigo: string;
  mcu?: string;
  nome: string;
  tipo: TipoUnidade;
  seId?: string;
  se?: SuperintendenciaEstadual;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: number;
  longitude: number;
  faixasCep: FaixaCep[];
  modeloTriagem: ModeloTriagem;
  configTriagem: ConfigTriagem;
  ativa: boolean;
}

export interface ConfiguracaoGlobal {
  id: string;
  chave: string;
  valor: unknown;
  descricao?: string;
}

export interface FaixaCep {
  inicio: string;
  fim: string;
  distritoCodigo?: string;
}

export interface ConfigTriagem {
  estruturas: number;
  posicoesPorEstrutura: number;
  throughputHora: number;
}

export interface Carteiro {
  id: string;
  usuarioId: string;
  unidadeId: string;
  matricula: string;
  modalPrincipal: ModalEntrega;
  cnh?: string;
  ativo: boolean;
  usuario?: User;
  _count?: { rotas: number };
}

export interface PontoDia {
  id: string;
  carteiroId: string;
  data: string;
  horaEntrada?: string;
  horaSaida?: string;
  presente: boolean;
  observacao?: string;
  carteiro?: Carteiro;
}

export interface Objeto {
  id: string;
  codigoRastreio: string;
  servicoCodigo: string;
  unidadeId: string;
  destinatarioNome: string;
  destinatarioCpf?: string;
  destinatarioTelefone?: string;
  cepDestino: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  latitude?: number;
  longitude?: number;
  pesoGramas: number;
  statusAtual: StatusObjeto;
  unitizadorId?: string;
  rotaId?: string;
  stopSequence?: number;
  tentativasEntrega: number;
  maxTentativas: number;
  dataLimiteGuarda?: string;
  remetenteNome: string;
}

export interface Unitizador {
  id: string;
  codigo: string;
  qrCode: string;
  tipo: TipoUnitizador;
  unidadeId: string;
  statusAtual: StatusUnitizador;
  statusVeiculo?: StatusVeiculo;
  placa?: string;
  modeloVeiculo?: string;
  modal?: ModalEntrega;
  capacidadeKg?: number;
  volumeLitros?: number;
  ativo: boolean;
  _count?: { objetos: number };
  objetos?: Objeto[];
}

export interface Rota {
  id: string;
  codigo: string;
  unidadeId: string;
  carteiroId: string;
  veiculoId: string;
  statusAtual: StatusRota;
  modoOtimizacao: ModoOtimizacao;
  solverUsado: SolverUsado;
  totalParadas: number;
  totalObjetos: number;
  totalEntregues: number;
  totalInsucessos: number;
  totalPnovs: number;
  distanciaEstimadaKm?: number;
  duracaoEstimadaMin?: number;
  horarioDespachoAlvo?: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  finalizadoEm?: string;
  posicaoEstacao?: string;
  carteiro?: Carteiro & { usuario?: User };
  veiculo?: Unitizador;
  paradas?: Parada[];
  objetos?: Objeto[];
  _count?: { paradas: number; objetos: number };
}

export interface Parada {
  id: string;
  rotaId: string;
  sequencia: number;
  latitude: number;
  longitude: number;
  cep: string;
  logradouro?: string;
  statusAtual: StatusParada;
  estimativaChegada?: string;
  totalObjetos: number;
  totalEntregues: number;
  totalInsucessos: number;
}

export interface ObjetoEvento {
  id: string;
  objetoId: string;
  tipo: string;
  descricao: string;
  ocorridoEm: string;
  latitude?: number;
  longitude?: number;
  localDescricao: string;
}

export interface SortPlan {
  id: string;
  rotaId: string;
  unidadeId: string;
  modelo: ModeloTriagem;
  assignments: SortAssignment[];
  validado: boolean;
}

export interface SortAssignment {
  objetoId: string;
  posicaoTriagem: string;
  distritoCodigo: string;
  stopSequence: number;
  unitizadorDestId?: string;
}

export interface VolumePrevisao {
  id: string;
  unidadeId: string;
  faixa: string;
  quantidadeEstimada: number;
  quantidadeChegou: number;
  data: string;
}

// ── Composite / response types ────────────────────────────────────────

export interface DashboardData {
  objetosPorStatus: Record<StatusObjeto, number>;
  rotasPorStatus: Record<StatusRota, number>;
  carteirosPresentes: number;
  carteirosTotal: number;
  unitizadoresPorStatus: Record<StatusUnitizador, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JobStatus {
  id: string;
  state: string;
  progress?: number;
}

export interface SimulacaoTriagem {
  totalPosicoes: number;
  quantidadeObjetos: number;
  tempoEstimadoMinutos: number;
  operadoresNecessarios: number;
  posicoesSuficientes: boolean;
  deadlineDespacho: string;
}

export interface ResumoRota {
  rota: Rota;
  sph: number;
  duracaoMinutos: number;
  objetosPendentesRetorno: Objeto[];
}

// ── Recebimento ───────────────────────────────────────────────────────

export interface ScanUnitizadorResult {
  id: string;
  codigo: string;
  qrCode: string;
  tipo: TipoUnitizador;
  statusAtual: StatusUnitizador;
  objetos: Objeto[];
}

export interface Divergencia {
  objetoId: string;
  tipo: string;
  descricao: string;
}

export interface RelatorioRecebimento {
  data: string;
  totalRecebidos: number;
  totalDivergencias: number;
  totalAvarias: number;
  unitizadoresProcessados: number;
}

// ── Monitoramento ─────────────────────────────────────────────────────

export interface MonitoramentoKpis {
  data: string;
  totalRotas: number;
  rotasAtivas: number;
  fadr: number;
  spr: number;
  sph: number;
  utilizacao: number;
  otdr: number;
  pnovRate: number;
  nps: number | null;
  totalObjetos: number;
  totalEntregues: number;
  totalPnovs: number;
}

export interface MonitoramentoAlerta {
  rota?: string;
  descricao?: string;
  severidade?: string;
  route?: string;
  issue?: string;
  severity?: string;
}

// ── Despacho ──────────────────────────────────────────────────────────

export interface PontoDiaItem {
  id: string;
  matricula: string;
  modalPrincipal: ModalEntrega;
  usuario: { id: string; nome: string; email?: string };
  ponto: {
    id: string;
    carteiroId: string;
    data: string;
    presente: boolean;
    horaEntrada?: string;
    observacao?: string;
  } | null;
}

// ── Triagem ───────────────────────────────────────────────────────────

export interface TriagemStatus {
  objetos: {
    recebidoUnidade: number;
    emConferencia: number;
    triado: number;
    totalPendentes: number;
    totalProcessados: number;
    percentualConcluido: number;
  };
  sortPlans: {
    total: number;
    validados: number;
    pendentes: number;
  };
}

// ── Roteirizacao ──────────────────────────────────────────────────────

export interface JobStatusDetalhado {
  jobId: string | undefined;
  solver: string;
  state: string;
  progress: number | object;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
}

export interface RoteirizacaoStop {
  objetoId?: string;
  codigoRastreio?: string;
  cep?: string;
  logradouro?: string;
  location?: number[];
  arrival?: number;
  duration?: number;
  distance?: number;
}

export interface RoteirizacaoRota {
  vehicleIndex: number;
  carteiroId?: string;
  matricula?: string;
  veiculoId?: string;
  veiculoCodigo?: string;
  totalObjetos: number;
  distanciaKm: number;
  duracaoMin: number;
  stops: RoteirizacaoStop[];
}

export interface RoteirizacaoResultado {
  jobId: string;
  summary: Record<string, number>;
  rotas: RoteirizacaoRota[];
  unassigned: { objetoId?: string; codigoRastreio?: string; location?: number[] | null }[];
  metadata: {
    unidadeId: string;
    modo: string;
    solver: string;
    totalVeiculos: number;
    totalObjetos: number;
  };
}

// ── SSE event payloads ────────────────────────────────────────────────

export interface SseRotaUpdate extends Partial<Rota> {
  id: string;
}

export interface SseAlerta {
  rota?: string;
  descricao?: string;
  severidade?: string;
}

export interface SseGpsUpdate {
  rotaId: string;
  latitude: number;
  longitude: number;
  velocidade?: number | null;
}

export interface SseObjetoEntregue {
  objetoId: string;
  codigoRastreio: string;
  rotaId: string;
}
