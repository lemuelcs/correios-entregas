import { readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  ExtracaoIndisponivel,
  FakeLabelExtractor,
  GeminiLabelExtractor,
  criarLabelExtractor,
  type GenerateObjectArgs,
  type GenerateObjectFn,
} from '../extraction.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const sinal = () => new AbortController().signal;

function gerador(object: unknown, usage = { inputTokens: 1200, outputTokens: 80 }) {
  return jest.fn<ReturnType<GenerateObjectFn>, [GenerateObjectArgs]>(async () => ({ object, usage }));
}

describe('GeminiLabelExtractor', () => {
  afterEach(() => jest.useRealTimers());

  it('UT-042 nome "ALINE RODRIGUES" sem dúvida → campo LLM, com o uso de tokens propagado', async () => {
    const gen = gerador({ nome: { valor: 'ALINE RODRIGUES', duvida: false } });
    const ext = new GeminiLabelExtractor({ generateObject: gen, model: {} });
    const r = await ext.extract(JPEG, ['nome'], sinal());
    expect(r.campos.nome).toEqual({ valor: 'ALINE RODRIGUES', duvida: false, fonte: 'LLM' });
    expect(r.uso).toEqual({ inputTokens: 1200, outputTokens: 80 });
  });

  it('UT-043 pedir = [nome] → o schema enviado contém só nome', async () => {
    const gen = gerador({ nome: { valor: 'X', duvida: false } });
    await new GeminiLabelExtractor({ generateObject: gen, model: {} }).extract(JPEG, ['nome'], sinal());
    const schema = gen.mock.calls[0][0].schema as z.ZodObject<z.ZodRawShape>;
    expect(Object.keys(schema.shape)).toEqual(['nome']);
    const imagem = gen.mock.calls[0][0].messages[0].content.find((c) => c.type === 'image');
    expect(imagem).toMatchObject({ type: 'image', mediaType: 'image/jpeg' });
  });

  it('UT-044 "AL?NE" sem dúvida → a pós-validação força duvida=true', async () => {
    const gen = gerador({ nome: { valor: 'AL?NE', duvida: false } });
    const r = await new GeminiLabelExtractor({ generateObject: gen, model: {} }).extract(JPEG, ['nome'], sinal());
    expect(r.campos.nome).toMatchObject({ valor: 'AL?NE', duvida: true });
  });

  it('UT-045 generateObject rejeita → ExtracaoIndisponivel', async () => {
    const gen = jest.fn(async () => { throw new Error('503 do provedor'); });
    const ext = new GeminiLabelExtractor({ generateObject: gen, model: {} });
    await expect(ext.extract(JPEG, ['nome'], sinal())).rejects.toBeInstanceOf(ExtracaoIndisponivel);
  });

  it('UT-046 sem resposta em 15 s → ExtracaoIndisponivel com motivo timeout', async () => {
    jest.useFakeTimers();
    let abortado = false;
    const gen = jest.fn((args: GenerateObjectArgs) => new Promise<never>(() => {
      args.abortSignal.addEventListener('abort', () => { abortado = true; });
    }));
    const ext = new GeminiLabelExtractor({ generateObject: gen, model: {} });
    const p = ext.extract(JPEG, ['nome'], sinal());
    const verificacao = expect(p).rejects.toMatchObject({ name: 'ExtracaoIndisponivel', motivo: 'timeout' });
    await jest.advanceTimersByTimeAsync(15_000);
    await verificacao;
    expect(abortado).toBe(true);
  });

  it('UT-047 CAPTURA_AI_PROVIDER=fake → a factory devolve o FakeLabelExtractor', () => {
    expect(criarLabelExtractor({ CAPTURA_AI_PROVIDER: 'fake' })).toBeInstanceOf(FakeLabelExtractor);
    expect(criarLabelExtractor({ CAPTURA_AI_PROVIDER: 'google' })).toBeInstanceOf(GeminiLabelExtractor);
  });

  it('sem chave configurada → ExtracaoIndisponivel sem_chave (nunca chama o provedor)', async () => {
    const gen = gerador({});
    const ext = new GeminiLabelExtractor({ generateObject: gen, apiKey: '' });
    await expect(ext.extract(JPEG, ['nome'], sinal())).rejects.toMatchObject({ motivo: 'sem_chave' });
    expect(gen).not.toHaveBeenCalled();
  });
});

describe('FakeLabelExtractor', () => {
  it('responde pela fixture do rótulo e só com os campos pedidos', async () => {
    const jpeg = readFileSync(path.resolve(__dirname, '../../../__tests__/fixtures/rotulos/rotulo-completo.jpg'));
    const fake = new FakeLabelExtractor();
    const r = await fake.extract(jpeg, ['nome'], sinal());
    expect(r.campos).toEqual({ nome: { valor: 'ALINE RODRIGUES', duvida: false, fonte: 'LLM' } });
    expect(fake.chamadas).toBe(1);
  });
});
