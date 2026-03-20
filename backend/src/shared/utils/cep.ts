/**
 * CEP (Código de Endereçamento Postal) utilities.
 * Brazilian postal code: 8 digits, format XXXXX-YYY
 */

export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '').padStart(8, '0');
}

export function formatCep(cep: string): string {
  const normalized = normalizeCep(cep);
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

export function validateCep(cep: string): boolean {
  const normalized = normalizeCep(cep);
  return /^\d{8}$/.test(normalized) && normalized !== '00000000';
}

export function getCepRegiao(cep: string): string {
  const regioes: Record<string, string> = {
    '0': 'Grande SP',
    '1': 'Interior SP',
    '2': 'RJ/ES',
    '3': 'MG',
    '4': 'BA/SE',
    '5': 'PE+',
    '6': 'CE+Norte',
    '7': 'DF+CO',
    '8': 'PR/SC',
    '9': 'RS',
  };
  const first = normalizeCep(cep)[0];
  return regioes[first] || 'Desconhecida';
}

export function getCep5(cep: string): string {
  return normalizeCep(cep).slice(0, 5);
}

export function isCepInRange(cep: string, inicio: string, fim: string): boolean {
  const cepNum = parseInt(normalizeCep(cep));
  const iniNum = parseInt(normalizeCep(inicio));
  const fimNum = parseInt(normalizeCep(fim));
  return cepNum >= iniNum && cepNum <= fimNum;
}
