/**
 * `mediation.outcome` → orientação (TechSpec › Integration Points › mediação):
 *
 * | Desfecho                                               | Orientação |
 * |--------------------------------------------------------|------------|
 * | `entrega_indireta` com `condicao.local`                | `VIZINHO`  |
 * | `outro` / `reagendamento` (e motivo desconhecido)      | `OUTRA`    |
 * | `destinatario_ausente` com `condicao.ate` de outro dia | `AMANHA`   |
 * | `disposition: 'proposto'`                              | nenhuma: evento `desfecho_proposto` + escalonado |
 *
 * Função pura: não toca no banco. O texto sai sem CPF/telefone e com no
 * máximo 300 caracteres (com reticências).
 */
import type { CallbackDesfechoMediacao } from '../../integrations/prosio/prosio.types';
import {
  formatarDiaDeEntrega,
  formatarHora,
  mesmoDiaBrasilia,
  proximoDiaDeEntrega,
} from './calendario';
import { limitarTexto, removerDadosSensiveis, textoOrientacaoAmanha } from './textos';
import { hojeBrasilia } from './datas';

export type TipoOrientacaoMediada = 'VIZINHO' | 'OUTRA' | 'AMANHA';

export interface OrientacaoMediada {
  tipo: TipoOrientacaoMediada;
  texto: string;
  origem: 'MEDIACAO';
  vizinhoNome?: string;
  vizinhoCasa?: string;
  valeParaAmanha?: boolean;
}

export type ResultadoDesfecho =
  | { acao: 'orientacao'; orientacao: OrientacaoMediada }
  | { acao: 'proposto' }
  | { acao: 'sem_orientacao'; motivo: string };

const PREPOSICAO_INICIAL = /^(com|na|no|nas|nos|em|ao|aos|à|às|a|pela|pelo|junto)\s/i;
const VERBO_INICIAL =
  /^(deixar|deixa|deixe|entregar|entrega|entregue|levar|tentar|tente|chamar|ligar)\b/i;

