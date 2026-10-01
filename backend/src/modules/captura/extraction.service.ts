/**
 * Extração dos campos livres do rótulo com um modelo de visão (ADR-008).
 *
 * `GeminiLabelExtractor` usa o AI SDK (`generateObject`) com um schema zod que só
 * contém os campos pedidos, cada um `{ valor, duvida, motivo }`. Timeout de 15 s,
 * sem retry. Uma pós-validação força `duvida` quando o valor tem caractere fora do
 * alfabeto esperado. Erro ou timeout → `ExtracaoIndisponivel`.
 *
 * `FakeLabelExtractor` (`CAPTURA_AI_PROVIDER=fake`) responde pelas fixtures de rótulo
 * (sha256 da imagem → destinatário em `rotulos.json`) ou por uma função configurada.
 *
 * Nunca registra em log o texto devolvido pelo modelo nem os bytes da foto.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import logger from '../../shared/utils/logger';
import { NOMES_CAMPOS, type Campo, type CamposLidos, type LabelExtractor, type NomeCampo, type UsoLlm } from './captura.types';

export const TIMEOUT_EXTRACAO_MS = 15_000;
export const MODELO_PADRAO = 'gemini-3.1-flash-lite';

export type MotivoExtracaoIndisponivel = 'timeout' | 'erro' | 'sem_chave' | 'abortada';

export class ExtracaoIndisponivel extends Error {
  constructor(readonly motivo: MotivoExtracaoIndisponivel) {
    super(`extracao_indisponivel:${motivo}`);
    this.name = 'ExtracaoIndisponivel';
  }
}

// ——— Schema e prompt ——————————————————————————————————————————————

const campoSchema = z.object({
  valor: z.string().nullable(),
  duvida: z.boolean(),
  motivo: z.string().nullable().optional(),
});

/** Schema do `generateObject`: só os campos pedidos. */
export function schemaPara(pedir: readonly NomeCampo[]) {
  const forma: Record<string, typeof campoSchema> = {};
  for (const n of NOMES_CAMPOS) if (pedir.includes(n)) forma[n] = campoSchema;
  return z.object(forma);
}

const DESCRICAO: Record<NomeCampo, string> = {
  codigo: 'código do objeto (2 letras, 9 dígitos, 2 letras)',
  nome: 'nome do destinatário',
  whatsapp: 'telefone do destinatário, com DDD',
  cep: 'CEP do destinatário, como impresso',
  logradouro: 'logradouro do destinatário (rua, quadra, avenida)',
  numero: 'número do endereço do destinatário ("S/N" se impresso assim)',
  complemento: 'complemento do endereço do destinatário, completo',
  bairro: 'bairro do destinatário',
  cidade: 'cidade do destinatário',
  uf: 'UF do destinatário (2 letras)',
};

export function promptPara(pedir: readonly NomeCampo[]): string {
  const linhas = NOMES_CAMPOS.filter((n) => pedir.includes(n)).map((n) => `- ${n}: ${DESCRICAO[n]}`);
  return [
    'Você lê o rótulo de envio dos Correios na foto. Leia SOMENTE o bloco do DESTINATÁRIO.',
    'Para cada campo pedido devolva { valor, duvida, motivo }:',
    '- transcreva exatamente o que está impresso; NUNCA invente, complete ou corrija letras ou dígitos;',
    '- se algum caractere não puder ser lido com segurança, marque duvida=true e explique em motivo;',
    '- se o campo não existir no rótulo, devolva valor=null e duvida=false.',
    'Campos pedidos:',
    ...linhas,
  ].join('\n');
}

// ——— Pós-validação ——————————————————————————————————————————————

const LETRAS = "A-Za-zÀ-ÖØ-öø-ÿ";
const VALIDADORES: Partial<Record<NomeCampo, RegExp>> = {
  nome: new RegExp(`^[${LETRAS}' .-]+$`),
  whatsapp: /^[\d\s()+.-]+$/,
  cep: /^\d{5}-?\d{3}$/,
  numero: new RegExp(`^[\\d${LETRAS}/ .-]+$`),
  uf: /^[A-Za-z]{2}$/,
  cidade: new RegExp(`^[${LETRAS}' .-]+$`),
  logradouro: new RegExp(`^[\\d${LETRAS}ºª°'",./ -]+$`),
  bairro: new RegExp(`^[\\d${LETRAS}ºª°'",./ -]+$`),
  complemento: new RegExp(`^[\\d${LETRAS}ºª°'",./#() -]+$`),
};

