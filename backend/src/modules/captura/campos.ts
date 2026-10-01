/**
 * Montagem dos campos de uma captura e avaliação do mínimo (funções puras).
 *
 * Precedência (ADR-011): DataMatrix > código linear > LLM. O endereço vem do CEP
 * (rua, bairro, cidade, UF); quando o CEP não resolve, vem do rótulo com dúvida (ADR-002).
 */
import { normalizeS10, validateS10 } from '../../shared/utils/s10';
import type { SigepDataMatrix } from '../../shared/utils/sigep-datamatrix';
import { classificarTelefone } from '../../shared/utils/telefone-classificacao';
import {
  MOTIVOS_GLOBAIS,
  NOMES_CAMPOS,
  type Campo,
  type CamposLidos,
  type Fonte,
  type NomeCampo,
  type ResultadoCep,
} from './captura.types';

export interface EntradaMontagem {
  /** Código escolhido no aparelho (lido no Code 128 ou digitado). */
  codigo: string | null;
  codigoDigitado: boolean;
  cepLinear: string | null;
  dataMatrix: SigepDataMatrix | null;
  /** Resultado da consulta do CEP; `null` quando não havia CEP para consultar. */
  cep: ResultadoCep | null;
  /** Campos devolvidos pelo LLM; `null` = extração indisponível. */
  llm: Partial<CamposLidos> | null;
}

function vazio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function campo(valor: string | null | undefined, fonte: Fonte, extra: { duvida?: boolean; motivo?: string } = {}): Campo {
  const c: Campo = { valor: vazio(valor), duvida: extra.duvida ?? false, fonte };
  if (extra.motivo) c.motivo = extra.motivo;
  return c;
}

function soDigitos(v: string | null | undefined): string | null {
  if (v == null) return null;
  const d = v.replace(/\D/g, '');
  return d === '' ? null : d;
}

function mesmoTexto(a: string, b: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  return n(a) === n(b);
}

/** Campo do LLM (ou vazio, marcado quando a extração falhou). */
function doLlm(llm: Partial<CamposLidos> | null, nome: NomeCampo, extra: { duvida?: boolean; motivo?: string } = {}): Campo {
  if (!llm) return campo(null, 'LLM', { duvida: extra.duvida, motivo: 'extracao_indisponivel' });
  const c = llm[nome];
  return campo(c?.valor ?? null, 'LLM', {
    duvida: (c?.duvida ?? false) || (extra.duvida ?? false),
    motivo: extra.motivo ?? c?.motivo,
  });
}

export function montarCampos(e: EntradaMontagem): CamposLidos {
  const dm = e.dataMatrix;

  // Código: o do aparelho; o do DataMatrix confere.
  const codigoAparelho = e.codigo ? normalizeS10(e.codigo) : null;
  let codigo: Campo;
  if (codigoAparelho) {
    codigo = campo(codigoAparelho, e.codigoDigitado ? 'DIGITADO' : 'BARRAS');
    if (dm?.codigo && dm.codigo !== codigoAparelho) {
      codigo = { ...codigo, duvida: true, motivo: 'codigos_divergentes' };
    }
  } else if (dm?.codigo) {
    codigo = campo(dm.codigo, 'DATAMATRIX');
  } else {
    codigo = campo(null, 'BARRAS');
  }

  // CEP: DataMatrix > linear > texto do LLM (sempre com dúvida).
  const cepLinear = soDigitos(e.cepLinear);
  let cep: Campo;
  if (dm?.cepDestino) {
    cep = campo(dm.cepDestino, 'DATAMATRIX');
    if (cepLinear && cepLinear !== dm.cepDestino) cep = { ...cep, duvida: true, motivo: 'ceps_divergentes' };
  } else if (cepLinear) {
    cep = campo(cepLinear, 'BARRAS');
  } else {
    const texto = e.llm?.cep?.valor ?? null;
    cep = campo(soDigitos(texto), 'LLM', { duvida: texto != null || !!e.llm?.cep?.duvida, motivo: e.llm ? 'cep_do_texto' : 'extracao_indisponivel' });
  }

  // Número, complemento e telefone: DataMatrix > LLM.
  const numero = dm?.numero ? campo(dm.numero, 'DATAMATRIX') : doLlm(e.llm, 'numero');
  const complemento = dm ? campo(dm.complemento, 'DATAMATRIX') : doLlm(e.llm, 'complemento');
  let whatsapp = dm?.telefone ? campo(dm.telefone, 'DATAMATRIX') : doLlm(e.llm, 'whatsapp');
  if (whatsapp.valor && !whatsapp.duvida) {
    try {
      classificarTelefone(whatsapp.valor);
    } catch {
      whatsapp = { ...whatsapp, duvida: true, motivo: 'telefone_invalido' };
    }
  }

  const nome = doLlm(e.llm, 'nome');

  // Endereço: CEP > rótulo.
  let logradouro: Campo;
  let bairro: Campo;
  let cidade: Campo;
  let uf: Campo;
  const r = e.cep;
  if (r && typeof r === 'object') {
    cidade = campo(r.cidade, 'CEP');
    uf = campo(r.uf, 'CEP');
    if (r.logradouro) {
      const doRotulo = vazio(e.llm?.logradouro?.valor ?? null);
      logradouro = campo(r.logradouro, 'CEP', doRotulo && !mesmoTexto(doRotulo, r.logradouro) ? { motivo: `rotulo:${doRotulo}` } : {});
      bairro = r.bairro ? campo(r.bairro, 'CEP') : doLlm(e.llm, 'bairro');
    } else {
      logradouro = doLlm(e.llm, 'logradouro', { duvida: true, motivo: 'cep_sem_logradouro' });
      bairro = doLlm(e.llm, 'bairro', { duvida: true, motivo: 'cep_sem_logradouro' });
    }
  } else if (r === 'INDISPONIVEL') {
    logradouro = doLlm(e.llm, 'logradouro', { duvida: true, motivo: 'cep_indisponivel' });
    bairro = doLlm(e.llm, 'bairro', { duvida: true, motivo: 'cep_indisponivel' });
    cidade = doLlm(e.llm, 'cidade', { duvida: true, motivo: 'cep_indisponivel' });
    uf = doLlm(e.llm, 'uf', { duvida: true, motivo: 'cep_indisponivel' });
  } else {
    // NAO_ENCONTRADO, ou sem CEP para consultar: o endereço vem do rótulo; o CEP fica em dúvida.
    logradouro = doLlm(e.llm, 'logradouro');
    bairro = doLlm(e.llm, 'bairro');
    cidade = doLlm(e.llm, 'cidade');
    uf = doLlm(e.llm, 'uf');
    if (r === 'NAO_ENCONTRADO') cep = { ...cep, duvida: true, motivo: 'cep_nao_encontrado' };
  }
  if (uf.valor) uf = { ...uf, valor: uf.valor.toUpperCase() };

  return { codigo, nome, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf };
}

