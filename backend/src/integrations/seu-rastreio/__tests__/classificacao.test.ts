import { classificarEvento, PADROES_RASTREIO, VERSAO_PADROES_RASTREIO } from '../classificacao';

describe('classificarEvento', () => {
  it('UT-078: "Objeto entregue ao destinatário" → ENTREGUE', () => {
    expect(classificarEvento('Objeto entregue ao destinatário')).toBe('ENTREGUE');
    expect(classificarEvento('OBJETO ENTREGUE AO DESTINATARIO')).toBe('ENTREGUE');
  });

  it('UT-079: "Carteiro não atendido - Entrega não realizada" → INSUCESSO', () => {
    expect(classificarEvento('Carteiro não atendido - Entrega não realizada')).toBe('INSUCESSO');
    for (const d of [
      'Destinatário ausente',
      'Entrega não efetuada',
      'Endereço insuficiente para entrega',
      'Objeto recusado pelo destinatário',
      'Objeto não entregue ao destinatário',
    ]) {
      expect(classificarEvento(d)).toBe('INSUCESSO');
    }
  });

  it('UT-080: evento sem padrão (em trânsito) → null', () => {
    expect(classificarEvento('Objeto em trânsito - por favor aguarde')).toBeNull();
    expect(classificarEvento('Objeto saiu para entrega ao destinatário')).toBeNull();
    expect(classificarEvento('')).toBeNull();
    expect(classificarEvento(null)).toBeNull();
  });

  it('a lista de padrões é versionada no código', () => {
    expect(VERSAO_PADROES_RASTREIO).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(PADROES_RASTREIO.ENTREGUE.length).toBeGreaterThan(0);
    expect(Object.isFrozen(PADROES_RASTREIO.INSUCESSO)).toBe(true);
  });
});
