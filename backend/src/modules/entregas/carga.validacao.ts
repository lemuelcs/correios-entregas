/**
 * Classificação das linhas da lista do dia (PRD › Validação da lista).
 *
 * Situações:
 * - `valida` — código S10 válido, nome presente, WhatsApp normalizado;
 * - `sem_whatsapp` — WhatsApp vazio (aceita, não será avisada);
 * - `corrigir` — WhatsApp malformado (`sem_ddd` ou `whatsapp_invalido`);
 *   se não for corrigida, entra como "sem WhatsApp";
 * - `invalida` — `faltam_campos`, `codigo_invalido`, `digito_invalido`,
 *   `duplicado_planilha` ou `ja_no_distrito` (nunca entra).
 *
 * As consultas ao banco são injetadas (`ConsultasValidacao`) para que a regra
 * seja testável sem banco; `consultasPrisma` é a implementação real.
 */
import type { TipoOrientacao } from '@prisma/client';
import { normalizeS10, validateS10 } from '../../shared/utils/s10';
import { normalizarTelefone, TelefoneInvalido } from '../../shared/utils/telefone';
import { prisma } from '../../shared/utils/prisma';
import type { CamposEndereco } from './planilha.parser';

export type Situacao = 'valida' | 'sem_whatsapp' | 'corrigir' | 'invalida';

export type Motivo =
  | 'faltam_campos'
  | 'codigo_invalido'
  | 'digito_invalido'
  | 'duplicado_planilha'
  | 'ja_no_distrito'
  | 'sem_ddd'
  | 'whatsapp_invalido';

/** Linha a validar: vinda do parser ou reenviada (corrigida) pelo frontend. */
export interface LinhaEntrada extends CamposEndereco {
  n: number;
  codigo: string;
  nome: string;
  whatsapp?: string | null;
  faltamCampos?: boolean;
}

export interface OrientacaoGuardadaResumo {
  tipo: TipoOrientacao;
  texto: string;
}

export interface LinhaClassificada extends Required<CamposEndereco> {
  n: number;
  /** Código normalizado (maiúsculas, sem espaços). */
  codigo: string;
  nome: string;
  /** E.164 quando válido; o texto original quando precisa de correção; `null` quando vazio. */
  whatsapp: string | null;
  situacao: Situacao;
  motivo?: Motivo;
  /** `ja_no_distrito`: código do distrito onde o pacote já está (se for da mesma unidade). */
  detalhe?: string | null;
  descadastrado?: boolean;
  semEndereco?: boolean;
  orientacaoGuardada?: OrientacaoGuardadaResumo;
}

export interface ResumoClassificacao {
  total: number;
  validas: number;
  semWhatsapp: number;
  corrigir: number;
  invalidas: number;
  /** Linhas que entram na confirmação (`valida` + `sem_whatsapp` + `corrigir`). */
  aceitaveis: number;
  comWhatsapp: number;
  descadastrados: number;
  orientacoesGuardadas: number;
}

export interface ConsultasValidacao {
  /** Códigos já presentes em alguma carga do dia → código do distrito (ou `null` se de outra unidade). */
  codigosNoDia(codigos: string[]): Promise<Map<string, string | null>>;
  /** Quais destes números E.164 estão descadastrados. */
  descadastrados(numeros: string[]): Promise<Set<string>>;
  /** Orientações `GUARDADA` vigentes para os códigos. */
  orientacoesGuardadas(codigos: string[]): Promise<Map<string, OrientacaoGuardadaResumo>>;
}

const vazio = (v: string | null | undefined): boolean => v === null || v === undefined || v.trim() === '';

function limpar(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/[\s\u00a0]+/g, ' ').trim();
  return t === '' ? null : t;
}

/** UF só com 2 letras; CEP com 8 dígitos (7 dígitos = zero à esquerda perdido pelo Excel). */
export function normalizarEndereco(e: CamposEndereco): Required<CamposEndereco> {
  const uf = limpar(e.uf);
  const cepDigitos = (limpar(e.cep) ?? '').replace(/\D/g, '');
  const cep = cepDigitos.length === 8 ? cepDigitos : cepDigitos.length === 7 ? `0${cepDigitos}` : null;
  return {
    logradouro: limpar(e.logradouro),
    numero: limpar(e.numero),
    complemento: limpar(e.complemento),
    bairro: limpar(e.bairro),
    cidade: limpar(e.cidade),
    uf: uf && /^[A-Za-z]{2}$/.test(uf) ? uf.toUpperCase() : null,
    cep,
    enderecoTexto: limpar(e.enderecoTexto),
    referencia: limpar(e.referencia),
  };
}

function classificarWhatsapp(bruto: string | null | undefined): Pick<LinhaClassificada, 'whatsapp' | 'situacao' | 'motivo'> {
  const texto = limpar(bruto);
  if (!texto) return { whatsapp: null, situacao: 'sem_whatsapp' };
  try {
    return { whatsapp: normalizarTelefone(texto), situacao: 'valida' };
  } catch (err) {
    const motivo: Motivo = err instanceof TelefoneInvalido && err.codigo === 'sem_ddd' ? 'sem_ddd' : 'whatsapp_invalido';
    return { whatsapp: texto, situacao: 'corrigir', motivo };
  }
}

