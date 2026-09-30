/**
 * Gera as fixtures de rótulo sintéticas da captura (Strategy de `_tests.md`).
 *
 *   npx tsx src/__tests__/fixtures/rotulos/gerar-rotulos.ts   (dentro de backend/)
 *
 * Cada rótulo é desenhado num bitmap em tons de cinza: Code 128 do objeto,
 * Code 128 do CEP e DataMatrix SIGEP montado por `montarSigepDataMatrix` (o
 * inverso do parser), mais o texto do destinatário. Dados fictícios, DV válido.
 * O ruído é determinístico: rodar de novo produz os mesmos arquivos.
 *
 * Saída: os JPEGs e `rotulos.json` (o que cada fixture contém e o que se espera
 * decodificar), usado pelas fakes e pelos testes do aparelho.
 */
import fs from 'fs';
import path from 'path';
import bwipjs from 'bwip-js';
import jpeg from 'jpeg-js';
import { montarSigepDataMatrix } from '../../../shared/utils/sigep-datamatrix';
import { calculateS10CheckDigit } from '../../../shared/utils/s10';

const SAIDA = __dirname;
const LARGURA = 720;
const ALTURA = 1080;
const QUALIDADE_JPEG = 85;

// ——— Bitmap ————————————————————————————————————————————————————————

class Bitmap {
  readonly px: Uint8Array;

  constructor(readonly w: number, readonly h: number, fundo = 255) {
    this.px = new Uint8Array(w * h).fill(fundo);
  }

  retangulo(x: number, y: number, w: number, h: number, v = 0): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy += 1) {
      this.px.fill(v, yy * this.w + Math.max(0, x), yy * this.w + Math.min(this.w, x + w));
    }
  }

  moldura(x: number, y: number, w: number, h: number, espessura = 2): void {
    this.retangulo(x, y, w, espessura);
    this.retangulo(x, y + h - espessura, w, espessura);
    this.retangulo(x, y, espessura, h);
    this.retangulo(x + w - espessura, y, espessura, h);
  }

  /** Texto com a fonte OCR-B embutida do bwip-js; `y` é a linha de base. */
  texto(x: number, y: number, conteudo: string, tamanho = 22): number {
    let cx = x;
    for (const ch of conteudo) {
      const g = bwipjs.FontLib.getglyph(1, ch.charCodeAt(0), tamanho, tamanho);
      for (let gy = 0; gy < g.height; gy += 1) {
        for (let gx = 0; gx < g.width; gx += 1) {
          const a = g.bytes[g.offset + gy * g.width + gx];
          if (a === 0) continue;
          const px = cx + g.left + gx;
          const py = y - g.top + gy;
          if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
          const i = py * this.w + px;
          this.px[i] = Math.min(this.px[i], 255 - a);
        }
      }
      cx += g.advance;
    }
    return cx;
  }

  /** Code 128 com `modulo` px por módulo; devolve a largura desenhada. */
  code128(x: number, y: number, conteudo: string, modulo: number, altura: number): number {
    const [{ sbs }] = bwipjs.raw({ bcid: 'code128', text: conteudo }) as unknown as [{ sbs: number[] }];
    let cx = x;
    sbs.forEach((largura, i) => {
      if (i % 2 === 0) this.retangulo(cx, y, largura * modulo, altura);
      cx += largura * modulo;
    });
    return cx - x;
  }

  /** DataMatrix com `modulo` px por módulo; devolve o lado desenhado. */
  datamatrix(x: number, y: number, conteudo: string, modulo: number): number {
    const [{ pixs, pixx, pixy }] = bwipjs.raw({ bcid: 'datamatrix', text: conteudo }) as unknown as [
      { pixs: number[]; pixx: number; pixy: number },
    ];
    for (let r = 0; r < pixy; r += 1) {
      for (let c = 0; c < pixx; c += 1) {
        if (pixs[r * pixx + c]) this.retangulo(x + c * modulo, y + r * modulo, modulo, modulo);
      }
    }
    return pixx * modulo;
  }

  colar(outro: Bitmap, x: number, y: number): void {
    for (let yy = 0; yy < outro.h; yy += 1) {
      this.px.set(outro.px.subarray(yy * outro.w, (yy + 1) * outro.w), (y + yy) * this.w + x);
    }
  }

  jpeg(): Buffer {
    const rgba = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.px.length; i += 1) {
      rgba[i * 4] = this.px[i];
      rgba[i * 4 + 1] = this.px[i];
      rgba[i * 4 + 2] = this.px[i];
      rgba[i * 4 + 3] = 255;
    }
    return jpeg.encode({ data: rgba, width: this.w, height: this.h }, QUALIDADE_JPEG).data;
  }
}

