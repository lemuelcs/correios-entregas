import { AppError } from '../../shared/middleware/error-handler.middleware';
import { CwsTokenResponse, RastreioResponse, CepResponse } from './cws.types';

const CWS_BASE_URL = process.env.CORREIOS_CWS_URL || 'https://api.correios.com.br';
const CWS_USERNAME = process.env.CORREIOS_CWS_USERNAME || '';
const CWS_ACCESS_CODE = process.env.CORREIOS_CWS_ACCESS_CODE || '';
const CWS_CONTRACT = process.env.CORREIOS_CWS_CONTRACT || '';
const CWS_CARTAO_POSTAGEM = process.env.CORREIOS_CWS_CARTAO_POSTAGEM || '';

// Token lifetime buffer: renew 5 minutes before actual expiry
const TOKEN_RENEWAL_BUFFER_MS = 5 * 60 * 1000;

class CwsClient {
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.baseUrl = CWS_BASE_URL;
  }

  private assertCredentials(): void {
    if (!CWS_USERNAME || !CWS_ACCESS_CODE || !CWS_CONTRACT) {
      throw new AppError(503, 'CWS credentials not configured');
    }
  }

  /**
   * Authenticate with Correios CWS API.
   * POST /token/v1/autentica/contrato
   */
  async authenticate(): Promise<void> {
    this.assertCredentials();

    const url = `${this.baseUrl}/token/v1/autentica/contrato`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${CWS_USERNAME}:${CWS_ACCESS_CODE}`).toString('base64')}`,
      },
      body: JSON.stringify({
        numero: CWS_CONTRACT,
        ...(CWS_CARTAO_POSTAGEM ? { cartaoPostagem: CWS_CARTAO_POSTAGEM } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        response.status,
        `CWS authentication failed: ${response.statusText}`,
        body,
      );
    }

    const data = (await response.json()) as CwsTokenResponse;
    this.token = data.token;
    this.tokenExpiresAt = new Date(data.expiraEm);

    console.log(
      `[cws] Authenticated successfully. Token expires at ${this.tokenExpiresAt.toISOString()}`,
    );
  }

  /**
   * Ensure we have a valid (non-expired) token, renewing if necessary.
   */
  private async ensureAuth(): Promise<string> {
    this.assertCredentials();

    const now = new Date();
    const isExpired =
      !this.token ||
      !this.tokenExpiresAt ||
      now.getTime() >= this.tokenExpiresAt.getTime() - TOKEN_RENEWAL_BUFFER_MS;

    if (isExpired) {
      await this.authenticate();
    }

    return this.token!;
  }

  /**
   * Track an object by its tracking code.
   * GET /rastro/v1/objetos/{code}
   */
  async rastrear(codigoObjeto: string): Promise<RastreioResponse> {
    const token = await this.ensureAuth();

    const url = `${this.baseUrl}/rastro/v1/objetos/${encodeURIComponent(codigoObjeto)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        response.status,
        `CWS rastrear failed for ${codigoObjeto}: ${response.statusText}`,
        body,
      );
    }

    return (await response.json()) as RastreioResponse;
  }

  /**
   * Lookup an address by CEP.
   * GET /cep/v2/enderecos?cep={cep}
   */
  async buscarCep(cep: string): Promise<CepResponse> {
    const token = await this.ensureAuth();

    const cleanCep = cep.replace(/\D/g, '');
    const url = `${this.baseUrl}/cep/v2/enderecos?cep=${encodeURIComponent(cleanCep)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        response.status,
        `CWS buscarCep failed for ${cep}: ${response.statusText}`,
        body,
      );
    }

    return (await response.json()) as CepResponse;
  }
}

export const cwsClient = new CwsClient();