export type AvaliacaoMinimo = { ok: true } | { ok: false; motivos: string[] };

/**
 * Regra 1 da conciliação: código válido (S10 com `qualquerPais`), nome, logradouro,
 * número (ou "S/N"), cidade, UF e CEP de 8 dígitos, e nenhum campo em dúvida.
 */
export function avaliarMinimo(campos: CamposLidos): AvaliacaoMinimo {
  const motivos: string[] = [];
  const v = (n: NomeCampo) => (campos[n]?.valor ?? '').trim();

  if (!v('codigo') || !validateS10(v('codigo'), { qualquerPais: true }).valid) motivos.push('codigo_invalido');
  if (!v('nome')) motivos.push('nome_ausente');
  if (!v('logradouro') || !v('numero') || !v('cidade') || !v('uf')) motivos.push('endereco_incompleto');
  if (!/^\d{8}$/.test(v('cep'))) motivos.push('cep_invalido');
  for (const n of NOMES_CAMPOS) {
    if (campos[n]?.duvida) motivos.push(`duvida:${n}`);
  }
  return motivos.length === 0 ? { ok: true } : { ok: false, motivos };
}

/** Motivos de "Para conferir": os do mínimo mais as tags globais gravadas nos campos. */
export function motivosDe(campos: CamposLidos): string[] {
  const minimo = avaliarMinimo(campos);
  const motivos = minimo.ok ? [] : [...minimo.motivos];
  const globais = new Set<string>(MOTIVOS_GLOBAIS);
  for (const n of NOMES_CAMPOS) {
    const m = campos[n]?.motivo;
    if (m && globais.has(m) && !motivos.includes(m)) motivos.push(m);
  }
  return motivos;
}

/**
 * Campos que o LLM precisa ler: só os que o DataMatrix e o CEP não cobriram (ADR-002).
 * `cep` = resultado da consulta, ou `null` quando ainda não há CEP (o LLM lê o CEP em texto).
 */
export function camposParaPedir(e: { dataMatrix: SigepDataMatrix | null; cepLinear: string | null; cep: ResultadoCep | null }): NomeCampo[] {
  const dm = e.dataMatrix;
  const pedir: NomeCampo[] = ['nome'];
  if (!dm?.telefone) pedir.push('whatsapp');
  if (!dm?.cepDestino && !soDigitos(e.cepLinear)) pedir.push('cep');
  if (!dm?.numero) pedir.push('numero');
  if (!dm) pedir.push('complemento');
  const r = e.cep;
  if (!(r && typeof r === 'object' && r.logradouro)) pedir.push('logradouro', 'bairro');
  if (!(r && typeof r === 'object')) pedir.push('cidade', 'uf');
  return NOMES_CAMPOS.filter((n) => pedir.includes(n));
}
