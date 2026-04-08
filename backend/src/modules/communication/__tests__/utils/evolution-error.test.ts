import { jest } from '@jest/globals';

// Mock the evolution-url module before importing the module under test
jest.mock('../../../communication/services/comunicacao/evolution-url', () => ({
  describeEvolutionBaseUrl: jest.fn(() => 'http://localhost:8080'),
}));

import {
  parseEvolutionInstanceMissingError,
  formatEvolutionApiError,
} from '../../utils/evolution-error';

describe('evolution-error utils', () => {
  describe('parseEvolutionInstanceMissingError', () => {
    it('returns friendly message for instance missing error with instance name', () => {
      const err = {
        response: {
          data: {
            response: {
              message: ['The instance "my-instance" instance does not exist'],
            },
          },
        },
      };
      const result = parseEvolutionInstanceMissingError(err);
      expect(result).toContain('my-instance');
      expect(result).toContain('não existe');
    });

    it('returns friendly message when error is in data.message', () => {
      const err = {
        response: {
          data: {
            message: 'The instance does not exist',
          },
        },
      };
      const result = parseEvolutionInstanceMissingError(err);
      expect(result).not.toBeNull();
      expect(result).toContain('não existe');
    });

    it('returns null for non-matching error', () => {
      const err = {
        message: 'Some other error',
      };
      expect(parseEvolutionInstanceMissingError(err)).toBeNull();
    });

    it('returns null for error without string message', () => {
      const err = {
        response: { data: { message: 123 } },
      };
      expect(parseEvolutionInstanceMissingError(err)).toBeNull();
    });

    it('returns null for null error', () => {
      expect(parseEvolutionInstanceMissingError(null)).toBeNull();
    });
  });

  describe('formatEvolutionApiError', () => {
    it('returns 502 for ECONNREFUSED', () => {
      const err = { code: 'ECONNREFUSED' };
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(502);
      expect(result.message).toContain('indisponível');
    });

    it('returns 502 for ECONNRESET', () => {
      const err = { code: 'ECONNRESET' };
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(502);
    });

    it('returns 502 for ETIMEDOUT', () => {
      const err = { code: 'ETIMEDOUT' };
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(502);
    });

    it('returns 404 with instance name for 404 response', () => {
      const err = {
        response: { status: 404, data: {} },
      };
      const result = formatEvolutionApiError(err, 'my-instance');
      expect(result.status).toBe(404);
      expect(result.message).toContain('my-instance');
    });

    it('returns 409 for instance missing error', () => {
      const err = {
        response: {
          data: {
            message: 'The instance "test" instance does not exist',
          },
        },
      };
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(409);
      expect(result.message).toContain('não existe');
    });

    it('returns 500 for generic error', () => {
      const err = { message: 'Something went wrong' };
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(500);
      expect(result.message).toBe('Something went wrong');
    });

    it('uses response data message if available', () => {
      const err = {
        response: { status: 500, data: { message: 'API error detail' } },
        message: 'generic',
      };
      // This won't match instance-missing, so falls to generic
      const result = formatEvolutionApiError(err);
      expect(result.status).toBe(500);
      expect(result.message).toBe('API error detail');
    });
  });
});
