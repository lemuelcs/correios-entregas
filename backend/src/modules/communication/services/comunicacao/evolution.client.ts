/**
 * evolution.client.ts
 * HTTP client para Evolution API (Meta Cloud API mode)
 * Módulo WPP-PILOT v1.3 — comunicação enxuta sem Chatwoot/n8n
 */
import axios, { AxiosInstance } from 'axios';
import logger from '../../../../shared/utils/logger';
import { getEvolutionBaseUrl } from './evolution-url';

export interface SendTextPayload {
  number: string; // E.164 sem "+": 5561999999999
  text: string;
  delay?: number; // ms de digitação (padrão 1000)
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      id: string;
      remoteJid: string; // "5561999999999@s.whatsapp.net"
      fromMe: boolean;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { caption?: string };
      audioMessage?: Record<string, unknown>;
      documentMessage?: { caption?: string; fileName?: string };
      videoMessage?: { caption?: string };
    };
    messageType: string;
    pushName?: string;
    status?: string;
  };
}

// Eventos que o WPP-PILOT precisa receber do Evolution API
export const WPP_PILOT_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'CONNECTION_UPDATE',
] as const;

export interface WebhookInfo {
  url: string;
  events: string[];
  webhookByEvents: boolean;
}

export interface EvolutionInstanceInfo {
  name: string;
  connectionStatus?: string;
}

type WebhookPayloadVersion = 'v2' | 'v1';

