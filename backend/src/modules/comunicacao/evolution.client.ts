import axios, { AxiosInstance } from 'axios';

export interface SendTextPayload {
  number: string; // E.164 sem "+": 5561999999999
  text: string;
  delay?: number; // ms antes de enviar
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

export class EvolutionClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.EVOLUTION_API_URL,
      headers: {
        apikey: process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  }

  async sendText(instanceName: string, payload: SendTextPayload): Promise<string> {
    try {
      const { data } = await this.client.post(`/message/sendText/${instanceName}`, {
        number: payload.number,
        text: payload.text,
        delay: payload.delay ?? 1000,
      });
      console.log(`[evolution] → ${payload.number} (${instanceName})`);
      return (data as Record<string, any>).key?.id ?? '';
    } catch (err: any) {
      console.error(`[evolution] Erro sendText:`, err.message);
      throw err;
    }
  }

  async markAsRead(instanceName: string, messageId: string, phone: string): Promise<void> {
    await this.client
      .post(`/message/readMessages/${instanceName}`, {
        readMessages: [
          {
            key: {
              id: messageId,
              fromMe: false,
              remoteJid: `${phone}@s.whatsapp.net`,
            },
          },
        ],
      })
      .catch(() => {});
  }

  async getConnectionState(instanceName: string): Promise<'open' | 'close' | 'connecting'> {
    const { data } = await this.client.get(`/instance/connectionState/${instanceName}`);
    return (data as Record<string, any>).instance?.state ?? 'close';
  }

  async createInstance(instanceName: string): Promise<{ qrcode?: { base64: string } }> {
    const { data } = await this.client.post('/instance/create', {
      instanceName,
      integration: 'BAILEYS',
      qrcode: true,
    });
    return data as any;
  }

  async getQrCode(instanceName: string): Promise<string> {
    const { data } = await this.client.get(`/instance/connect/${instanceName}`);
    return (data as Record<string, any>).base64 ?? '';
  }

  /** "5561999999999@s.whatsapp.net" → "5561999999999" */
  static extractPhone(remoteJid: string): string {
    return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }

  /** Extrai texto de qualquer tipo de mensagem */
  static extractText(payload: EvolutionWebhookPayload): string {
    const msg = payload.data.message;
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
