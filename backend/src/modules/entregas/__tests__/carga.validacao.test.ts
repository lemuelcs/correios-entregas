import { classificarLinhas, type ConsultasValidacao, type LinhaEntrada, type OrientacaoGuardadaResumo } from '../carga.validacao';
import { lerTexto } from '../planilha.parser';

function consultas(over: Partial<{
  noDia: Record<string, string | null>;
  descadastrados: string[];
  guardadas: Record<string, OrientacaoGuardadaResumo>;
}> = {}): ConsultasValidacao & { chamadas: string[][] } {
  const chamadas: string[][] = [];
  return {
    chamadas,
    async codigosNoDia(codigos) {
      chamadas.push(codigos);
      return new Map(Object.entries(over.noDia ?? {}).filter(([c]) => codigos.includes(c)));
    },
    async descadastrados(numeros) {
      return new Set((over.descadastrados ?? []).filter((n) => numeros.includes(n)));
    },
    async orientacoesGuardadas(codigos) {
      return new Map(Object.entries(over.guardadas ?? {}).filter(([c]) => codigos.includes(c)));
    },
  };
}

const linha = (n: number, codigo: string, whatsapp: string | null = '(61) 99812-4412', nome = 'Maria Souza'): LinhaEntrada => ({
  n, codigo, nome, whatsapp,
});

describe('carga.validacao — classificação das linhas', () => {
  it('UT-026 código repetido na planilha: a segunda ocorrência é duplicado_planilha', async () => {
    const { linhas, resumo } = await classificarLinhas(
      [linha(1, 'NL131860912BR'), linha(2, 'nl131860912br', '61 99812-0000')],
      consultas(),
    );
    expect(linhas[0].situacao).toBe('valida');
    expect(linhas[1]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'duplicado_planilha', codigo: 'NL131860912BR' }));
    expect(resumo).toEqual(expect.objectContaining({ validas: 1, invalidas: 1 }));
  });

  it('UT-027 código já presente no D-01 hoje → ja_no_distrito com detalhe', async () => {
    const c = consultas({ noDia: { NL131860912BR: 'D-01' } });
    const { linhas } = await classificarLinhas([linha(1, 'NL131860912BR')], c);
    expect(linhas[0]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'ja_no_distrito', detalhe: 'D-01' }));
    expect(c.chamadas).toEqual([['NL131860912BR']]);
  });

  it('UT-028 WhatsApp vazio → sem_whatsapp, aceita', async () => {
    const { linhas, resumo } = await classificarLinhas([linha(1, 'NL131860912BR', ''), linha(2, 'OY526018152BR', null)], consultas());
    expect(linhas.map((l) => l.situacao)).toEqual(['sem_whatsapp', 'sem_whatsapp']);
    expect(linhas[0].whatsapp).toBeNull();
    expect(resumo).toEqual(expect.objectContaining({ semWhatsapp: 2, aceitaveis: 2, comWhatsapp: 0 }));
  });

  it('UT-029 WhatsApp sem DDD → corrigir/sem_ddd; outro formato → corrigir/whatsapp_invalido', async () => {
    const { linhas, resumo } = await classificarLinhas(
      [linha(1, 'NL131860912BR', '98876-1102'), linha(2, 'OY526018152BR', '61 9abc-4412')],
      consultas(),
    );
    expect(linhas[0]).toEqual(expect.objectContaining({ situacao: 'corrigir', motivo: 'sem_ddd', whatsapp: '98876-1102' }));
    expect(linhas[1]).toEqual(expect.objectContaining({ situacao: 'corrigir', motivo: 'whatsapp_invalido' }));
    expect(resumo).toEqual(expect.objectContaining({ corrigir: 2, aceitaveis: 2 }));
  });

  it('UT-030 WhatsApp descadastrado → aceita com descadastrado: true', async () => {
    const { linhas, resumo } = await classificarLinhas(
      [linha(1, 'NL131860912BR', '(61) 99812-4412')],
      consultas({ descadastrados: ['+5561998124412'] }),
    );
    expect(linhas[0]).toEqual(expect.objectContaining({ situacao: 'valida', whatsapp: '+5561998124412', descadastrado: true }));
    expect(resumo.descadastrados).toBe(1);
  });

  it('UT-031 código com Orientacao GUARDADA → orientacaoGuardada { tipo, texto }', async () => {
    const guardada = { tipo: 'VIZINHO' as const, texto: 'Deixar com vizinho: Maria, apto 302' };
    const { linhas } = await classificarLinhas([linha(1, 'QB908301669BR')], consultas({ guardadas: { QB908301669BR: guardada } }));
    expect(linhas[0].situacao).toBe('valida');
    expect(linhas[0].orientacaoGuardada).toEqual(guardada);
  });

  it('UT-032 o mesmo WhatsApp em 3 códigos distintos → 3 linhas válidas', async () => {
    const { linhas } = await classificarLinhas(
      [linha(1, 'NL131860912BR'), linha(2, 'OY526018152BR'), linha(3, 'QB908301669BR')],
      consultas(),
    );
    expect(linhas.map((l) => l.situacao)).toEqual(['valida', 'valida', 'valida']);
    expect(new Set(linhas.map((l) => l.whatsapp))).toEqual(new Set(['+5561998124412']));
  });

  it('UT-023 linha colada só com o código → invalida/faltam_campos', async () => {
    const { linhas } = await classificarLinhas(lerTexto('OY526018152BR').linhas, consultas());
    expect(linhas[0]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'faltam_campos' }));
  });

  it('código com dígito verificador errado → digito_invalido; formato errado → codigo_invalido; minúsculas normalizadas', async () => {
    const { linhas } = await classificarLinhas(
      [linha(1, 'AB123456789BR'), linha(2, 'XYZ'), linha(3, 'oy 526018152 br'), linha(4, 'NL131860912BR', '', '   ')],
      consultas(),
    );
    expect(linhas[0]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'digito_invalido' }));
    expect(linhas[1]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'codigo_invalido' }));
    expect(linhas[2]).toEqual(expect.objectContaining({ situacao: 'valida', codigo: 'OY526018152BR' }));
    expect(linhas[3]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'faltam_campos' }));
  });

  it('normaliza UF e CEP e sinaliza semEndereco', async () => {
    const { linhas } = await classificarLinhas([
      { ...linha(1, 'NL131860912BR'), uf: 'df', cep: '1310100', logradouro: 'Av. Paulista' },
      { ...linha(2, 'OY526018152BR'), uf: 'Distrito Federal', cep: '123' },
    ], consultas());
    expect(linhas[0]).toEqual(expect.objectContaining({ uf: 'DF', cep: '01310100', semEndereco: false }));
    expect(linhas[1]).toEqual(expect.objectContaining({ uf: null, cep: null, semEndereco: true }));
  });
});
