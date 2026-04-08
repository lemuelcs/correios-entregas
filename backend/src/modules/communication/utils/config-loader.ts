/**
 * config-loader.ts
 * Centraliza lookups de WppPilotConfig, eliminando repetição em routes e services.
 * Padrão encontrado 35+ vezes em comunicacao.routes.ts.
 */
import { db } from '../types/prisma-extended';
import { AppError } from '../../../shared/middleware/error-handler.middleware';

/** Busca WppPilotConfig pelo dspId. Retorna null se não encontrado. */
export async function getWppPilotConfig(dspId: string) {
  return db.wppPilotConfig.findFirst({ where: { unidadeId: dspId } });
}

/** Busca WppPilotConfig pelo instanceName. Retorna null se não encontrado. */
export async function getWppPilotConfigByInstance(instanceName: string) {
  return db.wppPilotConfig.findUnique({ where: { instanceName } });
}

/** Busca WppPilotConfig ou lança AppError 404. */
export async function requireWppPilotConfig(dspId: string) {
  const config = await getWppPilotConfig(dspId);
  if (!config) throw new AppError(404, 'WppPilotConfig não encontrado para este tenant');
  return config;
}

/** Busca WppPilotConfig conectado ou lança AppError 503. */
export async function requireConnectedConfig(dspId: string) {
  const config = await requireWppPilotConfig(dspId);
  if (!config.connected) throw new AppError(503, 'WhatsApp não conectado para este DSP');
  return config;
}
