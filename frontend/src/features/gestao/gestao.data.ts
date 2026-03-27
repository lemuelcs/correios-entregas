export interface DashboardKpi {
  accent: 'blue' | 'yellow' | 'green' | 'red';
  delta: string;
  deltaPositive: boolean;
  label: string;
  unit?: string;
  value: string;
}

export const dashboardKpis: DashboardKpi[] = [
  { label: 'Objetos na unidade', value: '18.240', unit: 'obj', delta: '+6,2% vs ontem', deltaPositive: true, accent: 'blue' },
  { label: 'Chegadas previstas', value: '42', unit: 'bags', delta: '3 divergencias', deltaPositive: false, accent: 'yellow' },
  { label: 'Rotas em execucao', value: '64', unit: 'rotas', delta: '91% liberadas no horario', deltaPositive: true, accent: 'green' },
  { label: 'Alertas criticos', value: '7', delta: '2 acima do limite', deltaPositive: false, accent: 'red' },
];

export const dashboardAlerts = [
  {
    variant: 'warning' as const,
    title: 'Janela de recebimento sob pressao',
    description: 'As bags oriundas do CTE Guarulhos 02 chegaram 18 minutos acima da janela prevista e afetam a triagem da onda 2.',
  },
  {
    variant: 'info' as const,
    title: 'Cobertura operacional do dia',
    description: 'A unidade esta com 96% de cobertura de equipe, mantendo a previsao de SLA do dia acima de 93%.',
  },
];

export const routePulse = [
  { label: 'Objetos triados', value: 78, tone: 'blue' as const },
  { label: 'Despacho concluido', value: 64, tone: 'green' as const },
  { label: 'Entregas confirmadas', value: 52, tone: 'amber' as const },
];

export const incomingUnitizers = [
  { code: 'BAG-SP-1042', origin: 'CTE Guarulhos 02', eta: '08:20', status: 'Conferindo docs', statusVariant: 'warning' as const },
  { code: 'SAC-BA-2117', origin: 'CEE Campinas', eta: '08:35', status: 'Aguardando descarga', statusVariant: 'info' as const },
  { code: 'BAG-SP-1084', origin: 'CDD Pinheiros', eta: '08:52', status: 'Liberada para triagem', statusVariant: 'success' as const },
  { code: 'PAL-SP-0091', origin: 'HUB Jaguaré', eta: '09:05', status: 'Atraso monitorado', statusVariant: 'danger' as const },
];

export const routeSnapshots = [
  { route: 'R-01', district: 'Bela Vista', carteiro: 'Rafael M.', progress: 67, objects: 182, prediction: 'Finaliza 14:10' },
  { route: 'R-09', district: 'Liberdade', carteiro: 'Aline C.', progress: 59, objects: 164, prediction: 'Finaliza 14:32' },
  { route: 'R-14', district: 'Aclimacao', carteiro: 'Paulo V.', progress: 71, objects: 153, prediction: 'Finaliza 13:58' },
  { route: 'R-22', district: 'Paraiso', carteiro: 'Diana S.', progress: 43, objects: 149, prediction: 'Finaliza 15:26' },
];

export const recebimentoQueue = [
  { code: 'BAG-SP-1042', type: 'Bag', origin: 'CTE Guarulhos 02', expectedObjects: 438, eta: '08:20', divergence: 'Lacre divergente' },
  { code: 'SAC-BA-2117', type: 'Sacola', origin: 'CEE Campinas', expectedObjects: 124, eta: '08:35', divergence: 'Sem divergencia' },
  { code: 'CAF-SP-0048', type: 'Caixeta', origin: 'CDD Lapa', expectedObjects: 92, eta: '08:48', divergence: 'Aguardando leitura' },
  { code: 'BAG-SP-1084', type: 'Bag', origin: 'CDD Pinheiros', expectedObjects: 386, eta: '08:52', divergence: 'Sem divergencia' },
];

export const recebimentoHistory = [
  { time: '08:17', code: 'BAG-SP-1036', action: 'Recebido e liberado para triagem', user: 'Maria P.' },
  { time: '08:12', code: 'SAC-BA-2093', action: 'Divergencia de manifesto enviada', user: 'Julio N.' },
  { time: '08:08', code: 'PAL-SP-0088', action: 'Descarga confirmada no dock 03', user: 'Fernanda R.' },
];

