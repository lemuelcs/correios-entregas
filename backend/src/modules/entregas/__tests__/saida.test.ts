/**
 * Saídas do dia (ADR-019), sem banco: colunas `rota` e `carteiro` do arquivo,
 * limites do arquivo da saída e as normalizações da importação.
 * UT-100..UT-104.
 */
import ExcelJS from 'exceljs';
import { calculateS10CheckDigit } from '../../../shared/utils/s10';
import { lerArquivo, lerArquivoSaida, lerCsv, MAX_LINHAS_SAIDA, ParserErro } from '../planilha.parser';
import { casarCarteiro, codigoParaDescarte, normalizarRota } from '../saida.service';
import { montarResumoCarteiro } from '../textos';

function codigo(i: number): string {
  const serial = String(30_000_000 + i);
  return `OY${serial}${calculateS10CheckDigit(serial)}BR`;
}

const arquivoCsv = (texto: string) => ({ buffer: Buffer.from(texto, 'utf8'), originalname: 'saida-1.csv', mimetype: 'text/csv' });

async function erroDe(fn: () => Promise<unknown>): Promise<ParserErro> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ParserErro) return err;
    throw err;
  }
  throw new Error('não lançou');
}

describe('arquivo da saída — colunas rota e carteiro', () => {
  it('UT-100 lê `rota` e `carteiro` pelos cabeçalhos equivalentes, em CSV e XLSX', async () => {
    const csv = await lerArquivoSaida(arquivoCsv([
      'Rota;Carteiro;Código;Nome;WhatsApp',
      `501;Marcos Paulo Lima;${codigo(1)};Maria;61 99812-4412`,
      `502;;${codigo(2)};João;`,
      `;;${codigo(3)};Ana;`,
    ].join('\n')));
    expect(csv.linhas.map((l) => [l.n, l.rota, l.carteiro])).toEqual([
      [2, '501', 'Marcos Paulo Lima'],
      [3, '502', null],
      [4, null, null],
    ]);

    // Sinônimos: "Distrito" e "Matrícula" (o número da rota vem como número no Excel).
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet('Saída');
    aba.addRow(['Distrito', 'Matrícula', 'Objeto', 'Destinatário', 'Celular']);
    aba.addRow([503, 83015520, codigo(4), 'Carla', '61998124413']);
    const xlsx = await lerArquivoSaida({
      buffer: Buffer.from(await livro.xlsx.writeBuffer()),
      originalname: 'saida.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(xlsx.linhas[0]).toEqual(expect.objectContaining({ rota: '503', carteiro: '83015520', codigo: codigo(4), nome: 'Carla' }));

    for (const cabecalho of ['código da rota', 'Nº da rota', 'cod rota']) {
      const r = lerCsv(`${cabecalho};codigo;nome\n77;${codigo(5)};Zé`, { exigirRota: true });
      expect(r.linhas[0].rota).toBe('77');
    }
    for (const cabecalho of ['nome do carteiro', 'Matrícula do carteiro', 'entregador']) {
      const r = lerCsv(`rota;${cabecalho};codigo;nome\n77;Fulano;${codigo(6)};Zé`);
      expect(r.linhas[0].carteiro).toBe('Fulano');
    }
  });

  it('UT-101 sem a coluna `rota` o arquivo da saída é recusado; a lista por rota continua sem ela', async () => {
    const semRota = `codigo;nome;whatsapp\n${codigo(1)};Maria;61 99812-4412`;
    const erro = await erroDe(() => lerArquivoSaida(arquivoCsv(semRota)));
    expect(erro.codigo).toBe('coluna_ausente');
    expect(erro.detalhes).toEqual({ coluna: 'rota' });

    const porRota = await lerArquivo(arquivoCsv(semRota));
    expect(porRota.linhas).toHaveLength(1);
    expect(porRota.linhas[0]).not.toHaveProperty('rota');
    expect(porRota.linhas[0]).not.toHaveProperty('carteiro');
  });

  it('UT-102 limite do arquivo da saída: 5.000 linhas passam, 5.001 → `limite_linhas`; a lista por rota segue em 500', async () => {
    const linhas = (qtd: number) => ['rota;codigo;nome', ...Array.from({ length: qtd }, (_, i) => `${500 + (i % 20)};${codigo(i)};Pessoa ${i}`)].join('\n');
    expect(MAX_LINHAS_SAIDA).toBe(5000);
    expect((await lerArquivoSaida(arquivoCsv(linhas(5000)))).linhas).toHaveLength(5000);

    const erro = await erroDe(() => lerArquivoSaida(arquivoCsv(linhas(5001))));
    expect(erro.codigo).toBe('limite_linhas');
    expect(erro.detalhes).toEqual({ max: 5000 });

    const porRota = await erroDe(() => lerArquivo(arquivoCsv(linhas(501))));
    expect(porRota.detalhes).toEqual({ max: 500 });
  });
});

describe('importação da saída — normalizações', () => {
  it('UT-103 código da rota em maiúsculas e código de rastreio do descarte sem dado pessoal', () => {
    expect(normalizarRota('  d-01 ')).toBe('D-01');
    expect(normalizarRota(null)).toBe('');

    expect(codigoParaDescarte('oy 123456785 br')).toBe('OY123456785BR');
    expect(codigoParaDescarte('XX12')).toBe('XX12');
    // Coluna trocada: nome e telefone não entram no resumo de descartes.
    expect(codigoParaDescarte('Maria Souza')).toBe('');
    expect(codigoParaDescarte('61998124412')).toBe('');
    expect(codigoParaDescarte('')).toBe('');
  });

  it('UT-104 carteiro do arquivo: matrícula (com ou sem máscara) ou nome completo; nome repetido não casa', () => {
    const carteiros = [
      { id: 'a', nome: 'Patrícia Nunes', matricula: '83015520' },
      { id: 'b', nome: 'José da Silva', matricula: '83015521' },
      { id: 'c', nome: 'Jose da Silva', matricula: '83015522' },
    ];
    expect(casarCarteiro('8.301.552-0', carteiros)?.id).toBe('a');
    expect(casarCarteiro('83015521', carteiros)?.id).toBe('b');
    expect(casarCarteiro('  patricia   NUNES ', carteiros)?.id).toBe('a');
    expect(casarCarteiro('José da Silva', carteiros)).toBeNull();
    expect(casarCarteiro('Fulano de Tal', carteiros)).toBeNull();
    expect(casarCarteiro('Patrícia', carteiros)).toBeNull();
  });

  it('UT-105 o resumo ao carteiro que assumiu depois da liberação fala em "rota"', () => {
    const [mensagem] = montarResumoCarteiro([{ codigo: codigo(1), nomeDestinatario: 'Maria', texto: 'Deixar com o vizinho' }], { troca: true });
    expect(mensagem).toContain('Você assumiu a rota hoje.');
    expect(mensagem.toLowerCase()).not.toContain('distrito');
  });
});
