import { parseSigepDataMatrix, montarSigepDataMatrix } from '../../../shared/utils/sigep-datamatrix';
import { avaliarMinimo, camposParaPedir, montarCampos } from '../campos';
import type { Campo, CamposLidos, CepInfo } from '../captura.types';

const DM_COMPLETO = parseSigepDataMatrix(
  montarSigepDataMatrix({ cepDestino: '72115040', codigo: 'OY716488072BR', numero: '17', complemento: 'CASA', telefone: '61993401287' }),
);
const CEP_QNC: CepInfo = { cep: '72115040', logradouro: 'QNC 4', bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF' };

function llm(campos: Partial<Record<keyof CamposLidos, string | null | { valor: string | null; duvida: boolean; motivo?: string }>>): Partial<CamposLidos> {
  const r: Partial<CamposLidos> = {};
  for (const [k, v] of Object.entries(campos)) {
    const c = v !== null && typeof v === 'object' ? v : { valor: v ?? null, duvida: false };
    r[k as keyof CamposLidos] = { ...c, fonte: 'LLM' } as Campo;
  }
  return r;
}

const ok = (valor: string | null): Campo => ({ valor, duvida: false, fonte: 'CARTEIRO' });

function completos(over: Partial<CamposLidos> = {}): CamposLidos {
  return {
    codigo: ok('OY716488072BR'),
    nome: ok('ALINE RODRIGUES'),
    whatsapp: ok('61993401287'),
    cep: ok('72115040'),
    logradouro: ok('QNC 4'),
    numero: ok('17'),
    complemento: ok('CASA'),
    bairro: ok('Taguatinga Norte'),
    cidade: ok('Brasília'),
    uf: ok('DF'),
    ...over,
  };
}

describe('montarCampos', () => {
  it('UT-018 DataMatrix + CEP + LLM só com o nome: fontes por campo e nenhuma dúvida', () => {
    const c = montarCampos({
      codigo: 'OY716488072BR', codigoDigitado: false, cepLinear: '72115040',
      dataMatrix: DM_COMPLETO, cep: CEP_QNC, llm: llm({ nome: 'ALINE RODRIGUES' }),
    });
    expect(c.numero).toEqual({ valor: '17', duvida: false, fonte: 'DATAMATRIX' });
    expect(c.complemento).toEqual({ valor: 'CASA', duvida: false, fonte: 'DATAMATRIX' });
    expect(c.whatsapp).toEqual({ valor: '61993401287', duvida: false, fonte: 'DATAMATRIX' });
    expect(c.logradouro).toEqual({ valor: 'QNC 4', duvida: false, fonte: 'CEP' });
    expect(c.nome).toEqual({ valor: 'ALINE RODRIGUES', duvida: false, fonte: 'LLM' });
    expect(Object.values(c).some((x) => x.duvida)).toBe(false);
    expect(avaliarMinimo(c)).toEqual({ ok: true });
  });

  it('UT-019 Code 128 diferente do código do DataMatrix → codigo em dúvida (codigos_divergentes)', () => {
    const dm = parseSigepDataMatrix(montarSigepDataMatrix({ cepDestino: '72115040', codigo: 'AA123456785BR', numero: '17' }));
    const c = montarCampos({ codigo: 'OY716488072BR', codigoDigitado: false, cepLinear: '72115040', dataMatrix: dm, cep: CEP_QNC, llm: llm({ nome: 'X' }) });
    expect(c.codigo.duvida).toBe(true);
    expect(c.codigo.motivo).toBe('codigos_divergentes');
    expect(c.codigo.valor).toBe('OY716488072BR');
  });

  it('UT-020 sem CEP linear nem DataMatrix: CEP em texto do LLM vira 8 dígitos, com dúvida', () => {
    const c = montarCampos({ codigo: 'AA123456785BR', codigoDigitado: false, cepLinear: null, dataMatrix: null, cep: null, llm: llm({ cep: '72115-040' }) });
    expect(c.cep).toMatchObject({ valor: '72115040', fonte: 'LLM', duvida: true });
  });

  it('UT-021 CEP com logradouro: rua, bairro, cidade e UF do CEP; número do LLM', () => {
    const c = montarCampos({
      codigo: 'AA123456785BR', codigoDigitado: false, cepLinear: '72115040', dataMatrix: null, cep: CEP_QNC,
      llm: llm({ nome: 'JOSE', numero: '5', logradouro: 'QNC 4' }),
    });
    expect(c.logradouro).toMatchObject({ valor: 'QNC 4', fonte: 'CEP' });
    expect(c.bairro).toMatchObject({ valor: 'Taguatinga Norte', fonte: 'CEP' });
    expect(c.cidade).toMatchObject({ valor: 'Brasília', fonte: 'CEP' });
    expect(c.uf).toMatchObject({ valor: 'DF', fonte: 'CEP' });
    expect(c.numero).toEqual({ valor: '5', duvida: false, fonte: 'LLM' });
  });

  it('UT-022 CEP sem logradouro → logradouro e bairro do LLM com dúvida (cep_sem_logradouro)', () => {
    const c = montarCampos({
      codigo: 'OY716488293BR', codigoDigitado: false, cepLinear: '73800000', dataMatrix: null,
      cep: { cep: '73800000', logradouro: null, bairro: null, cidade: 'Formosa', uf: 'GO' },
      llm: llm({ logradouro: 'Rua Sete', bairro: 'Centro' }),
    });
    expect(c.logradouro).toEqual({ valor: 'Rua Sete', duvida: true, motivo: 'cep_sem_logradouro', fonte: 'LLM' });
    expect(c.bairro).toEqual({ valor: 'Centro', duvida: true, motivo: 'cep_sem_logradouro', fonte: 'LLM' });
    expect(c.cidade).toMatchObject({ valor: 'Formosa', fonte: 'CEP', duvida: false });
  });

  it('UT-023 CEP INDISPONIVEL → logradouro, bairro, cidade e UF do LLM, todos com dúvida', () => {
    const c = montarCampos({
      codigo: 'AA123456785BR', codigoDigitado: false, cepLinear: '71919360', dataMatrix: null, cep: 'INDISPONIVEL',
      llm: llm({ logradouro: 'Rua 25 Norte', bairro: 'Aguas Claras', cidade: 'Brasilia', uf: 'DF' }),
    });
    for (const n of ['logradouro', 'bairro', 'cidade', 'uf'] as const) {
      expect(c[n]).toMatchObject({ fonte: 'LLM', duvida: true });
      expect(c[n].valor).not.toBeNull();
    }
  });

  it('UT-024 logradouro do CEP "Quadra QNC 4" e do rótulo "QNC 4" → vale o do CEP, o do rótulo em motivo', () => {
    const c = montarCampos({
      codigo: 'AA123456785BR', codigoDigitado: false, cepLinear: '72115040', dataMatrix: null,
      cep: { ...CEP_QNC, logradouro: 'Quadra QNC 4' }, llm: llm({ logradouro: 'QNC 4' }),
    });
    expect(c.logradouro.valor).toBe('Quadra QNC 4');
    expect(c.logradouro.fonte).toBe('CEP');
    expect(c.logradouro.duvida).toBe(false);
    expect(c.logradouro.motivo).toContain('QNC 4');
  });

  it('UT-025 complemento de 120 caracteres vindo do LLM é mantido integralmente', () => {
    const longo = 'BLOCO C APARTAMENTO 1203 '.repeat(5).slice(0, 120).trim().padEnd(120, 'X');
    const c = montarCampos({ codigo: 'AA123456785BR', codigoDigitado: false, cepLinear: '72115040', dataMatrix: null, cep: CEP_QNC, llm: llm({ complemento: longo }) });
    expect(c.complemento.valor).toBe(longo);
    expect(c.complemento.valor).toHaveLength(120);
  });

  it('extração indisponível → campos do LLM vazios com o motivo extracao_indisponivel', () => {
    const c = montarCampos({ codigo: 'OY716488072BR', codigoDigitado: false, cepLinear: '72115040', dataMatrix: DM_COMPLETO, cep: CEP_QNC, llm: null });
    expect(c.nome).toEqual({ valor: null, duvida: false, motivo: 'extracao_indisponivel', fonte: 'LLM' });
  });

  it('pede ao LLM só o que o DataMatrix e o CEP não cobriram', () => {
    expect(camposParaPedir({ dataMatrix: DM_COMPLETO, cepLinear: '72115040', cep: CEP_QNC })).toEqual(['nome']);
    expect(camposParaPedir({ dataMatrix: null, cepLinear: null, cep: null })).toEqual(
      ['nome', 'whatsapp', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'],
    );
  });
});

describe('avaliarMinimo', () => {
  it('UT-026 todos os campos mínimos presentes e sem dúvida → ok', () => {
    expect(avaliarMinimo(completos())).toEqual({ ok: true });
  });

  it('UT-027 nome nulo → nome_ausente', () => {
    expect(avaliarMinimo(completos({ nome: ok(null) }))).toEqual({ ok: false, motivos: ['nome_ausente'] });
  });

  it('UT-028 logradouro nulo → endereco_incompleto', () => {
    expect(avaliarMinimo(completos({ logradouro: ok(null) }))).toEqual({ ok: false, motivos: ['endereco_incompleto'] });
  });

  it('UT-029 número "S/N" é aceito; vazio → endereco_incompleto', () => {
    expect(avaliarMinimo(completos({ numero: ok('S/N') }))).toEqual({ ok: true });
    expect(avaliarMinimo(completos({ numero: ok('') }))).toEqual({ ok: false, motivos: ['endereco_incompleto'] });
  });

  it('UT-030 número com dúvida → duvida:numero', () => {
    expect(avaliarMinimo(completos({ numero: { valor: '17', duvida: true, fonte: 'LLM' } }))).toEqual({ ok: false, motivos: ['duvida:numero'] });
  });

  it('UT-031 WhatsApp com dúvida → não ok (nunca vira "sem WhatsApp" em silêncio)', () => {
    const r = avaliarMinimo(completos({ whatsapp: { valor: '6199340128?', duvida: true, fonte: 'LLM' } }));
    expect(r).toEqual({ ok: false, motivos: ['duvida:whatsapp'] });
  });

  it('UT-032 WhatsApp nulo sem dúvida → ok', () => {
    expect(avaliarMinimo(completos({ whatsapp: ok(null) }))).toEqual({ ok: true });
  });

  it('UT-033 CEP com 7 dígitos → cep_invalido', () => {
    expect(avaliarMinimo(completos({ cep: ok('7211504') }))).toEqual({ ok: false, motivos: ['cep_invalido'] });
  });

  it('UT-126 código com formato inválido → codigo_invalido', () => {
    expect(avaliarMinimo(completos({ codigo: ok('A1234567895BR') }))).toEqual({ ok: false, motivos: ['codigo_invalido'] });
  });
});
