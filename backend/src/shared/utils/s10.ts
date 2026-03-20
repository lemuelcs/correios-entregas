/**
 * UPU S10 barcode validation for Brazilian postal objects.
 * Format: [SS][NNNNNNNN][D][BR] = 13 characters
 * SS = service indicator (2 letters)
 * NNNNNNNN = 8 sequential digits
 * D = check digit (modulo 11 with weights [8,6,4,2,3,5,9,7])
 * BR = country code
 */

const S10_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

const SERVICO_MAP: Record<string, string> = {
  PB: 'PAC', PC: 'PAC', PD: 'PAC', PE: 'PAC', PF: 'PAC', PG: 'PAC', PH: 'PAC',
  PI: 'PAC', PJ: 'PAC', PK: 'PAC', PL: 'PAC', PM: 'PAC', PN: 'PAC', PO: 'PAC',
  PP: 'PAC', PQ: 'PAC', PR: 'PAC', PS: 'PAC', PT: 'PAC', PU: 'PAC', PV: 'PAC',
  PW: 'PAC', PX: 'PAC', PY: 'PAC', PZ: 'PAC',
  DG: 'SEDEX', DL: 'SEDEX', DX: 'SEDEX', DY: 'SEDEX', DZ: 'SEDEX',
  RB: 'CARTA_REGISTRADA',
  LA: 'LOGISTICA_REVERSA', LB: 'LOGISTICA_REVERSA', LC: 'LOGISTICA_REVERSA',
  QQ: 'TESTE',
};

export interface S10Result {
  valid: boolean;
  servico?: string;
  servicoNome?: string;
  serial?: string;
  checkDigit?: number;
}

export function calculateS10CheckDigit(serial: string): number {
  const digits = serial.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * S10_WEIGHTS[i], 0);
  const remainder = sum % 11;
  if (remainder === 0) return 0;
  if (remainder === 1) return 5;
  return 11 - remainder;
}

export function validateS10(code: string): S10Result {
  const clean = code.toUpperCase().replace(/[\s-]/g, '');
  const match = clean.match(/^([A-Z]{2})(\d{8})(\d)(BR)$/);
  if (!match) return { valid: false };

  const [, servico, serial, dvStr] = match;
  const expected = calculateS10CheckDigit(serial);

  return {
    valid: Number(dvStr) === expected,
    servico,
    servicoNome: SERVICO_MAP[servico],
    serial,
    checkDigit: expected,
  };
}

export function formatS10(code: string): string {
  const clean = code.toUpperCase().replace(/[\s-]/g, '');
  if (clean.length !== 13) return code;
  return `${clean.slice(0, 2)}${clean.slice(2, 10)}${clean.slice(10, 11)}${clean.slice(11)}`;
}
