/**
 * delivery-status.ts
 * Mapeamento de status de entrega do WhatsApp (Evolution API / Baileys).
 *
 * Referência Baileys WAMessageStatus:
 *   0 = ERROR
 *   1 = PENDING
 *   2 = SERVER_ACK (enviado ao servidor WhatsApp)
 *   3 = DELIVERY_ACK (entregue ao dispositivo)
 *   4 = READ (lido pelo destinatário)
 *   5 = PLAYED (áudio/vídeo reproduzido)
 */

export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

/**
 * Mapeia o status bruto do webhook (numérico ou string) para DeliveryStatus.
 * Retorna null se o status não é reconhecido.
 */
export function mapRawDeliveryStatus(rawStatus: number | string | undefined | null): DeliveryStatus | null {
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') return null;

  if (typeof rawStatus === 'number') {
    switch (rawStatus) {
      case 0: return 'FAILED';
      case 2: return 'SENT';
      case 3: return 'DELIVERED';
      case 4:
      case 5: return 'READ';
      default: return null;
    }
  }

  switch (String(rawStatus).toUpperCase()) {
    case 'SERVER_ACK': return 'SENT';
    case 'DELIVERY_ACK': return 'DELIVERED';
    case 'READ':
    case 'PLAYED': return 'READ';
    case 'ERROR': return 'FAILED';
    default: return null;
  }
}