export const triageModes = [
  { label: 'PTL', description: 'Sort wall com leitura assistida e balanceamento por faixa de CEP.', badge: 'Padrao recomendado' },
  { label: 'Manual', description: 'Fallback para contingencia e baixa volumetria no turno.', badge: 'Uso pontual' },
  { label: 'ADTA', description: 'Triagem acelerada para malha de maior prioridade e objetos premium.', badge: 'Alta prioridade' },
];

export const triageLanes = [
  { lane: 'Esteira A', route: 'R-01 a R-08', utilization: 84, backlog: '164 obj', tone: 'blue' as const },
  { lane: 'Esteira B', route: 'R-09 a R-16', utilization: 76, backlog: '121 obj', tone: 'green' as const },
  { lane: 'Esteira C', route: 'R-17 a R-24', utilization: 92, backlog: '208 obj', tone: 'amber' as const },
  { lane: 'Mesa Manual', route: 'Excecoes', utilization: 38, backlog: '27 obj', tone: 'red' as const },
];

export const triagePlan = [
  { slot: '08:00 - 09:00', wave: 'Onda 1', team: '12 operadores', focus: 'R-01 a R-10' },
  { slot: '09:00 - 10:00', wave: 'Onda 2', team: '14 operadores', focus: 'R-11 a R-20' },
  { slot: '10:00 - 11:00', wave: 'Onda 3', team: '10 operadores', focus: 'R-21 a R-28 e excedentes' },
];

export const routeScenarios = [
  { name: 'Balanceado', solver: 'PyVRP', gain: '11% menos km', commitment: 'SLA 93,4%', recommended: true },
  { name: 'Absoluto', solver: 'VROOM', gain: '13% menos km', commitment: 'SLA 91,8%', recommended: false },
  { name: 'Large Van', solver: 'PyVRP', gain: '8% menos km', commitment: 'Maior consolidacao', recommended: false },
];

export const routeOptimizationResults = [
  { route: 'R-01', stops: 44, objects: 182, modal: 'A pe', occupation: 71, departure: '09:12' },
  { route: 'R-09', stops: 39, objects: 164, modal: 'Moto', occupation: 64, departure: '09:20' },
  { route: 'R-14', stops: 36, objects: 153, modal: 'Bike', occupation: 68, departure: '09:18' },
  { route: 'R-22', stops: 33, objects: 149, modal: 'Van', occupation: 81, departure: '09:28' },
];

export const dispatchChecklist = [
  'Coleta de unitizador confirmada por todos os carteiros escalados.',
  'Etiquetas de rota impressas e anexadas aos volumes.',
  'Roteiros com geocode abaixo de 2% de pontos aproximados.',
  'Pendencias operacionais tratadas antes do horario limite.',
];

export const dispatchRoutes = [
  { route: 'R-01', carteiro: 'Rafael M.', vehicle: 'A pe', objects: 182, window: '09:10', ready: true },
  { route: 'R-09', carteiro: 'Aline C.', vehicle: 'Moto 14', objects: 164, window: '09:20', ready: true },
  { route: 'R-14', carteiro: 'Paulo V.', vehicle: 'Bike 03', objects: 153, window: '09:18', ready: false },
  { route: 'R-22', carteiro: 'Diana S.', vehicle: 'Van 07', objects: 149, window: '09:28', ready: true },
];

export const monitoringAlerts = [
  { route: 'R-14', issue: 'Desvio de 18 min no corredor Sul', severity: 'warning' as const },
  { route: 'R-22', issue: '4 tentativas sem atendimento no mesmo setor', severity: 'info' as const },
  { route: 'R-03', issue: 'GPS sem pulso ha 6 min', severity: 'danger' as const },
];

export const liveRoutes = [
  { route: 'R-01', carteiro: 'Rafael M.', planned: 61, actual: 67, lastEvent: 'Entrega confirmada 10:41', incidents: 1 },
  { route: 'R-09', carteiro: 'Aline C.', planned: 63, actual: 59, lastEvent: 'Coleta concluida 10:38', incidents: 0 },
  { route: 'R-14', carteiro: 'Paulo V.', planned: 74, actual: 71, lastEvent: 'Tentativa sem atendimento 10:35', incidents: 2 },
  { route: 'R-22', carteiro: 'Diana S.', planned: 46, actual: 43, lastEvent: 'Parada em andamento 10:43', incidents: 1 },
];