/** Força `duvida` quando o valor tem caractere fora do alfabeto do campo (ex.: "AL?NE"). */
export function posValidar(nome: NomeCampo, bruto: { valor: string | null; duvida: boolean; motivo?: string | null } | undefined): Campo {
  const valor = typeof bruto?.valor === 'string' && bruto.valor.trim() !== '' ? bruto.valor.trim() : null;
  let duvida = !!bruto?.duvida;
  let motivo = bruto?.motivo ?? undefined;
  const re = VALIDADORES[nome];
  if (valor && re && !re.test(valor)) {
    duvida = true;
    motivo = 'caractere_ilegivel';
  }
  if (valor && /[?�_*]/.test(valor)) {
    duvida = true;
    motivo = 'caractere_ilegivel';
  }
  const c: Campo = { valor, duvida, fonte: 'LLM' };
  if (motivo) c.motivo = motivo;
  return c;
}

// ——— Gemini ————————————————————————————————————————————————————————

export interface GenerateObjectArgs {
  model: unknown;
  schema: z.ZodTypeAny;
  messages: Array<{ role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image'; image: Buffer; mediaType: string }> }>;
  abortSignal: AbortSignal;
  temperature?: number;
  maxRetries?: number;
}

export type GenerateObjectFn = (args: GenerateObjectArgs) => Promise<{
  object: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
}>;

export interface GeminiLabelExtractorDeps {
  /** Injetável nos testes; o padrão carrega `ai` sob demanda. */
  generateObject?: GenerateObjectFn;
  /** Modelo do AI SDK; o padrão cria `google(CAPTURA_AI_MODEL)` com `CAPTURA_AI_API_KEY`. */
  model?: unknown;
  modelId?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class GeminiLabelExtractor implements LabelExtractor {
  private readonly timeoutMs: number;

  constructor(private readonly deps: GeminiLabelExtractorDeps = {}) {
    this.timeoutMs = deps.timeoutMs ?? TIMEOUT_EXTRACAO_MS;
  }

  private async carregar(): Promise<{ generateObject: GenerateObjectFn; model: unknown }> {
    const generateObject = this.deps.generateObject ?? ((await import('ai')).generateObject as unknown as GenerateObjectFn);
    let model = this.deps.model;
    if (!model) {
      const apiKey = this.deps.apiKey ?? process.env.CAPTURA_AI_API_KEY;
      if (!apiKey) throw new ExtracaoIndisponivel('sem_chave');
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      model = createGoogleGenerativeAI({ apiKey })(this.deps.modelId ?? process.env.CAPTURA_AI_MODEL ?? MODELO_PADRAO);
    }
    return { generateObject, model };
  }

  async extract(jpeg: Buffer, pedir: Array<keyof CamposLidos>, signal: AbortSignal): Promise<{ campos: Partial<CamposLidos>; uso: UsoLlm }> {
    if (pedir.length === 0) return { campos: {}, uso: { inputTokens: 0, outputTokens: 0 } };
    const { generateObject, model } = await this.carregar();

    const ctrl = new AbortController();
    const abortar = () => ctrl.abort();
    signal.addEventListener('abort', abortar, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => {
        ctrl.abort();
        rejeitar(new ExtracaoIndisponivel('timeout'));
      }, this.timeoutMs);
    });

    try {
      const r = await Promise.race([
        generateObject({
          model,
          schema: schemaPara(pedir),
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: promptPara(pedir) },
              { type: 'image', image: jpeg, mediaType: 'image/jpeg' },
            ],
          }],
          abortSignal: ctrl.signal,
          temperature: 0,
          maxRetries: 0,
        }),
        prazo,
      ]);
      const objeto = (r.object ?? {}) as Record<string, { valor: string | null; duvida: boolean; motivo?: string | null }>;
      const campos: Partial<CamposLidos> = {};
      for (const n of pedir) campos[n] = posValidar(n, objeto[n]);
      return {
        campos,
        uso: { inputTokens: r.usage?.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0 },
      };
    } catch (err) {
      if (err instanceof ExtracaoIndisponivel) throw err;
      const motivo: MotivoExtracaoIndisponivel = signal.aborted ? 'abortada' : 'erro';
      logger.warn({ motivo, erro: err instanceof Error ? err.name : 'desconhecido' }, 'captura: extração do rótulo falhou');
      throw new ExtracaoIndisponivel(motivo);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortar);
    }
  }
}

// ——— Fake —————————————————————————————————————————————————————————

export type RespostaFake = Partial<Record<NomeCampo, { valor: string | null; duvida?: boolean; motivo?: string }>>;

