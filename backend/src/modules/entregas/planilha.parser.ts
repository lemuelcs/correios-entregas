/**
 * Leitura da lista do dia (ADR-017): CSV, XLSX (só a primeira aba) ou texto colado.
 *
 * - Toda célula vira texto; fórmulas nunca são avaliadas (a célula vale o texto
 *   literal da fórmula).
 * - Espaços nas pontas são removidos e espaços repetidos viram um só.
 * - Linhas totalmente em branco são ignoradas e não contam no limite de 500.
 * - Cabeçalhos equivalentes (PRD › Validação da lista) são reconhecidos sem
 *   acento e sem diferença de caixa.
 *
 * Só lê: a validação (S10, WhatsApp, duplicidade…) é do `carga.validacao.ts`.
 */
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export const MAX_LINHAS = 500;
export const MAX_BYTES_ARQUIVO = 2 * 1024 * 1024;

export type CodigoParserErro =
  | 'coluna_ausente'
  | 'limite_linhas'
  | 'nenhuma_encomenda'
  | 'formato_nao_suportado'
  | 'arquivo_invalido';

export class ParserErro extends Error {
  readonly codigo: CodigoParserErro;
  readonly detalhes?: Record<string, unknown>;

  constructor(codigo: CodigoParserErro, detalhes?: Record<string, unknown>) {
    super(codigo);
    this.name = 'ParserErro';
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export type AvisoParser = 'varias_abas' | 'sem_coluna_whatsapp' | 'sem_coluna_endereco';

export interface CamposEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  /** Endereço em texto livre (uma coluna só, ou o resto da linha colada). */
  enderecoTexto?: string | null;
  referencia?: string | null;
}

export interface LinhaLida extends CamposEndereco {
  /** Número da linha na origem (1 = primeira linha do arquivo ou do texto). */
  n: number;
  codigo: string;
  nome: string;
  whatsapp: string | null;
  /** Linha colada com campos a menos (só o código, por exemplo). */
  faltamCampos?: boolean;
}

export interface ResultadoLeitura {
  linhas: LinhaLida[];
  avisos: AvisoParser[];
}

export type FormatoArquivo = 'csv' | 'xlsx';

type Campo = 'codigo' | 'nome' | 'whatsapp' | 'endereco' | keyof Omit<CamposEndereco, 'enderecoTexto'>;

/** Cabeçalhos aceitos, já normalizados (sem acento, minúsculos, só letras e dígitos). */
const CABECALHOS: Record<string, Campo> = {};
function aceitar(campo: Campo, nomes: string[]): void {
  for (const n of nomes) CABECALHOS[normalizarCabecalho(n)] = campo;
}
aceitar('codigo', ['código', 'codigo', 'objeto', 'rastreio', 'código de rastreio', 'código do objeto', 'etiqueta', 'cod', 'codigo rastreio', 'rastreamento']);
aceitar('nome', ['nome', 'destinatário', 'destinatario', 'nome do destinatário', 'cliente', 'nome destinatario']);
aceitar('whatsapp', ['whatsapp', 'whats', 'zap', 'telefone', 'celular', 'fone', 'tel', 'telefone celular', 'contato']);
aceitar('endereco', ['endereço', 'endereco', 'endereço completo', 'endereco completo']);
aceitar('logradouro', ['logradouro', 'rua', 'avenida']);
aceitar('numero', ['número', 'numero', 'nº', 'no', 'num', 'nro', 'n']);
aceitar('complemento', ['complemento', 'compl']);
aceitar('bairro', ['bairro']);
aceitar('cidade', ['cidade', 'município', 'municipio', 'localidade']);
aceitar('uf', ['uf', 'estado']);
aceitar('cep', ['cep']);
aceitar('referencia', ['referência', 'referencia', 'ponto de referência', 'ponto de referencia', 'observação', 'observacao', 'obs']);

const CAMPOS_ENDERECO_ESTRUTURADO: Campo[] = ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep'];

export function normalizarCabecalho(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/º/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

/** Remove espaços nas pontas e colapsa espaços internos. */
export function limparTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[\s\u00a0]+/g, ' ').trim();
}

function linhaVazia(celulas: string[]): boolean {
  return celulas.every((c) => c === '');
}

// ——— Mapeamento de colunas ——————————————————————————————————————

type Mapa = Partial<Record<Campo, number>>;

function mapearCabecalho(celulas: string[]): Mapa {
  const mapa: Mapa = {};
  celulas.forEach((c, i) => {
    const campo = CABECALHOS[normalizarCabecalho(c)];
    if (campo && mapa[campo] === undefined) mapa[campo] = i;
  });
  return mapa;
}

