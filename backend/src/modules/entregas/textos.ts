/**
 * Textos das entregas mediadas — mensagens ao destinatário e ao carteiro e as
 * respostas das ações de botão. Centralizados aqui para que nenhum gerador
 * escape das regras do PRD:
 * - nenhum link, pedido de pagamento ou pix (verificado por teste);
 * - português simples, sem jargão interno (sem "SRO", "CDD", "distrito" para o destinatário);
 * - instrução ao carteiro com no máximo 300 caracteres, sem CPF nem telefone.
 *
 * Reutilizado pela task_06 (aviso, resumo ao carteiro).
 */
import type { BotaoMensagem } from '../../integrations/prosio/prosio.types';
import { formatarDiaDeEntrega } from './calendario';

export const LIMITE_TEXTO_ORIENTACAO = 300;
export const MARCADOR_REMOVIDO = '[removido]';

// ——— Higiene de texto ——————————————————————————————————————————————

const PADROES_SENSIVEIS: readonly RegExp[] = [
  // e-mail
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  // CPF (com ou sem máscara) e CNPJ
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  // telefone: +55, DDD opcional (com ou sem parênteses), 8 ou 9 dígitos com separador opcional
  /(?:\+?55[\s.-]?)?(?:\(?\b\d{2}\)?[\s.-]?)?\b9?\d{4}[\s.-]?\d{4}\b/g,
];

/** Substitui CPF, CNPJ, telefone e e-mail por `[removido]` (US-014.EC-2, US-032). */
export function removerDadosSensiveis(texto: string): string {
  let r = texto;
  for (const p of PADROES_SENSIVEIS) r = r.replace(p, MARCADOR_REMOVIDO);
  return r;
}

/** Espaços colapsados; acima de `limite`, corta e termina com reticências (US-017.EC-6). */
export function limitarTexto(texto: string, limite = LIMITE_TEXTO_ORIENTACAO): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (t.length <= limite) return t;
  return `${t.slice(0, limite - 1).trimEnd()}…`;
}

/** Primeiro nome com a primeira letra maiúscula ("MARIA DA SILVA" → "Maria"). */
export function primeiroNome(nome: string): string {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  if (!p) return '';
  return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');
}

// ——— Opções e pontos ————————————————————————————————————————————————

export type OpcaoAviso = 'AMANHA' | 'VIZINHO' | 'AGENCIA' | 'LOCKER' | 'OUTRA';

export const ROTULOS_OPCAO: Readonly<Record<OpcaoAviso, string>> = {
  AMANHA: 'Tentar novamente amanhã',
  VIZINHO: 'Deixar com meu vizinho',
  AGENCIA: 'Deixar na agência',
  LOCKER: 'Deixar no locker',
  OUTRA: 'Outra opção',
};

export type TipoPontoTexto = 'AGENCIA' | 'LOCKER';

export interface PontoTexto {
  id: string;
  tipo: TipoPontoTexto;
  nome: string;
  endereco: string;
  horario: string;
}

function artigoPonto(tipo: TipoPontoTexto): { na: string; nome: string; essa: string } {
  return tipo === 'AGENCIA'
    ? { na: 'na agência', nome: 'agência', essa: 'Essa agência' }
    : { na: 'no locker', nome: 'locker', essa: 'Esse locker' };
}

/** Texto da orientação ao carteiro para um ponto de retirada. */
export function textoOrientacaoPonto(p: PontoTexto): string {
  return limitarTexto(`Deixar ${artigoPonto(p.tipo).na} ${p.nome} (${p.endereco})`);
}

/** Texto da orientação "amanhã" (vale no próximo dia de entrega). */
export function textoOrientacaoAmanha(dia: Date): string {
  return `Nova tentativa de entrega em ${formatarDiaDeEntrega(dia)}, a pedido do destinatário`;
}

/** Texto da orientação "vizinho" (só nome e casa/apartamento). */
export function textoOrientacaoVizinho(nome: string, casa?: string | null): string {
  return limitarTexto(removerDadosSensiveis(casa ? `Deixar com ${nome}, ${casa}` : `Deixar com ${nome}`));
}

// ——— Destinatário ————————————————————————————————————————————————————