function maiuscula(t: string): string {
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

/** Frase de instrução a partir do local combinado ("portaria com o Seu João" → "Deixar na portaria com o Seu João"). */
function instrucaoDoLocal(local: string): string {
  const l = local.trim().replace(/[.;]+$/, '');
  if (VERBO_INICIAL.test(l)) return maiuscula(l);
  if (PREPOSICAO_INICIAL.test(l))
    return `Deixar ${l.charAt(0).toLocaleLowerCase('pt-BR')}${l.slice(1)}`;
  return `Deixar na ${l}`;
}

/** Texto aparado, sem dados sensíveis; vazio vira `''`. */
function limpo(t: string | undefined): string {
  return t ? removerDadosSensiveis(t).trim() : '';
}

/** "; das 12h às 14h" quando a mediação trouxe o início da janela (`de`) e o fim (`ate`) no mesmo dia. */
function janelaDe(de: string | undefined, ate: Date | null): string | null {
  const ini = dataValida(de);
  if (!ini || !ate || ini.getTime() >= ate.getTime() || !mesmoDiaBrasilia(ini, hojeBrasilia(ate)))
    return null;
  return `; das ${formatarHora(ini)} às ${formatarHora(ate)}`;
}

function dataValida(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Dona Célia, casa 47" → nome "Dona Célia", casa "casa 47". */
function separarVizinho(local: string): { nome: string; casa?: string } {
  const i = local.indexOf(',');
  if (i === -1) return { nome: local.trim() };
  const nome = local.slice(0, i).trim();
  const casa = local.slice(i + 1).trim();
  return casa ? { nome, casa } : { nome };
}

export function mapearDesfecho(
  cb: Pick<CallbackDesfechoMediacao, 'disposition' | 'outcome'>,
  agora: Date = new Date(),
): ResultadoDesfecho {
  if (cb.disposition === 'proposto') return { acao: 'proposto' };
  const o = cb.outcome;
  if (o.estado && o.estado !== 'resolvido')
    return { acao: 'sem_orientacao', motivo: `estado_${o.estado}` };

  const hoje = hojeBrasilia(agora);
  const local = o.condicao?.local ? removerDadosSensiveis(o.condicao.local).trim() : '';
  const ate = dataValida(o.condicao?.ate);
  const ateHoje = ate ? mesmoDiaBrasilia(ate, hoje) : false;
  // Prazo combinado: só a hora se for hoje; com a data quando for outro dia (22/10: "até 14:00 de 23/10" se perdia).
  const sufixoAte = ate
    ? ateHoje
      ? `; até ${formatarHora(ate)}`
      : `; até ${formatarHora(ate)}, ${formatarDiaDeEntrega(hojeBrasilia(ate))}`
    : '';

  if (o.motivo === 'destinatario_ausente' && ate && hojeBrasilia(ate).getTime() > hoje.getTime()) {
    return {
      acao: 'orientacao',
      orientacao: {
        tipo: 'AMANHA',
        texto: limitarTexto(textoOrientacaoAmanha(proximoDiaDeEntrega(hoje))),
        origem: 'MEDIACAO',
        valeParaAmanha: true,
      },
    };
  }

  // Campos estruturados do Prosio (#62): quem, onde e como achar vêm separados; a frase é composta aqui.
  const pessoa = limpo(o.condicao?.pessoa);
  const unidade = limpo(o.condicao?.unidade);
  const referencia = limpo(o.condicao?.referencia);
  if (o.motivo === 'entrega_indireta' && pessoa) {
    const funcao = /^vizinh[oa]\b/i.test(local)
      ? local.toLowerCase().startsWith('vizinha')
        ? 'a vizinha'
        : 'o vizinho'
      : '';
    const quem = funcao ? `${funcao} ${pessoa}` : pessoa;
    const onde = [unidade, referencia ? `(${referencia})` : ''].filter(Boolean).join(' ');
    const base = onde ? `Deixar com ${quem}, ${onde}` : `Deixar com ${quem}`;
    const janela = janelaDe(o.condicao?.de, ate);
    return {
      acao: 'orientacao',
      orientacao: {
        tipo: 'VIZINHO',
        texto: limitarTexto(`${base}${janela ?? sufixoAte}`),
        origem: 'MEDIACAO',
        vizinhoNome: pessoa.slice(0, 120),
        ...(unidade
          ? {
              vizinhoCasa: [unidade, referencia ? `(${referencia})` : '']
                .filter(Boolean)
                .join(' ')
                .slice(0, 120),
            }
          : {}),
      },
    };
  }

  if (o.motivo === 'entrega_indireta' && local) {
    const { nome: nomeBruto, casa } = separarVizinho(local);
    // "vizinho Valenza" → "o vizinho Valenza" no texto; o nome guardado é só "Valenza".
    const papel = /^(vizinh[oa])\s+(.+)$/i.exec(nomeBruto);
    const nome = papel ? papel[2]!.trim() : nomeBruto;
    const quem = papel
      ? `${papel[1]!.toLowerCase() === 'vizinha' ? 'a' : 'o'} ${papel[1]!.toLowerCase()} ${nome}`
      : nome;
    const base = casa ? `Deixar com ${quem}, ${casa}` : `Deixar com ${quem}`;
    return {
      acao: 'orientacao',
      orientacao: {
        tipo: 'VIZINHO',
        texto: limitarTexto(`${base}${sufixoAte}`),
        origem: 'MEDIACAO',
        vizinhoNome: nome.slice(0, 120),
        ...(casa ? { vizinhoCasa: casa.slice(0, 120) } : {}),
      },
    };
  }

  // `outro`, `reagendamento`, motivos sem regra própria e motivos desconhecidos → OUTRA.
  let texto: string;
  if (local) texto = `${instrucaoDoLocal(local)}${sufixoAte}`;
  else if (ate && ateHoje) texto = `Tentar novamente depois das ${formatarHora(ate)}`;
  else texto = 'Seguir o que foi combinado com o destinatário na conversa mediada';
  return {
    acao: 'orientacao',
    orientacao: { tipo: 'OUTRA', texto: limitarTexto(texto), origem: 'MEDIACAO' },
  };
}

/** `externalRef` do caso de uma encomenda num dia: `<codigo>@<YYYY-MM-DD>` (ADR-011). */
export function lerExternalRef(ref: string): { codigo: string; data: string } | null {
  const m = /^([A-Z]{2}\d{9}[A-Z]{2})@(\d{4}-\d{2}-\d{2})$/.exec((ref ?? '').trim().toUpperCase());
  return m ? { codigo: m[1], data: m[2] } : null;
}
