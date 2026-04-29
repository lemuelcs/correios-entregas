/**
 * whatsapp-hub.client.ts
 * Cliente HTTP interno (server-to-server) para o microsserviço central
 * ms-whatsapp (delivyo-services). Emite tokens curtos com o tenantId fixo
 * configurado para a operação Correios.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';

import logger from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/error-handler.middleware';

const WHATSAPP_HUB_BASE_URL = (
  process.env.WHATSAPP_HUB_BASE_URL || 'http://host.docker.internal/services/whatsapp'
).replace(/\/+$/, '');
const WHATSAPP_HUB_API_PREFIX = process.env.WHATSAPP_HUB_API_PREFIX || '/api/comunicacao';
const WHATSAPP_HUB_TIMEOUT_MS = parseInt(process.env.WHATSAPP_HUB_TIMEOUT_MS || '10000', 10);
const WHATSAPP_HUB_TENANT_ID = process.env.WHATSAPP_HUB_TENANT_ID || 'CORREIOS';

export interface WhatsAppPilotRuntimeConfig {
  configured: boolean;
  connected: boolean;
  instanceName?: string;
  phoneNumber?: string;
  locale?: string;
  timezone?: string;
  tenantNome?: string;
}

export interface SendMessageParams {
  phone: string;
  text: string;
  delay?: number;
  instanceName?: string;
  tenantId?: string;
}

export interface NotifyInsucessoParams {
  paradaId?: string;
  objetoId?: string;
  motivo?: string;
  observacao?: string;
  phone?: string;
  destinatarioNome?: string;
  tenantId?: string;
  // Permite payload livre adicional quando o hub acrescentar campos
  [key: string]: unknown;
}

export interface StartProxyParams {
  phone: string;
  destinatarioNome?: string;
  paradaId?: string;
  objetoId?: string;
  context?: Record<string, unknown>;
  tenantId?: string;
  [key: string]: unknown;
}

export interface TerminologyPayload {
  // Estrutura conforme contrato do hub; mantemos como objeto livre.
  [key: string]: unknown;
}

class WhatsAppHubClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${WHATSAPP_HUB_BASE_URL}${WHATSAPP_HUB_API_PREFIX}`,
      timeout: WHATSAPP_HUB_TIMEOUT_MS,
    });
  }

  private buildServiceToken(tenantId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError(500, 'JWT_SECRET não configurado para autenticação com o hub de WhatsApp');
    }

    return jwt.sign(
      {
        sub: 'correios-entregas-backend',
        role: 'MASTER',
        tenantId,
        dspId: tenantId,
      },
      secret,
      { expiresIn: '5m' },
    );
  }

  private buildHeaders(tenantId: string): Record<string, string> {
    const token = this.buildServiceToken(tenantId);
    return {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'x-dsp-id': tenantId,
    };
  }

  private resolveTenantId(tenantId?: string): string {
    return tenantId || WHATSAPP_HUB_TENANT_ID;
  }

  private serializeAxiosError(error: AxiosError): Record<string, unknown> {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    };
  }

  private handleAxiosError(error: unknown, action: string, context: Record<string, unknown>): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const data = error.response?.data as { error?: unknown; message?: unknown } | undefined;
      const responseMessage =
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.message === 'string'
            ? data.message
            : null;
      const message = responseMessage || error.message || `Falha ao ${action} via hub de WhatsApp`;

      logger.warn(
        {
          err: this.serializeAxiosError(error),
          ...context,
        },
        `[COMMUNICATION_API] Falha ao ${action} via hub`,
      );

      throw new AppError(status, message);
    }

    throw error;
  }

  /**
   * GET /admin/config
   * Retorna a configuração ativa do piloto de WhatsApp para o tenant.
   * Retorna `null` quando o tenant ainda não tem configuração.
   */
  async getPilotConfig(tenantId?: string): Promise<WhatsAppPilotRuntimeConfig | null> {
    const tid = this.resolveTenantId(tenantId);
    try {
      const response = await this.client.get('/admin/config', {
        headers: this.buildHeaders(tid),
      });

      if (!response.data || response.data.configured === false) {
        return null;
      }

      return response.data as WhatsAppPilotRuntimeConfig;
    } catch (error) {
      this.handleAxiosError(error, 'consultar configuração de WhatsApp', { tenantId: tid });
    }
  }

  /**
   * POST /notify
   * Envia uma mensagem de texto simples para um número via hub.
   */
  async sendMessage(params: SendMessageParams): Promise<string | undefined> {
    const tid = this.resolveTenantId(params.tenantId);
    try {
      const response = await this.client.post(
        '/notify',
        {
          phone: params.phone,
          text: params.text,
          delay: params.delay,
          instanceName: params.instanceName,
        },
        {
          headers: this.buildHeaders(tid),
        },
      );

      return response.data?.messageId;
    } catch (error) {
      this.handleAxiosError(error, 'enviar mensagem de WhatsApp', {
        tenantId: tid,
        instanceName: params.instanceName,
      });
    }
  }

  /**
   * POST /insucesso/notificar
   * Notifica o destinatário sobre uma tentativa de entrega sem sucesso.
   */
  async notifyInsucesso(params: NotifyInsucessoParams): Promise<unknown> {
    const tid = this.resolveTenantId(params.tenantId);
    try {
      const { tenantId: _ignored, ...payload } = params;
      void _ignored;
      const response = await this.client.post('/insucesso/notificar', payload, {
        headers: this.buildHeaders(tid),
      });
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'notificar insucesso de entrega', {
        tenantId: tid,
        paradaId: params.paradaId,
        objetoId: params.objetoId,
      });
    }
  }

  /**
   * POST /proxy/start
   * Inicia uma conversa LGPD-aware via número proxy do hub.
   */
  async startProxy(params: StartProxyParams): Promise<unknown> {
    const tid = this.resolveTenantId(params.tenantId);
    try {
      const { tenantId: _ignored, ...payload } = params;
      void _ignored;
      const response = await this.client.post('/proxy/start', payload, {
        headers: this.buildHeaders(tid),
      });
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'iniciar conversa via proxy LGPD', {
        tenantId: tid,
        phone: params.phone,
      });
    }
  }

  /**
   * GET /admin/terminology
   * Retorna a terminologia configurada (templates, variáveis, idioma).
   */
  async getTerminology(tenantId?: string): Promise<TerminologyPayload | null> {
    const tid = this.resolveTenantId(tenantId);
    try {
      const response = await this.client.get('/admin/terminology', {
        headers: this.buildHeaders(tid),
      });
      return (response.data ?? null) as TerminologyPayload | null;
    } catch (error) {
      this.handleAxiosError(error, 'consultar terminologia do hub de WhatsApp', { tenantId: tid });
    }
  }

  /**
   * PUT /admin/terminology
   * Atualiza a terminologia configurada para o tenant.
   */
  async updateTerminology(payload: TerminologyPayload, tenantId?: string): Promise<TerminologyPayload> {
    const tid = this.resolveTenantId(tenantId);
    try {
      const response = await this.client.put('/admin/terminology', payload, {
        headers: this.buildHeaders(tid),
      });
      return response.data as TerminologyPayload;
    } catch (error) {
      this.handleAxiosError(error, 'atualizar terminologia do hub de WhatsApp', { tenantId: tid });
    }
  }
}

export const whatsappHubClient = new WhatsAppHubClient();
