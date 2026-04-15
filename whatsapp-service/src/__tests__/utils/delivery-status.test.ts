import { mapRawDeliveryStatus } from '../../utils/delivery-status';

describe('delivery-status utils', () => {
  describe('mapRawDeliveryStatus', () => {
    describe('numeric status codes', () => {
      it('maps 0 to FAILED', () => {
        expect(mapRawDeliveryStatus(0)).toBe('FAILED');
      });

      it('maps 2 to SENT', () => {
        expect(mapRawDeliveryStatus(2)).toBe('SENT');
      });

      it('maps 3 to DELIVERED', () => {
        expect(mapRawDeliveryStatus(3)).toBe('DELIVERED');
      });

      it('maps 4 to READ', () => {
        expect(mapRawDeliveryStatus(4)).toBe('READ');
      });

      it('maps 5 (PLAYED) to READ', () => {
        expect(mapRawDeliveryStatus(5)).toBe('READ');
      });

      it('maps 1 (PENDING) to null', () => {
        expect(mapRawDeliveryStatus(1)).toBeNull();
      });
    });

    describe('string status codes', () => {
      it('maps SERVER_ACK to SENT', () => {
        expect(mapRawDeliveryStatus('SERVER_ACK')).toBe('SENT');
      });

      it('maps DELIVERY_ACK to DELIVERED', () => {
        expect(mapRawDeliveryStatus('DELIVERY_ACK')).toBe('DELIVERED');
      });

      it('maps READ to READ', () => {
        expect(mapRawDeliveryStatus('READ')).toBe('READ');
      });

      it('maps PLAYED to READ', () => {
        expect(mapRawDeliveryStatus('PLAYED')).toBe('READ');
      });

      it('maps ERROR to FAILED', () => {
        expect(mapRawDeliveryStatus('ERROR')).toBe('FAILED');
      });
    });

    describe('edge cases', () => {
      it('returns null for undefined', () => {
        expect(mapRawDeliveryStatus(undefined)).toBeNull();
      });

      it('returns null for null', () => {
        expect(mapRawDeliveryStatus(null)).toBeNull();
      });

      it('returns null for empty string', () => {
        expect(mapRawDeliveryStatus('')).toBeNull();
      });

      it('returns null for unrecognized string', () => {
        expect(mapRawDeliveryStatus('UNKNOWN')).toBeNull();
      });

      it('returns null for unrecognized number', () => {
        expect(mapRawDeliveryStatus(99)).toBeNull();
      });
    });
  });
});