/** PRNG determinístico (mulberry32). */
function aleatorio(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído leve de papel/câmera. */
function ruido(b: Bitmap, semente: number, amplitude = 8): void {
  const rnd = aleatorio(semente);
  for (let i = 0; i < b.px.length; i += 1) {
    const v = b.px[i] + (rnd() - 0.5) * amplitude;
    b.px[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
}

// ——— Rótulo ———————————————————————————————————————————————————————

interface Destinatario {
  nome: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefoneImpresso: string | null;
}

interface Rotulo {
  codigo: string;
  destinatario: Destinatario;
  /** Conteúdo do DataMatrix; `null` = rótulo sem DataMatrix. */
  dataMatrix: string | null;
  /** Risca o Code 128 do objeto até ficar ilegível. */
  codigoDanificado?: boolean;
}

function cepFormatado(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function desenharRotulo(r: Rotulo, semente: number): Bitmap {
  const b = new Bitmap(LARGURA, ALTURA);
  const m = 24;
  b.moldura(m / 2, m / 2, LARGURA - m, ALTURA - m, 3);

  // Cabeçalho (remetente fictício) e DataMatrix no canto.
  b.texto(m + 8, 70, 'SEDEX CONTRATO', 26);
  b.texto(m + 8, 104, 'Contrato 9912345678', 18);
  b.texto(m + 8, 130, 'Volume 1/1   Peso 1,250 kg', 18);
  if (r.dataMatrix) b.datamatrix(LARGURA - m - 8 - 260, m + 16, r.dataMatrix, 5);

  // Código do objeto.
  const yCodigo = 330;
  b.texto(m + 8, yCodigo - 14, r.codigo.replace(/^(..)(...)(...)(...)(..)$/, '$1 $2 $3 $4 $5'), 30);
  const larguraCodigo = b.code128(m + 40, yCodigo, r.codigo, 3, 130);
  if (r.codigoDanificado) {
    // Faixas brancas e um borrão atravessando as barras.
    for (let i = 0; i < larguraCodigo; i += 23) b.retangulo(m + 40 + i, yCodigo, 9, 130, 255);
    b.retangulo(m + 40 + larguraCodigo / 3, yCodigo + 20, larguraCodigo / 3, 90, 90);
  }
  b.texto(m + 8, yCodigo + 170, 'Recebedor: ________________________', 18);
  b.texto(m + 8, yCodigo + 200, 'Assinatura: _________  Documento: _________', 18);

  // Destinatário.
  const d = r.destinatario;
  const yDest = 600;
  b.retangulo(m, yDest - 34, LARGURA - 2 * m, 4);
  b.texto(m + 8, yDest, 'DESTINATARIO', 22);
  b.texto(m + 8, yDest + 36, d.nome, 24);
  b.texto(m + 8, yDest + 68, `${d.logradouro}, ${d.numero}${d.complemento ? ` ${d.complemento}` : ''}`, 22);
  b.texto(m + 8, yDest + 98, d.bairro, 22);
  b.texto(m + 8, yDest + 128, `${cepFormatado(d.cep)}  ${d.cidade}/${d.uf}`, 22);
  if (d.telefoneImpresso) b.texto(m + 8, yDest + 158, `Tel.: ${d.telefoneImpresso}`, 20);
  b.code128(m + 40, yDest + 180, d.cep, 3, 90);

  // Remetente.
  const yRem = 950;
  b.retangulo(m, yRem - 30, LARGURA - 2 * m, 2);
  b.texto(m + 8, yRem, 'Remetente: LOJA EXEMPLO LTDA', 18);
  b.texto(m + 8, yRem + 26, 'SIA Trecho 3, 100 - 71200-030 Brasilia/DF', 18);

  ruido(b, semente);
  return b;
}

function s10(prefixo: string, serial: string): string {
  return `${prefixo}${serial}${calculateS10CheckDigit(serial)}BR`;
}

// ——— Fixtures ———————————————————————————————————————————————————

const ALINE: Destinatario = {
  nome: 'ALINE RODRIGUES',
  logradouro: 'QNC 4',
  numero: '17',
  complemento: 'CASA',
  bairro: 'Taguatinga Norte',
  cep: '72115040',
  cidade: 'Brasilia',
  uf: 'DF',
  telefoneImpresso: '(61) 99340-1287',
};

const JOSE: Destinatario = {
  nome: 'JOSE CARLOS PEREIRA',
  logradouro: 'Rua 25 Norte',
  numero: '5',
  complemento: 'APTO 1203',
  bairro: 'Aguas Claras',
  cep: '71919360',
  cidade: 'Brasilia',
  uf: 'DF',
  telefoneImpresso: '(61) 98765-4321',
};

const COMPLETO: Rotulo = {
  codigo: 'OY716488072BR',
  destinatario: ALINE,
  dataMatrix: montarSigepDataMatrix({
    cepDestino: ALINE.cep,
    codigo: 'OY716488072BR',
    numero: '17',
    complemento: 'CASA',
    telefone: '61993401287',
  }),
};

const SEM_DATAMATRIX: Rotulo = { codigo: 'AA123456785BR', destinatario: JOSE, dataMatrix: null };

const CODIGO_DM_SEM_TELEFONE = s10('OY', '71648810');
const DM_SEM_TELEFONE: Rotulo = {
  codigo: CODIGO_DM_SEM_TELEFONE,
  destinatario: { ...ALINE, nome: 'MARCOS VINICIUS LIMA', telefoneImpresso: null },
  dataMatrix: montarSigepDataMatrix({
    cepDestino: ALINE.cep,
    codigo: CODIGO_DM_SEM_TELEFONE,
    numero: '17',
    complemento: 'CASA',
    telefone: '000000000000',
  }),
};

const CODIGO_DANIFICADO: Rotulo = { ...SEM_DATAMATRIX, codigoDanificado: true };

const CODIGO_CEP_UNICO = s10('OY', '71648829');
const FORMOSA: Destinatario = {
  nome: 'HELENA SOUZA',
  logradouro: 'Rua Sete',
  numero: '120',
  complemento: null,
  bairro: 'Centro',
  cep: '73800000',
  cidade: 'Formosa',
  uf: 'GO',
  telefoneImpresso: '(61) 99111-2222',
};
const CEP_UNICO: Rotulo = {
  codigo: CODIGO_CEP_UNICO,
  destinatario: FORMOSA,
  dataMatrix: montarSigepDataMatrix({
    cepDestino: FORMOSA.cep,
    codigo: CODIGO_CEP_UNICO,
    numero: '120',
    telefone: '61991112222',
  }),
};

interface Esperado {
  objeto: string | null;
  cepLinear: string | null;
  dataMatrixRaw: string | null;
  multiplos: boolean;
}

interface Fixture {
  arquivo: string;
  descricao: string;
  imagem: () => Bitmap;
  /** O que o `barcode.decode` do aparelho deve devolver. */
  esperado: Esperado;
  /** Conteúdo impresso (para a `FakeLabelExtractor`). */
  rotulos: Rotulo[];
}

function esperadoDe(r: Rotulo): Esperado {
  return {
    objeto: r.codigoDanificado ? null : r.codigo,
    cepLinear: r.destinatario.cep,
    dataMatrixRaw: r.dataMatrix,
    multiplos: false,
  };
}

const FIXTURES: Fixture[] = [
  {
    arquivo: 'rotulo-completo.jpg',
    descricao: 'Code 128 do objeto, código do CEP e DataMatrix SIGEP com número 17, complemento CASA e telefone.',
    imagem: () => desenharRotulo(COMPLETO, 1),
    esperado: esperadoDe(COMPLETO),
    rotulos: [COMPLETO],
  },
  {
    arquivo: 'rotulo-sem-datamatrix.jpg',
    descricao: 'Só os dois Code 128 (objeto e CEP), sem DataMatrix.',
    imagem: () => desenharRotulo(SEM_DATAMATRIX, 2),
    esperado: esperadoDe(SEM_DATAMATRIX),
    rotulos: [SEM_DATAMATRIX],
  },
  {
    arquivo: 'rotulo-dm-sem-telefone.jpg',
    descricao: 'DataMatrix com o telefone zerado (000000000000); nenhum telefone impresso.',
    imagem: () => desenharRotulo(DM_SEM_TELEFONE, 3),
    esperado: esperadoDe(DM_SEM_TELEFONE),
    rotulos: [DM_SEM_TELEFONE],
  },
  {
    arquivo: 'rotulo-codigo-danificado.jpg',
    descricao: 'Code 128 do objeto riscado (ilegível) e sem DataMatrix; o código do CEP continua legível.',
    imagem: () => desenharRotulo(CODIGO_DANIFICADO, 4),
    esperado: esperadoDe(CODIGO_DANIFICADO),
    rotulos: [CODIGO_DANIFICADO],
  },
  {
    arquivo: 'rotulo-dois.jpg',
    descricao: 'Dois rótulos na mesma foto (completo e sem DataMatrix), lado a lado.',
    imagem: () => {
      const a = desenharRotulo(COMPLETO, 5);
      const b = desenharRotulo(SEM_DATAMATRIX, 6);
      const foto = new Bitmap(LARGURA * 2 + 40, ALTURA + 40, 200);
      foto.colar(a, 10, 20);
      foto.colar(b, LARGURA + 30, 20);
      return foto;
    },
    esperado: { objeto: null, cepLinear: null, dataMatrixRaw: null, multiplos: true },
    rotulos: [COMPLETO, SEM_DATAMATRIX],
  },
  {
    arquivo: 'rotulo-escuro.jpg',
    descricao: 'O rótulo completo fotografado no escuro: contraste mínimo e ruído forte, nenhum código decodificável.',
    imagem: () => {
      const b = desenharRotulo(COMPLETO, 7);
      const rnd = aleatorio(77);
      for (let i = 0; i < b.px.length; i += 1) {
        const v = 12 + (b.px[i] / 255) * 6 + (rnd() - 0.5) * 26;
        b.px[i] = Math.max(0, Math.min(255, Math.round(v)));
      }
      return b;
    },
    esperado: { objeto: null, cepLinear: null, dataMatrixRaw: null, multiplos: false },
    rotulos: [COMPLETO],
  },
  {
    arquivo: 'rotulo-cep-unico.jpg',
    descricao: 'CEP 73800000 (Formosa/GO, cidade de CEP único: o CEP não resolve o logradouro).',
    imagem: () => desenharRotulo(CEP_UNICO, 8),
    esperado: esperadoDe(CEP_UNICO),
    rotulos: [CEP_UNICO],
  },
];

function main(): void {
  const manifesto = FIXTURES.map((f) => {
    fs.writeFileSync(path.join(SAIDA, f.arquivo), f.imagem().jpeg());
    return {
      arquivo: f.arquivo,
      descricao: f.descricao,
      esperado: f.esperado,
      rotulos: f.rotulos.map((r) => ({ codigo: r.codigo, dataMatrix: r.dataMatrix, destinatario: r.destinatario })),
    };
  });
  fs.writeFileSync(path.join(SAIDA, 'rotulos.json'), `${JSON.stringify(manifesto, null, 2)}\n`);
  console.log(`${FIXTURES.length} rótulos gerados em ${SAIDA}`);
}

main();
