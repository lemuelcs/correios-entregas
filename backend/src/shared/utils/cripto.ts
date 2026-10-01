/**
 * Cifra simétrica dos segredos dos canais (AES-256-GCM).
 *
 * A chave vem de ENTREGAS_CRYPTO_KEY e é aceita em três formas:
 * - 64 caracteres hexadecimais (32 bytes);
 * - base64 que decodifica em exatamente 32 bytes (ex.: `openssl rand -base64 32`);
 * - texto com pelo menos 32 bytes, derivado para 32 bytes por SHA-256.
 *
 * Formato do texto cifrado: `v1:<iv>:<tag>:<dados>`, cada parte em base64.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type CodigoCriptoErro = 'chave' | 'formato' | 'integridade';

export class CriptoErro extends Error {
  readonly codigo: CodigoCriptoErro;

  constructor(codigo: CodigoCriptoErro, mensagem?: string) {
    super(mensagem ?? codigo);
    this.name = 'CriptoErro';
    this.codigo = codigo;
  }
}

const ALGORITMO = 'aes-256-gcm';
const VERSAO = 'v1';
const TAMANHO_IV = 12;
const TAMANHO_CHAVE = 32;

export function carregarChave(env: NodeJS.ProcessEnv = process.env): Buffer {
  const valor = env.ENTREGAS_CRYPTO_KEY?.trim();
  if (!valor) {
    throw new CriptoErro('chave', 'ENTREGAS_CRYPTO_KEY ausente');
  }

  if (/^[0-9a-f]{64}$/i.test(valor)) {
    return Buffer.from(valor, 'hex');
  }

  if (/^[A-Za-z0-9+/]{43}=$/.test(valor)) {
    const decodificada = Buffer.from(valor, 'base64');
    if (decodificada.length === TAMANHO_CHAVE) return decodificada;
  }

  const bytes = Buffer.from(valor, 'utf8');
  if (bytes.length < TAMANHO_CHAVE) {
    throw new CriptoErro('chave', `ENTREGAS_CRYPTO_KEY precisa de pelo menos ${TAMANHO_CHAVE} bytes`);
  }
  return createHash('sha256').update(bytes).digest();
}

let chavePadrao: Buffer | null = null;

function chaveOuPadrao(chave?: Buffer): Buffer {
  if (chave) return chave;
  chavePadrao ??= carregarChave();
  return chavePadrao;
}

/** Só para testes: esquece a chave em cache (ex.: após trocar ENTREGAS_CRYPTO_KEY). */
export function redefinirChaveEmCache(): void {
  chavePadrao = null;
}

export function cifrar(texto: string, chave?: Buffer): string {
  const k = chaveOuPadrao(chave);
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, k, iv);
  const dados = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSAO, iv.toString('base64'), tag.toString('base64'), dados.toString('base64')].join(':');
}

export function decifrar(cifrado: string, chave?: Buffer): string {
  const partes = cifrado.split(':');
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new CriptoErro('formato');
  }
  const [, ivB64, tagB64, dadosB64] = partes;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const dados = Buffer.from(dadosB64, 'base64');
  if (iv.length !== TAMANHO_IV || tag.length !== 16) {
    throw new CriptoErro('formato');
  }

  const k = chaveOuPadrao(chave);
  try {
    const decipher = createDecipheriv(ALGORITMO, k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(dados), decipher.final()]).toString('utf8');
  } catch {
    throw new CriptoErro('integridade');
  }
}