/**
 * Classifica as linhas na ordem recebida. A duplicidade marca a segunda
 * ocorrência em diante; a primeira segue as demais regras.
 */
export async function classificarLinhas(
  entrada: LinhaEntrada[],
  consultas: ConsultasValidacao,
): Promise<{ linhas: LinhaClassificada[]; resumo: ResumoClassificacao }> {
  const vistos = new Set<string>();

  const preliminares: LinhaClassificada[] = entrada.map((l) => {
    const codigo = normalizeS10(limpar(l.codigo) ?? '');
    const nome = limpar(l.nome) ?? '';
    const endereco = normalizarEndereco(l);
    const semEndereco = !endereco.logradouro && !endereco.enderecoTexto;
    const base = { n: l.n, codigo, nome, ...endereco, semEndereco };

    if (l.faltamCampos || vazio(codigo) || vazio(nome)) {
      return { ...base, whatsapp: limpar(l.whatsapp), situacao: 'invalida', motivo: 'faltam_campos' };
    }
    const s10 = validateS10(codigo, { qualquerPais: true });
    if (!s10.valid) {
      const motivo: Motivo = s10.checkDigit !== undefined ? 'digito_invalido' : 'codigo_invalido';
      return { ...base, whatsapp: limpar(l.whatsapp), situacao: 'invalida', motivo };
    }
    if (vistos.has(codigo)) {
      return { ...base, whatsapp: limpar(l.whatsapp), situacao: 'invalida', motivo: 'duplicado_planilha' };
    }
    vistos.add(codigo);
    return { ...base, ...classificarWhatsapp(l.whatsapp) };
  });

  const candidatas = preliminares.filter((l) => l.situacao !== 'invalida');
  const codigos = candidatas.map((l) => l.codigo);
  const numeros = [...new Set(candidatas.filter((l) => l.situacao === 'valida' && l.whatsapp).map((l) => l.whatsapp!))];

  const [noDia, descadastrados, guardadas] = await Promise.all([
    codigos.length ? consultas.codigosNoDia(codigos) : Promise.resolve(new Map<string, string | null>()),
    numeros.length ? consultas.descadastrados(numeros) : Promise.resolve(new Set<string>()),
    codigos.length ? consultas.orientacoesGuardadas(codigos) : Promise.resolve(new Map<string, OrientacaoGuardadaResumo>()),
  ]);

  const linhas = preliminares.map((l): LinhaClassificada => {
    if (l.situacao === 'invalida') return l;
    if (noDia.has(l.codigo)) {
      return { ...l, situacao: 'invalida', motivo: 'ja_no_distrito', detalhe: noDia.get(l.codigo) ?? null };
    }
    const final: LinhaClassificada = { ...l };
    if (l.situacao === 'valida' && l.whatsapp && descadastrados.has(l.whatsapp)) final.descadastrado = true;
    const orientacao = guardadas.get(l.codigo);
    if (orientacao) final.orientacaoGuardada = orientacao;
    return final;
  });

  return { linhas, resumo: resumir(linhas) };
}

export function resumir(linhas: LinhaClassificada[]): ResumoClassificacao {
  const conta = (s: Situacao) => linhas.filter((l) => l.situacao === s).length;
  const validas = conta('valida');
  const semWhatsapp = conta('sem_whatsapp');
  const corrigir = conta('corrigir');
  return {
    total: linhas.length,
    validas,
    semWhatsapp,
    corrigir,
    invalidas: conta('invalida'),
    aceitaveis: validas + semWhatsapp + corrigir,
    comWhatsapp: validas,
    descadastrados: linhas.filter((l) => l.descadastrado).length,
    orientacoesGuardadas: linhas.filter((l) => l.orientacaoGuardada).length,
  };
}

/** Consultas reais para o distrito `distrito` na `data`. */
export function consultasPrisma(opcoes: { data: Date; unidadeId: string }): ConsultasValidacao {
  return {
    async codigosNoDia(codigos) {
      const existentes = await prisma.pacoteDia.findMany({
        where: { data: opcoes.data, codigo: { in: codigos } },
        select: { codigo: true, carga: { select: { distrito: { select: { codigo: true, unidadeId: true } } } } },
      });
      return new Map(existentes.map((p) => [
        p.codigo,
        p.carga.distrito.unidadeId === opcoes.unidadeId ? p.carga.distrito.codigo : null,
      ]));
    },
    async descadastrados(numeros) {
      const lista = await prisma.descadastroWhatsapp.findMany({
        where: { whatsappE164: { in: numeros } },
        select: { whatsappE164: true },
      });
      return new Set(lista.map((d) => d.whatsappE164));
    },
    async orientacoesGuardadas(codigos) {
      const lista = await prisma.orientacao.findMany({
        where: {
          codigo: { in: codigos },
          estado: 'GUARDADA',
          OR: [{ valeAPartirDe: null }, { valeAPartirDe: { lte: opcoes.data } }],
        },
        orderBy: { criadaEm: 'asc' }, // a mais recente sobrescreve no Map
        select: { codigo: true, tipo: true, texto: true },
      });
      return new Map(lista.map((o) => [o.codigo, { tipo: o.tipo, texto: o.texto }]));
    },
  };
}
