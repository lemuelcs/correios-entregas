/**
 * config-loader.ts
 * Centraliza lookups de WppPilotConfig por Tenant (Multi-Tenant).
 */
import { db } from '../types/prisma-extended';
import { AppError } from '../shared/middleware/error-handler.middleware';

/** Busca a configuração de um Tenant específico. */
export async function getWppConfigByTenant(tenantId: string) {
  return db.wppPilotConfig.findFirst({ 
    where: { tenantId }
  });
}

/** Busca a configuração de uma Estação específica (se houver override) ou do Tenant. */
export async function getWppConfigByStation(tenantId: string, stationId?: string) {
  if (stationId) {
    const stationConfig = await db.wppPilotConfig.findUnique({ where: { stationId } });
    if (stationConfig) return stationConfig;
  }
  return getWppConfigByTenant(tenantId);
}

/** Salva ou atualiza a configuração de um Tenant. */
export async function upsertTenantWppConfig(tenantId: string, data: any) {
  const existing = await getWppConfigByTenant(tenantId);

  const payload: any = {
    tenantId,
    instanceName: data.instanceName,
    phoneNumber: data.phoneNumber || '',
    terminology: data.terminology || { unit: 'Estação', agent: 'Motorista', pack: 'Encomenda', customer: 'Cliente', route: 'Rota' },
    locale: data.locale || 'pt_BR',
    timezone: data.timezone || 'America/Sao_Paulo',
    botEnabled: data.botEnabled ?? true,
    proxyEnabled: data.proxyEnabled ?? true,
    llmEnabled: data.llmEnabled ?? false,
    llmConfig: data.llmConfig || {},
    flowDefinition: data.flowDefinition || {},
    customMessages: data.customMessages || {},
    connected: data.connected ?? false,
  };

  if (existing) {
    return db.wppPilotConfig.update({ where: { id: existing.id }, data: payload });
  }

  return db.wppPilotConfig.create({ data: payload });
}

/** Busca WppPilotConfig pelo instanceName (usado nos webhooks). */
export async function getWppPilotConfigByInstance(instanceName: string) {
  return db.wppPilotConfig.findUnique({ where: { instanceName } });
}

/** Garante que a config existe para o tenant ou lança erro. */
export async function requireWppConfig(tenantId: string) {
  const config = await getWppConfigByTenant(tenantId);
  if (!config) throw new AppError(404, `Configuração de WhatsApp não encontrada para o tenant ${tenantId}`);
  return config;
}
