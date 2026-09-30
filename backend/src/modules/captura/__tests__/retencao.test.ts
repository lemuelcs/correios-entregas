import { configRetencao, fotoExpirada, motivoExpiracao } from '../retencao';

const config = { diasAposFim: 30, maxDias: 90 };
const PACOTE_0109 = new Date('2026-09-01T00:00:00.000Z');

describe('Retenção das fotos', () => {
  it('UT-052 PacoteDia.data 2026-09-01, agora 2026-10-02T03:00-03:00, 30 dias → expirada', () => {
    const agora = new Date('2026-10-02T03:00:00-03:00');
    expect(fotoExpirada({ pacoteData: PACOTE_0109, capturadoEm: new Date('2026-09-01T09:00:00-03:00'), agora, config })).toBe(true);
    expect(motivoExpiracao({ pacoteData: PACOTE_0109, capturadoEm: new Date('2026-09-01T09:00:00-03:00'), agora, config })).toBe('fim_do_fluxo');
  });

  it('UT-053 PacoteDia.data 2026-09-01, agora 2026-09-30T23:59-03:00 → não expirada', () => {
    const agora = new Date('2026-09-30T23:59:00-03:00');
    expect(fotoExpirada({ pacoteData: PACOTE_0109, capturadoEm: new Date('2026-09-01T09:00:00-03:00'), agora, config })).toBe(false);
  });

  it('UT-054 captura sem pacote de 91 dias atrás, máximo 90 → expirada', () => {
    const agora = new Date('2026-09-30T03:00:00-03:00');
    const capturadoEm = new Date(agora.getTime() - 91 * 24 * 3600 * 1000);
    expect(motivoExpiracao({ pacoteData: null, capturadoEm, agora, config })).toBe('prazo_maximo');
    const de89 = new Date(agora.getTime() - 89 * 24 * 3600 * 1000);
    expect(fotoExpirada({ pacoteData: null, capturadoEm: de89, agora, config })).toBe(false);
  });

  it('UT-055 variáveis de ambiente ausentes → padrões 30 e 90', () => {
    expect(configRetencao({})).toEqual({ diasAposFim: 30, maxDias: 90 });
    expect(configRetencao({ FOTO_RETENCAO_DIAS_APOS_FIM: '10', FOTO_RETENCAO_MAX_DIAS: '45' })).toEqual({ diasAposFim: 10, maxDias: 45 });
    expect(configRetencao({ FOTO_RETENCAO_DIAS_APOS_FIM: 'abc' })).toEqual({ diasAposFim: 30, maxDias: 90 });
  });
});
