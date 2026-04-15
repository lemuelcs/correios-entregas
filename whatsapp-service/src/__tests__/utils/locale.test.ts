import {
  resolveLocale,
  resolveTimezone,
  resolveDspNome,
  shortLang,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_DSP_NOME,
} from '../../utils/locale';

describe('locale utils', () => {
  describe('resolveLocale', () => {
    it('returns default locale for null config', () => {
      expect(resolveLocale(null)).toBe('pt_BR');
    });

    it('returns default locale for undefined config', () => {
      expect(resolveLocale(undefined)).toBe('pt_BR');
    });

    it('returns configured locale when present', () => {
      expect(resolveLocale({ locale: 'en_US' })).toBe('en_US');
    });

    it('returns default locale for empty string', () => {
      expect(resolveLocale({ locale: '' })).toBe('pt_BR');
    });

    it('returns default locale for null locale field', () => {
      expect(resolveLocale({ locale: null })).toBe('pt_BR');
    });
  });

  describe('resolveTimezone', () => {
    it('returns default timezone for null config', () => {
      expect(resolveTimezone(null)).toBe('America/Sao_Paulo');
    });

    it('returns configured timezone when present', () => {
      expect(resolveTimezone({ timezone: 'America/New_York' })).toBe('America/New_York');
    });
  });

  describe('resolveDspNome', () => {
    it('returns configured dspNome when present', () => {
      expect(resolveDspNome({ dspNome: 'MyDSP' })).toBe('MyDSP');
    });

    it('returns default dsp nome for null config', () => {
      expect(resolveDspNome(null)).toBe(DEFAULT_DSP_NOME);
    });

    it('returns default dsp nome for empty string', () => {
      expect(resolveDspNome({ dspNome: '' })).toBe(DEFAULT_DSP_NOME);
    });
  });

  describe('shortLang', () => {
    it('extracts language from underscore locale', () => {
      expect(shortLang('pt_BR')).toBe('pt');
    });

    it('extracts language from hyphen locale', () => {
      expect(shortLang('en-US')).toBe('en');
    });

    it('handles Spanish locale', () => {
      expect(shortLang('es_ES')).toBe('es');
    });

    it('returns full string if no separator', () => {
      expect(shortLang('pt')).toBe('pt');
    });
  });
});
