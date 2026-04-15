import {
  stripNonDigits,
  normalizePhoneE164,
  normalizePhoneBR,
  extractPhoneFromJid,
  formatPhoneDisplay,
} from '../../utils/phone';

describe('phone utils', () => {
  describe('stripNonDigits', () => {
    it('removes parentheses, spaces and dashes', () => {
      expect(stripNonDigits('(11) 99999-1234')).toBe('11999991234');
    });

    it('returns digits unchanged', () => {
      expect(stripNonDigits('11999991234')).toBe('11999991234');
    });

    it('handles empty string', () => {
      expect(stripNonDigits('')).toBe('');
    });

    it('strips plus sign', () => {
      expect(stripNonDigits('+5521999992121')).toBe('5521999992121');
    });
  });

  describe('normalizePhoneE164', () => {
    it('adds country code 55 to 11-digit BR number', () => {
      expect(normalizePhoneE164('21999992121')).toBe('5521999992121');
    });

    it('keeps already-complete E164 number unchanged', () => {
      expect(normalizePhoneE164('5521999992121')).toBe('5521999992121');
    });

    it('inserts 9th digit when 12 digits (55 + DDD + 8)', () => {
      // 552199992121 (12 digits) → inserts 9 after DDD → 5521999992121
      expect(normalizePhoneE164('552199992121')).toBe('5521999992121');
    });

    it('adds 55 and inserts 9th digit for 10-digit number', () => {
      // 2199992121 (10 digits) → inserts 9 after DDD → 21999992121 → adds 55 → 5521999992121
      expect(normalizePhoneE164('2199992121')).toBe('5521999992121');
    });

    it('handles formatted input with special characters', () => {
      expect(normalizePhoneE164('(21) 99999-2121')).toBe('5521999992121');
    });
  });

  describe('normalizePhoneBR', () => {
    it('removes country code 55 from E164 number', () => {
      expect(normalizePhoneBR('5521999992121')).toBe('21999992121');
    });

    it('inserts 9th digit for 10-digit local number', () => {
      // 2199992121 (10 digits) → inserts 9 after DDD → 21999992121
      expect(normalizePhoneBR('2199992121')).toBe('21999992121');
    });

    it('keeps 11-digit local number unchanged', () => {
      expect(normalizePhoneBR('21999992121')).toBe('21999992121');
    });

    it('handles 12-digit E164 (55 + DDD + 8 digits) by removing 55 and inserting 9th digit', () => {
      // 552199992121 (12 digits) → removes 55 → 2199992121 (10 digits) → inserts 9 → 21999992121
      expect(normalizePhoneBR('552199992121')).toBe('21999992121');
    });
  });

  describe('extractPhoneFromJid', () => {
    it('extracts phone from individual JID', () => {
      expect(extractPhoneFromJid('5521999992121@s.whatsapp.net')).toBe('5521999992121');
    });

    it('extracts phone from group JID', () => {
      expect(extractPhoneFromJid('5521999992121@g.us')).toBe('5521999992121');
    });

    it('returns string as-is if no JID suffix', () => {
      expect(extractPhoneFromJid('5521999992121')).toBe('5521999992121');
    });
  });

  describe('formatPhoneDisplay', () => {
    it('formats 11-digit number as (XX) XXXXX-XXXX', () => {
      expect(formatPhoneDisplay('21999992121')).toBe('(21) 99999-2121');
    });

    it('formats E164 number by taking last 11 digits', () => {
      expect(formatPhoneDisplay('5521999992121')).toBe('(21) 99999-2121');
    });

    it('returns original string if not 11 digits', () => {
      expect(formatPhoneDisplay('123')).toBe('123');
    });
  });
});
