import ExcelJS from 'exceljs';
import { calculateS10CheckDigit } from '../../../shared/utils/s10';
import { detectarFormato, lerArquivo, lerCsv, lerTexto, lerXlsx, ParserErro } from '../planilha.parser';

function codigo(i: number): string {
  const serial = String(20_000_000 + i);
  return `OY${serial}${calculateS10CheckDigit(serial)}BR`;
}

function csvComLinhas(qtd: number, sep = ';'): string {
  const linhas = ['codigo;nome;whatsapp'.replace(/;/g, sep)];
  for (let i = 0; i < qtd; i += 1) linhas.push([codigo(i), `Pessoa ${i}`, '61 99812-4412'].join(sep));
  return linhas.join('\n');
}

function capturar(fn: () => unknown): ParserErro {
  try {
    fn();
  } catch (err) {
    if (err instanceof ParserErro) return err;
    throw err;
  }
  throw new Error('não lançou');
}

async function capturarAsync(fn: () => Promise<unknown>): Promise<ParserErro> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ParserErro) return err;
    throw err;
  }
  throw new Error('não lançou');
}

async function xlsx(abas: Array<{ nome: string; linhas: ExcelJS.CellValue[][] }>): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  for (const aba of abas) {
    const ws = livro.addWorksheet(aba.nome);
    aba.linhas.forEach((l) => ws.addRow(l));
  }
  return Buffer.from(await livro.xlsx.writeBuffer());
}

