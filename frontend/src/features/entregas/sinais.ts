/**
 * Sinalizações que a API devolve em `pacote.sinais` e `orientacaoVigente.sinais`
 * (backend: `modules/entregas/sinais.ts`), com o rótulo que o supervisor lê.
 */
import type { PacoteDistrito } from './entregas.types';

export interface Sinal {
  codigo: string;
  rotulo: string;
  /** Explicação curta (atributo `title` e leitor de tela). */
  detalhe: string;
  tom: 'erro' | 'atencao';
}

const SINAIS: Record<string, Omit<Sinal, 'codigo'>> = {
  divergencia: {
    rotulo: 'Divergência',
    detalhe: 'O que o carteiro ou o destinatário informou não bate com o rastreio.',
    tom: 'erro',
  },
  nao_entregue_carteiro: {
    rotulo: 'Carteiro sem WhatsApp',
    detalhe: 'A orientação não chegou ao carteiro: ele não tem WhatsApp cadastrado.',
    tom: 'erro',
  },
  falha_envio_carteiro: {
    rotulo: 'Falha no envio ao carteiro',
    detalhe: 'A orientação não foi entregue ao WhatsApp do carteiro.',
    tom: 'erro',
  },
  nao_foi_possivel: {
    rotulo: 'Carteiro não conseguiu',
    detalhe: 'O carteiro respondeu que não foi possível cumprir a orientação.',
    tom: 'atencao',
  },
  retido_consentimento: {
    rotulo: 'Aguardando consentimento',
    detalhe: 'A mediação ficou retida: o destinatário ainda não aceitou receber mensagens.',
    tom: 'atencao',
  },
  whatsapp_invalido: {
    rotulo: 'WhatsApp inválido',
    detalhe: 'O número veio malformado no arquivo; o pacote entrou sem WhatsApp. Corrija em "Editar".',
    tom: 'atencao',
  },
  descadastrado: {
    rotulo: 'Descadastrado',
    detalhe: 'O destinatário pediu para não receber mensagens.',
    tom: 'atencao',
  },
};

const MOTIVOS_CASO_RECUSADO: Record<string, string> = {
  opt_out: 'o destinatário pediu para não receber mensagens',
  sem_consentimento: 'o destinatário não deu consentimento',
  numero_invalido: 'o número do destinatário é inválido',
  limite_canal: 'o canal atingiu o limite de envios',
};

function texto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
}

/** Rótulo de um sinal; os desconhecidos aparecem com o próprio código, legível. */
export function descreverSinal(codigo: string): Sinal {
  if (codigo.startsWith('caso_recusado')) {
    const motivo = codigo.split(':')[1] ?? '';
    const legivel = MOTIVOS_CASO_RECUSADO[motivo] ?? (motivo ? motivo.replace(/_/g, ' ') : 'sem motivo informado');
    return { codigo, rotulo: 'Mediação recusada', detalhe: `O Prosio recusou abrir a mediação: ${legivel}.`, tom: 'erro' };
  }
  const conhecido = SINAIS[codigo];
  if (conhecido) return { codigo, ...conhecido };
  const legivel = codigo.replace(/[_:]/g, ' ').trim();
  return { codigo, rotulo: legivel.charAt(0).toUpperCase() + legivel.slice(1), detalhe: 'Sinalização do sistema.', tom: 'atencao' };
}

/**
 * Sinais do pacote e da orientação vigente, sem repetição. `descadastrado` fica de fora
 * quando a linha já diz "Não enviado: pediu para não receber mensagens".
 */
export function sinaisDoPacote(p: Pick<PacoteDistrito, 'sinais' | 'orientacaoVigente' | 'naoEnviadoMotivo' | 'descadastrado'>): Sinal[] {
  const codigos = [...texto(p.sinais), ...texto(p.orientacaoVigente?.sinais)];
  const jaDito = p.naoEnviadoMotivo === 'descadastrado' || p.descadastrado;
  const vistos = new Set<string>();
  const sinais: Sinal[] = [];
  for (const c of codigos) {
    if (vistos.has(c) || (c === 'descadastrado' && jaDito)) continue;
    vistos.add(c);
    sinais.push(descreverSinal(c));
  }
  return sinais;
}