export const textosDestinatario = {
  /** Resposta neutra a toque de número que não é o do pacote (ou id inexistente). */
  neutra: 'Não encontramos essa encomenda para o seu número. Se precisar, responda o aviso que você recebeu.',
  jaEntregue: 'Sua encomenda já foi entregue.',
  entregueAs: (hora: string | null) => (hora ? `Sua encomenda foi entregue às ${hora}.` : 'Sua encomenda já foi entregue.'),
  confirmacaoAmanha: (dia: Date) =>
    `Combinado, tentaremos entregar na ${formatarDiaDeEntrega(dia)}. Se mudar de ideia, é só escolher outra opção.`,
  limiteTentativas: (codigo: string) =>
    `Já tentamos entregar a encomenda ${codigo} outras vezes, e ela ficará disponível na unidade para retirada. ` +
    'Vou chamar um atendente da unidade para ajudar você.',
  atendimentoHumano: 'Vou chamar um atendente da unidade. Aguarde, por favor, que já falamos com você por aqui.',
  perguntaVizinho: 'Qual o nome do vizinho e o número da casa ou apartamento?',
  perguntaOutra: 'Conte como prefere receber.',
  semPontos: (tipo: TipoPontoTexto) =>
    `No momento não há ${tipo === 'AGENCIA' ? 'agência' : 'locker'} disponível. Escolha outra opção no aviso.`,
  subLista: (tipo: TipoPontoTexto) =>
    tipo === 'AGENCIA' ? 'Escolha a agência onde prefere retirar:' : 'Escolha o locker onde prefere retirar:',
  subListaEnviada: (tipo: TipoPontoTexto) =>
    tipo === 'AGENCIA' ? 'Enviei a lista das agências. Escolha uma delas.' : 'Enviei a lista dos lockers. Escolha um deles.',
  pontoIndisponivel: (tipo: TipoPontoTexto) =>
    `${artigoPonto(tipo).essa} não está mais disponível. Enviei a lista atualizada para você escolher de novo.`,
  confirmarPontoUnico: (p: PontoTexto) =>
    `Temos ${p.tipo === 'AGENCIA' ? 'uma agência' : 'um locker'} disponível: ${p.nome}, ${p.endereco}. ` +
    `Horário: ${p.horario}. Podemos deixar sua encomenda lá?`,
  confirmarPontoUnicoResposta: 'Confirme pelos botões da mensagem.',
  confirmacaoPonto: (p: PontoTexto) =>
    `Combinado! Sua encomenda será deixada ${artigoPonto(p.tipo).na} ${p.nome}, ${p.endereco}. Horário: ${p.horario}.`,
  confirmacaoOrientacao: (texto: string) => `Combinado! O carteiro vai seguir sua orientação: ${texto}.`,
  tentativaSemSucesso: (hora: string | null, texto: string) =>
    `${hora ? `Hoje já tentamos entregar às ${hora}, sem sucesso.` : 'Hoje já tentamos entregar, sem sucesso.'} ` +
    `Na próxima tentativa o carteiro seguirá sua orientação: ${texto}.`,
  perguntaValeParaAmanha: 'Confirma que vale para a próxima tentativa?',
  guardadaParaAmanha: (dia: Date) =>
    `Combinado! Sua orientação fica guardada, e o carteiro vai segui-la na ${formatarDiaDeEntrega(dia)}.`,
  negouConfirmacao: 'Tudo bem, nada foi alterado. Se precisar, escolha outra opção no aviso.',
  jaRegistrada: 'Sua orientação já foi registrada.',
  lockerFechado: (codigo: string, nomePonto: string | null) =>
    `O carteiro não conseguiu deixar a encomenda ${codigo}${nomePonto ? ` no locker ${nomePonto}` : ' no locker'}: ` +
    'estava fechado ou cheio. A encomenda seguirá para a unidade, e um atendente vai falar com você.',
} as const;

export const BOTOES_SIM_NAO = (orientacaoId: string): BotaoMensagem[] => [
  { id: `CE_SN:${orientacaoId}.SIM`, text: 'Sim' },
  { id: `CE_SN:${orientacaoId}.NAO`, text: 'Não' },
];