export const reconciliationSummary = [
  { label: 'Rotas fechadas', value: '22/28', accent: 'green' as const },
  { label: 'Pendencias abertas', value: '31 obj', accent: 'amber' as const },
  { label: 'Retorno sem scan', value: '2 bags', accent: 'red' as const },
  { label: 'Objetos reencaminhados', value: '86 obj', accent: 'blue' as const },
];

export const reconciliationReturns = [
  { code: 'BAG-RET-0021', route: 'R-01', scannedAt: '16:58', status: 'Conferido' },
  { code: 'BAG-RET-0044', route: 'R-14', scannedAt: '17:05', status: 'Aguardando tratativa' },
  { code: 'SAC-RET-0118', route: 'R-22', scannedAt: '17:11', status: 'Conferido' },
];

export const reconciliationPending = [
  { objectCode: 'SX123456789BR', route: 'R-14', reason: 'BDE_04 - Endereco insuficiente', action: 'Validar complemento' },
  { objectCode: 'SX123456790BR', route: 'R-22', reason: 'BDE_02 - Ausente', action: 'Ofertar reagendamento' },
  { objectCode: 'SX123456791BR', route: 'R-03', reason: 'Sem scan de retorno', action: 'Cobrar fechamento da rota' },
];

export const forecastSeries = [
  ['19/03', 18240],
  ['20/03', 17650],
  ['21/03', 16980],
  ['22/03', 15440],
  ['23/03', 14890],
  ['24/03', 17320],
  ['25/03', 18940],
  ['26/03', 20110],
  ['27/03', 19630],
  ['28/03', 18210],
  ['29/03', 17140],
  ['30/03', 18880],
  ['31/03', 20560],
  ['01/04', 21430],
] as const;

export const unitizerInventory = [
  { code: 'BAG-01', type: 'Bag', status: 'Disponivel', quantity: 124 },
  { code: 'SAC-02', type: 'Sacola', status: 'Em uso', quantity: 86 },
  { code: 'CAF-03', type: 'Caixeta', status: 'Manutencao', quantity: 12 },
  { code: 'CDL-04', type: 'Conteiner', status: 'Disponivel', quantity: 18 },
];

export const vehicleFleet = [
  { plate: 'ABC1D23', model: 'Moto 150', status: 'Em rota', route: 'R-09', fuel: '68%' },
  { plate: 'EFG4H56', model: 'Van', status: 'Disponivel', route: 'Reserva', fuel: '91%' },
  { plate: 'IJK7L89', model: 'Bike eletrica', status: 'Manutencao', route: 'Oficina', fuel: '100%' },
];

export const carteiroTeam = [
  { name: 'Rafael Mendes', modal: 'A pe', status: 'Escalado', familiarity: 'H3 alto' },
  { name: 'Aline Costa', modal: 'Moto', status: 'Escalada', familiarity: 'H3 medio' },
  { name: 'Paulo Vieira', modal: 'Bike', status: 'Escalado', familiarity: 'H3 alto' },
  { name: 'Diana Souza', modal: 'Van', status: 'Escalada', familiarity: 'H3 medio' },
];

export const attendance = [
  { name: 'Rafael Mendes', shift: '07:30', status: 'Presente' },
  { name: 'Aline Costa', shift: '07:30', status: 'Presente' },
  { name: 'Paulo Vieira', shift: '07:30', status: 'Atraso 12 min' },
  { name: 'Diana Souza', shift: '07:30', status: 'Presente' },
  { name: 'Lucia Prado', shift: '08:00', status: 'Ausencia justificada' },
];

export const unidadeConfiguracoes = [
  { label: 'Unidade', value: 'CDD Sao Paulo Centro' },
  { label: 'Modelo de triagem', value: 'PTL com contingencia manual' },
  { label: 'Faixas de CEP', value: '01000-999 a 01599-999' },
  { label: 'Integracao SRO', value: 'Ativa e sincronizada' },
  { label: 'Integracao solver', value: 'PyVRP primario, VROOM contingencia' },
  { label: 'Janela de despacho', value: '09:10 ate 09:40' },
];

export const gestaoUnitName = 'CDD Sao Paulo Centro';