describe('planilha.parser', () => {
  it('UT-014 CSV com ";" e cabeçalhos equivalentes mapeia codigo, nome e whatsapp', () => {
    const csv = [
      'rastreio;destinatario;celular;rua;numero;bairro;cidade;uf;cep',
      'OY526018152BR;Maria Souza;(61) 99812-4412;QNA 12;45;Taguatinga;Brasília;DF;72110120',
    ].join('\n');

    const { linhas, avisos } = lerCsv(Buffer.from(csv));

    expect(avisos).toEqual([]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual(expect.objectContaining({
      n: 2,
      codigo: 'OY526018152BR',
      nome: 'Maria Souza',
      whatsapp: '(61) 99812-4412',
      logradouro: 'QNA 12',
      numero: '45',
      bairro: 'Taguatinga',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '72110120',
      enderecoTexto: null,
    }));
  });

  it('UT-015 XLSX com duas abas lê só a primeira e avisa varias_abas', async () => {
    const buffer = await xlsx([
      { nome: 'Lista', linhas: [['Código', 'Nome', 'WhatsApp'], ['OY526018152BR', 'Maria Souza', '61998124412']] },
      { nome: 'Outra', linhas: [['Código', 'Nome'], ['NL131860912BR', 'Não deve aparecer']] },
    ]);

    const { linhas, avisos } = await lerXlsx(buffer);

    expect(avisos).toEqual(['varias_abas', 'sem_coluna_endereco']);
    expect(linhas.map((l) => l.codigo)).toEqual(['OY526018152BR']);
    expect(linhas[0].whatsapp).toBe('61998124412');
  });

  it('UT-016 texto colado com tabs vira uma linha com enderecoTexto', () => {
    const { linhas } = lerTexto('OY526018152BR\tMaria Souza\t61 99812-4412\tQNA 12 Casa 45');

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual(expect.objectContaining({
      codigo: 'OY526018152BR',
      nome: 'Maria Souza',
      whatsapp: '61 99812-4412',
      enderecoTexto: 'QNA 12 Casa 45',
      faltamCampos: false,
    }));
  });

  it('UT-016 texto colado com ";" ou "," e com cabeçalho também é lido', () => {
    expect(lerTexto('OY526018152BR;Maria Souza;61 99812-4412').linhas[0].nome).toBe('Maria Souza');
    expect(lerTexto('OY526018152BR, Maria Souza, 61 99812-4412, QNA 12, Casa 45').linhas[0].enderecoTexto)
      .toBe('QNA 12, Casa 45');
    const comCabecalho = lerTexto('objeto\tnome\ttelefone\nOY526018152BR\tMaria Souza\t61 99812-4412');
    expect(comCabecalho.linhas).toHaveLength(1);
    expect(comCabecalho.linhas[0].whatsapp).toBe('61 99812-4412');
  });

  it('UT-017 CSV sem coluna de código lança coluna_ausente', () => {
    const err = capturar(() => lerCsv(Buffer.from('nome;whatsapp\nMaria;61998124412')));
    expect(err.codigo).toBe('coluna_ausente');
    expect(err.detalhes).toEqual({ coluna: 'codigo' });

    const semNome = capturar(() => lerCsv(Buffer.from('codigo;whatsapp\nOY526018152BR;61998124412')));
    expect(semNome.detalhes).toEqual({ coluna: 'nome' });
  });

  it('UT-018 CSV sem coluna de WhatsApp devolve whatsapp null e aviso', () => {
    const { linhas, avisos } = lerCsv(Buffer.from('codigo;nome;endereco\nOY526018152BR;Maria;QNA 12'));
    expect(avisos).toEqual(['sem_coluna_whatsapp']);
    expect(linhas[0].whatsapp).toBeNull();
  });

  it('UT-019 500 linhas passam; 501 lançam limite_linhas (CSV e texto)', () => {
    expect(lerCsv(Buffer.from(csvComLinhas(500))).linhas).toHaveLength(500);
    const errCsv = capturar(() => lerCsv(Buffer.from(csvComLinhas(501))));
    expect(errCsv.codigo).toBe('limite_linhas');
    expect(errCsv.detalhes).toEqual({ max: 500 });

    const texto = (n: number) => Array.from({ length: n }, (_, i) => `${codigo(i)}\tPessoa ${i}\t61998124412`).join('\n');
    expect(lerTexto(texto(500)).linhas).toHaveLength(500);
    const errTexto = capturar(() => lerTexto(texto(501)));
    expect(errTexto.codigo).toBe('limite_linhas');
    expect(errTexto.detalhes).toEqual({ max: 500 });
  });

  it('UT-020 linhas em branco no meio são ignoradas e não contam no limite', () => {
    const linhas = csvComLinhas(500).split('\n');
    const comBrancos = [linhas[0], '', ...linhas.slice(1, 250), '   ', ';;', '', ...linhas.slice(250)].join('\n');
    const { linhas: lidas } = lerCsv(Buffer.from(comBrancos));
    expect(lidas).toHaveLength(500);
    expect(lidas.every((l) => l.codigo !== '')).toBe(true);

    const texto = lerTexto(`${codigo(1)}\tAna\n\n   \n${codigo(2)}\tBia`);
    expect(texto.linhas.map((l) => l.nome)).toEqual(['Ana', 'Bia']);
  });

  it('UT-021 fórmula é lida como texto literal, sem avaliação (CSV e XLSX)', async () => {
    const csv = lerCsv(Buffer.from('codigo;nome\nOY526018152BR;"=HYPERLINK(""http://x"",""y"")"'));
    expect(csv.linhas[0].nome).toBe('=HYPERLINK("http://x","y")');

    const buffer = await xlsx([{
      nome: 'Lista',
      linhas: [['codigo', 'nome'], ['OY526018152BR', { formula: 'HYPERLINK("http://x","y")', result: 'y' }]],
    }]);
    const planilha = await lerXlsx(buffer);
    expect(planilha.linhas[0].nome).toBe('=HYPERLINK("http://x","y")');
  });

  it('UT-022 espaços extras são aparados e colapsados', () => {
    const { linhas } = lerCsv(Buffer.from('codigo;nome\n  OY526018152BR  ;Maria   Souza '));
    expect(linhas[0].codigo).toBe('OY526018152BR');
    expect(linhas[0].nome).toBe('Maria Souza');
  });

  it('UT-023 linha colada só com o código fica marcada com faltamCampos', () => {
    const { linhas } = lerTexto('OY526018152BR');
    expect(linhas[0]).toEqual(expect.objectContaining({ codigo: 'OY526018152BR', nome: '', faltamCampos: true }));
  });

  it('UT-024 arquivo só com o cabeçalho (ou vazio) lança nenhuma_encomenda', async () => {
    expect(capturar(() => lerCsv(Buffer.from('codigo;nome;whatsapp\n'))).codigo).toBe('nenhuma_encomenda');
    expect(capturar(() => lerCsv(Buffer.from(''))).codigo).toBe('nenhuma_encomenda');
    expect(capturar(() => lerTexto('   \n  ')).codigo).toBe('nenhuma_encomenda');
    const buffer = await xlsx([{ nome: 'Lista', linhas: [['codigo', 'nome']] }]);
    expect((await capturarAsync(() => lerXlsx(buffer))).codigo).toBe('nenhuma_encomenda');
  });

  it('UT-025 coluna única "endereco" vai para enderecoTexto; colunas separadas vão para os campos', () => {
    const livre = lerCsv(Buffer.from('codigo;nome;endereço\nOY526018152BR;Maria;QNA 12 Casa 45, Taguatinga'));
    expect(livre.linhas[0].enderecoTexto).toBe('QNA 12 Casa 45, Taguatinga');
    expect(livre.linhas[0].logradouro).toBeNull();
    expect(livre.avisos).toEqual(['sem_coluna_whatsapp']);

    const separado = lerCsv(Buffer.from('codigo;nome;logradouro;número;complemento;bairro;cidade;uf;cep\nOY526018152BR;Maria;QNA 12;45;Casa;Taguatinga;Brasília;DF;72110120'));
    expect(separado.linhas[0]).toEqual(expect.objectContaining({
      logradouro: 'QNA 12', numero: '45', complemento: 'Casa', bairro: 'Taguatinga', cidade: 'Brasília', uf: 'DF', cep: '72110120', enderecoTexto: null,
    }));

    const semEndereco = lerCsv(Buffer.from('codigo;nome;whatsapp\nOY526018152BR;Maria;61998124412'));
    expect(semEndereco.avisos).toEqual(['sem_coluna_endereco']);
  });

  it('detecta o formato pelo nome e pelo conteúdo; PDF → formato_nao_suportado', async () => {
    const pdf = Buffer.from('%PDF-1.4 ...');
    expect(capturar(() => detectarFormato('lista.pdf', 'application/pdf', pdf)).codigo).toBe('formato_nao_suportado');
    expect(capturar(() => detectarFormato('lista.xlsx', 'application/octet-stream', pdf)).codigo).toBe('formato_nao_suportado');
    expect(detectarFormato('lista.csv', 'text/csv', Buffer.from('a;b'))).toBe('csv');
    const buffer = await xlsx([{ nome: 'L', linhas: [['codigo', 'nome'], ['OY526018152BR', 'Maria']] }]);
    expect(detectarFormato('lista.xlsx', 'application/octet-stream', buffer)).toBe('xlsx');
    const lido = await lerArquivo({ buffer, originalname: 'lista.xlsx', mimetype: 'application/octet-stream' });
    expect(lido.linhas[0].nome).toBe('Maria');
  });

  it('CSV em Windows-1252 (Excel) é decodificado', () => {
    const latin1 = Buffer.from('código;nome\nOY526018152BR;João Conceição', 'latin1');
    const { linhas } = lerCsv(latin1);
    expect(linhas[0].nome).toBe('João Conceição');
  });
});