interface RotuloFixture {
  arquivo: string;
  rotulos: Array<{
    codigo: string;
    destinatario: {
      nome: string; logradouro: string; numero: string; complemento: string | null; bairro: string;
      cep: string; cidade: string; uf: string; telefoneImpresso: string | null;
    };
  }>;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Diretório padrão das fixtures de rótulo (existe no código-fonte; ausente em produção). */
function dirFixturesPadrao(): string {
  return process.env.CAPTURA_AI_FAKE_DIR ?? path.resolve(__dirname, '../../__tests__/fixtures/rotulos');
}

export class FakeLabelExtractor implements LabelExtractor {
  chamadas = 0;
  ultimoPedido: NomeCampo[] = [];
  private resposta: ((jpeg: Buffer, pedir: NomeCampo[]) => RespostaFake | Promise<RespostaFake>) | null = null;
  private falha: ExtracaoIndisponivel | null = null;
  private atrasoMs = 0;
  private porHash: Map<string, RespostaFake> | null = null;

  constructor(private readonly dirFixtures: string = dirFixturesPadrao()) {}

  /** Responde com esta função (ou objeto) em vez das fixtures. */
  responder(r: RespostaFake | ((jpeg: Buffer, pedir: NomeCampo[]) => RespostaFake | Promise<RespostaFake>) | null): this {
    this.resposta = r === null ? null : typeof r === 'function' ? r : () => r;
    return this;
  }

  falhar(motivo: MotivoExtracaoIndisponivel | null = 'erro'): this {
    this.falha = motivo ? new ExtracaoIndisponivel(motivo) : null;
    return this;
  }

  atrasar(ms: number): this {
    this.atrasoMs = ms;
    return this;
  }

  redefinir(): this {
    this.chamadas = 0;
    this.ultimoPedido = [];
    this.resposta = null;
    this.falha = null;
    this.atrasoMs = 0;
    return this;
  }

  private fixtures(): Map<string, RespostaFake> {
    if (this.porHash) return this.porHash;
    const mapa = new Map<string, RespostaFake>();
    try {
      const indice = path.join(this.dirFixtures, 'rotulos.json');
      if (existsSync(indice)) {
        const lista = JSON.parse(readFileSync(indice, 'utf8')) as RotuloFixture[];
        for (const f of lista) {
          const arquivo = path.join(this.dirFixtures, f.arquivo);
          if (!existsSync(arquivo) || f.rotulos.length !== 1) continue;
          const d = f.rotulos[0].destinatario;
          mapa.set(sha256(readFileSync(arquivo)), {
            codigo: { valor: f.rotulos[0].codigo },
            nome: { valor: d.nome },
            whatsapp: { valor: d.telefoneImpresso },
            cep: { valor: d.cep },
            logradouro: { valor: d.logradouro },
            numero: { valor: d.numero },
            complemento: { valor: d.complemento },
            bairro: { valor: d.bairro },
            cidade: { valor: d.cidade },
            uf: { valor: d.uf },
          });
        }
      }
    } catch {
      // sem fixtures: responde vazio
    }
    this.porHash = mapa;
    return mapa;
  }

  async extract(jpeg: Buffer, pedir: Array<keyof CamposLidos>, signal: AbortSignal): Promise<{ campos: Partial<CamposLidos>; uso: UsoLlm }> {
    this.chamadas += 1;
    this.ultimoPedido = [...pedir];
    if (this.atrasoMs > 0) await new Promise((r) => setTimeout(r, this.atrasoMs));
    if (signal.aborted) throw new ExtracaoIndisponivel('abortada');
    if (this.falha) throw this.falha;
    const bruto = this.resposta ? await this.resposta(jpeg, [...pedir]) : this.fixtures().get(sha256(jpeg)) ?? {};
    const campos: Partial<CamposLidos> = {};
    for (const n of pedir) {
      const c = bruto[n];
      campos[n] = posValidar(n, { valor: c?.valor ?? null, duvida: c?.duvida ?? false, motivo: c?.motivo });
    }
    return { campos, uso: { inputTokens: 0, outputTokens: 0 } };
  }
}

// ——— Factory ——————————————————————————————————————————————————————

/** `CAPTURA_AI_PROVIDER`: `fake` → `FakeLabelExtractor`; qualquer outro (padrão `google`) → Gemini. */
export function criarLabelExtractor(env: NodeJS.ProcessEnv = process.env): LabelExtractor {
  const provedor = (env.CAPTURA_AI_PROVIDER ?? 'google').trim().toLowerCase();
  if (provedor === 'fake') return new FakeLabelExtractor();
  return new GeminiLabelExtractor({ apiKey: env.CAPTURA_AI_API_KEY, modelId: env.CAPTURA_AI_MODEL || undefined });
}