/** Sub-lista de agências ou lockers: `CE_PT:<pacoteId>.<pontoId>`, rótulo = nome (≤ 24). */
export function botoesSubLista(pacoteId: string, pontos: ReadonlyArray<Pick<PontoTexto, 'id' | 'nome'>>): BotaoMensagem[] {
  return pontos.slice(0, 10).map((p) => ({ id: `CE_PT:${pacoteId}.${p.id}`, text: p.nome.slice(0, 60) }));
}

/** Corpo da sub-lista: a pergunta e, por ponto, nome e endereço resumido. */
export function corpoSubLista(tipo: TipoPontoTexto, pontos: ReadonlyArray<Pick<PontoTexto, 'nome' | 'endereco'>>): string {
  const linhas = pontos.slice(0, 10).map((p) => `• ${p.nome}: ${p.endereco}`);
  return [textosDestinatario.subLista(tipo), ...linhas].join('\n');
}

// ——— Carteiro ————————————————————————————————————————————————————————

export type RespostaCarteiro = 'VI' | 'FEITO' | 'NAO' | MotivoNaoFoiPossivel;
export type MotivoNaoFoiPossivel = 'NAO_ATENDEU' | 'ENDERECO' | 'RECUSOU' | 'FECHADO' | 'OUTRO';

export const MOTIVOS_NAO_FOI_POSSIVEL: readonly MotivoNaoFoiPossivel[] = ['NAO_ATENDEU', 'ENDERECO', 'RECUSOU', 'FECHADO', 'OUTRO'];

export const ROTULOS_MOTIVO: Readonly<Record<MotivoNaoFoiPossivel, string>> = {
  NAO_ATENDEU: 'Ninguém atendeu',
  ENDERECO: 'Endereço não encontrado',
  RECUSOU: 'Vizinho recusou',
  FECHADO: 'Local fechado ou cheio',
  OUTRO: 'Outro motivo',
};

export interface OrientacaoParaCarteiro {
  codigo: string;
  nomeDestinatario: string;
  texto: string;
  atualizada: boolean;
}

/** Mensagem da orientação ao carteiro (US-021): código, primeiro nome, orientação; "ATUALIZADA:" quando substitui outra. */
export function mensagemOrientacaoCarteiro(o: OrientacaoParaCarteiro): string {
  const cabeca = `${o.atualizada ? 'ATUALIZADA: ' : ''}Orientação para ${o.codigo}`;
  return `${cabeca}\nDestinatário: ${primeiroNome(o.nomeDestinatario)}\n${o.texto}`;
}

export function botoesOrientacaoCarteiro(orientacaoId: string): BotaoMensagem[] {
  return [
    { id: `CE_CT:${orientacaoId}.VI`, text: 'Vi' },
    { id: `CE_CT:${orientacaoId}.FEITO`, text: 'Feito' },
    { id: `CE_CT:${orientacaoId}.NAO`, text: 'Não foi possível' },
  ];
}

/** "Não tentar hoje" (orientação AMANHA com o carteiro já na rua; IT-036). */
export function mensagemNaoTentarHoje(o: Omit<OrientacaoParaCarteiro, 'texto'> & { dia: Date }): string {
  return `${o.atualizada ? 'ATUALIZADA: ' : ''}Não tentar hoje: ${o.codigo}\n` +
    `Destinatário: ${primeiroNome(o.nomeDestinatario)} pediu nova tentativa em ${formatarDiaDeEntrega(o.dia)}.`;
}

export const textosCarteiro = {
  neutra: 'Essa orientação não está disponível para o seu número.',
  substituida: 'Essa orientação foi substituída por uma mais recente. Siga a última que você recebeu.',
  vista: 'Anotado: orientação vista.',
  feita: 'Obrigado! Registramos que a orientação foi cumprida.',
  perguntaMotivo: 'Qual foi o motivo?',
  perguntaMotivoResposta: 'Escolha o motivo na lista que enviei.',
  naoFoiPossivel: (motivo: MotivoNaoFoiPossivel) =>
    `Registramos: não foi possível (${ROTULOS_MOTIVO[motivo].toLowerCase()}). A unidade foi avisada.`,
  jaRespondida: 'Essa resposta já foi registrada.',
} as const;

export function botoesMotivos(orientacaoId: string): BotaoMensagem[] {
  return MOTIVOS_NAO_FOI_POSSIVEL.map((m) => ({ id: `CE_CT:${orientacaoId}.${m}`, text: ROTULOS_MOTIVO[m] }));
}
