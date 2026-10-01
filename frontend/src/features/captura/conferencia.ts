/**
 * Regras da tela "Confira os dados" (US-006, US-008): validação local dos campos,
 * textos de dúvida em linguagem de carteiro e o rascunho por `capturaId`.
 */
import type { CamposLidos, Campo } from './captureQueue';
import { normalizeS10, validateS10 } from './lib/s10';
import { normalizarTelefone } from './lib/telefone';

export type NomeCampo = keyof CamposLidos;
export type Valores = Record<NomeCampo, string>;

export const NOMES_CAMPOS: NomeCampo[] = [
  'codigo', 'nome', 'whatsapp', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
];

export const ROTULOS: Record<NomeCampo, string> = {
  codigo: 'Código do objeto',
  nome: 'Destinatário',
  whatsapp: 'WhatsApp',
  cep: 'CEP',
  logradouro: 'Rua',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
};

const TEXTO_MOTIVO: Record<string, string> = {
  cep_sem_logradouro: 'O CEP não traz a rua. Confira no rótulo.',
  cep_indisponivel: 'Não deu para consultar o CEP. Confira no rótulo.',
  cep_nao_encontrado: 'CEP não encontrado. Confira no rótulo.',
  cep_do_texto: 'CEP lido do texto do rótulo. Confira.',
  ceps_divergentes: 'Os dois CEPs do rótulo não batem. Confira.',
  codigos_divergentes: 'Os códigos do rótulo não batem. Confira no pacote.',
  telefone_invalido: 'Número incompleto: corrija ou deixe em branco',
  extracao_indisponivel: 'Não deu para ler este campo. Preencha pelo rótulo.',
};

const TEXTO_DUVIDA_PADRAO: Partial<Record<NomeCampo, string>> = {
  whatsapp: 'Um dígito ficou ilegível. Confira no rótulo ou deixe em branco.',
};

/** O texto que explica a dúvida de um campo (o destaque nunca depende só da cor). */
export function textoDuvida(nome: NomeCampo, campo: Campo | undefined): string | null {
  if (!campo?.duvida) return null;
  const motivo = campo.motivo ?? '';
  return TEXTO_MOTIVO[motivo] ?? TEXTO_DUVIDA_PADRAO[nome] ?? 'Não deu para ler com segurança. Confira no rótulo.';
}

/** Referência do rótulo quando o CEP trouxe outra rua (US-008 EC-2). */
export function referenciaRotulo(campo: Campo | undefined): string | null {
  const m = campo?.motivo;
  return m && m.startsWith('rotulo:') ? m.slice('rotulo:'.length) : null;
}

export function valoresIniciais(campos: Partial<CamposLidos> | null | undefined): Valores {
  const v = {} as Valores;
  for (const n of NOMES_CAMPOS) v[n] = campos?.[n]?.valor ?? '';
  return v;
}

export function soDigitos(s: string): string {
  return s.replace(/\D/g, '');
}

export type Erros = Partial<Record<NomeCampo, string>>;

/** Os bloqueios de "Salvar" (o mínimo da TechSpec), com a mensagem de cada campo. */
export function validar(v: Valores): Erros {
  const e: Erros = {};
  if (!validateS10(normalizeS10(v.codigo), { qualquerPais: true }).valid) e.codigo = 'Código não confere';
  if (!v.nome.trim()) e.nome = 'Informe o nome do destinatário';
  if (v.whatsapp.trim()) {
    try {
      normalizarTelefone(v.whatsapp);
    } catch {
      e.whatsapp = 'Número incompleto: corrija ou deixe em branco';
    }
  }
  if (soDigitos(v.cep).length !== 8) e.cep = 'CEP deve ter 8 dígitos';
  if (!v.logradouro.trim()) e.logradouro = 'Informe a rua';
  if (!v.numero.trim()) e.numero = 'Informe o número (ou S/N)';
  if (!v.cidade.trim()) e.cidade = 'Informe a cidade';
  if (!/^[A-Za-z]{2}$/.test(v.uf.trim())) e.uf = 'Informe a UF (2 letras)';
  return e;
}

/**
 * O que vai no `confirmar`: os campos alterados e os que estavam em dúvida
 * (confirmados pelo carteiro). Vazio vira `null` (WhatsApp em branco = sem WhatsApp).
 */
export function camposParaEnviar(
  v: Valores,
  original: Partial<CamposLidos> | null | undefined,
): Partial<Record<NomeCampo, string | null>> {
  const saida: Partial<Record<NomeCampo, string | null>> = {};
  for (const n of NOMES_CAMPOS) {
    const antes = original?.[n]?.valor ?? '';
    const agora = n === 'codigo' ? normalizeS10(v[n]) : n === 'cep' ? soDigitos(v[n]) : v[n].trim();
    if (agora !== antes || original?.[n]?.duvida) saida[n] = agora === '' ? null : agora;
  }
  return saida;
}

const PREFIXO_RASCUNHO = 'captura:rascunho:';

export function lerRascunho(capturaId: string): Valores | null {
  try {
    const bruto = localStorage.getItem(PREFIXO_RASCUNHO + capturaId);
    return bruto ? (JSON.parse(bruto) as Valores) : null;
  } catch {
    return null;
  }
}

export function gravarRascunho(capturaId: string, v: Valores): void {
  try {
    localStorage.setItem(PREFIXO_RASCUNHO + capturaId, JSON.stringify(v));
  } catch {
    // sem espaço: o rascunho é conveniência
  }
}

export function apagarRascunho(capturaId: string): void {
  try {
    localStorage.removeItem(PREFIXO_RASCUNHO + capturaId);
  } catch {
    // nada a fazer
  }
}