function montarLinhas(mapa: Mapa, dados: Array<{ n: number; celulas: string[] }>): ResultadoLeitura {
  if (mapa.codigo === undefined) throw new ParserErro('coluna_ausente', { coluna: 'codigo' });
  if (mapa.nome === undefined) throw new ParserErro('coluna_ausente', { coluna: 'nome' });

  const avisos: AvisoParser[] = [];
  if (mapa.whatsapp === undefined) avisos.push('sem_coluna_whatsapp');

  const temEstruturado = CAMPOS_ENDERECO_ESTRUTURADO.some((c) => mapa[c] !== undefined);
  // "endereço" sozinho é texto livre; com colunas separadas, é o logradouro.
  const enderecoComoLogradouro = mapa.endereco !== undefined && temEstruturado && mapa.logradouro === undefined;
  if (mapa.endereco === undefined && !temEstruturado) avisos.push('sem_coluna_endereco');

  const pegar = (celulas: string[], campo: Campo): string | null => {
    const i = mapa[campo];
    if (i === undefined) return null;
    const v = celulas[i] ?? '';
    return v === '' ? null : v;
  };

  const linhas = dados.map(({ n, celulas }): LinhaLida => ({
    n,
    codigo: pegar(celulas, 'codigo') ?? '',
    nome: pegar(celulas, 'nome') ?? '',
    whatsapp: pegar(celulas, 'whatsapp'),
    logradouro: enderecoComoLogradouro ? pegar(celulas, 'endereco') : pegar(celulas, 'logradouro'),
    numero: pegar(celulas, 'numero'),
    complemento: pegar(celulas, 'complemento'),
    bairro: pegar(celulas, 'bairro'),
    cidade: pegar(celulas, 'cidade'),
    uf: pegar(celulas, 'uf'),
    cep: pegar(celulas, 'cep'),
    enderecoTexto: enderecoComoLogradouro ? null : pegar(celulas, 'endereco'),
    referencia: pegar(celulas, 'referencia'),
  }));
  return { linhas, avisos };
}

/** Separa cabeçalho e dados, aplicando os limites. */
function comCabecalho(linhas: Array<{ n: number; celulas: string[] }>): ResultadoLeitura {
  if (linhas.length === 0) throw new ParserErro('nenhuma_encomenda');
  const [cabecalho, ...dados] = linhas;
  const mapa = mapearCabecalho(cabecalho.celulas);
  const resultado = montarLinhas(mapa, dados);
  if (dados.length === 0) throw new ParserErro('nenhuma_encomenda');
  return resultado;
}

function verificarLimite(qtdDados: number): void {
  if (qtdDados > MAX_LINHAS) throw new ParserErro('limite_linhas', { max: MAX_LINHAS });
}

// ——— CSV e texto ——————————————————————————————————————————————————

/** Tab, depois `;`, depois `,` (vírgula é comum dentro do endereço). */
export function adivinharSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 20).join('\n');
  if (amostra.includes('\t')) return '\t';
  if (amostra.includes(';')) return ';';
  return ',';
}

