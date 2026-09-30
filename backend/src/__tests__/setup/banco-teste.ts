/**
 * Trava do banco de testes. Os testes de integração apagam e recriam o schema;
 * por isso só rodam contra um banco cujo nome termine em `_test`, vindo de
 * TEST_DATABASE_URL (nunca de DATABASE_URL, que aponta para o banco de dev).
 */

export interface BancoTeste {
  url: string;
  banco: string;
  schema: string;
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

export function resolverBancoTeste(url: string | undefined): BancoTeste {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL não definida. Os testes de integração exigem um banco dedicado ' +
        '(ex.: postgresql://usuario:senha@127.0.0.1:5432/correiosentregas_test).',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL inválida.');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error('TEST_DATABASE_URL precisa ser uma URL postgresql://.');
  }

  const banco = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!banco.endsWith('_test')) {
    throw new Error(
      `Recusado: o banco "${banco || '(vazio)'}" não termina em "_test". ` +
        'Os testes de integração apagam dados e só rodam num banco dedicado.',
    );
  }

  const schema = parsed.searchParams.get('schema') ?? 'public';
  if (!IDENTIFICADOR.test(schema)) {
    throw new Error(`Schema inválido em TEST_DATABASE_URL: "${schema}".`);
  }

  return { url, banco, schema };
}

/** Mesma URL, com outro schema (usado para aplicar as migrations num schema vazio). */
export function urlComSchema(url: string, schema: string): string {
  if (!IDENTIFICADOR.test(schema)) throw new Error(`Schema inválido: "${schema}".`);
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
}