export class EvolutionClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getEvolutionBaseUrl(),
      headers: {
        apikey: process.env.EVOLUTION_PILOT_API_KEY ?? process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  }

  /**
   * Configura o webhook da instância Evolution API para o WPP-PILOT.
   * Deve ser chamado sempre que uma WppPilotConfig é criada ou atualizada.
   * URL: {APP_URL}/api/comunicacao/webhook/inbound
   * Eventos: MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    const payloadVersions: WebhookPayloadVersion[] = ['v2', 'v1'];
    let lastError: unknown;

    for (const version of payloadVersions) {
      try {
        await this.client.post(`/webhook/set/${instanceName}`, this.buildWebhookPayload(version, webhookUrl));
        logger.info({ instanceName, webhookUrl, payloadVersion: version }, '[WPP-PILOT] Webhook configurado');
        return;
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;
        const responseData = err?.response?.data;
        const shouldRetryWithLegacyPayload = version === 'v2' && status === 400;

        if (shouldRetryWithLegacyPayload) {
          logger.warn(
            { instanceName, webhookUrl, payloadVersion: version, status, responseData },
            '[WPP-PILOT] Falha ao configurar webhook com payload v2; tentando compatibilidade v1'
          );
          continue;
        }

        logger.error(
          { instanceName, webhookUrl, payloadVersion: version, status, responseData, err: err.message },
          '[WPP-PILOT] Erro ao configurar webhook'
        );
        throw err;
      }
    }

    throw lastError;
  }

  /**
   * Retorna as configurações atuais de webhook da instância.
   */
  async fetchWebhookInfo(instanceName: string): Promise<WebhookInfo | null> {
    try {
      const { data } = await this.client.get(`/webhook/find/${instanceName}`);
      const d = data as any;
      const webhookConfig = d?.webhook?.webhook ?? d?.webhook ?? d;
      return {
        url: d?.url ?? webhookConfig?.url ?? '',
        events: d?.events ?? webhookConfig?.events ?? [],
        webhookByEvents: d?.webhook_by_events
          ?? d?.webhookByEvents
          ?? webhookConfig?.webhookByEvents
          ?? webhookConfig?.webhook_by_events
          ?? false,
      };
    } catch {
      return null;
    }
  }

  private buildWebhookPayload(version: WebhookPayloadVersion, webhookUrl: string) {
    if (version === 'v1') {
      // Formato legacy (Evolution API < v2.2)
      return {
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: false,
        events: WPP_PILOT_WEBHOOK_EVENTS,
      };
    }

    // v2: Evolution API >= v2.2 exige payload aninhado sob "webhook"
    return {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        webhookBase64: false,
        events: WPP_PILOT_WEBHOOK_EVENTS,
      },
    };
  }

  async sendText(instanceName: string, payload: SendTextPayload): Promise<string> {
    try {
      const { data } = await this.client.post(`/message/sendText/${instanceName}`, {
        number: payload.number,
        text: payload.text,
        delay: payload.delay ?? 1000,
      });
      logger.debug({ instanceName, to: payload.number }, '[WPP-PILOT] Mensagem enviada');
      return (data as any)?.key?.id ?? '';
    } catch (err: any) {
      logger.error({ instanceName, to: payload.number, err: err.message }, '[WPP-PILOT] Erro ao enviar mensagem');
      throw err;
    }
  }

  async markAsRead(instanceName: string, messageId: string, phone: string): Promise<void> {
    await this.client
      .post(`/message/readMessages/${instanceName}`, {
        readMessages: [
          { key: { id: messageId, fromMe: false, remoteJid: `${phone}@s.whatsapp.net` } },
        ],
      })
      .catch(() => {});
  }

  async getConnectionState(instanceName: string): Promise<'open' | 'close' | 'connecting'> {
    const { data } = await this.client.get(`/instance/connectionState/${instanceName}`);
    return (data as any)?.instance?.state ?? 'close';
  }

  async fetchInstances(): Promise<EvolutionInstanceInfo[]> {
    const { data } = await this.client.get('/instance/fetchInstances');
    const instances = Array.isArray(data) ? data : [];

    return instances
      .map((entry: any) => ({
        name: entry?.name ?? entry?.instance?.instanceName ?? entry?.instanceName ?? '',
        connectionStatus: entry?.connectionStatus ?? entry?.instance?.state,
      }))
      .filter((entry) => !!entry.name);
  }

  async instanceExists(instanceName: string): Promise<boolean> {
    const instances = await this.fetchInstances();
    return instances.some((entry) => entry.name === instanceName);
  }

  /**
   * Normaliza o valor de base64 retornado pela Evolution API para um data URI válido.
   * Garante que apenas strings sejam aceitas (evita objeto {code, base64} ser usado como src).
   */
  private normalizeQrCodeBase64(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !raw) return undefined;
    return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
  }

  /**
   * Cria uma instância Baileys (WhatsApp Web via QR Code) na Evolution API.
   * Retorna o QR code base64 para exibir ao usuário escanear.
   *
   * Evolution API v2: { qrcode: { base64: "data:image/png;base64,..." } }
   * Evolution API v1: { base64: "data:image/png;base64,..." }
   */
  async createBaileysInstance(instanceName: string): Promise<{ qrcode?: string }> {
    try {
      const { data } = await this.client.post('/instance/create', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      });
      const d = data as any;
      // d?.qrcode pode ser um objeto {code, base64} — extrair apenas o campo base64 (string)
      const raw =
        d?.qrcode?.base64 ??
        d?.base64 ??
        d?.qrcode?.code ??
        d?.code ??
        null;
      const qrcode = this.normalizeQrCodeBase64(raw);
      logger.info(
        { instanceName, hasQrCode: !!qrcode, responseKeys: d ? Object.keys(d) : [] },
        '[WPP-PILOT] Instância Baileys criada',
      );
      return { qrcode };
    } catch (err: any) {
      logger.error(
        { instanceName, err: err.message, status: err?.response?.status, responseData: err?.response?.data },
        '[WPP-PILOT] Erro ao criar instância Baileys',
      );
      throw err;
    }
  }

  /**
   * Busca o QR code atual de uma instância Baileys já existente.
   * Útil para reconectar ou exibir o QR code novamente.
   *
   * Evolution API v2: { base64: "data:image/png;base64,..." }
   * Evolution API v1: { qrcode: { base64: "data:image/png;base64,..." } }
   * Algumas versões: { code: "2@...", base64: "..." }
   * Algumas versões: { pairingCode: null, code: "...", base64: "..." }
   */
  async getQrCode(instanceName: string): Promise<{ qrcode?: string }> {
    try {
      const { data } = await this.client.get(`/instance/connect/${instanceName}`);
      const d = data as any;
      const raw =
        d?.base64 ??
        d?.qrcode?.base64 ??
        d?.qrcode?.code ??
        d?.code ??
        null;
      const qrcode = this.normalizeQrCodeBase64(raw);
      logger.debug(
        { instanceName, hasQrCode: !!qrcode, responseKeys: d ? Object.keys(d) : [] },
        '[WPP-PILOT] getQrCode resposta',
      );
      return { qrcode };
    } catch (err: any) {
      logger.error(
        { instanceName, err: err.message, status: err?.response?.status, responseData: err?.response?.data },
        '[WPP-PILOT] Erro ao buscar QR code',
      );
      throw err;
    }
  }

  /**
   * Busca o QR code com polling — o Baileys gera o QR assincronamente,
   * então pode ser necessário aguardar alguns segundos após criar/conectar a instância.
   * Tenta até `maxAttempts` vezes com intervalo de `intervalMs` entre cada tentativa.
   */
  async getQrCodeWithPolling(
    instanceName: string,
    maxAttempts = 5,
    intervalMs = 2000,
  ): Promise<{ qrcode?: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { qrcode } = await this.getQrCode(instanceName);
      if (qrcode) return { qrcode };
      if (attempt < maxAttempts) {
        logger.debug({ instanceName, attempt, maxAttempts }, '[WPP-PILOT] QR code ainda não disponível, aguardando...');
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    return { qrcode: undefined };
  }

  /**
   * Reinicia uma instância Baileys na Evolution API.
   */
  async restartInstance(instanceName: string): Promise<void> {
    try {
      await this.client.post(`/instance/restart/${instanceName}`);
      logger.info({ instanceName }, '[WPP-PILOT] Instância reiniciada');
    } catch (err: any) {
      logger.error(
        { instanceName, err: err.message, status: err?.response?.status, responseData: err?.response?.data },
        '[WPP-PILOT] Erro ao reiniciar instância'
      );
      throw err;
    }
  }

  /**
   * Exclui permanentemente uma instância da Evolution API.
   */
  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
      logger.info({ instanceName }, '[WPP-PILOT] Instância excluída');
    } catch (err: any) {
      logger.error({ instanceName, err: err.message }, '[WPP-PILOT] Erro ao excluir instância');
      throw err;
    }
  }

  /** Extrai número E.164 (sem +) a partir do remoteJid do Evolution */
  static extractPhone(remoteJid: string): string {
    return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }

  /**
   * Normaliza telefone para formato E.164 sem +  (ex: "5521999992121").
   * Garante que números BR de 10-11 dígitos recebam prefixo "55".
   * Trata o 9º dígito ausente em celulares BR (WhatsApp pode retornar 12 dígitos).
   */
  static normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      // 12 dígitos = 55 + DDD(2) + 8 dígitos → falta o 9º dígito
      if (digits.length === 12) {
        return digits.slice(0, 4) + '9' + digits.slice(4);
      }
      return digits;
    }
    if (digits.length >= 10 && digits.length <= 11) {
      let local = digits;
      // 10 dígitos = DDD(2) + 8 dígitos → falta o 9º dígito
      if (local.length === 10) {
        local = local.slice(0, 2) + '9' + local.slice(2);
      }
      return '55' + local;
    }
    return digits;
  }

  /**
   * Obtém o conteúdo base64 de uma mensagem de mídia (áudio, imagem, vídeo, documento).
   * Chama o endpoint POST /chat/getBase64FromMediaMessage/{instanceName} do Evolution API.
   */
  async getBase64FromMediaMessage(instanceName: string, messageId: string, remoteJid: string): Promise<string | null> {
    try {
      const { data } = await this.client.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: { key: { id: messageId, remoteJid } },
      });
      return (data as any)?.base64 ?? null;
    } catch (err: any) {
      logger.error(
        { instanceName, messageId, err: err.message },
        '[WPP-PILOT] Erro ao obter base64 da mídia',
      );
      return null;
    }
  }

  /** Extrai texto legível de qualquer tipo de mensagem */
  static extractText(payload: EvolutionWebhookPayload): string {
    const msg = payload.data?.message;
    if (!msg) return '';
    return (
      msg.conversation ??
      msg.extendedTextMessage?.text ??
      msg.imageMessage?.caption ??
      msg.videoMessage?.caption ??
      msg.documentMessage?.caption ??
      ''
    );
  }
}

export const evolutionClient = new EvolutionClient();
