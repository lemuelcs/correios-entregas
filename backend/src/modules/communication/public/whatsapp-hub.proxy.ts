/**
 * whatsapp-hub.proxy.ts
 * Proxy HTTP do backend Correios Entregas para o microsserviço central ms-whatsapp
 * (delivyo-services). Reescreve o JWT local para um JWT temporário compatível
 * com o hub, fixando o `tenantId` no valor configurado para a operação Correios.
 */
import axios, { AxiosRequestConfig, Method } from 'axios';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';

import logger from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/error-handler.middleware';

const WHATSAPP_HUB_BASE_URL = (
  process.env.WHATSAPP_HUB_BASE_URL || 'http://host.docker.internal/services/whatsapp'
).replace(/\/+$/, '');
const WHATSAPP_HUB_API_PREFIX = process.env.WHATSAPP_HUB_API_PREFIX || '/api/comunicacao';
const WHATSAPP_HUB_TIMEOUT_MS = parseInt(process.env.WHATSAPP_HUB_TIMEOUT_MS || '10000', 10);
const WHATSAPP_HUB_TENANT_ID = process.env.WHATSAPP_HUB_TENANT_ID || 'CORREIOS';
const LOCAL_COMUNICACAO_PREFIX = '/api/v1/comunicacao';

function buildHubUrl(req: Request): string {
  const pathWithQuery = req.originalUrl.replace(new RegExp(`^${LOCAL_COMUNICACAO_PREFIX}`), '');
  return `${WHATSAPP_HUB_BASE_URL}${WHATSAPP_HUB_API_PREFIX}${pathWithQuery}`;
}

/**
 * Mapeia a role local (Correios Entregas) para a role esperada pelo hub central
 * de WhatsApp, que reconhece ADMIN/MASTER/USER. Operadores administrativos do
 * Correios (GESTAO) sao mapeados para ADMIN no hub.
 */
function mapRoleForHub(localRole: string | undefined): string {
  switch (localRole) {
    case 'GESTAO':
      return 'ADMIN';
    case 'UNIDADE':
      return 'GESTOR';
    default:
      return localRole ?? 'USER';
  }
}

function buildProxyToken(req: Request): string {
  // Secret usado para assinar o JWT enviado ao hub central. Permite separar do
  // JWT_SECRET local (que assina tokens de usuario do Correios Entregas) caso o
  // hub use um segredo diferente.
  const secret = process.env.WHATSAPP_HUB_JWT_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new AppError(500, 'JWT_SECRET não configurado para proxy do hub de WhatsApp');
  }

  if (!req.user) {
    throw new AppError(401, 'Usuário não autenticado');
  }

  return jwt.sign(
    {
      sub: req.user.sub,
      role: mapRoleForHub(req.user.role),
      tenantId: WHATSAPP_HUB_TENANT_ID,
      dspId: WHATSAPP_HUB_TENANT_ID,
      unidadeId: req.user.unidadeId,
    },
    secret,
    { expiresIn: '5m' },
  );
}

function buildHeaders(req: Request, authenticated: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: req.header('accept') || 'application/json',
  };

  const contentType = req.header('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (authenticated) {
    headers.Authorization = `Bearer ${buildProxyToken(req)}`;
    headers['x-tenant-id'] = WHATSAPP_HUB_TENANT_ID;
    headers['x-dsp-id'] = WHATSAPP_HUB_TENANT_ID;
  }

  return headers;
}

async function forwardRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  authenticated: boolean,
): Promise<void> {
  const targetUrl = buildHubUrl(req);

  try {
    const config: AxiosRequestConfig = {
      url: targetUrl,
      method: req.method as Method,
      headers: buildHeaders(req, authenticated),
      timeout: WHATSAPP_HUB_TIMEOUT_MS,
      validateStatus: () => true,
      data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : req.body,
    };

    const response = await axios.request(config);

    const responseContentType = response.headers['content-type'];
    if (typeof responseContentType === 'string') {
      res.setHeader('content-type', responseContentType);
    }

    res.status(response.status).send(response.data);
  } catch (error) {
    logger.error(
      {
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        method: req.method,
        originalUrl: req.originalUrl,
        targetUrl,
      },
      '[COMMUNICATION_PROXY] Falha ao encaminhar requisição para o hub',
    );

    next(new AppError(502, 'Falha ao comunicar com o hub central de WhatsApp'));
  }
}

export function proxyWhatsAppHub(req: Request, res: Response, next: NextFunction): Promise<void> {
  return forwardRequest(req, res, next, true);
}

export function proxyWhatsAppHubWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  return forwardRequest(req, res, next, false);
}