function lerTabela(texto: string): Array<{ n: number; celulas: string[] }> {
  const limpo = texto.replace(/^\uFEFF/, '');
  const resultado = Papa.parse<string[]>(limpo, {
    delimiter: adivinharSeparador(limpo),
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  const linhas: Array<{ n: number; celulas: string[] }> = [];
  resultado.data.forEach((bruta, i) => {
    const celulas = (bruta ?? []).map(limparTexto);
    if (linhaVazia(celulas)) return;
    linhas.push({ n: i + 1, celulas });
    // cabeçalho + 500 dados: a 502ª linha não vazia já estoura
    if (linhas.length > MAX_LINHAS + 1) throw new ParserErro('limite_linhas', { max: MAX_LINHAS });
  });
  return linhas;
}

/** Decodifica como UTF-8; se não for UTF-8 válido, como Windows-1252 (Excel no Windows). */
export function decodificarTexto(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export function lerCsv(conteudo: Buffer | string): ResultadoLeitura {
  const texto = typeof conteudo === 'string' ? conteudo : decodificarTexto(conteudo);
  const linhas = lerTabela(texto);
  verificarLimite(Math.max(0, linhas.length - 1));
  return comCabecalho(linhas);
}

const PADRAO_S10 = /^[A-Za-z]{2}\s?\d{8}\s?\d\s?[A-Za-z]{2}$/;
const PADRAO_TELEFONE = /^\+?[\d\s().-]+$/;

function pareceTelefone(v: string): boolean {
  return PADRAO_TELEFONE.test(v) && v.replace(/\D/g, '').length >= 8;
}

/**
 * Linha colada sem cabeçalho. O código é a célula no formato S10 (ou a primeira);
 * o WhatsApp é a primeira célula com cara de telefone; o nome é a primeira
 * célula restante; o resto vira `enderecoTexto`.
 */
function linhaPosicional(n: number, celulas: string[]): LinhaLida {
  const preenchidas = celulas.filter((c) => c !== '');
  let iCodigo = preenchidas.findIndex((c) => PADRAO_S10.test(c));
  if (iCodigo < 0) iCodigo = 0;
  const codigo = preenchidas[iCodigo] ?? '';
  const resto = preenchidas.filter((_, i) => i !== iCodigo);

  const iFone = resto.findIndex(pareceTelefone);
  const whatsapp = iFone >= 0 ? resto[iFone] : null;
  const semFone = resto.filter((_, i) => i !== iFone);
  const nome = semFone[0] ?? '';
  const endereco = semFone.slice(1).join(', ');

  return {
    n,
    codigo,
    nome,
    whatsapp,
    enderecoTexto: endereco || null,
    faltamCampos: preenchidas.length < 2 || nome === '',
  };
}

/**
 * Texto colado. Se a primeira linha tiver cabeçalhos reconhecidos (código e
 * mais um), é lida como planilha; senão, cada linha é interpretada por posição.
 */
export function lerTexto(texto: string): ResultadoLeitura {
  const linhas = lerTabela(texto ?? '');
  if (linhas.length === 0) throw new ParserErro('nenhuma_encomenda');

  const mapa = mapearCabecalho(linhas[0].celulas);
  if (mapa.codigo !== undefined && Object.keys(mapa).length >= 2) {
    verificarLimite(linhas.length - 1);
    return comCabecalho(linhas);
  }

  verificarLimite(linhas.length);
  return { linhas: linhas.map(({ n, celulas }) => linhaPosicional(n, celulas)), avisos: [] };
}

// ——— XLSX ——————————————————————————————————————————————————————————

/** Texto de uma célula do ExcelJS, sem avaliar fórmulas. */
export function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return limparTexto(valor);
  const v = valor as unknown as Record<string, unknown>;
  if (typeof v.formula === 'string') return limparTexto(`=${v.formula}`);
  if (typeof v.sharedFormula === 'string') return limparTexto(`=${v.sharedFormula}`);
  if (Array.isArray(v.richText)) {
    return limparTexto((v.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join(''));
  }
  if ('text' in v) {
    const t = v.text as unknown;
    if (t && typeof t === 'object' && Array.isArray((t as { richText?: unknown }).richText)) {
      return textoDaCelula(t as ExcelJS.CellValue);
    }
    return limparTexto(t);
  }
  if ('error' in v) return '';
  return '';
}

export async function lerXlsx(buffer: Buffer): Promise<ResultadoLeitura> {
  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ParserErro('arquivo_invalido');
  }
  const aba = livro.worksheets[0];
  if (!aba) throw new ParserErro('nenhuma_encomenda');

  const linhas: Array<{ n: number; celulas: string[] }> = [];
  aba.eachRow({ includeEmpty: false }, (row, numero) => {
    const celulas: string[] = [];
    const valores = row.values as ExcelJS.CellValue[]; // índice 1 = coluna A
    for (let c = 1; c < valores.length; c += 1) celulas[c - 1] = textoDaCelula(valores[c]);
    for (let c = 0; c < celulas.length; c += 1) celulas[c] ??= '';
    if (linhaVazia(celulas)) return;
    linhas.push({ n: numero, celulas });
    if (linhas.length > MAX_LINHAS + 1) throw new ParserErro('limite_linhas', { max: MAX_LINHAS });
  });

  verificarLimite(Math.max(0, linhas.length - 1));
  const resultado = comCabecalho(linhas);
  if (livro.worksheets.length > 1) resultado.avisos.unshift('varias_abas');
  return resultado;
}

// ——— Arquivo enviado —————————————————————————————————————————————————

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIMES_CSV = new Set(['text/csv', 'text/plain', 'application/csv', 'text/x-csv', 'application/vnd.ms-excel', 'text/comma-separated-values', 'text/tab-separated-values']);

/** Formato pelo nome e pelo conteúdo. Qualquer outro (PDF, imagem, XLS antigo) → `formato_nao_suportado`. */
export function detectarFormato(nomeArquivo: string, mimetype: string, buffer: Buffer): FormatoArquivo {
  const ext = (nomeArquivo.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) ?? '';
  const zip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (ext === 'xlsx' || (ext === '' && mimetype === MIME_XLSX)) {
    if (!zip) throw new ParserErro('formato_nao_suportado');
    return 'xlsx';
  }
  const extTexto = ext === 'csv' || ext === 'txt' || ext === 'tsv';
  if (extTexto || (ext === '' && MIMES_CSV.has(mimetype))) {
    if (zip || buffer.includes(0)) throw new ParserErro('formato_nao_suportado');
    return 'csv';
  }
  throw new ParserErro('formato_nao_suportado');
}

export async function lerArquivo(arquivo: { buffer: Buffer; originalname: string; mimetype: string }): Promise<ResultadoLeitura> {
  const formato = detectarFormato(arquivo.originalname, arquivo.mimetype, arquivo.buffer);
  return formato === 'xlsx' ? lerXlsx(arquivo.buffer) : lerCsv(arquivo.buffer);
}
