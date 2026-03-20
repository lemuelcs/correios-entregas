export const objetos = [
  {
    code: 'AA123456789BR',
    service: 'SEDEX',
    sender: 'Amazon Brasil',
    status: 'Saiu para entrega',
    badge: 'info' as const,
    accent: '🚚',
    estimate: 'Hoje, ate 18h',
  },
  {
    code: 'AA987654321BR',
    service: 'PAC',
    sender: 'Magazine Luiza',
    status: 'Em transito',
    badge: 'warning' as const,
    accent: '📦',
    estimate: 'Amanha, 20/03',
  },
  {
    code: 'SX000001111BR',
    service: 'SEDEX',
    sender: 'Mercado Livre',
    status: 'Entregue',
    badge: 'success' as const,
    accent: '✅',
    estimate: 'Entregue em 17/03',
  },
];

export const timeline = [
  { event: 'OEC', description: 'Objeto saiu para entrega', location: 'CDD Sao Paulo Centro', time: '07:14', current: true },
  { event: 'RO', description: 'Objeto recebido na unidade de entrega', location: 'CDD Sao Paulo Centro', time: 'Ontem, 22:30' },
  { event: 'CTE', description: 'Objeto em transferencia', location: 'CTE Sao Paulo', time: 'Ontem, 18:45' },
  { event: 'POSTADO', description: 'Objeto postado', location: 'Agencia Centro, SP', time: '15/03, 14:20' },
];

export const interactionOptions = [
  { id: 'reagendar', title: 'Reagendar entrega', subtitle: 'Escolher nova data e periodo', accent: '📅' },
  { id: 'terceiro', title: 'Autorizar terceiro', subtitle: 'Permitir recebimento por outra pessoa', accent: '👤' },
  { id: 'redirecionar', title: 'Redirecionar entrega', subtitle: 'Indicar outro endereco', accent: '📍' },
  { id: 'agencia', title: 'Guardar na agencia', subtitle: 'Retirada presencial na unidade', accent: '🏢' },
  { id: 'contatar', title: 'Contatar a operacao', subtitle: 'Enviar observacao complementar', accent: '📞' },
];

export const scheduleDays = [
  { label: 'Qui', day: '20', month: 'mar', available: true },
  { label: 'Sex', day: '21', month: 'mar', available: true },
  { label: 'Sab', day: '22', month: 'mar', available: false },
  { label: 'Dom', day: '23', month: 'mar', available: false },
  { label: 'Seg', day: '24', month: 'mar', available: true },
  { label: 'Ter', day: '25', month: 'mar', available: true },
  { label: 'Qua', day: '26', month: 'mar', available: true },
];

export const accountData = {
  name: 'Ana Carolina Souza',
  email: 'ana.souza@example.com',
  cpf: '123.456.789-00',
  notifications: 'Avisos por push e e-mail',
};

export const helpTopics = [
  { title: 'Como alterar a entrega', detail: 'Use Gerenciar Entrega para reagendar, redirecionar ou indicar retirada em agencia.' },
  { title: 'Tentativa sem atendimento', detail: 'Quando houver insucesso BDE_02 ou BDE_10, o sistema permite nova tentativa ou reagendamento.' },
  { title: 'Codigo de rastreio', detail: 'Voce pode rastrear sem login informando o codigo no formato AA000000000BR.' },
];
